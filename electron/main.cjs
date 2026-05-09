const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store').default;
const coolsms = require('coolsms-node-sdk').default;

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // 자동 발송 스케줄러 시작
  startAutoSmsScheduler();
});

ipcMain.handle('add-members', (event, payload) => {
  try {
    if (!store) initStore(); // store 초기화 (기존 코드 유지)

    let newMembers = [];
    let mode = 'append';

    // 기존 배열 호환 및 객체 파라미터 분기
    if (Array.isArray(payload)) {
      newMembers = payload;
    } else if (payload && typeof payload === 'object') {
      newMembers = payload.data || [];
      mode = payload.mode || 'append';
    }

    if (mode === 'overwrite') {
      // 덮어쓰기 모드면 기존 데이터 싹 날림
      store.set('members', {});
      store.set('membersLastIndex', 0);
    }

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
          let targetIndex = null;

          // 누적 모드일 경우 신도번호를 기준으로 중복 검색
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
            // 기존 데이터 병합 (인덱스 유지)
            currentMembers[targetIndex] = { ...currentMembers[targetIndex], ...member, index: Number(targetIndex) };
          } else {
            // 새 데이터 추가
            lastIndex++;
            currentMembers[lastIndex] = { ...member, index: lastIndex };
          }
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

ipcMain.handle('get-solapi-balance', async (_, { apiKey, apiSecret }) => {
  try {
    const messageService = new coolsms(apiKey, apiSecret);
    const result = await messageService.getBalance();
    return { success: true, balance: result };
  } catch (error) {
    console.error('Solapi 인증 실패:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (_, url) => {
  await shell.openExternal(url);
  return true;
});
const smsHistoryPath = path.join(app.getPath('userData'), 'sms-history.json');

function saveSmsHistory(historyItem) {
  try {
    let history = [];
    if (fs.existsSync(smsHistoryPath)) {
      history = JSON.parse(fs.readFileSync(smsHistoryPath, 'utf8'));
    }
    history.unshift(historyItem);
    if (history.length > 100) history = history.slice(0, 100);
    fs.writeFileSync(smsHistoryPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save SMS history', err);
  }
}

ipcMain.handle('get-sms-history', () => {
  try {
    if (fs.existsSync(smsHistoryPath)) {
      return JSON.parse(fs.readFileSync(smsHistoryPath, 'utf8'));
    }
  } catch (err) {}
  return [];
});

ipcMain.handle('clear-sms-history', () => {
  const smsHistoryPath = path.join(app.getPath('userData'), 'sms-history.json');
  try {
    if (fs.existsSync(smsHistoryPath)) {
      fs.unlinkSync(smsHistoryPath);
    }
  } catch (err) {
    console.error('발송 이력 삭제 실패:', err);
  }
});

// 자동 문자 발송 설정
ipcMain.handle('get-auto-sms-config', () => {
  return store.get('autoSmsConfig') || null;
});

ipcMain.handle('save-auto-sms-config', (event, config) => {
  store.set('autoSmsConfig', config);
  return true;
});

// 자동 발송 스케줄러 로직
let autoSmsTimer = null;

function startAutoSmsScheduler() {
  if (autoSmsTimer) clearInterval(autoSmsTimer);
  checkAndRunAutoSms();
  
  // 1분마다 체크
  autoSmsTimer = setInterval(() => {
    checkAndRunAutoSms();
  }, 60 * 1000);
}

async function checkAndRunAutoSms() {
  const config = store.get('autoSmsConfig');
  if (!config || !config.enabled || !config.time) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const lastRunDate = store.get('lastAutoSmsRunDate');
  
  const configTimeParts = config.time.split(':');
  const configHour = parseInt(configTimeParts[0], 10);
  const configMinute = parseInt(configTimeParts[1], 10);
  
  const hasPassedConfigTime = now.getHours() > configHour || (now.getHours() === configHour && now.getMinutes() >= configMinute);
  
  if (hasPassedConfigTime && lastRunDate !== todayStr) {
    await executeAutoSms(config);
    store.set('lastAutoSmsRunDate', todayStr);
  }
}

async function executeAutoSms(config) {
  const settings = store.get('settings') || {};
  if (!settings.solapiApiKey || !settings.solapiApiSecret || !settings.solapiSenderNumber) return;
  
  const rawMembers = store.get('members') || {};
  let currentMembers = [];
  if (Array.isArray(rawMembers)) {
    currentMembers = rawMembers.filter(m => m && m.index !== undefined);
  } else {
    currentMembers = Object.values(rawMembers).filter(m => m);
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logPath = path.join(app.getPath('userData'), 'auto-sms-log.json');
  let autoSmsLog = {};
  if (fs.existsSync(logPath)) {
    try { autoSmsLog = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch (e) {}
  }
  
  const messageService = new coolsms(settings.solapiApiKey, settings.solapiApiSecret);
  
  for (const rule of config.rules) {
    if (!rule.enabled || !rule.template) continue;
    
    const targets = [];
    
    for (const member of currentMembers) {
      if (member.status === '비활동') continue;
      
      const lastPaymentMonth = member['최종납부월'];
      if (!lastPaymentMonth || lastPaymentMonth === '-') continue;
      
      const [yearStr, monthStr] = String(lastPaymentMonth).split('-');
      if (!yearStr || !monthStr) continue;
      
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const targetDate = new Date(year, month, 0);
      targetDate.setHours(23, 59, 59, 999);
      
      const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let isMatch = false;
      if (rule.type === '1month' && diffDays <= 30 && diffDays > 14) isMatch = true;
      if (rule.type === '2weeks' && diffDays <= 14 && diffDays > 7) isMatch = true;
      if (rule.type === '1week' && diffDays <= 7 && diffDays >= 0) isMatch = true;
      
      if (!isMatch) continue;
      
      const id = member['신도번호'] ? String(member['신도번호']).trim() : '';
      const daeju = member['대주'] ? String(member['대주']).trim() : '';
      const dongchamja = member['동참자'] ? String(member['동참자']).trim() : '';
      
      if (!id && !daeju && !dongchamja) continue;
      
      const duplicateKey = `${id}_${daeju}_${dongchamja}_${yearStr}-${monthStr}_${rule.type}`;
      if (autoSmsLog[duplicateKey]) continue;
      
      targets.push({ member, duplicateKey });
    }
    
    if (targets.length === 0) continue;
    
    const messages = [];
    const validTargets = [];
    
    for (const { member, duplicateKey } of targets) {
      const toPhone = member.phone || member['연락처'] || member['휴대전화'];
      if (!toPhone) continue;
      
      let content = rule.template;
      Object.keys(member).forEach(key => {
        const val = member[key];
        if (val !== undefined && val !== null) {
          content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
        }
      });
      
      messages.push({
        to: toPhone.replace(/[^0-9]/g, ''),
        from: settings.solapiSenderNumber.replace(/[^0-9]/g, ''),
        text: content,
        autoTypeDetect: true
      });
      validTargets.push({ member, duplicateKey });
    }
    
    if (messages.length === 0) continue;
    
    try {
      const result = await messageService.sendMany(messages);
      
      for (const { duplicateKey } of validTargets) {
        autoSmsLog[duplicateKey] = new Date().toISOString();
      }
      fs.writeFileSync(logPath, JSON.stringify(autoSmsLog, null, 2), 'utf8');
      
      let typeLabel = '';
      if (rule.type === '1month') typeLabel = '만료 한달 전';
      else if (rule.type === '2weeks') typeLabel = '만료 2주 전';
      else if (rule.type === '1week') typeLabel = '만료 1주 전';
      
      saveSmsHistory({
        id: Date.now().toString() + '_' + rule.type,
        date: new Date().toISOString(),
        template: `[자동 발송: ${typeLabel}]\n${rule.template}`,
        hasImage: false,
        targets: validTargets.map(t => ({ name: t.member.name || t.member['대주'] || '이름없음', phone: t.member.phone || t.member['연락처'] || '' })),
        success: true,
        result
      });
    } catch (e) {
      console.error('Auto SMS Send Error:', e);
    }
  }
}

ipcMain.handle('send-sms', async (_, payload) => {
  console.log('SMS 발송 Payload:', payload);
  const { apiKey, apiSecret, senderNumber, targets, messageTemplate, imagePath } = payload;
  
  if (!apiKey || !apiSecret || !senderNumber) {
    return { success: false, error: '솔라피 설정 정보가 누락되었습니다.' };
  }

  const basicTargetInfo = targets.map(m => ({
    name: m['대주'] || m['이름'] || '알수없음',
    phone: m['휴대폰'] || m.phone || m['전화번호'] || '알수없음'
  }));

  try {
    const messageService = new coolsms(apiKey, apiSecret);
    
    let imageId = undefined;
    if (imagePath) {
      try {
        // Base64 데이터를 임시 파일로 저장
        const tempPath = path.join(app.getPath('temp'), `mms-${Date.now()}.jpg`);
        fs.writeFileSync(tempPath, Buffer.from(imagePath, 'base64'));

        // SDK의 기본 uploadFile 함수 사용 (내부적으로 다시 base64 인코딩됨)
        const uploadResult = await messageService.uploadFile(tempPath, 'MMS');
        imageId = uploadResult.fileId;

        // 임시 파일 삭제
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (err) {
        console.error('이미지 업로드 실패:', err);
        throw new Error('MMS 이미지 업로드에 실패했습니다.');
      }
    }
    
    // 수신자 리스트 생성
    const messages = targets.map((member) => {
      // 휴대폰 번호 정리 (하이픈, 공백 제거)
      let toPhone = '';
      if (member.phone) {
         toPhone = String(member.phone).replace(/[^0-9]/g, '');
      } else if (member['휴대폰']) {
         toPhone = String(member['휴대폰']).replace(/[^0-9]/g, '');
      } else if (member['전화번호']) {
         toPhone = String(member['전화번호']).replace(/[^0-9]/g, '');
      }

      // 치환 (매크로) 로직
      let content = messageTemplate;
      Object.keys(member).forEach((key) => {
        const regex = new RegExp(`{${key}}`, 'g');
        content = content.replace(regex, member[key] || '');
      });

      const msg = {
        to: toPhone,
        from: senderNumber.replace(/[^0-9]/g, ''),
        text: content,
        type: imageId ? 'MMS' : undefined,
        // 제목을 완전한 공백(Zero-width space 또는 일반 공백)으로 설정하여 숨김
        subject: imageId ? '\u200B' : undefined,
        autoTypeDetect: imageId ? false : true
      };
      if (imageId) msg.imageId = imageId;
      return msg;
    }).filter(msg => msg.to.length >= 10);

    if (messages.length === 0) {
      throw new Error('유효한 수신자 번호가 없습니다.');
    }

    const result = await messageService.sendMany(messages);
    
    saveSmsHistory({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      template: messageTemplate,
      hasImage: !!imagePath,
      imageBase64: imagePath, // 이미지를 이력에 저장
      targets: basicTargetInfo,
      success: true,
      result
    });

    return { success: true, result };
  } catch (error) {
    console.error('Solapi 발송 실패:', error);
    
    saveSmsHistory({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      template: messageTemplate,
      hasImage: !!imagePath,
      imageBase64: imagePath, // 이미지를 이력에 저장
      targets: basicTargetInfo,
      success: false,
      errorMsg: error.message
    });

    return { success: false, error: error.message };
  }
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
