export type MemberStatus = '활동' | '비활동';

export interface Member {
  name?: string;
  phone?: string;
  status: MemberStatus;
  index?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface SendSMSPayload {
  targets: Member[];
  messageTemplate: string;
  apiKey: string;
  apiSecret: string;
  senderNumber: string;
  imagePath?: string;
}

export interface SendSMSResponse {
  success: boolean;
  error?: string;
  result?: any;
}

export interface SmsHistoryTarget {
  name: string;
  phone: string;
}

export interface SmsHistoryItem {
  id: string;
  date: string;
  template: string;
  hasImage: boolean;
  imageBase64?: string;
  targets: SmsHistoryTarget[];
  success: boolean;
  errorMsg?: string;
  result?: any;
}

export interface Settings {
  warningDays: number;
  criticalDays: number;
  warningColor: string;
  criticalColor: string;
  safeColor: string;
  solapiApiKey?: string;
  solapiApiSecret?: string;
  solapiSenderNumber?: string;
}
