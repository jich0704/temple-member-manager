const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveMembers: (data) => ipcRenderer.invoke('save-members', data), // 멤버 저장
  loadMembers: () => ipcRenderer.invoke('load-members'), // 멤버 불러오기
  sendSMS: (payload) => ipcRenderer.invoke('send-sms', payload), // SMS 발송처리(?)
});
