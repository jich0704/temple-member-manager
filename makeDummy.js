import * as XLSX from 'xlsx';

const data = [];
const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const firstNames = ['민수', '지은', '철수', '영희', '다은', '준호', '서연', '지훈', '하은', '도윤'];
const genders = ['남', '여'];

// 1. JSON 형태의 1000명 데이터 배열 만들기
for (let i = 1; i <= 1000; i++) {
  const name = lastNames[Math.floor(Math.random() * lastNames.length)] + firstNames[Math.floor(Math.random() * firstNames.length)] + i;

  const phone = `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const gender = genders[Math.floor(Math.random() * genders.length)];

  data.push({
    이름: name,
    전화번호: phone,
    성별: gender,
    시작일: '2025-11-30',
    종료일: '2026-03-30',
  });
}

// 2. 데이터를 진짜 엑셀 시트로 변환
const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, '회원명단');

// 3. 진짜 .xlsx 파일로 디스크에 저장!
XLSX.writeFile(workbook, 'test_1000.xlsx');

console.log('엑셀 파일(test_1000.xlsx) 생성 완료!');
