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

ipcMain.handle('save-members', (_, data) => {
  if (!store) initStore();
  store.set('members', data);
});

ipcMain.handle('load-members', () => {
  if (!store) initStore();
  const data = store.get('members');
  console.log('Loaded members:', data);
  return data || [];
});

ipcMain.handle('send-sms', async (_, payload) => {
  console.log('SMS 발송:', payload);
  // 실제 API 연동 위치
  return { success: true };
});
