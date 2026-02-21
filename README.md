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
│ └─ useDebounce.ts
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

# 엑셀업로드 1000건 테스트 방법

1. 프로젝트 루트경로
2. node makeDummy.js 실행
3. 프로젝트내에 xlsx 파일생성

# 개발된 업무 (~2.20)

- 엑셀업로드 기능
- 엑셀업로드 컬럼 동적 처리
- 컬럼 테이블 ROW에 선택적 표출 가능 (최소 3개)
- 컬럼 정렬처리(한글, 숫자 대응)
- 종료일에 따른 활성상태 색상표현(종료일이 컬럼으로 있다는 가정하여야하며 2026-02-19 의 포맷 기준이어야함 \*추후변경될 수 있음)
- 통합검색기능 (추가된 동적 컬럼 대응하여 관련 데이터 필터링)
- 회원통계 (활동/비활동 관련 통계VIEW) + 토글형식 ON/OFF 가능
- 업로드데이터 로컬PC 영구저장
- 목록 페이징처리
- 리스트에 표출된 회원 삭제 기능
- ROW마다 SMS발송버튼 추가(개별발송)

# 남은 업무

- SMS 발송 로직 프로세스 구현예상
  1. 클릭시 팝업호출
  2. 문자업체 ID,PWD 입력하여 연결 후 문자발송 호출
  3. 체크박스로 SMS발송시 다중선택 가능하게

# 주요사항 체크리스트

- 고객사에서 종료일(ex. 2026-02-19)을 엑셀 컬럼으로 무조건 넣었다는 가정하에 작업된 내역들이 많습니다.
  이 부분에 대해서 넣는지 안넣는지 확인이 필요하긴할거같습니다. 혹시나 안넣는다면... 수정이 많을거같습니다.
- 고객사에서 전화번호를 엑셀업로드시 넣지않으면 무조건 버그가 날겁니다. (ex. SMS발송실패 등)

- 위 2개를 대응하려면 엑셀은 동적으로 처리하되 필수적인 컬럼항목은 유효성검사를 체크해서 업로드못하게막던지 사전에 최소 2~3개의 고정컬럼은 협의가 필요할 수 있을거같습니다..
