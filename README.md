[신도 관리 시스템]

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

---

# 개발된 업무

# [ ~ 2.20]
- 엑셀업로드 기능
- 엑셀업로드 컬럼 동적 처리
- 컬럼 테이블 ROW에 선택적 표출 가능 (최소 3개)
- 컬럼 정렬처리(한글, 숫자 대응)
- 종료일에 따른 활성상태 색상표현
- 통합검색기능
- 회원통계 (활동/비활동 관련 통계VIEW) + 토글형식 ON/OFF 가능
- 업로드데이터 로컬PC 영구저장
- 목록 페이징처리
- 리스트에 표출된 회원 삭제 기능
- ROW마다 SMS발송버튼 추가(개별발송)

# [ ~ 3.12]
- 통계UI에 만료임박 통계 추가
- 만료임박 조건날짜 및 뱃지색상 커스텀 추가
- 사용PC 변경 혹은 데이터 CLEAR 대비해서 회원백업 기능 추가

# [ ~ 05.09]

## 1. MMS 이미지 전송 안정성 확보
- 기존 파일 경로 방식에서 벗어나, 앱 내부에서 이미지를 즉시 압축하고 포맷을 완벽한 `JPEG(300KB 이하)`로 강제 변환하여 솔라피 서버로 전송하도록 아키텍처 개편.
- MMS 발송 시 자동으로 메시지 내용이 제목으로 복사되어 두 번 전송되는 현상을 막기 위해, 제목을 투명 공백으로 고정 처리.

## 2. 문자 발송 내역(이력) 및 UI 고도화
- 이력 모달에서 차감된 잔액 및 건수가 `[object Object]`로 표시되던 오류 수정 및 천 단위 콤마 적용.
- MMS 발송 이력 모달에서 첨부 이미지 썸네일 직접 확인 가능 (Base64 로컬 저장).

## 3. 문자 연동 가이드 및 매크로 변수 동적 지원
- 엑셀 데이터 기반의 동적 치환 변수 뱃지 UI 추가 (일반 발송 및 자동 발송 모달 모두 적용).
- 초보자를 위한 솔라피 연동 가이드 창 제작 (가입 → 번호 등록 → API 키 생성 과정 상세 안내).

## 4. 엑셀 중복 판단 조건 강화
- `신도번호 + 대주 + 동참자` 세 가지 요소가 완벽히 일치해야만 중복으로 간주하도록 강화.

## 5. 자동 발송 스케줄러 기능
- 매일 지정된 시간에 "만료 1개월 전", "2주 전", "1주 전" 대상자에게 자동으로 안내 문자 발송 스케줄러 구현.
- 앱이 꺼져 있다가 켜지면 놓친 문자를 1회 한정 즉시 발송하는 보정 로직 적용.
- `auto-sms-log.json` 기록으로 동일 조건 중복 발송 완벽 차단.

---

# [ ~ 05.17]

## 1. 테이블 셀 마지막 문자발송 날짜 표기 추가

## 2. 카드섹션 위치별로 분리

## 3. 설정기능 제외 모두 밖으로
- 설정 내부에 있던 버튼을 모두 메인화면 헤더로 옮긴 뒤 박스별로 소제목 추가

## 4. MDB 파일 구조 분석 시작

---

# [ ~ 05.29]

## 1. MDB 실시간 연동 및 자동 동기화 스케줄러
- Access MDB 파일(`ReceiveMember`, `Receive`, `Member`, `FamilyInfo` 4개 테이블 JOIN)을 읽어 회원 데이터를 SQLite로 동기화하는 백엔드 서비스 구현 (`mdbService.cjs`)
- 신규 감지: `ReceiveMemberID > lastSyncedId` 기준으로 신규 추가된 회원 자동 감지
- 수정 감지: `Updatedt >= lastCheckedAt` 기준으로 기존 회원 정보 변경 자동 감지 (납부월 변경 등)
- 실시간 스케줄러 설정 모달: 감지 주기(초), 수정 보정 주기(초), 자동 동기화 ON/OFF 설정 가능
- 모달 헤더 옆 ⓘ 버튼으로 각 설정 항목 안내 팝업 제공

## 2. MDB 동기화 이력 모달 (`mdbSyncLogsModal.tsx`)
- 최근 30일 동기화 이력을 SQLite(`mdb_sync_logs`)에 저장하고 조회
- **전체 / 신규 / 수정 / 삭제** 탭으로 유형별 필터링 (백엔드 WHERE 쿼리 적용)
- 각 이력 행은 기본 한 줄 요약(토글), 클릭 시 상세 펼침
  - 신규: 테이블에서 표시되는 주요 컬럼만 표시 (이름, 휴대폰, 위치명 등)
  - 수정: 변경 전 → 변경 후 화살표 형식으로 모든 변경 필드 표시
- 페이지당 20건 숫자 버튼 페이지네이션
- 시간 표기 로컬 시간 기준 정상화 (`ko-KR` 포맷)
- `mdbUpdatedAt` 같은 ISO 날짜 문자열 자동 포맷 변환
- 모달 열 때마다 탭 초기값 "전체"로 리셋
- 신도번호 앞의 `mdb:receive-member:` 접두사 제거 후 숫자만 표시

## 3. 테이블 로딩 UX 개선
- 카드 선택, 검색, 페이지 변경, 페이지당 항목 수 변경 시 중앙 로딩 오버레이(스피너) 표시
- 페이지/항목 수 변경 시 스크롤 위치 자동 초기화 (테이블 상단으로 이동)
- `isLoading` 초기값 `true`로 설정 → 마운트 직후 "데이터 없음" 깜빡임 방지

