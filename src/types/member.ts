export type MemberStatus = '활동' | '비활동';

export interface Member {
  name: string;
  phone: string;
  status: MemberStatus;
}

export interface SendSMSPayload {
  targets: Member[];
  message: string;
}

export interface SendSMSResponse {
  success: boolean;
}
