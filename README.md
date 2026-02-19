[사찰 회원 관리 시스템]

# 개발 스택

- Electron
- React
- TypeScript
- Vite (build)
- Tailwind CSS v4
- shadcn (ui)
- lucide-react
- react-window
- react-virtualized-auto-sizer
- xlsx

# 프로젝트 구조

src/
├─ components/
│ ├─ header.tsx
│ ├─ memberTable.tsx
│ └─ ui/ (shadcn 컴포넌트)
│
├─ hooks/
│ ├─ useMembers.ts
│ └─ useSms.ts
│
├─ service/
│ └─ excelService.ts
│
├─ types/
│ └─ member.ts
│
└─ App.tsx

# 실행방법

1.  루트경로 진입
2.  npm install
3.  npm run dev

# exe 추출

1.  npm run dist
2.  setup 파일 실행 및 설치
3.  exe 실행

# 남은 업무

1.  엑셀업로드시 시작일,종료일 추가
2.  종료일 1달남은시점 활동상태변경(파란색상), 1주일남은시점(빨간색상) - 활동상태에따른텍스트추가예정(?)
3.  sms 발송 버튼 텍스트 -> sms설정 텍스트로 변경
4.  sms 발송 로직 프로세스 구현예상
    1. 클릭시 팝업호출
    2. 문자업체 id,pwd 입력하여 연결 후 문자발송 호출
    3. row마다 sms발송버튼 추가
    4. 체크박스로 sms발송시 다중선택 가능하게
5.  회원삭제 작업이란 컬럼명을 다른이름으로수정
6.  엑셀 업로드시 동적 처리
7.  테이블에 컬럼표시시 이름,전화번호,상태,삭제 제외 나머지는 선택체크사항으로 표출할 수 있게 처리
