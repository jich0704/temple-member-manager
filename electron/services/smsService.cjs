const fs = require('fs');
const os = require('os');
const path = require('path');
const { SolapiMessageService } = require('solapi');

const MAX_MMS_IMAGE_BYTES = 200 * 1024;

function createTemporaryMmsImage(imageBase64) {
  const normalized = String(imageBase64 || '')
    .replace(/^data:image\/jpeg;base64,/i, '')
    .replace(/\s/g, '');

  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('MMS 이미지 데이터 형식이 올바르지 않습니다.');
  }

  const imageBuffer = Buffer.from(normalized, 'base64');
  if (imageBuffer.length === 0 || imageBuffer.length > MAX_MMS_IMAGE_BYTES) {
    throw new Error('MMS 이미지는 JPEG 형식의 200KB 이하 파일만 발송할 수 있습니다.');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-member-manager-mms-'));
  const filePath = path.join(tempDir, 'image.jpg');
  fs.writeFileSync(filePath, imageBuffer);
  return { tempDir, filePath };
}

function asNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null;
}

function getSendOutcome(result, attemptedCount) {
  const groupInfo = result?.groupInfo || result || {};
  const count = groupInfo.count || result?.count || {};
  const failedMessageList = Array.isArray(result?.failedMessageList)
    ? result.failedMessageList
    : Array.isArray(groupInfo.failedMessageList)
      ? groupInfo.failedMessageList
      : [];
  const reportedFailedCount = asNonNegativeInteger(count.registeredFailed);
  const reportedSuccessCount = asNonNegativeInteger(count.registeredSuccess);
  const failedCount = Math.min(
    attemptedCount,
    Math.max(reportedFailedCount ?? 0, failedMessageList.length),
  );
  const successCount = Math.min(
    attemptedCount - failedCount,
    reportedSuccessCount ?? attemptedCount - failedCount,
  );
  const failedTargets = failedMessageList.map((item) => ({
    phone: String(item?.to || ''),
    error: String(item?.statusMessage || item?.errorMessage || '접수에 실패했습니다.'),
  }));
  const deliveryStatus = failedCount === 0
    ? 'success'
    : successCount > 0
      ? 'partial'
      : 'failed';

  return { deliveryStatus, successCount, failedCount, failedTargets };
}

function getFailedTargetsFromError(error) {
  const failedMessageList = Array.isArray(error?.failedMessageList) ? error.failedMessageList : [];
  return failedMessageList.map((item) => ({
    phone: String(item?.to || ''),
    error: String(item?.statusMessage || item?.errorMessage || error?.message || '접수에 실패했습니다.'),
  }));
}

