const { BrowserWindow, dialog } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  filePath: '',
  password: '',
  keyword: '',
  enabled: false,
  pollIntervalSeconds: 10,
  updateScanIntervalSeconds: 300,
};

const MAX_SYNC_ROWS = 500000;
const SYNC_DEBOUNCE_MS = 2500;

function toPlainConfig(config = {}, includePassword = false) {
  return {
    filePath: config.filePath || '',
    keyword: config.keyword || DEFAULT_CONFIG.keyword,
    enabled: Boolean(config.enabled),
    pollIntervalSeconds: Number(config.pollIntervalSeconds || DEFAULT_CONFIG.pollIntervalSeconds),
    updateScanIntervalSeconds: Number(config.updateScanIntervalSeconds || DEFAULT_CONFIG.updateScanIntervalSeconds),
    hasPassword: Boolean(config.password),
    ...(includePassword ? { password: config.password || '' } : {}),
  };
}

function normalizeSeconds(value, fallback, min) {
  const seconds = Number(value || fallback);
  if (!Number.isFinite(seconds)) return fallback;
  return Math.max(min, seconds);
}

function escapePowerShellString(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function getPowerShell32Path() {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const sysWow64Path = path.join(systemRoot, 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const system32Path = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (fs.existsSync(sysWow64Path)) return sysWow64Path;
  return system32Path;
}

function decodeOutput(buffer) {
  return Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
}

function runPowerShell(script, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFile(
      getPowerShell32Path(),
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      {
        encoding: 'buffer',
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 1024,
        timeout: timeoutMs,
      },
      (error, stdoutBuffer, stderrBuffer) => {
        const stdout = decodeOutput(stdoutBuffer).trim();
        const stderr = decodeOutput(stderrBuffer).trim();
        if (error) {
          const err = new Error(stderr || stdout || error.message);
          err.cause = error;
          reject(err);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function getMdbReaderPath() {
  return path.join(__dirname, '..', 'helpers', 'MdbReader.exe');
}

function runMdbReader(args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(
      getMdbReaderPath(),
      args,
      {
        encoding: 'buffer',
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 1024,
        timeout: timeoutMs,
      },
      (error, stdoutBuffer, stderrBuffer) => {
        const stdout = decodeOutput(stdoutBuffer).trim();
        const stderr = decodeOutput(stderrBuffer).trim();
        if (error && !stdout) {
          const err = new Error(stderr || error.message);
          err.cause = error;
          reject(err);
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          const err = new Error(stderr || stdout || parseError.message);
          err.cause = parseError;
          reject(err);
        }
      },
    );
  });
}

function hasMdbReader() {
  return fs.existsSync(getMdbReaderPath());
}

function extractJsonOutput(stdout) {
  const marker = '__MDB_JSON__';
  const index = stdout.lastIndexOf(marker);
  if (index === -1) {
    throw new Error(stdout || 'MDB helper did not return JSON.');
  }
  return stdout.slice(index + marker.length).trim();
}

function buildPreamble(config) {
  return `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$path = '${escapePowerShellString(config.filePath)}'
$password = '${escapePowerShellString(config.password || '')}'
function Write-JsonResult($value) {
  Write-Output ('__MDB_JSON__' + ($value | ConvertTo-Json -Depth 8 -Compress))
}
function Open-MdbConnection {
  $conn = New-Object -ComObject ADODB.Connection
  $conn.Open("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$path;Jet OLEDB:Database Password=$password;")
  return $conn
}
function DbValue($recordset, $name) {
  $value = $recordset.Fields.Item($name).Value
  if ($null -eq $value -or [System.DBNull]::Value.Equals($value)) { return '' }
  return $value
}
function StringValue($recordset, $name) {
  $value = DbValue $recordset $name
  if ($null -eq $value) { return '' }
  return [string]$value
}
function IntValue($recordset, $name) {
  $value = DbValue $recordset $name
  if ($null -eq $value -or [string]$value -eq '') { return 0 }
  try { return [int]$value } catch { return 0 }
}
function BoolLabel($value) {
  if ($value -eq $true -or $value -eq -1 -or $value -eq 1 -or [string]$value -eq 'True') { return 'O' }
  return 'X'
}
function SmsLabel($value) {
  if ($value -eq $true -or $value -eq -1 -or $value -eq 1 -or [string]$value -eq 'True') { return '수신동의' }
  return '미동의'
}
function DateLabel($value) {
  if ($null -eq $value -or [System.DBNull]::Value.Equals($value) -or [string]$value -eq '') { return '' }
  if ($value -is [datetime]) { return $value.ToString('yyyy-MM-dd') }
  return [string]$value
}
function MonthLabel($value) {
  if ($null -eq $value -or [System.DBNull]::Value.Equals($value) -or [string]$value -eq '') { return '' }
  $num = [int]$value
  if ($num -le 0) { return '' }
  $year = [math]::Floor($num / 100)
  $month = $num % 100
  return ('{0:0000}-{1:00}' -f $year, $month)
}
function AddressLabel($city, $gu, $dong, $bunji) {
  return (@($city, $gu, $dong, $bunji) | Where-Object { $_ -and [string]$_ -ne '' }) -join ' '
}
`;
}



function formatAccessDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function testConnection(config) {
  if (hasMdbReader()) {
    return runMdbReader([
      'test',
      `--path=${config.filePath}`,
      `--password=${config.password || ''}`,
    ], 60000);
  }

  const script = `
${buildPreamble(config)}
$conn = $null
try {
  $conn = Open-MdbConnection
  $rsTables = $conn.OpenSchema(20)
  $tableCount = 0
  while (-not $rsTables.EOF) {
    if ($rsTables.Fields.Item('TABLE_TYPE').Value -eq 'TABLE') { $tableCount++ }
    $rsTables.MoveNext()
  }
  $rsTables.Close()
  $memberCount = 0
  try {
    $rsMember = $conn.Execute('SELECT COUNT(*) AS C FROM [Member]')
    $memberCount = [int]$rsMember.Fields.Item('C').Value
    $rsMember.Close()
  } catch {}
  Write-JsonResult @{ ok = $true; tableCount = $tableCount; memberCount = $memberCount; driver = 'Microsoft.Jet.OLEDB.4.0 (32-bit)' }
} catch {
  Write-JsonResult @{ ok = $false; error = $_.Exception.Message }
  exit 0
} finally {
  if ($conn -and $conn.State -eq 1) { $conn.Close() }
}
`;
  const output = await runPowerShell(script, 60000);
  return JSON.parse(extractJsonOutput(output));
}

async function readMdbRows(config, options = {}) {
  const since = options.since ? formatAccessDate(options.since) : '';
  const afterReceiveMemberId = Math.max(0, Math.trunc(Number(options.afterReceiveMemberId || 0)));
  if (hasMdbReader()) {
    const args = [
      'sync',
      `--path=${config.filePath}`,
      `--password=${config.password || ''}`,
      `--maxRows=${MAX_SYNC_ROWS}`,
    ];
    if (since) args.push(`--since=${since}`);
    if (afterReceiveMemberId > 0) args.push(`--afterReceiveMemberId=${afterReceiveMemberId}`);
    return runMdbReader(args, 300000);
  }

  const script = `
${buildPreamble(config)}
$since = '${escapePowerShellString(since)}'
$afterReceiveMemberId = ${afterReceiveMemberId}
$where = "1=1"
if ($afterReceiveMemberId -gt 0) {
  $where = "($where) AND rm.ReceiveMemberID > $afterReceiveMemberId"
}
if ($since) {
  $where = "($where) AND (rm.Updatedt >= #$since# OR rm.Createdt >= #$since# OR r.Updatedt >= #$since# OR r.Createdt >= #$since# OR m.UpdateDt >= #$since# OR m.CreateDt >= #$since# OR fi.UpdateDt >= #$since# OR fi.CreateDt >= #$since#)"
}
$conn = $null
try {
  $conn = Open-MdbConnection
  $countSql = "SELECT COUNT(*) AS C FROM ((([ReceiveMember] rm LEFT JOIN [Receive] r ON rm.ReceiveID = r.ReceiveID) LEFT JOIN [Member] m ON rm.MemberID = m.MemberID) LEFT JOIN [FamilyInfo] fi ON r.FamilyInfoID = fi.FamilyInfoID) WHERE $where"
  $rsCount = $conn.Execute($countSql)
  $total = [int]$rsCount.Fields.Item('C').Value
  $rsCount.Close()

  if ($total -gt ${MAX_SYNC_ROWS}) {
    Write-JsonResult @{ ok = $false; tooManyRows = $true; total = $total; maxRows = ${MAX_SYNC_ROWS} }
    exit 0
  }

  $sql = @"
SELECT
  rm.ReceiveMemberID,
  rm.ReceiveID,
  rm.MemberID,
  rm.LocID,
  rm.LocCategory,
  rm.LocLocation,
  rm.LocNum,
  rm.GrpNum,
  rm.RowIndex,
  rm.MemberName AS RmMemberName,
  rm.IsYoungga,
  rm.Ganji,
  rm.Relation,
  rm.Comment AS RmComment,
  rm.Createdt AS RmCreatedt,
  rm.Updatedt AS RmUpdatedt,
  r.ReceiveName,
  r.Category,
  r.SubCategory,
  r.Createdt AS ReceiveCreatedt,
  r.Updatedt AS ReceiveUpdatedt,
  r.Startdt,
  r.Enddt,
  r.Comment AS ReceiveComment,
  r.Deleted AS ReceiveDeleted,
  m.MemberNo,
  m.MemberNumber,
  m.MemberName,
  m.BuddhistName,
  m.Gender,
  m.BirthDate,
  m.BirthLunar,
  m.MobilePhone,
  m.IsSms,
  m.Deleted AS MemberDeleted,
  m.UpdateDt AS MemberUpdatedt,
  fi.FamilyNumber,
  fi.FamilyHolderName,
  fi.FamilyPhone,
  fi.FamilyAddrZip,
  fi.FamilyAddrCity,
  fi.FamilyAddrGu,
  fi.FamilyAddrDong,
  fi.FamilyAddrBunji
FROM ((( [ReceiveMember] rm
  LEFT JOIN [Receive] r ON rm.ReceiveID = r.ReceiveID)
  LEFT JOIN [Member] m ON rm.MemberID = m.MemberID)
  LEFT JOIN [FamilyInfo] fi ON r.FamilyInfoID = fi.FamilyInfoID)
WHERE $where
ORDER BY rm.ReceiveMemberID DESC
"@

  $rs = $conn.Execute($sql)
  $rows = New-Object System.Collections.Generic.List[object]
  $receiveIds = @{}
  while (-not $rs.EOF) {
    $receiveId = IntValue $rs 'ReceiveID'
    if ($receiveId -gt 0) { $receiveIds[[string]$receiveId] = $true }
    $locCategory = StringValue $rs 'LocCategory'
    $locLocation = StringValue $rs 'LocLocation'
    $receiveName = StringValue $rs 'ReceiveName'
    $category = StringValue $rs 'Category'
    $subCategory = StringValue $rs 'SubCategory'
    $locationName = (@($locCategory, $locLocation, $receiveName, $category, $subCategory) | Where-Object { $_ -and [string]$_ -ne '' } | Select-Object -First 1)
    $memberName = StringValue $rs 'MemberName'
    if (-not $memberName) { $memberName = StringValue $rs 'RmMemberName' }
    $familyHolder = StringValue $rs 'FamilyHolderName'
    if (-not $familyHolder) { $familyHolder = $memberName }
    $phone = StringValue $rs 'MobilePhone'
    if (-not $phone) { $phone = StringValue $rs 'FamilyPhone' }
    $updatedCandidates = @((DbValue $rs 'RmUpdatedt'), (DbValue $rs 'ReceiveUpdatedt'), (DbValue $rs 'MemberUpdatedt')) | Where-Object { $_ -and -not [System.DBNull]::Value.Equals($_) }
    $updatedAt = ''
    if ($updatedCandidates.Count -gt 0) { $updatedAt = ([datetime]($updatedCandidates | Sort-Object -Descending | Select-Object -First 1)).ToString('o') }
    $deleted = ((DbValue $rs 'ReceiveDeleted') -eq $true -or (DbValue $rs 'ReceiveDeleted') -eq -1 -or (DbValue $rs 'MemberDeleted') -eq $true -or (DbValue $rs 'MemberDeleted') -eq -1)

    $row = [ordered]@{
      source = 'mdb'
      mdbReceiveMemberId = IntValue $rs 'ReceiveMemberID'
      mdbReceiveId = $receiveId
      mdbMemberId = IntValue $rs 'MemberID'
      mdbLocId = IntValue $rs 'LocID'
      mdbUpdatedAt = $updatedAt
      mdbDeleted = [bool]$deleted
      name = $memberName
      phone = $phone
      status = '활동'
      '인등번호' = if ((StringValue $rs 'LocNum') -and (StringValue $rs 'LocNum') -ne '0') { StringValue $rs 'LocNum' } else { StringValue $rs 'ReceiveMemberID' }
      '위치명' = $locationName
      '등록일' = if (StringValue $rs 'Startdt') { StringValue $rs 'Startdt' } else { DateLabel (DbValue $rs 'ReceiveCreatedt') }
      '신도번호' = if ((StringValue $rs 'MemberNumber')) { StringValue $rs 'MemberNumber' } elseif ((StringValue $rs 'MemberNo') -and (StringValue $rs 'MemberNo') -ne '0') { StringValue $rs 'MemberNo' } else { StringValue $rs 'MemberID' }
      '대주' = $familyHolder
      '영가여부' = BoolLabel (DbValue $rs 'IsYoungga')
      '동참자' = $memberName
      '법명' = StringValue $rs 'BuddhistName'
      '성별' = StringValue $rs 'Gender'
      '접수비고' = if (StringValue $rs 'RmComment') { StringValue $rs 'RmComment' } else { StringValue $rs 'ReceiveComment' }
      '간지' = StringValue $rs 'Ganji'
      '음력' = BoolLabel (DbValue $rs 'BirthLunar')
      '생일' = StringValue $rs 'BirthDate'
      '휴대폰' = $phone
      'DM' = SmsLabel (DbValue $rs 'IsSms')
      '우편번호' = StringValue $rs 'FamilyAddrZip'
      '주소' = AddressLabel (StringValue $rs 'FamilyAddrCity') (StringValue $rs 'FamilyAddrGu') (StringValue $rs 'FamilyAddrDong') (StringValue $rs 'FamilyAddrBunji')
      '주소(동)' = StringValue $rs 'FamilyAddrDong'
      '주소(번지)' = StringValue $rs 'FamilyAddrBunji'
      '가족순서' = if (StringValue $rs 'RowIndex') { StringValue $rs 'RowIndex' } else { StringValue $rs 'GrpNum' }
      '최종납부월' = ''
      '접수명' = $receiveName
      '분류' = $category
      '세부분류' = $subCategory
    }
    $rows.Add([pscustomobject]$row)
    $rs.MoveNext()
  }
  $rs.Close()

  $paymentByReceiveId = @{}
  $receiveIdArray = @($receiveIds.Keys | ForEach-Object { [int]$_ })
  for ($offset = 0; $offset -lt $receiveIdArray.Count; $offset += 500) {
    $end = [Math]::Min($offset + 499, $receiveIdArray.Count - 1)
    $chunk = $receiveIdArray[$offset..$end]
    if ($chunk.Count -eq 0) { continue }
    $inList = ($chunk | ForEach-Object { [string]$_ }) -join ','
    $paySql = "SELECT ReceiveID, MAX(ReceiveYr * 100 + ReceiveMon) AS LastYm FROM [ReceiveCollectMonth] WHERE ReceiveID IN ($inList) GROUP BY ReceiveID"
    $payRs = $conn.Execute($paySql)
    while (-not $payRs.EOF) {
      $paymentByReceiveId[[string]$payRs.Fields.Item('ReceiveID').Value] = MonthLabel $payRs.Fields.Item('LastYm').Value
      $payRs.MoveNext()
    }
    $payRs.Close()
  }

  foreach ($row in $rows) {
    $receiveKey = [string]$row.mdbReceiveId
    if ($paymentByReceiveId.ContainsKey($receiveKey)) {
      $row.'최종납부월' = $paymentByReceiveId[$receiveKey]
    }
  }

  Write-JsonResult @{ ok = $true; total = $total; rows = @($rows.ToArray()); syncedAt = (Get-Date).ToString('o') }
} catch {
  Write-JsonResult @{ ok = $false; error = $_.Exception.Message }
  exit 0
} finally {
  if ($conn -and $conn.State -eq 1) { $conn.Close() }
}
`;
  const output = await runPowerShell(script, 300000);
  return JSON.parse(extractJsonOutput(output));
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : (rows ? [rows] : []);
}

function getMaxReceiveMemberId(rows) {
  return normalizeRows(rows).reduce((max, row) => {
    const value = Number(row?.mdbReceiveMemberId || 0);
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
}

function getDateWithGrace(value, graceMs = 2 * 60 * 1000) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() - graceMs);
}

module.exports = function setupMdbService(ipcMain, memberRepository, settingsStore, app) {
  let syncTimer = null;
  let debounceTimer = null;
  let isSyncing = false;
  let lastObservedMtimeMs = 0;
  let lastStatus = {
    state: 'idle',
    message: 'MDB 동기화 대기 중',
    syncedAt: settingsStore.get('mdbSync.lastSyncAt') || '',
    rowCount: settingsStore.get('mdbSync.lastRowCount') || 0,
    error: '',
  };

  const getConfig = (includePassword = false) => {
    const saved = settingsStore.get('mdbSync') || {};
    return toPlainConfig({ ...DEFAULT_CONFIG, ...saved }, includePassword);
  };

  const saveConfig = (nextConfig) => {
    const previous = settingsStore.get('mdbSync') || {};
    const merged = {
      ...DEFAULT_CONFIG,
      ...previous,
      ...nextConfig,
      password: nextConfig.password ? nextConfig.password : previous.password || '',
      pollIntervalSeconds: normalizeSeconds(nextConfig.pollIntervalSeconds || previous.pollIntervalSeconds, DEFAULT_CONFIG.pollIntervalSeconds, 3),
      updateScanIntervalSeconds: normalizeSeconds(
        nextConfig.updateScanIntervalSeconds || previous.updateScanIntervalSeconds,
        DEFAULT_CONFIG.updateScanIntervalSeconds,
        30,
      ),
    };
    settingsStore.set('mdbSync', merged);
    restartPolling();
    return toPlainConfig(merged);
  };

  const emitStatus = (patch) => {
    lastStatus = { ...lastStatus, ...patch };
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('mdb-sync-status', lastStatus);
    });
  };

  const getStoredMaxReceiveMemberId = () => {
    const value = Number(settingsStore.get('mdbSync.maxReceiveMemberId') || 0);
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
  };

  const rememberMaxReceiveMemberId = (rows, { reset = false } = {}) => {
    const rowMax = getMaxReceiveMemberId(rows);
    const nextMax = reset ? rowMax : Math.max(getStoredMaxReceiveMemberId(), rowMax);
    settingsStore.set('mdbSync.maxReceiveMemberId', nextMax);
    return nextMax;
  };

  const getUpdateScanCursor = () => (
    settingsStore.get('mdbSync.lastUpdateScanAt')
    || settingsStore.get('mdbSync.lastFullSyncAt')
    || settingsStore.get('mdbSync.lastSyncAt')
    || ''
  );

  const shouldRunUpdateScan = (config) => {
    const cursor = getUpdateScanCursor();
    if (!cursor) return false;
    const lastScanMs = new Date(cursor).getTime();
    if (Number.isNaN(lastScanMs)) return false;
    const intervalMs = normalizeSeconds(
      config.updateScanIntervalSeconds,
      DEFAULT_CONFIG.updateScanIntervalSeconds,
      30,
    ) * 1000;
    return Date.now() - lastScanMs >= intervalMs;
  };

  const getFailureMessage = (result) => {
    if (result.tooManyRows) {
      return `동기화 대상이 ${result.total.toLocaleString()}건입니다. 너무 많습니다.`;
    }
    if (!result.error) return 'MDB 동기화에 실패했습니다.';
    
    const msg = String(result.error).toLowerCase();
    if (msg.includes('not a valid password')) {
      return '비밀번호가 올바르지 않습니다.';
    }
    if (msg.includes('cannot open any more databases')) {
      return '데이터베이스 파일이 이미 사용 중입니다. 열려있는 파일을 닫아주세요.';
    }
    if (msg.includes('not a valid path') || msg.includes('could not find file')) {
      return 'MDB 파일을 찾을 수 없거나 파일 경로가 잘못되었습니다.';
    }
    if (msg.includes('file already in use') || msg.includes('exclusive')) {
      return '데이터베이스 파일이 다른 프로그램에 의해 잠겨 있습니다. (엑세스 거부됨)';
    }
    if (msg.includes('unrecognized database format')) {
      return '알 수 없는 데이터베이스 형식입니다. 정상적인 MDB 파일인지 확인하세요.';
    }
    return result.error;
  };

  const rememberSyncMeta = ({ syncedAt, rowCount, elapsedMs }) => {
    settingsStore.set('mdbSync.lastSyncAt', syncedAt);
    settingsStore.set('mdbSync.lastRowCount', rowCount);
    settingsStore.set('mdbSync.lastElapsedMs', elapsedMs);
  };

  const syncNow = async ({ reason = 'manual', incremental = false } = {}) => {
    const config = getConfig(true);
    if (!config.filePath) {
      return { ok: false, error: 'MDB 파일을 먼저 선택해 주세요.' };
    }
    if (!fs.existsSync(config.filePath)) {
      return { ok: false, error: '선택한 MDB 파일을 찾을 수 없습니다.' };
    }
    if (isSyncing) {
      return { ok: false, error: '이미 MDB 동기화가 진행 중입니다.' };
    }

    isSyncing = true;
    emitStatus({ state: 'syncing', message: reason === 'auto' ? 'MDB 변경 감지, 동기화 준비 중...' : 'MDB 파일에서 데이터를 읽고 분석하는 중입니다...', error: '' });
    try {
      const startedAt = Date.now();
      const runFullSync = async () => {
        let lastId = 0;
        let totalFetched = 0;
        let totalTarget = 0;
        let mdbRowCount = 0;
        let maxReceiveMemberId = 0;
        let syncedAt = new Date().toISOString();
        let errorMsg = null;
        
        while (true) {
          const result = await readMdbRows(config, { afterReceiveMemberId: lastId, maxRows: 10000 });
          if (!result.ok) {
            errorMsg = getFailureMessage(result);
            break;
          }
          if (totalTarget === 0) totalTarget = result.total || 0;
          
          if (result.rows && result.rows.length > 0) {
            const rows = normalizeRows(result.rows);
            // UPSERT in chunks
            mdbRowCount += memberRepository.upsertMdbRows(rows, { fullSync: totalFetched === 0 });
            maxReceiveMemberId = Math.max(maxReceiveMemberId, rememberMaxReceiveMemberId(rows, { reset: totalFetched === 0 }));
            
            totalFetched += result.rows.length;
            lastId = result.rows.reduce((max, r) => Math.max(max, r.mdbReceiveMemberId), lastId);
            
            syncedAt = result.syncedAt || syncedAt;
            emitStatus({ 
              state: 'syncing', 
              message: `데이터 읽는 중... (${totalFetched.toLocaleString()} / ${totalTarget.toLocaleString()}건)`, 
              error: '' 
            });
            
            if (result.rows.length < 10000) {
              break; // No more rows
            }
          } else {
            break;
          }
        }
        
        if (errorMsg && totalFetched === 0) {
          emitStatus({ state: 'error', message: errorMsg, error: errorMsg });
          return { ok: false, error: errorMsg };
        }

        const elapsedMs = Date.now() - startedAt;
        settingsStore.set('mdbSync.lastFullSyncAt', syncedAt);
        settingsStore.set('mdbSync.lastUpdateScanAt', syncedAt);
        rememberSyncMeta({ syncedAt, rowCount: mdbRowCount, elapsedMs });
        
        emitStatus({
          state: 'idle',
          message: `MDB 동기화 완료: ${mdbRowCount.toLocaleString()}건`,
          syncedAt,
          rowCount: mdbRowCount,
          elapsedMs,
          error: '',
        });
        
        return {
          ok: true,
          rowCount: mdbRowCount,
          sourceRows: totalFetched,
          total: totalTarget,
          incremental: false,
          elapsedMs,
          syncedAt,
          maxReceiveMemberId,
        };
      };

      if (!incremental) {
        return await runFullSync();
      }

      const watermark = getStoredMaxReceiveMemberId();
      if (watermark <= 0 && !settingsStore.get('mdbSync.lastFullSyncAt')) {
        return await runFullSync();
      }

      const newResult = await readMdbRows(config, { afterReceiveMemberId: watermark });
      if (!newResult.ok) {
        const message = getFailureMessage(newResult);
        emitStatus({ state: 'error', message, error: message });
        return { ok: false, ...newResult, error: message };
      }

      const newRows = normalizeRows(newResult.rows);
      let mdbRowCount = memberRepository.upsertMdbRows(newRows, { fullSync: false });
      let correctionRows = [];
      let correctionTotal = 0;
      let updateScanRan = false;
      let correctionSyncedAt = '';
      rememberMaxReceiveMemberId(newRows);

      if (shouldRunUpdateScan(config)) {
        const since = getDateWithGrace(getUpdateScanCursor());
        if (since) {
          updateScanRan = true;
          const correctionResult = await readMdbRows(config, { since });
          if (!correctionResult.ok) {
            const message = getFailureMessage(correctionResult);
            emitStatus({ state: 'error', message, error: message });
            return { ok: false, ...correctionResult, error: message };
          }
          correctionRows = normalizeRows(correctionResult.rows);
          correctionTotal = correctionResult.total || correctionRows.length;
          mdbRowCount = memberRepository.upsertMdbRows(correctionRows, { fullSync: false });
          correctionSyncedAt = correctionResult.syncedAt || new Date().toISOString();
          settingsStore.set('mdbSync.lastUpdateScanAt', correctionSyncedAt);
          rememberMaxReceiveMemberId(correctionRows);
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const syncedAt = correctionSyncedAt || newResult.syncedAt || new Date().toISOString();
      rememberSyncMeta({ syncedAt, rowCount: mdbRowCount, elapsedMs });
      const message = updateScanRan
        ? `MDB 신규 ${newRows.length.toLocaleString()}건 / 보정 ${correctionRows.length.toLocaleString()}건 반영 완료`
        : newRows.length > 0
          ? `MDB 신규 ${newRows.length.toLocaleString()}건 반영 완료`
          : 'MDB 변경 없음';
      emitStatus({
        state: 'idle',
        message,
        syncedAt,
        rowCount: mdbRowCount,
        elapsedMs,
        error: '',
      });
      return {
        ok: true,
        rowCount: mdbRowCount,
        sourceRows: newRows.length + correctionRows.length,
        newRows: newRows.length,
        correctionRows: correctionRows.length,
        correctionTotal,
        total: (newResult.total || newRows.length) + correctionTotal,
        incremental: true,
        updateScanRan,
        elapsedMs,
        syncedAt,
        maxReceiveMemberId: getStoredMaxReceiveMemberId(),
      };
    } catch (error) {
      let message = error.message || 'MDB 동기화에 실패했습니다.';
      if (message.includes('Maximum call stack size')) {
        message = '데이터 처리 중 메모리 초과 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
      emitStatus({ state: 'error', message, error: message });
      return { ok: false, error: message };
    } finally {
      isSyncing = false;
    }
  };

  const scheduleAutoSync = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncNow({ reason: 'auto', incremental: true }).catch((error) => {
        emitStatus({ state: 'error', message: error.message, error: error.message });
      });
    }, SYNC_DEBOUNCE_MS);
  };

  const restartPolling = () => {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    const config = getConfig(true);
    if (!config.enabled || !config.filePath) return;

    try {
      if (fs.existsSync(config.filePath)) {
        lastObservedMtimeMs = fs.statSync(config.filePath).mtimeMs;
      }
    } catch {}

    syncTimer = setInterval(() => {
      const latestConfig = getConfig(true);
      if (!latestConfig.enabled || !latestConfig.filePath || isSyncing) return;
      try {
        const stat = fs.statSync(latestConfig.filePath);
        if (stat.mtimeMs !== lastObservedMtimeMs) {
          lastObservedMtimeMs = stat.mtimeMs;
          scheduleAutoSync();
        }
      } catch (error) {
        emitStatus({ state: 'error', message: 'MDB 파일 감시 중 오류가 발생했습니다.', error: error.message });
      }
    }, normalizeSeconds(config.pollIntervalSeconds, DEFAULT_CONFIG.pollIntervalSeconds, 3) * 1000);
  };

  ipcMain.handle('select-mdb-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'MDB 파일 선택',
      properties: ['openFile'],
      filters: [{ name: 'Access Database', extensions: ['mdb', 'accdb'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const config = saveConfig({ filePath: result.filePaths[0] });
    return config;
  });

  ipcMain.handle('get-mdb-config', () => getConfig(false));

  ipcMain.handle('save-mdb-config', (_, config) => saveConfig(config || {}));

  ipcMain.handle('test-mdb-connection', async (_, configPatch = {}) => {
    const config = { ...getConfig(true), ...configPatch };
    if (!config.filePath) return { ok: false, error: 'MDB 파일을 먼저 선택해 주세요.' };
    return testConnection(config);
  });

  ipcMain.handle('sync-mdb-now', async (_, configPatch = {}) => {
    if (configPatch && Object.keys(configPatch).length > 0) saveConfig(configPatch);
    return syncNow({ reason: 'manual' });
  });

  ipcMain.handle('get-mdb-sync-status', () => lastStatus);

  ipcMain.handle('clear-mdb-data', async () => {
    try {
      memberRepository.deleteMembers(
        memberRepository.loadAll().filter(m => m.source === 'mdb')
      );
      settingsStore.delete('mdbSync.lastSyncAt');
      settingsStore.delete('mdbSync.lastRowCount');
      settingsStore.delete('mdbSync.lastFullSyncAt');
      settingsStore.delete('mdbSync.lastUpdateScanAt');
      settingsStore.delete('mdbSync.maxReceiveMemberId');
      
      emitStatus({ state: 'idle', message: '데이터 초기화 완료', rowCount: 0, syncedAt: '' });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('get-mdb-sync-logs', (_event, options) => {
    return memberRepository.getMdbSyncLogs(options);
  });

  ipcMain.handle('clear-mdb-sync-logs', () => {
    return memberRepository.clearMdbSyncLogs();
  });

  app.on('before-quit', () => {
    if (syncTimer) clearInterval(syncTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  restartPolling();
};
