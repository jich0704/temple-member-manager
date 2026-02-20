const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store').default;

let store;

const initStore = () => {
  store = new Store({
    name: 'members',
    cwd: app.getPath('userData'),
    fileExtension: 'json',
  });

  console.log('Store path:', store.path);
};

console.log('dirname:', __dirname);
console.log('preload path:', path.join(__dirname, 'preload.cjs'));

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    minWidth: 800, // 이 너비 이하로는 안 줄어듦
    minHeight: 800, // 이 높이 이하로는 안 줄어듦
  });

  // 개발자도구가 안보이기에 개발중일때는 메뉴를 view처리
  // win.setMenu(null);

  if (app.isPackaged) {
    // 배포(exe) 모드일 때
    const indexPath = path.join(process.resourcesPath, 'app', 'dist', 'index.html');
    win.loadFile(indexPath);
  } else {
    // 개발 모드
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  initStore();
  createWindow();
});

// 1. 엑셀 업로드용 (기존 로직 유지, 이름만 변경)
ipcMain.handle('add-members', (_, newMembers) => {
  if (!store) initStore();
  const existingMembers = store.get('members') || [];
  const lastIndex = store.get('membersLastIndex', 0);

  let currentIndex = lastIndex;
  const membersWithIndex = newMembers.map((member) => {
    currentIndex += 1;
    return { ...member, index: currentIndex };
  });

  const updatedMembers = [...existingMembers, ...membersWithIndex];
  store.set('members', updatedMembers);
  store.set('membersLastIndex', currentIndex);

  return updatedMembers; // 프론트엔드 동기화를 위해 전체 배열 반환
});

// 2. 삭제 및 상태 변경용 (완전히 덮어쓰기)
ipcMain.handle('overwrite-members', (_, updatedMembers) => {
  if (!store) initStore();
  // 이어붙이지 않고, 넘어온 배열로 데이터를 통째로 교체
  store.set('members', updatedMembers);
  return updatedMembers;
});

ipcMain.handle('load-members', () => {
  if (!store) initStore();
  const data = store.get('members', []);

  return [...data].sort((a, b) => b.index - a.index) || [];
});

ipcMain.handle('send-sms', async (_, payload) => {
  console.log('SMS 발송:', payload);
  // 실제 API 연동 위치
  return { success: true };
});
