import type { Member, SendSMSPayload, SendSMSResponse, Settings } from './types/member';

export {};

export interface MdbSyncConfig {
  filePath?: string;
  password?: string;
  keyword?: string;
  enabled?: boolean;
  pollIntervalSeconds?: number;
  updateScanIntervalSeconds?: number;
  hasPassword?: boolean;
}

export interface MdbSyncStatus {
  state: 'idle' | 'syncing' | 'error';
  message: string;
  syncedAt?: string;
  rowCount?: number;
  elapsedMs?: number;
  error?: string;
}

export interface MdbConnectionResult {
  ok: boolean;
  tableCount?: number;
  memberCount?: number;
  driver?: string;
  error?: string;
}

export interface MdbSyncResult {
  ok: boolean;
  rowCount?: number;
  sourceRows?: number;
  newRows?: number;
  correctionRows?: number;
  correctionTotal?: number;
  elapsedMs?: number;
  syncedAt?: string;
  tooManyRows?: boolean;
  total?: number;
  maxRows?: number;
  keyword?: string;
  incremental?: boolean;
  updateScanRan?: boolean;
  maxReceiveMemberId?: number;
  error?: string;
}

declare global {
  interface Window {
    api: {
      addMembers: (data: Member[] | { data: Member[]; mode: 'append' | 'overwrite' }) => Promise<void>;
      deleteMembers: (data: Array<Member | string | number>) => Promise<Member[]>;
      loadMembers: () => Promise<Member[]>;
      getMembersPage: (options: {
        page?: number;
        limit?: number;
        location?: string;
        statusFilter?: string;
        search?: string;
        sortKey?: string;
        sortDir?: 'asc' | 'desc';
        warningDays?: number;
        criticalDays?: number;
      }) => Promise<{ members: Member[]; totalCount: number; totalPages: number; currentPage: number }>;
      getLocationStats: (options?: { warningDays?: number; criticalDays?: number }) => Promise<Record<string, {
        total: number;
        active: number;
        expired: number;
        twoWeeks: number;
        oneMonth: number;
      }>>;
      sendSMS: (payload: SendSMSPayload) => Promise<SendSMSResponse>;
      getSolapiBalance: (keys: { apiKey: string; apiSecret: string }) => Promise<{ success: boolean; balance?: any; error?: string }>;
      openExternal: (url: string) => Promise<boolean>;
      loadSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<void>;
      getSmsHistory: () => Promise<any[]>;
      clearSmsHistory: () => Promise<boolean>;
      getAutoSmsConfig: () => Promise<any>;
      saveAutoSmsConfig: (config: any) => Promise<void>;
      selectMdbFile: () => Promise<MdbSyncConfig | null>;
      getMdbConfig: () => Promise<MdbSyncConfig>;
      saveMdbConfig: (config: MdbSyncConfig) => Promise<MdbSyncConfig>;
      testMdbConnection: (config: MdbSyncConfig) => Promise<MdbConnectionResult>;
      syncMdbNow: (config: MdbSyncConfig) => Promise<MdbSyncResult>;
      getMdbSyncStatus: () => Promise<MdbSyncStatus>;
      onMdbSyncStatus: (callback: (status: MdbSyncStatus) => void) => () => void;
      clearMdbData: () => Promise<{ ok: boolean; error?: string }>;
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<{ ok: boolean; version?: string; message?: string }>;
    };
  }
}

