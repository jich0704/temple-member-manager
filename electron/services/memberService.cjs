module.exports = function setupMemberService(ipcMain, store) {
  ipcMain.handle('add-members', (event, payload) => {
    try {
      let newMembers = [];
      let mode = 'append';

      if (Array.isArray(payload)) {
        newMembers = payload;
      } else if (payload && typeof payload === 'object') {
        newMembers = payload.data || [];
        mode = payload.mode || 'append';
      }

      if (mode === 'overwrite') {
        store.set('members', {});
        store.set('membersLastIndex', 0);
      }

      const rawMembers = store.get('members') || {};
      let currentMembers = {};

      if (Array.isArray(rawMembers)) {
        rawMembers.forEach((m) => {
          if (m && m.index !== undefined) {
            currentMembers[m.index] = m;
          }
        });
      } else {
        currentMembers = typeof rawMembers === 'object' ? rawMembers : {};
      }

      let lastIndex = store.get('membersLastIndex') || 0;

      if (Array.isArray(newMembers)) {
        newMembers.forEach((member) => {
          if (member) {
            let targetIndex = null;

            if (mode === 'append') {
              const newId = member['신도번호'] ? String(member['신도번호']).trim() : '';
              const newDaeju = member['대주'] ? String(member['대주']).trim() : '';
              const newDongchamja = member['동참자'] ? String(member['동참자']).trim() : '';

              if (newId) {
                for (const [key, existingMember] of Object.entries(currentMembers)) {
                  const existingId = existingMember['신도번호'] ? String(existingMember['신도번호']).trim() : '';
                  const existingDaeju = existingMember['대주'] ? String(existingMember['대주']).trim() : '';
                  const existingDongchamja = existingMember['동참자'] ? String(existingMember['동참자']).trim() : '';

                  if (existingId === newId && existingDaeju === newDaeju && existingDongchamja === newDongchamja) {
                    targetIndex = key;
                    break;
                  }
                }
              }
            }

            if (targetIndex !== null) {
              currentMembers[targetIndex] = { ...currentMembers[targetIndex], ...member, index: Number(targetIndex) };
            } else {
              lastIndex++;
              currentMembers[lastIndex] = { ...member, index: lastIndex };
            }
          }
        });
      }

      store.set('members', currentMembers);
      store.set('membersLastIndex', lastIndex);
      return true;
    } catch (error) {
      console.error('add-members에서 치명적 에러 발생:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-members', (event, items) => {
    const currentMembers = store.get('members') || {};
    items.forEach((item) => {
      const targetId = typeof item === 'object' && item !== null ? item.index : item;
      delete currentMembers[String(targetId)];
    });
    store.set('members', currentMembers);
    const dataArray = Object.values(currentMembers);
    return dataArray.sort((a, b) => b.index - a.index);
  });

  ipcMain.handle('load-members', () => {
    const rawData = store.get('members', {});
    const dataArray = Array.isArray(rawData) ? rawData : Object.values(rawData);
    return dataArray.sort((a, b) => b.index - a.index);
  });
};
