export type MemberStatus = '대기' | '성공' | '실패';

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
