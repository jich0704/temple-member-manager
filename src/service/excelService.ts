import * as XLSX from 'xlsx';
import type { Member } from '../types/member';

interface ExcelRow {
  이름: string;
  전화번호: string;
}

export function parseExcel(file: File): Promise<Member[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      const result = evt.target?.result;
      if (!(result instanceof ArrayBuffer)) return;

      const workbook = XLSX.read(result, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const data = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

      const parsed: Member[] = data.map((row) => ({
        name: row.이름 ?? '',
        phone: row.전화번호 ?? '',
        status: '대기',
      }));

      resolve(parsed);
    };

    reader.readAsArrayBuffer(file);
  });
}
