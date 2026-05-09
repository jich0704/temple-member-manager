import type { Member, SendSMSPayload, SendSMSResponse, Settings } from './types/member';

export {};

declare global {
  interface Window {
    api: {
      addMembers: (data: Member[]) => Promise<void>;
      deleteMembers: (data: Member[]) => Promise<void>;
      loadMembers: () => Promise<Member[]>;
      sendSMS: (payload: SendSMSPayload) => Promise<SendSMSResponse>;
      getSolapiBalance: (keys: { apiKey: string; apiSecret: string }) => Promise<{ success: boolean; balance?: any; error?: string }>;
      openExternal: (url: string) => Promise<boolean>;
      loadSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<void>;
      getSmsHistory: () => Promise<any[]>;
      clearSmsHistory: () => Promise<boolean>;
      getAutoSmsConfig: () => Promise<any>;
      saveAutoSmsConfig: (config: any) => Promise<void>;
    };
  }
}
