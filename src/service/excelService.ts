import type { Member } from '@/types/member';
import * as XLSX from 'xlsx';

type ExcelRawRow = Record<string, string | number | boolean | Date | undefined>;
type FormattedRow = Record<string, string | number | boolean | undefined>;

const formatDate = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeExcelValue = (key: string, value: string | number | boolean | Date | undefined) => {
  if (value instanceof Date) return formatDate(value);
  if (typeof value !== 'string') return value;

  if (key === '영가여부') {
    if (value === 'Checked') return 'O';
    if (value === 'Unchecked') return 'X';
  }

  if (key === '음력') {
    if (value === 'Checked') return '음력';
    if (value === 'Unchecked') return '양력';
  }

  if (key === 'DM') {
    if (value === 'Checked') return '수신동의';
    if (value === 'Unchecked') return '미동의';
  }

  return value;
};

export const parseExcel = (file: File): Promise<Member[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const result = evt.target?.result;
        if (!(result instanceof ArrayBuffer)) {
          throw new Error('엑셀 파일을 읽을 수 없습니다.');
        }

        const workbook = XLSX.read(result, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
          throw new Error('읽을 수 있는 시트가 없습니다.');
        }
        const data = XLSX.utils.sheet_to_json<ExcelRawRow>(workbook.Sheets[firstSheetName], { defval: '' });
        if (data.length === 0) {
          throw new Error('회원 데이터가 없는 엑셀 파일입니다.');
        }

        const parsed: Member[] = data.map((row) => {
          const formattedRow: FormattedRow = {};

          Object.keys(row).forEach((key) => {
            formattedRow[key] = normalizeExcelValue(key, row[key]);
          });

          const phone = String(formattedRow['휴대폰'] || formattedRow['전화번호'] || '').trim();
          const name = String(formattedRow['동참자'] || formattedRow['대주'] || formattedRow['이름'] || '').trim();

          return {
            ...formattedRow,
            name,
            phone,
            status: String(formattedRow['상태'] || '활동'),
          } as Member;
        });

        resolve(parsed);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('엑셀 파일을 처리하지 못했습니다.'));
      }
    };

    reader.onerror = () => reject(new Error('엑셀 파일을 읽는 중 오류가 발생했습니다.'));

    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (members: Member[]) => {
  if (members.length === 0) return;

  const exportData = members.map((member) => {
    const { index, status, name, phone, source, sourceKey, mdbUpdatedAt, mdbDeleted, ...rest } = member;

    return {
      이름: name || member['동참자'] || member['대주'] || '',
      전화번호: phone || member['휴대폰'] || '',
      상태: status || member['상태'] || '',
      ...rest,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '회원목록');

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `신도인등_백업_${today}.xlsx`);
};
