/**
 * 엑셀 데이터(회원 목록) 객체 배열에서 사용 가능한 매크로(치환 변수) 항목 키들을 추출합니다.
 * @param members 회원 데이터 배열 (첫 번째 객체를 기준으로 키를 추출)
 * @returns 추출된 키 배열 (예: ['대주', '동참자', '신도번호', '최종납부월', '등록일'])
 */
export function getAvailableMacroKeys(members: any[]): string[] {
  if (!members || members.length === 0) return [];
  return Object.keys(members[0]).filter(k => k !== 'index' && k !== 'status' && k !== 'name' && k !== 'phone');
}
