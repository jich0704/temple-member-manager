const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addMembers: (data) => ipcRenderer.invoke('add-members', data), // 멤버 추가
  overwriteMembers: (data) => ipcRenderer.invoke('overwrite-members', data), // 멤버 삭제
  loadMembers: () => ipcRenderer.invoke('load-members'), // 멤버 불러오기
  sendSMS: (payload) => ipcRenderer.invoke('send-sms', payload), // SMS 발송처리(?)
});
