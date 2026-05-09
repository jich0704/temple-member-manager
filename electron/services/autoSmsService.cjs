const fs = require('fs');
const path = require('path');
const coolsms = require('coolsms-node-sdk').default;

module.exports = function setupAutoSmsService(ipcMain, store, settingsStore, app, saveSmsHistory) {
  ipcMain.handle('get-auto-sms-config', () => {
    return store.get('autoSmsConfig') || null;
  });

  ipcMain.handle('save-auto-sms-config', (event, config) => {
    store.set('autoSmsConfig', config);
    return true;
  });

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
    
    // 오늘 이미 실행했다면 패스
    if (lastRunDate === todayStr) return;

    const [targetHour, targetMin] = config.time.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    // 설정된 시간 이후인지 확인
    if (currentHour > targetHour || (currentHour === targetHour && currentMin >= targetMin)) {
      console.log(`[AutoSms] 설정 시간(${config.time})이 되었으므로 문자를 발송합니다.`);
      await executeAutoSms(config);
      store.set('lastAutoSmsRunDate', todayStr);
    }
  }

  async function executeAutoSms(config) {
    const settings = settingsStore.store;
    if (!settings.solapiApiKey || !settings.solapiApiSecret || !settings.solapiSenderNumber) {
      console.error('[AutoSms] 솔라피 설정이 없어 자동발송 취소');
      return;
    }

    const messageService = new coolsms(settings.solapiApiKey, settings.solapiApiSecret);
    const rawMembers = store.get('members') || {};
    const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
    
    if (members.length === 0) return;

    const now = new Date();
    const logPath = path.join(app.getPath('userData'), 'auto-sms-log.json');
    let autoSmsLog = {};
    if (fs.existsSync(logPath)) {
      try { autoSmsLog = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch (e) {}
    }

    for (const rule of config.rules) {
      if (!rule.enabled || !rule.template) continue;

      let validTargets = [];

      for (const member of members) {
        const expireStr = member['최종납부월'] || member['납부만료월'] || '';
        if (!expireStr) continue;

        const [yyyy, mm] = expireStr.split('.').map(Number);
        if (!yyyy || !mm) continue;

        const expireDate = new Date(yyyy, mm - 1, 1);
        const diffMs = expireDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let shouldSend = false;
        if (rule.type === '1month' && diffDays > 14 && diffDays <= 30) shouldSend = true;
        else if (rule.type === '2weeks' && diffDays > 7 && diffDays <= 14) shouldSend = true;
        else if (rule.type === '1week' && diffDays >= 0 && diffDays <= 7) shouldSend = true;

        if (shouldSend) {
          const shindoNo = member['신도번호'] || '';
          const daeju = member['대주'] || '';
          const dongchamja = member['동참자'] || '';
          
          const uniqueKey = `${shindoNo}_${daeju}_${dongchamja}`;
          const duplicateKey = `${uniqueKey}_${rule.type}_${yyyy}-${mm}`;
          
          if (!autoSmsLog[duplicateKey]) {
            validTargets.push({ member, duplicateKey });
          }
        }
      }

      if (validTargets.length === 0) continue;

      const messages = validTargets.map(t => {
        let finalMessage = rule.template;
        Object.keys(t.member).forEach(key => {
          const regex = new RegExp(`{${key}}`, 'g');
          finalMessage = finalMessage.replace(regex, String(t.member[key] || ''));
        });

        return {
          to: String(t.member['연락처'] || '').replace(/[^0-9]/g, ''),
          from: settings.solapiSenderNumber.replace(/[^0-9]/g, ''),
          text: finalMessage,
        };
      });

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

  // start the scheduler immediately
  startAutoSmsScheduler();
};