## 4. 초기 로딩 이중 실행 버그 수정
- `smsLatestDates`, `settings`를 `useRef`로 관리하여 `reloadMembers` 불필요한 재생성 방지
- `isInitialized` ref 가드: 초기화 완료 전 `useEffect` 실행 차단
- `suppressEffect` ref: 초기화 직후 `useEffect` 이중 실행 억제
- `setTimeout(0)` 활용으로 React 위치 자동 선택 처리 후 1회만 데이터 로드
- `locationInitialized` ref: 초기 위치 자동 설정이 카드 클릭 시 재발동되지 않도록 방지

## 5. 위치 카드 뱃지 UI 개선
- 선택된 카드 / 미선택 카드 모두 동일한 뱃지 색상 유지
  - 총인원(회색), 사용중(초록), 1달전(황색), 2주전(주황), 만료(빨강)
- 현재 선택된 필터 뱃지에만 `ring-2` 테두리 강조 표시

## 6. 문자 자동 발송 - 위치별 발송 설정
- 자동 발송 설정 모달에 **발송 설정 / 위치별 설정** 탭 분리
- 위치별 설정 탭에서 각 위치명별로 발송 포함/미발송 개별 토글 설정 가능
- 기본값: **미발송** (명시적으로 ON한 위치만 발송 대상)
- 백엔드(`autoSmsService.cjs`)에서도 `locationEnabled` 설정값을 읽어 실제 발송 시 위치 필터링 반영
- 모달 열 때 전체 회원 `loadMembers()` 호출 제거 → 설정값만 로드하여 즉각 반응

## 7. 모달 UX 통일 및 안정화
- MDB 연동 모달, 스케줄러 설정 모달: `rounded-2xl` + `overflow-hidden` 적용으로 다른 모달과 테두리 스타일 통일
- MDB 스케줄러 모달의 ⓘ 팝업: `fixed` 포지셔닝으로 변경하여 `overflow-hidden`에 의한 잘림 방지
- `ErrorBoundary` 추가(`main.tsx`): React 런타임 오류 발생 시 흰 화면 대신 오류 메시지 화면에 표시

---

# 주요사항 체크리스트
- MDB 연동 시 신규 감지 테스트: `ReceiveMember` 테이블에 신규 행 INSERT 후 감지 주기 이후 이력 확인
- MDB 연동 시 수정 감지 테스트: `Member` 테이블 `UpdateDt = Now()` UPDATE 후 수정 보정 주기 이후 이력 확인

---

# 프로젝트 코드 구조

## 1. 백엔드 (`electron/`)
- **`main.cjs`**: 앱 진입점. 창 생성 및 서비스 모듈 조립
- **`preload.cjs`**: 프론트-백엔드 IPC 브릿지
- **`services/memberRepository.cjs`**: SQLite DB 접근 레이어. 회원 페이징 조회, 위치 통계, 동기화 이력 CRUD
- **`services/memberService.cjs`**: 엑셀 업로드 시 중복 검사 및 회원 데이터 저장/삭제
- **`services/smsService.cjs`**: 솔라피(SOLAPI) 문자 발송 및 이력 저장
- **`services/autoSmsService.cjs`**: 1분 주기 시간 감시 스케줄러. 위치별 발송 설정 반영
- **`services/mdbService.cjs`**: Access MDB 파일 폴링으로 신규/수정/삭제 감지 후 SQLite 동기화

## 2. 프론트엔드 (`src/`)
- **`Dashboard.tsx`**: 메인 화면. 회원 테이블, 위치별 카드, 검색, 페이지네이션
- **`hooks/useMembers.ts`**: 회원 데이터 페이징 로드, 필터/정렬/검색, 로딩 상태, 초기화 로직
- **`components/header.tsx`**: 헤더. 각종 모달 진입점 버튼
- **`components/memberTable.tsx`**: 회원 테이블. 로딩 오버레이, 스크롤 초기화
- **`components/ui/`**:
  - `mdbSyncModal.tsx`: MDB 연동 설정 + 실시간 스케줄러 설정
  - `mdbSyncLogsModal.tsx`: 동기화 이력 조회 (탭 필터, 토글 상세, 페이지네이션)
  - `autoSmsSettingsModal.tsx`: 자동 발송 설정 (발송 설정 탭 + 위치별 설정 탭)
  - `smsSendModal.tsx` / `smsHistoryModal.tsx`: 문자 발송 / 이력 확인
  - `solapiSetupModal.tsx`: 솔라피 API 연동 가이드
  - `excel-upload-dialog.tsx`: 엑셀 업로드 유효성 검증
- **`utils/macroUtils.ts`**: `{대주}` 등 치환 변수 동적 추출 유틸

## 확인필요사항 ##
- 명단초기화 로직 확인 필요 => 초기화해도 화면상 달라지는점 없음
  - mdb 초기화로 mdb파일에 영향이 가면 안될것 같은데 가도되는것인지는 논의 필요
  - 이 프로그램의 리스트 초기화기능 필요여부 논의 필요
- 카드접기/펼치기로 변경되는 카드부분 높이값 펼치기시 카드 높이 기준으로 키우기
- 카드가 2개 이상일떄 전체의 카운팅이 필요할지 논의 필요

