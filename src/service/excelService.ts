import type { Member } from '@/types/member';
import * as XLSX from 'xlsx';

type ExcelRawRow = Record<string, string | number | boolean | Date | undefined>;

type FormattedRow = Record<string, string | number | boolean | undefined>;

export const parseExcel = (file: File): Promise<Member[]> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      const result = evt.target?.result;
      if (!(result instanceof ArrayBuffer)) return;

      // 1. cellDates: true 로 엑셀의 숫자형 날짜를 자바스크립트 Date 객체로 만듭니다.
      const workbook = XLSX.read(result, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      // 2. raw: true (기본값)로 설정하여 Date 객체를 문자열로 바꾸지 않고 날것 그대로 가져옵니다.
      // defval: '' 옵션을 주어 빈 셀이더라도 컬럼 키가 누락되지 않게 하여 엑셀 원래의 컬럼 순서를 보장합니다.
      const data = XLSX.utils.sheet_to_json<ExcelRawRow>(sheet, { defval: '' });

      const parsed: Member[] = data.map((row) => {
        const formattedRow: FormattedRow = {};

        // 3. 데이터를 한 줄씩 읽으면서 데이터 변환을 수행합니다.
        Object.keys(row).forEach((key) => {
          let value = row[key];

          if (value instanceof Date) {
            const d = value;
            // xlsx 라이브러리는 날짜를 UTC 기준으로 읽어오므로 getUTC 메서드를 씁니다.
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');

            formattedRow[key] = `${year}-${month}-${day}`;
          } else {
            // Checked / Unchecked 변환 로직 추가
            if (typeof value === 'string') {
              if (key === '영가여부') {
                value = value === 'Checked' ? 'O' : (value === 'Unchecked' ? 'X' : value);
              } else if (key === '음력') {
                value = value === 'Checked' ? '음력' : (value === 'Unchecked' ? '양력' : value);
              } else if (key === 'DM') {
                value = value === 'Checked' ? '수신동의' : (value === 'Unchecked' ? '미동의' : value);
              }
            }
            formattedRow[key] = value;
          }
        });

        return {
          ...formattedRow,
          status: String(formattedRow['상태'] ?? '활동'),
        } as Member;
      });

      resolve(parsed);
    };

    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (members: Member[]) => {
  if (members.length === 0) {
    return;
  }

  // 내보낼 데이터 가공 (관리용 필드 제외 및 필드명 정리)
  const exportData = members.map((member) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { index, status, name, phone, ...rest } = member;
    
    // 한국어 필드명 우선 순위 및 정리
    return {
      이름: name || member['이름'] || '',
      전화번호: phone || member['전화번호'] || '',
      상태: status || member['상태'] || '',
      ...rest
    };
  });

  // 워크시트 생성
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '회원목록');

  // 파일 생성 및 다운로드
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `신도인등_백업_${today}.xlsx`);
};
