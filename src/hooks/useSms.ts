import { useState } from 'react';
import type { SendSMSPayload } from '../types/member';

/*
 * SMS 발송 관련 + 외부API 연동
 */
export const useSMS = () => {
  const [isSending, setIsSending] = useState(false);

  const sendSMS = async (payload: SendSMSPayload) => {
    if (!payload.targets.length) return { success: false, error: '대상이 없습니다.' };

    setIsSending(true);
    try {
      return await window.api.sendSMS(payload);
    } finally {
      // IPC 자체가 예외를 던져도 발송 버튼이 계속 비활성 상태로 남지 않게 한다.
      setIsSending(false);
    }
  };

  const checkSolapiBalance = async (apiKey: string, apiSecret: string) => {
    return await window.api.getSolapiBalance({ apiKey, apiSecret });
  };

  return { sendSMS, isSending, checkSolapiBalance };
}
