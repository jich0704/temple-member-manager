const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addMembers: (data) => ipcRenderer.invoke('add-members', data), // 멤버 추가
  deleteMembers: (data) => ipcRenderer.invoke('delete-members', data), // 멤버 삭제
  loadMembers: () => ipcRenderer.invoke('load-members'), // 멤버 불러오기
  sendSMS: (payload) => ipcRenderer.invoke('send-sms', payload), // SMS 발송처리(?)
  getSolapiBalance: (keys) => ipcRenderer.invoke('get-solapi-balance', keys), // 솔라피 잔액 조회
  openExternal: (url) => ipcRenderer.invoke('open-external', url), // 외부 브라우저 열기
  loadSettings: () => ipcRenderer.invoke('load-settings'), // 설정 불러오기
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings), // 설정 저장하기
  getSmsHistory: () => ipcRenderer.invoke('get-sms-history'),
  clearSmsHistory: () => ipcRenderer.invoke('clear-sms-history'),
  getAutoSmsConfig: () => ipcRenderer.invoke('get-auto-sms-config'),
  saveAutoSmsConfig: (config) => ipcRenderer.invoke('save-auto-sms-config', config),
});
