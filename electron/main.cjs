const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store').default;

const setupMemberService = require('./services/memberService.cjs');
const setupSmsService = require('./services/smsService.cjs');
const setupAutoSmsService = require('./services/autoSmsService.cjs');

let store;
let settingsStore;

const initStore = () => {
  store = new Store({
    name: 'members',
    cwd: app.getPath('userData'),
    fileExtension: 'json',
  });

  settingsStore = new Store({
    name: 'settings',
    cwd: app.getPath('userData'),
    fileExtension: 'json',
    defaults: {
      warningDays: 30,
      criticalDays: 7,
      warningColor: 'from-blue-500 to-blue-600',
      criticalColor: 'from-red-500 to-red-600',
      safeColor: 'from-green-500 to-emerald-500',
    }
  });

  console.log('Store path:', store.path);
  console.log('Settings path:', settingsStore.path);
};

console.log('dirname:', __dirname);
console.log('preload path:', path.join(__dirname, 'preload.cjs'));

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    minWidth: 800,
    minHeight: 800,
  });

  win.maximize(); // 실행 시 창 최대화

  if (app.isPackaged) {
    const indexPath = path.join(process.resourcesPath, 'app', 'dist', 'index.html');
    win.loadFile(indexPath);
  } else {
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  initStore();
  
  // 각종 서비스 초기화 및 IPC 핸들러 등록
  setupMemberService(ipcMain, store);
  const { saveSmsHistory } = setupSmsService(ipcMain, settingsStore, app);
  setupAutoSmsService(ipcMain, store, settingsStore, app, saveSmsHistory);

  ipcMain.handle('open-external', async (_, url) => {
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('load-settings', () => {
    if (!settingsStore) initStore();
    return settingsStore.store;
  });

  ipcMain.handle('save-settings', (_, newSettings) => {
    if (!settingsStore) initStore();
    settingsStore.set(newSettings);
    return true;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
