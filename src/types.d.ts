import type { Member, SendSMSPayload, SendSMSResponse } from './types/member';

export {};

declare global {
  interface Window {
    api: {
      addMembers: (data: Member[]) => Promise<void>;
      overwriteMembers: (data: Member[]) => Promise<void>;
      loadMembers: () => Promise<Member[]>;
      sendSMS: (payload: SendSMSPayload) => Promise<SendSMSResponse>;
    };
  }
}
