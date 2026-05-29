const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function firstText(member, keys) {
  for (const key of keys) {
    const value = member[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function isTruthyAccessValue(value) {
  return value === true || value === 1 || value === -1 || value === 'True' || value === 'true' || value === '1' || value === '-1';
}

function normalizeMembers(rawMembers) {
  if (Array.isArray(rawMembers)) return rawMembers.filter(Boolean);
  if (rawMembers && typeof rawMembers === 'object') return Object.values(rawMembers).filter(Boolean);
  return [];
}

function getSourceKey(member) {
  if (member.sourceKey) return asText(member.sourceKey);
  if (member.source === 'mdb' && member.mdbReceiveMemberId !== undefined && member.mdbReceiveMemberId !== null) {
    return `mdb:receive-member:${member.mdbReceiveMemberId}`;
  }
  return null;
}

function extractFields(member) {
  return {
    source: firstText(member, ['source']) || 'manual',
    sourceKey: getSourceKey(member),
    name: firstText(member, ['name', '동참자', '대주', '이름']),
    phone: firstText(member, ['phone', '휴대폰', '전화번호', '연락처']),
    locationName: firstText(member, ['위치명', '인등위치']),
    lastPaymentMonth: firstText(member, ['최종납부월', '납부만료월']),
    updatedAt: firstText(member, ['mdbUpdatedAt', 'updatedAt']) || new Date().toISOString(),
  };
}

function createMemberRepository(userDataPath) {
  fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, 'members.db');
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL DEFAULT 'manual',
      source_key TEXT UNIQUE,
      data_json TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      location_name TEXT,
      last_payment_month TEXT,
      updated_at TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mdb_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      type TEXT NOT NULL,
      source_key TEXT,
      name TEXT,
      details_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_members_source ON members(source);
    CREATE INDEX IF NOT EXISTS idx_members_deleted ON members(deleted);
    CREATE INDEX IF NOT EXISTS idx_members_location ON members(location_name);
    CREATE INDEX IF NOT EXISTS idx_members_last_payment ON members(last_payment_month);
    CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
    CREATE INDEX IF NOT EXISTS idx_members_updated ON members(updated_at);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp ON mdb_sync_logs(timestamp);
  `);

  const insertMember = db.prepare(`
    INSERT INTO members (id, source, source_key, data_json, name, phone, location_name, last_payment_month, updated_at, deleted, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);

  const insertMemberAuto = db.prepare(`
    INSERT INTO members (source, source_key, data_json, name, phone, location_name, last_payment_month, updated_at, deleted, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);

  const upsertBySourceKey = db.prepare(`
    INSERT INTO members (source, source_key, data_json, name, phone, location_name, last_payment_month, updated_at, deleted, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(source_key) DO UPDATE SET
      data_json = excluded.data_json,
      name = excluded.name,
      phone = excluded.phone,
      location_name = excluded.location_name,
      last_payment_month = excluded.last_payment_month,
      updated_at = excluded.updated_at,
      deleted = 0,
      synced_at = CURRENT_TIMESTAMP
  `);

  const updateById = db.prepare(`
    UPDATE members
    SET source = ?, source_key = ?, data_json = ?, name = ?, phone = ?, location_name = ?, last_payment_month = ?, updated_at = ?, deleted = 0, synced_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const deleteById = db.prepare('DELETE FROM members WHERE id = ?');
  const deleteMdbBySourceKey = db.prepare('DELETE FROM members WHERE source_key = ?');
  const deleteAllMembers = db.prepare('DELETE FROM members');
  const deleteMdbMembers = db.prepare("DELETE FROM members WHERE source = 'mdb'");
  const loadAllRows = db.prepare('SELECT id, data_json FROM members WHERE deleted = 0 ORDER BY id DESC');
  const countRows = db.prepare('SELECT COUNT(*) AS count FROM members WHERE deleted = 0');
  const maxIdRow = db.prepare('SELECT COALESCE(MAX(id), 0) AS maxId FROM members');
  const findById = db.prepare('SELECT id, data_json FROM members WHERE id = ? AND deleted = 0');
  const getMetaStmt = db.prepare('SELECT value FROM sync_meta WHERE key = ?');
  const setMetaStmt = db.prepare(`
    INSERT INTO sync_meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const insertSyncLog = db.prepare(`
    INSERT INTO mdb_sync_logs (type, source_key, name, details_json)
    VALUES (?, ?, ?, ?)
  `);
  const cleanupSyncLogs = db.prepare(`
    DELETE FROM mdb_sync_logs WHERE timestamp < datetime('now', '-30 days')
  `);
  const getExistingData = db.prepare('SELECT data_json FROM members WHERE source = ? AND source_key = ?');

  function withTransaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  function toStoredMember(member, id) {
    return { ...member, index: Number(id) };
  }

  function saveAuto(member) {
    const fields = extractFields(member);
    const dataJson = JSON.stringify({ ...member, source: fields.source });
    const result = insertMemberAuto.run(
      fields.source,
      fields.sourceKey,
      dataJson,
      fields.name,
      fields.phone,
      fields.locationName,
      fields.lastPaymentMonth,
      fields.updatedAt,
    );
    return Number(result.lastInsertRowid);
  }

  function saveWithId(id, member) {
    const fields = extractFields(member);
    const dataJson = JSON.stringify({ ...member, source: fields.source, index: Number(id) });
    insertMember.run(
      Number(id),
      fields.source,
      fields.sourceKey,
      dataJson,
      fields.name,
      fields.phone,
      fields.locationName,
      fields.lastPaymentMonth,
      fields.updatedAt,
    );
    return Number(id);
  }

  function updateExisting(id, member) {
    const fields = extractFields(member);
    const dataJson = JSON.stringify({ ...member, source: fields.source, index: Number(id) });
    updateById.run(
      fields.source,
      fields.sourceKey,
      dataJson,
      fields.name,
      fields.phone,
      fields.locationName,
      fields.lastPaymentMonth,
      fields.updatedAt,
      Number(id),
    );
    return Number(id);
  }

  function findDuplicateMemberId(member) {
    const newId = firstText(member, ['신도번호']);
    const newDaeju = firstText(member, ['대주']);
    const newDongchamja = firstText(member, ['동참자']);
    if (!newId) return null;

    const rows = loadAllRows.all();
    for (const row of rows) {
      const existing = JSON.parse(row.data_json);
      const existingId = firstText(existing, ['신도번호']);
      const existingDaeju = firstText(existing, ['대주']);
      const existingDongchamja = firstText(existing, ['동참자']);
      if (existingId === newId && existingDaeju === newDaeju && existingDongchamja === newDongchamja) {
        return Number(row.id);
      }
    }
    return null;
  }

  return {
    dbPath,

    close() {
      db.close();
    },

    count() {
      return Number(countRows.get().count || 0);
    },

    getLastIndex() {
      return Number(maxIdRow.get().maxId || 0);
    },

    loadAll() {
      return loadAllRows.all().map((row) => toStoredMember(JSON.parse(row.data_json), row.id));
    },

    getMembersPage(options = {}) {
      const { page = 1, limit = 50, location = '전체', statusFilter = '전체', search = '', sortKey = '인등번호', sortDir = 'desc', warningDays = 30, criticalDays = 14 } = options;
      
      let whereClause = 'WHERE deleted = 0';
      const params = [];
      
      if (location !== '전체') {
        if (location === '미지정') {
          whereClause += " AND (location_name = '미지정' OR location_name IS NULL OR TRIM(location_name) = '')";
        } else {
          whereClause += ' AND location_name = ?';
          params.push(location);
        }
      }
      
      if (search) {
        whereClause += ' AND (name LIKE ? OR phone LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      
      if (statusFilter !== '전체') {
        // Need to calculate days difference from last_payment_month
        const nowStr = new Date().toISOString().substring(0, 7); // e.g. "2024-05"
        // Since sqlite dates are tricky without full timestamps, it's easier to filter in memory 
        // OR we just use basic string comparison for 'expired', 'warning' etc. 
        // For accurate pagination, we should build the SQL properly.
        // Actually, last_payment_month is just 'YYYY-MM'. We can use strftime on it.
        // Let's implement a simplified date check in sqlite for the filter:
        if (statusFilter === '사용중') {
          whereClause += " AND (last_payment_month IS NULL OR last_payment_month = '' OR date(last_payment_month || '-01', '+1 month', '-1 day') >= date('now'))";
        } else if (statusFilter === '종료') {
          whereClause += " AND last_payment_month != '' AND date(last_payment_month || '-01', '+1 month', '-1 day') < date('now')";
        } else if (statusFilter === '한달전') {
          whereClause += " AND last_payment_month != '' AND date(last_payment_month || '-01', '+1 month', '-1 day') >= date('now') AND date(last_payment_month || '-01', '+1 month', '-1 day') <= date('now', '+" + warningDays + " days')";
        } else if (statusFilter === '2주전') {
          whereClause += " AND last_payment_month != '' AND date(last_payment_month || '-01', '+1 month', '-1 day') >= date('now') AND date(last_payment_month || '-01', '+1 month', '-1 day') <= date('now', '+" + criticalDays + " days')";
        }
      }

      // We cannot easily sort by arbitrary JSON keys dynamically in simple SQLite without JSON1 extension.
      // Assuming 'data_json' is valid JSON and SQLite version supports json_extract (SQLite 3.38+ supports -> operator, older JSON1 uses json_extract).
      // Let's use json_extract:
      const orderBy = `ORDER BY json_extract(data_json, '$.' || ?) ${sortDir === 'asc' ? 'ASC' : 'DESC'}, id DESC`;
      const sqlParams = [...params, sortKey, limit, (page - 1) * limit];
      
      const countSql = `SELECT COUNT(*) as count FROM members ${whereClause}`;
      const totalCount = Number(db.prepare(countSql).get(...params).count || 0);
      
      const dataSql = `SELECT id, data_json FROM members ${whereClause} ${orderBy} LIMIT ? OFFSET ?`;
      const rows = db.prepare(dataSql).all(...sqlParams);
      
      return {
        members: rows.map(row => toStoredMember(JSON.parse(row.data_json), row.id)),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      };
    },

    getLocationStats({ warningDays = 30, criticalDays = 14 } = {}) {
      // Aggregate stats per location
      const sql = `
        SELECT 
          COALESCE(NULLIF(TRIM(location_name), ''), '미지정') as location,
          COUNT(*) as total,
          SUM(CASE WHEN last_payment_month IS NULL OR last_payment_month = '' OR date(last_payment_month || '-01', '+1 month', '-1 day') >= date('now') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN last_payment_month != '' AND date(last_payment_month || '-01', '+1 month', '-1 day') < date('now') THEN 1 ELSE 0 END) as expired,
          SUM(CASE WHEN last_payment_month != '' AND date(last_payment_month || '-01', '+1 month', '-1 day') >= date('now') AND date(last_payment_month || '-01', '+1 month', '-1 day') <= date('now', '+" + warningDays + " days') THEN 1 ELSE 0 END) as oneMonth,
          SUM(CASE WHEN last_payment_month != '' AND date(last_payment_month || '-01', '+1 month', '-1 day') >= date('now') AND date(last_payment_month || '-01', '+1 month', '-1 day') <= date('now', '+" + criticalDays + " days') THEN 1 ELSE 0 END) as twoWeeks
        FROM members
        WHERE deleted = 0
        GROUP BY COALESCE(NULLIF(TRIM(location_name), ''), '미지정')
      `;
      const rows = db.prepare(sql).all();
      const stats = {};
      let allTotal = 0, allActive = 0, allExpired = 0, allOneMonth = 0, allTwoWeeks = 0;
      for (const row of rows) {
        stats[row.location] = { total: row.total, active: row.active, expired: row.expired, oneMonth: row.oneMonth, twoWeeks: row.twoWeeks };
        allTotal += row.total; allActive += row.active; allExpired += row.expired; allOneMonth += row.oneMonth; allTwoWeeks += row.twoWeeks;
      }
      stats['전체'] = { total: allTotal, active: allActive, expired: allExpired, oneMonth: allOneMonth, twoWeeks: allTwoWeeks };
      return stats;
    },

    getMdbSyncLogs(options = {}) {
      const { page = 1, limit = 20, type } = options;
      const hasType = type && type !== 'all';
      const countSql = hasType
        ? `SELECT COUNT(*) as count FROM mdb_sync_logs WHERE type = ?`
        : `SELECT COUNT(*) as count FROM mdb_sync_logs`;
      const totalCount = Number(
        (hasType ? db.prepare(countSql).get(type) : db.prepare(countSql).get()).count || 0
      );
      const dataSql = hasType
        ? `SELECT * FROM mdb_sync_logs WHERE type = ? ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`
        : `SELECT * FROM mdb_sync_logs ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`;
      const rows = hasType
        ? db.prepare(dataSql).all(type, limit, (page - 1) * limit)
        : db.prepare(dataSql).all(limit, (page - 1) * limit);
      return {
        logs: rows.map(r => ({ ...r, details: r.details_json ? JSON.parse(r.details_json) : null })),
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        currentPage: page
      };
    },

    clearMdbSyncLogs() {
      db.prepare('DELETE FROM mdb_sync_logs').run();
      return true;
    },

    addMembers(members, mode = 'append') {
      return withTransaction(() => {
        if (mode === 'overwrite') {
          deleteAllMembers.run();
        }

        for (const member of members) {
          if (!member) continue;
          const duplicateId = mode === 'append' ? findDuplicateMemberId(member) : null;
          if (duplicateId) {
            const existing = findById.get(duplicateId);
            const existingMember = existing ? JSON.parse(existing.data_json) : {};
            updateExisting(duplicateId, { ...existingMember, ...member, index: duplicateId });
          } else {
            saveAuto({ ...member, source: member.source || 'excel' });
          }
        }

        return this.loadAll();
      });
    },

    deleteMembers(items) {
      return withTransaction(() => {
        for (const item of items) {
          const id = typeof item === 'object' && item !== null ? item.index : item;
          if (id !== undefined && id !== null) deleteById.run(Number(id));
        }
        return this.loadAll();
      });
    },

    upsertMdbRows(rows, { fullSync = false } = {}) {
      return withTransaction(() => {
        if (fullSync) deleteMdbMembers.run();

        // Run log cleanup periodically (e.g. at the start of a sync chunk)
        try { cleanupSyncLogs.run(); } catch {}

        for (const row of rows) {
          if (!row) continue;
          const sourceKey = getSourceKey(row);
          if (!sourceKey) continue;

          if (isTruthyAccessValue(row.mdbDeleted)) {
            if (!fullSync) {
              const existingRow = getExistingData.get('mdb', sourceKey);
              if (existingRow) {
                const existing = JSON.parse(existingRow.data_json);
                insertSyncLog.run('delete', sourceKey, existing.name || firstText(existing, ['성명', '이름']), JSON.stringify(existing));
              }
            }
            deleteMdbBySourceKey.run(sourceKey);
            continue;
          }

          const fields = extractFields({ ...row, source: 'mdb' });
          const dataJson = JSON.stringify({ ...row, source: 'mdb', sourceKey });

          if (!fullSync) {
            const existingRow = getExistingData.get('mdb', sourceKey);
            if (!existingRow) {
              insertSyncLog.run('new', sourceKey, fields.name, dataJson);
            } else {
              const existing = JSON.parse(existingRow.data_json);
              const changes = {};
              let hasChanges = false;
              for (const k of Object.keys(row)) {
                if (existing[k] !== row[k] && k !== 'mdbReceiveMemberId' && k !== 'source' && k !== 'sourceKey') {
                  changes[k] = { old: existing[k], new: row[k] };
                  hasChanges = true;
                }
              }
              if (hasChanges) {
                insertSyncLog.run('update', sourceKey, fields.name, JSON.stringify(changes));
              }
            }
          }

          upsertBySourceKey.run(
            'mdb',
            sourceKey,
            dataJson,
            fields.name,
            fields.phone,
            fields.locationName,
            fields.lastPaymentMonth,
            fields.updatedAt,
          );
        }

        return Number(db.prepare("SELECT COUNT(*) AS count FROM members WHERE source = 'mdb' AND deleted = 0").get().count || 0);
      });
    },

    migrateFromStore(store) {
      if (this.count() > 0) return { migrated: false, count: this.count() };
      const legacyMembers = normalizeMembers(store.get('members') || {});
      if (legacyMembers.length === 0) return { migrated: false, count: 0 };

      return withTransaction(() => {
        for (const member of legacyMembers) {
          const id = Number(member.index || 0);
          if (id > 0) {
            try {
              saveWithId(id, { ...member, source: member.source || 'legacy' });
            } catch {
              saveAuto({ ...member, source: member.source || 'legacy' });
            }
          } else {
            saveAuto({ ...member, source: member.source || 'legacy' });
          }
        }
        return { migrated: true, count: legacyMembers.length };
      });
    },

    getMeta(key) {
      const row = getMetaStmt.get(key);
      return row ? row.value : null;
    },

    setMeta(key, value) {
      setMetaStmt.run(key, String(value));
    },
  };
}

module.exports = createMemberRepository;