module.exports = function setupSmsService(ipcMain, settingsStore, app) {
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
    try {
      if (fs.existsSync(smsHistoryPath)) {
        fs.unlinkSync(smsHistoryPath);
      }
    } catch (err) {
      console.error('발송 이력 삭제 실패:', err);
    }
  });

  ipcMain.handle('get-solapi-balance', async (_, { apiKey, apiSecret }) => {
    try {
      const messageService = new SolapiMessageService(apiKey, apiSecret);
      const result = await messageService.getBalance();
      return { success: true, balance: result };
    } catch (error) {
      console.error('Solapi 인증 실패:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('send-sms', async (_, payload) => {
    let temporaryImageDir = null;
    try {
      const settings = settingsStore.store;
      if (!settings.solapiApiKey || !settings.solapiApiSecret || !settings.solapiSenderNumber) {
        throw new Error('솔라피 계정 정보나 발신번호가 설정되지 않았습니다.');
      }
      
      const messageService = new SolapiMessageService(settings.solapiApiKey, settings.solapiApiSecret);
      const { targets, message, imageBase64 } = payload;
      if (!Array.isArray(targets) || targets.length === 0) {
        throw new Error('발송 대상이 없습니다.');
      }
      if (typeof message !== 'string' || !message.trim()) {
        throw new Error('메시지 내용을 입력해 주세요.');
      }
      
      let fileId = null;
      if (imageBase64) {
        const temporaryImage = createTemporaryMmsImage(imageBase64);
        temporaryImageDir = temporaryImage.tempDir;
        const result = await messageService.uploadFile(temporaryImage.filePath, 'MMS');
        if (result && result.fileId) {
          fileId = result.fileId;
        } else {
          throw new Error('이미지 업로드에 실패했습니다.');
        }
      }

      const messages = targets.map((t) => {
        let finalMessage = message;
        Object.keys(t).forEach((key) => {
          const regex = new RegExp(`{${key}}`, 'g');
          finalMessage = finalMessage.replace(regex, String(t[key] || ''));
        });

        const rawPhone = t.phone || t['휴대폰'] || t['전화번호'] || t['연락처'] || '';
        const msgObj = {
          to: String(rawPhone).replace(/[^0-9]/g, ''),
          from: settings.solapiSenderNumber.replace(/[^0-9]/g, ''),
          text: finalMessage,
        };

        if (fileId) {
          msgObj.imageId = fileId;
          msgObj.subject = '\u200B';
          msgObj.type = 'MMS';
        }
        return msgObj;
      });

      const sendResult = await messageService.send(messages, { showMessageList: true });
      const outcome = getSendOutcome(sendResult, targets.length);
      const errorMsg = outcome.failedCount > 0
        ? `${outcome.failedCount}명 접수 실패${outcome.failedTargets.length > 0 ? `: ${outcome.failedTargets.map((item) => item.error).join(' / ')}` : ''}`
        : undefined;
      
      saveSmsHistory({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        template: message,
        hasImage: !!imageBase64,
        imageBase64: imageBase64 || undefined,
        targets: targets.map(t => ({
          name: t.name || t['동참자'] || t['대주'] || t['이름'] || '이름없음',
          phone: t.phone || t['휴대폰'] || t['전화번호'] || t['연락처'] || ''
        })),
        success: outcome.deliveryStatus === 'success',
        deliveryStatus: outcome.deliveryStatus,
        successCount: outcome.successCount,
        failedCount: outcome.failedCount,
        failedTargets: outcome.failedTargets,
        errorMsg,
        result: sendResult
      });

      if (outcome.deliveryStatus === 'failed') {
        return {
          success: false,
          error: errorMsg || '모든 수신자 접수에 실패했습니다.',
          result: sendResult,
          ...outcome,
        };
      }

      return { success: true, result: sendResult, partial: outcome.deliveryStatus === 'partial', ...outcome };
    } catch (error) {
      console.error('문자 발송 실패:', error);
      try {
        const { targets = [], message = '', imageBase64 } = payload || {};
        const failedTargets = getFailedTargetsFromError(error);
        saveSmsHistory({
          id: Date.now().toString(),
          date: new Date().toISOString(),
          template: message,
          hasImage: !!imageBase64,
          imageBase64: imageBase64 || undefined,
          targets: targets.map(t => ({
            name: t.name || t['동참자'] || t['대주'] || t['이름'] || '이름없음',
            phone: t.phone || t['휴대폰'] || t['전화번호'] || t['연락처'] || ''
          })),
          success: false,
          deliveryStatus: 'failed',
          successCount: 0,
          failedCount: failedTargets.length || targets.length,
          failedTargets,
          errorMsg: error.message
        });
      } catch {}
      return { success: false, error: error.message };
    } finally {
      if (temporaryImageDir) {
        try {
          fs.rmSync(temporaryImageDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn('임시 MMS 이미지 삭제 실패:', cleanupError);
        }
      }
    }
  });

  // 자동 발송도 수동 발송과 같은 솔라피 응답 판정 규칙을 사용한다.
  return { saveSmsHistory, getSendOutcome, getFailedTargetsFromError };
};
