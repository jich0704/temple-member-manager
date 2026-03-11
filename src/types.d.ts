import type { Member, SendSMSPayload, SendSMSResponse, Settings } from './types/member';

export {};

declare global {
  interface Window {
    api: {
      addMembers: (data: Member[]) => Promise<void>;
      deleteMembers: (data: Member[]) => Promise<void>;
      loadMembers: () => Promise<Member[]>;
      sendSMS: (payload: SendSMSPayload) => Promise<SendSMSResponse>;
      loadSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<void>;
    };
  }
}
