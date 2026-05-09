import { useState } from 'react';
import type { SendSMSPayload } from '../types/member';

/*
 * SMS 발송 관련 + 외부API 연동
 */
export function useSMS() {
  const [isSending, setIsSending] = useState(false);

  const sendSMS = async (payload: SendSMSPayload) => {
    if (!payload.targets.length) return { success: false, error: '대상이 없습니다.' };

    setIsSending(true);
    const result = await window.api.sendSMS(payload);
    setIsSending(false);
    return result;
  };

  const checkSolapiBalance = async (apiKey: string, apiSecret: string) => {
    return await window.api.getSolapiBalance({ apiKey, apiSecret });
  };

  return { sendSMS, isSending, checkSolapiBalance };
}
