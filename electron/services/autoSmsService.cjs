const fs = require('fs');
const path = require('path');
const { SolapiMessageService } = require('solapi');

const MAX_MESSAGE_BYTES = 2000;

function getMessageByteLength(text) {
  let byteLength = 0;
  for (const char of String(text || '')) {
    byteLength += char.codePointAt(0) <= 0x7f ? 1 : 2;
  }
  return byteLength;
}

function applyMacros(template, member) {
  let finalMessage = template;
  Object.keys(member).forEach((key) => {
    const regex = new RegExp(`{${key}}`, 'g');
    finalMessage = finalMessage.replace(regex, String(member[key] || ''));
  });
  return finalMessage;
}

module.exports = function setupAutoSmsService(ipcMain, store, settingsStore, app, saveSmsHistory, memberRepository, getSendOutcome, getFailedTargetsFromError) {
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
      const result = await executeAutoSms(config);
      if (result.ok) {
        store.set('lastAutoSmsRunDate', todayStr);
      }
    }
  }

  async function executeAutoSms(config) {
    const settings = settingsStore.store;
    if (!settings.solapiApiKey || !settings.solapiApiSecret || !settings.solapiSenderNumber) {
      console.error('[AutoSms] 솔라피 설정이 없어 자동발송 취소');
      return { ok: false };
    }

    const messageService = new SolapiMessageService(settings.solapiApiKey, settings.solapiApiSecret);
    let members = [];
    if (memberRepository && memberRepository.getMembersPage) {
      const pageData = memberRepository.getMembersPage({
        page: 1,
        limit: 500000,
        location: '전체',
        statusFilter: '한달전',
        warningDays: 30,
        criticalDays: 14,
      });
      members = pageData?.members || [];
    } else if (memberRepository) {
      members = memberRepository.loadAll();
    } else {
      const raw = store.get('members') || {};
      members = Array.isArray(raw) ? raw : Object.values(raw);
    }
    
    if (members.length === 0) return { ok: true };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logPath = path.join(app.getPath('userData'), 'auto-sms-log.json');
    let autoSmsLog = {};
    if (fs.existsSync(logPath)) {
      try { autoSmsLog = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch (e) {}
    }

    let allRulesSucceeded = true;
    for (const rule of config.rules) {
      if (!rule.enabled || !rule.template) continue;

      let validTargets = [];

      for (const member of members) {
        // 위치별 발송 설정 확인 (true로 명시된 경우에만 발송, 기본=미발송)
        const memberLoc = String(member['위치명'] || '').trim() || '미지정';
        if (!config.locationEnabled || config.locationEnabled[memberLoc] !== true) continue;

        const rawPhone = String(member.phone || member['휴대폰'] || member['전화번호'] || member['연락처'] || '').replace(/[^0-9]/g, '');
        if (!rawPhone) continue;

        const expireStr = String(member['최종납부월'] || member['납부만료월'] || '').trim();
        if (!expireStr) continue;

        const [yyyy, mm] = expireStr.split(/[-.]/).map(Number);
        if (!yyyy || !mm) continue;

        const expireDate = new Date(yyyy, mm, 0, 23, 59, 59, 999);
        const diffMs = expireDate.getTime() - today.getTime();
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
          const duplicateKey = `${uniqueKey}_${rule.type}_${yyyy}-${String(mm).padStart(2, '0')}`;
          
          if (!autoSmsLog[duplicateKey]) {
            validTargets.push({ member, duplicateKey, rawPhone });
          }
        }
      }

      if (validTargets.length === 0) continue;

      const invalidTargets = [];
      const messageTargets = [];
      for (const target of validTargets) {
        const finalMessage = applyMacros(rule.template, target.member);
        const byteLength = getMessageByteLength(finalMessage);
        if (!finalMessage.trim()) {
          invalidTargets.push({
            ...target,
            error: '매크로 치환 후 메시지 내용이 비어 있습니다.',
          });
          continue;
        }
        if (byteLength > MAX_MESSAGE_BYTES) {
          invalidTargets.push({
            ...target,
            error: `매크로 치환 후 메시지가 ${byteLength.toLocaleString()}바이트입니다. 최대 ${MAX_MESSAGE_BYTES.toLocaleString()}바이트까지 발송할 수 있습니다.`,
          });
          continue;
        }
        messageTargets.push({
          ...target,
          message: {
            to: target.rawPhone,
            from: settings.solapiSenderNumber.replace(/[^0-9]/g, ''),
            text: finalMessage,
          },
        });
      }

      const typeLabel = rule.type === '1month'
        ? '만료 한달 전'
        : rule.type === '2weeks'
          ? '만료 2주 전'
          : '만료 1주 전';
      const historyTargets = validTargets.map(t => ({
        name: t.member.name || t.member['동참자'] || t.member['대주'] || t.member['이름'] || '이름없음',
        phone: t.member.phone || t.member['휴대폰'] || t.member['전화번호'] || t.member['연락처'] || ''
      }));

      if (messageTargets.length === 0) {
        saveSmsHistory({
          id: Date.now().toString() + '_' + rule.type,
          date: new Date().toISOString(),
          template: `[자동 발송 실패]\n${rule.template}`,
          hasImage: false,
          targets: historyTargets,
          success: false,
          deliveryStatus: 'failed',
          successCount: 0,
          failedCount: invalidTargets.length,
          failedTargets: invalidTargets.map(t => ({ phone: t.rawPhone, error: t.error })),
          errorMsg: '발송 가능한 메시지가 없습니다. 매크로 치환 결과를 확인해 주세요.',
        });
        allRulesSucceeded = false;
        continue;
      }

      try {
        const result = await messageService.send(messageTargets.map(t => t.message), { showMessageList: true });
        const outcome = typeof getSendOutcome === 'function'
          ? getSendOutcome(result, messageTargets.length)
          : { deliveryStatus: 'success', successCount: messageTargets.length, failedCount: 0, failedTargets: [] };
        const failedPhones = new Set(outcome.failedTargets.map((target) => String(target.phone || '').replace(/[^0-9]/g, '')));

        // 실패 목록을 받은 경우에만 성공한 대상만 완료 처리한다. 실패한 번호는 다음 실행에서 재시도한다.
        if (outcome.failedCount === 0 || outcome.failedTargets.length > 0) {
          for (const { duplicateKey, rawPhone } of messageTargets) {
            if (!failedPhones.has(rawPhone)) {
              autoSmsLog[duplicateKey] = new Date().toISOString();
            }
          }
        }
        fs.writeFileSync(logPath, JSON.stringify(autoSmsLog, null, 2), 'utf8');
        
        const failedTargets = [
          ...invalidTargets.map(t => ({ phone: t.rawPhone, error: t.error })),
          ...outcome.failedTargets,
        ];
        const failedCount = failedTargets.length;
        const deliveryStatus = failedCount === 0
          ? 'success'
          : outcome.successCount > 0
            ? 'partial'
            : 'failed';
        
        saveSmsHistory({
          id: Date.now().toString() + '_' + rule.type,
          date: new Date().toISOString(),
          template: `[자동 발송: ${typeLabel}]\n${rule.template}`,
          hasImage: false,
          targets: historyTargets,
          success: deliveryStatus === 'success',
          deliveryStatus,
          successCount: outcome.successCount,
          failedCount,
          failedTargets,
          errorMsg: failedCount > 0 ? `${failedCount}명 발송 실패` : undefined,
          result
        });
        if (deliveryStatus !== 'success') allRulesSucceeded = false;
      } catch (e) {
        console.error('Auto SMS Send Error:', e);
        const failedTargets = typeof getFailedTargetsFromError === 'function'
          ? getFailedTargetsFromError(e)
          : [];
        saveSmsHistory({
          id: Date.now().toString() + '_' + rule.type,
          date: new Date().toISOString(),
          template: `[자동 발송 실패]\n${rule.template}`,
          hasImage: false,
          targets: validTargets.map(t => ({
            name: t.member.name || t.member['동참자'] || t.member['대주'] || t.member['이름'] || '이름없음',
            phone: t.member.phone || t.member['휴대폰'] || t.member['전화번호'] || t.member['연락처'] || ''
          })),
          success: false,
          deliveryStatus: 'failed',
          successCount: 0,
          failedCount: failedTargets.length || validTargets.length,
          failedTargets,
          errorMsg: e.message,
        });
        allRulesSucceeded = false;
      }
    }
    return { ok: allRulesSucceeded };
  }

  // start the scheduler immediately
  startAutoSmsScheduler();
};
