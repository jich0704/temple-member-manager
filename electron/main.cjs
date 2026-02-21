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

ipcMain.handle('add-members', (event, newMembers) => {
  try {
    if (!store) initStore(); // store 초기화 (기존 코드 유지)

    // 1. 기존 데이터 가져오기 (비어있으면 빈 객체)
    const rawMembers = store.get('members') || {};
    let currentMembers = {};

    // 2. 만약 기존 데이터가 배열이라면 (null 방어 로직 추가)
    if (Array.isArray(rawMembers)) {
      rawMembers.forEach((m) => {
        // m이 null이 아니고, 안에 index가 있을 때만
        if (m && m.index !== undefined) {
          currentMembers[m.index] = m;
        }
      });
    } else {
      currentMembers = typeof rawMembers === 'object' ? rawMembers : {};
    }

    let lastIndex = store.get('membersLastIndex') || 0;

    // 3. 엑셀에서 넘어온 새 데이터 추가
    if (Array.isArray(newMembers)) {
      newMembers.forEach((member) => {
        if (member) {
          // 엑셀 빈 줄 무시
          lastIndex++;
          currentMembers[lastIndex] = { ...member, index: lastIndex };
        }
      });
    }

    // 4. 안전하게 저장
    store.set('members', currentMembers);
    store.set('membersLastIndex', lastIndex);

    return true; // 성공적으로 끝나면 true 반환
  } catch (error) {
    console.error('add-members에서 치명적 에러 발생:', error);
    throw error; // 에러를 삼키지 않고 프론트로 던져서 원인을 파악하게 함
  }
});

ipcMain.handle('delete-members', (event, items) => {
  console.log('삭제 요청 도착! 데이터:', items);

  if (!store) initStore();
  const currentMembers = store.get('members') || {};

  // 넘어온 배열을 돌면서 삭제 처리
  items.forEach((item) => {
    // item이 객체면 안의 index를 뽑아내고, 그냥 숫자/문자면 그대로 씁니다.
    const targetId = typeof item === 'object' && item !== null ? item.index : item;

    delete currentMembers[String(targetId)];
  });

  store.set('members', currentMembers);

  const dataArray = Object.values(currentMembers);
  return dataArray.sort((a, b) => b.index - a.index);
});

ipcMain.handle('load-members', () => {
  if (!store) initStore();

  // 1. 기본값을 빈 객체({})로 가져옵니다.
  const rawData = store.get('members', {});

  // 2. 객체에 담긴 값들만 뽑아서(Object.values) 배열로
  const dataArray = Array.isArray(rawData) ? rawData : Object.values(rawData);

  // 3. index 역순(최신순)으로 정렬해서 프론트로
  return dataArray.sort((a, b) => b.index - a.index);
});

ipcMain.handle('send-sms', async (_, payload) => {
  console.log('SMS 발송:', payload);
  // 실제 API 연동 위치
  return { success: true };
});
