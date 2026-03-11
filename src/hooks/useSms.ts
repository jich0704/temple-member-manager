import { useState } from 'react';
import type { Member } from '../types/member';

/*
 * SMS 발송 관련 + 추후 외부API 연동 대비
 */
export function useSMS() {
  const [isSending, setIsSending] = useState(false);

  const sendSMS = async ({ targets, message }: { targets: Member[]; message: string }) => {
    if (!targets.length) return;

    setIsSending(true);

    await window.api.sendSMS({ targets, message });

    setIsSending(false);
  };

  return { sendSMS, isSending };
}
