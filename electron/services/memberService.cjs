module.exports = function setupMemberService(ipcMain, memberRepository) {
  ipcMain.handle('add-members', (_event, payload) => {
    try {
      let newMembers = [];
      let mode = 'append';

      if (Array.isArray(payload)) {
        newMembers = payload;
      } else if (payload && typeof payload === 'object') {
        newMembers = payload.data || [];
        mode = payload.mode || 'append';
      }

      memberRepository.addMembers(Array.isArray(newMembers) ? newMembers : [], mode);
      return true;
    } catch (error) {
      console.error('add-members failed:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-members', (_event, items) => {
    return memberRepository.deleteMembers(items || []);
  });

  ipcMain.handle('load-members', () => {
    return memberRepository.loadAll();
  });

  ipcMain.handle('get-members-page', (_event, options) => {
    return memberRepository.getMembersPage(options);
  });

  ipcMain.handle('get-location-stats', (_event, options) => {
    return memberRepository.getLocationStats(options);
  });
};
