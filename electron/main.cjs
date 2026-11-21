const { app, BrowserWindow, ipcMain, shell, screen, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store').default;
const { autoUpdater } = require('electron-updater');

const setupMemberService = require('./services/memberService.cjs');
const setupSmsService = require('./services/smsService.cjs');
const setupAutoSmsService = require('./services/autoSmsService.cjs');
const setupMdbService = require('./services/mdbService.cjs');
const createMemberRepository = require('./services/memberRepository.cjs');

let store;
let settingsStore;
let memberRepository;

const defaultWindowState = {
  width: 1400,
  height: 900,
  isMaximized: true,
};

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
      memberListFontSize: 14,
      menuFontSize: 14,
    }
  });

  console.log('Store path:', store.path);
  console.log('Settings path:', settingsStore.path);

  memberRepository = createMemberRepository(app.getPath('userData'));
  const migration = memberRepository.migrateFromStore(store);
  if (migration.migrated) {
    console.log(`Migrated ${migration.count} legacy members to SQLite:`, memberRepository.dbPath);
  } else {
    console.log('SQLite member DB:', memberRepository.dbPath);
  }
};

console.log('dirname:', __dirname);
console.log('preload path:', path.join(__dirname, 'preload.cjs'));

function getSavedWindowState() {
  const savedState = settingsStore?.get('windowState');
  if (!savedState || typeof savedState !== 'object') {
    return defaultWindowState;
  }

  const nextState = {
    ...defaultWindowState,
    ...savedState,
  };

  const width = Number(nextState.width);
  const height = Number(nextState.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return defaultWindowState;
  }

  nextState.width = Math.max(800, Math.round(width));
  nextState.height = Math.max(800, Math.round(height));

  const hasPosition = Number.isFinite(Number(nextState.x)) && Number.isFinite(Number(nextState.y));
  if (hasPosition) {
    nextState.x = Math.round(Number(nextState.x));
    nextState.y = Math.round(Number(nextState.y));

    const savedBounds = {
      x: nextState.x,
      y: nextState.y,
      width: nextState.width,
      height: nextState.height,
    };
    const hasMatchingDisplay = screen.getAllDisplays().some((display) => {
      const { x, y, width: displayWidth, height: displayHeight } = display.workArea;
      return (
        savedBounds.x < x + displayWidth &&
        savedBounds.x + savedBounds.width > x &&
        savedBounds.y < y + displayHeight &&
        savedBounds.y + savedBounds.height > y
      );
    });

    if (!hasMatchingDisplay) {
      delete nextState.x;
      delete nextState.y;
    }
  }

  return nextState;
}

function saveWindowState(win) {
  if (!settingsStore || win.isDestroyed()) return;

  const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
  settingsStore.set('windowState', {
    ...bounds,
    isMaximized: win.isMaximized(),
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] 새 버전 감지됨:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] 업데이트 다운로드 완료:', info.version);
    dialog
      .showMessageBox({
        type: 'info',
        title: '업데이트 준비 완료',
        message: `새로운 버전(v${info.version})이 다운로드되었습니다.\n지금 재시작하여 업데이트를 적용하시겠습니까?`,
        buttons: ['지금 재시작', '나중에 (종료 시 자동 적용)'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] 업데이트 확인 중 오류:', err?.message || err);
  });

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[AutoUpdater] 초기 업데이트 체크 실패:', err?.message || err);
      });
    }, 3000);
  }
}

function createWindow() {
  const windowState = getSavedWindowState();
  const win = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
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

  if (windowState.isMaximized) {
    win.maximize();
  }

  win.on('close', () => saveWindowState(win));

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
  setupMemberService(ipcMain, memberRepository);
  const { saveSmsHistory, getSendOutcome, getFailedTargetsFromError } = setupSmsService(ipcMain, settingsStore, app);
  setupAutoSmsService(ipcMain, store, settingsStore, app, saveSmsHistory, memberRepository, getSendOutcome, getFailedTargetsFromError);
  setupMdbService(ipcMain, memberRepository, settingsStore, app);
  setupAutoUpdater();

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      return { ok: false, message: '자동 업데이트 확인은 설치된 배포판(.exe)에서 동작합니다.' };
    }
    try {
      const res = await autoUpdater.checkForUpdates();
      return { ok: true, version: res?.updateInfo?.version || app.getVersion() };
    } catch (error) {
      return { ok: false, message: error?.message || '업데이트 확인 실패' };
    }
  });

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

  app.on('before-quit', () => {
    if (memberRepository) memberRepository.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

