const fs = require('fs');
const path = require('path');
const coolsms = require('coolsms-node-sdk').default;

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
      const messageService = new coolsms(apiKey, apiSecret);
      const result = await messageService.getBalance();
      return { success: true, balance: result };
    } catch (error) {
      console.error('Solapi 인증 실패:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('send-sms', async (_, payload) => {
    try {
      const settings = settingsStore.store;
      if (!settings.solapiApiKey || !settings.solapiApiSecret || !settings.solapiSenderNumber) {
        throw new Error('솔라피 계정 정보나 발신번호가 설정되지 않았습니다.');
      }
      
      const messageService = new coolsms(settings.solapiApiKey, settings.solapiApiSecret);
      const { targets, message, imageBase64 } = payload;
      
      let fileId = null;
      if (imageBase64) {
        const result = await messageService.uploadFile(imageBase64, 'IMAGE');
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

        const msgObj = {
          to: String(t['연락처']).replace(/[^0-9]/g, ''),
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

      const sendResult = await messageService.sendMany(messages);
      
      saveSmsHistory({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        template: message,
        hasImage: !!imageBase64,
        imageBase64: imageBase64 || undefined,
        targets: targets.map(t => ({ name: t.name || t['대주'] || '이름없음', phone: t.phone || t['연락처'] || '' })),
        success: true,
        result: sendResult
      });

      return { success: true, result: sendResult };
    } catch (error) {
      console.error('문자 발송 실패:', error);
      return { success: false, error: error.message };
    }
  });

  // return saveSmsHistory to be used by autoSmsService
  return { saveSmsHistory };
};
