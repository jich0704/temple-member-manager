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
      const data = XLSX.utils.sheet_to_json<ExcelRawRow>(sheet);

      const parsed: Member[] = data.map((row) => {
        const formattedRow: FormattedRow = {};

        // 3. 데이터를 한 줄씩 읽으면서, '날짜(Date)' 타입이 발견되면 무조건 YYYY-MM-DD로 바꿔버립니다.
        Object.keys(row).forEach((key) => {
          if (row[key] instanceof Date) {
            const d = row[key] as Date;
            // xlsx 라이브러리는 날짜를 UTC 기준으로 읽어오므로 getUTC 메서드를 씁니다.
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');

            formattedRow[key] = `${year}-${month}-${day}`;
          } else {
            formattedRow[key] = row[key];
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
