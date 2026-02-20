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
  message: string;
}

export interface SendSMSResponse {
  success: boolean;
}
