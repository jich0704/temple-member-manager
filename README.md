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

# [ ~ 10.18]

## 1. 위치 카드 디자인 및 접기/펼치기 높이 동적 개선
- 선택된 위치 카드의 배경을 어두운 차콜 톤에서 밝은 블루 포인트 톤(`bg-blue-50/90`, `border-blue-500`)으로 개선
- `ResizeObserver`로 첫 줄 카드의 실제 높이를 측정하여, 메뉴 폰트 크기 변경 시에도 접힌 상태에서 1줄 카드가 잘리지 않고 카드 높이에 맞게 표시되도록 수정

## 2. 문자 발송(수동/자동) 안정성 및 날짜 파싱 보완
- MDB 연동 회원의 전화번호(`phone`, `휴대폰`, `전화번호`, `연락처`) 및 이름(`동참자`, `대주`, `이름`) 필드를 모두 인식하도록 수정 및 발송 실패 이력 기록 추가
- 자동 문자 발송(`autoSmsService.cjs`) 시 전체 회원 로딩 대신 만료 임박 대상자만 SQLite에서 조회하도록 개선하고, `YYYY-MM` / `YYYY.MM` 포맷 및 월말 기준 남은 일수 계산 반영

## 3. 이력 모달(문자 발송 이력 / MDB 동기화 이력) 페이징 및 UI 통일
- 문자 발송 이력 모달(`smsHistoryModal.tsx`): **전체 / 성공 / 실패** 탭 필터, 페이지당 10건 페이지네이션, 클릭 시 상세(전문/MMS 이미지/오류 원인/수신자 명단) 펼침 UI 적용
- MDB 동기화 이력 모달(`mdbSyncLogsModal.tsx`): 첫 페이지/마지막 페이지 이동이 가능한 페이지네이션 UI로 통일

## 4. 리스트 정렬, 검색 페이징 및 MDB 데이터 초기화 버그 수정
- 기본 정렬 기준을 `신도번호`로 통일하고 숫자 크기순 정렬(`CAST AS INTEGER`) 및 헤더 정렬 방향 아이콘(`↑`/`↓`) 표시 적용
- 검색어 입력 후 페이지 이동 시 검색어가 초기화되던 버그 수정
- MDB 데이터 초기화(`clear-mdb-data`) 시 SQLite 즉시 삭제(`clearMdbMembers`) 및 프론트엔드 위치 카드 통계·회원 목록 즉시 갱신 처리

## 5. 사찰 계정 로그인 화면 및 Firebase 클라우드 동기화 아키텍처 구축
- **로그인 화면(`LoginPage.tsx`)**: Firebase Auth 사찰 아이디/비밀번호 로그인, 실제 Firebase 세션 기반 자동 로그인, 헤더 계정 표시 및 로그아웃 기능 추가 (로컬 테스트 로그인은 개발 서버에서 명시적으로 활성화한 경우에만 허용)
- **하이브리드 데이터 구조(`firebaseSyncService.ts`)**:
  - 48만 건의 대용량 MDB 원본 회원 데이터는 로컬 SQLite(`members.db`)에서 고속 처리
  - Firestore(`temples/{uid}`)에는 관리자 승인 사찰 계정 정보(`isActive`), 현재 설치된 앱 버전(`appVersion`), 실시간 요약 통계(`locationStats`), 솔라피 잔액(`solapiBalance`), MDB 동기화 상태(`mdbStatus`), 환경설정(`config/settings`), 문자 발송 이력용 경로(`sms_history`), 통합 오류 이력(`error_logs`)만 경량 동기화

## 6. 원격 자동 업데이트(`electron-updater`) 및 앱 버전 표기 적용
- 로그인 화면 우측 상단 및 메인 대시보드 우측 상단 헤더에 현재 앱 버전(`v1.0.0`) 표기 추가
- `electron-updater` 및 GitHub Releases(`jich0704/temple-member-manager`) 연동으로 사찰 PC에서 앱 실행 시 새 버전을 자동 감지·다운로드 후 재시작 안내 팝업 제공

---

# 원격 자동 업데이트 (Auto-Update) 배포 및 테스트 가이드

사찰 PC에 매번 `.exe` 파일을 직접 전달하지 않아도, 개발자가 **GitHub Releases**에 새 버전만 올리면 사찰 PC가 앱을 켤 때 자동으로 새 버전을 감지하여 업데이트합니다.

## 1. 동작 원리
1. `package.json`의 `"build.publish"` 설정이 본인의 GitHub 저장소(`jich0704/temple-member-manager`)를 바라보도록 세팅되어 있습니다.
2. 빌드(`npm run dist`)가 실행되면 `release/` 폴더 안에 아래 3가지 핵심 파일이 생성됩니다:
   - `신도관리시스템 Setup X.X.X.exe` (설치 파일)
   - `신도관리시스템 Setup X.X.X.exe.blockmap` (변경된 부분만 빠르게 다운로드하기 위한 블록맵 파일)
   - `latest.yml` (**가장 중요**: 최신 버전 번호와 파일 해시 정보가 적힌 메타데이터 파일)
3. 사찰 PC에서 앱을 실행하면 3초 뒤 자동으로 GitHub Releases의 `latest.yml`을 확인합니다.
4. 내 PC의 버전(예: `1.0.1`)보다 GitHub의 버전(예: `1.0.2`)이 높으면 백그라운드에서 조용히 다운로드한 뒤, **"새로운 버전(v1.0.2)이 다운로드되었습니다. 지금 재시작하여 업데이트를 적용하시겠습니까?"** 알림창을 띄웁니다. (기존 SQLite 회원 DB와 설정값은 그대로 유지됩니다.)

---

## 2. 새 버전 배포 방법 (Git 푸시와 동시에 버전 업 + 자동 배포)

`.github/workflows/release.yml` (GitHub Actions)과 `package.json`의 `release` 스크립트가 세팅되어 있어, **명령어 한 줄**로 버전 증가부터 Git 푸시, `.exe` 빌드 및 GitHub Releases 등록까지 자동으로 처리할 수 있습니다.

### 방법 A (추천): 명령어 한 줄로 버전 업 + Git 푸시 + 자동 빌드 배포 (`npm run release`)
1. 수정한 코드들을 평소처럼 커밋합니다:
   ```bash
   git add .
   git commit -m "기능 수정 내역"
   ```
2. 아래 명령어 중 하나를 실행합니다:
   - **패치 버전 업 (`1.0.0` → `1.0.1`)**:
     ```bash
     npm run release
     ```
   - **마이너 버전 업 (`1.0.1` → `1.1.0`)**:
     ```bash
     npm run release:minor
     ```
   - **메이저 버전 업 (`1.1.0` → `2.0.0`)**:
     ```bash
     npm run release:major
     ```
3. **자동으로 일어나는 일**:
   - `package.json`의 `"version"`이 자동으로 올라가고(`1.0.1` → `1.0.2`), 버전 커밋과 Git 태그(`v1.0.2`)가 생성된 뒤 GitHub로 코드와 태그가 함께 Push됩니다.
   - GitHub의 **Actions** 탭에서 자동으로 Windows 빌드가 시작되며(약 2~3분 소요), 완료되면 **GitHub Releases**에 `.exe`, `.blockmap`, `latest.yml`이 올라갑니다.
   - *(참고: GitHub Actions가 만든 릴리즈가 Draft(임시저장) 상태로 올라간 경우, GitHub Releases 페이지에서 **[Publish release]** 버튼만 한 번 눌러주면 즉시 모든 사찰 PC에 배포됩니다.)*

### 방법 B: 내 PC에서 직접 빌드해서 GitHub 웹페이지에 올리기
1. `package.json`의 `"version"` 값을 `"1.0.2"`로 수정한 뒤 터미널에서 `npm run dist`를 실행합니다.
2. GitHub 저장소(`https://github.com/jich0704/temple-member-manager/releases`)에서 **[Draft a new release]** 클릭 → 태그 `v1.0.2` 입력
3. 프로젝트 `release/` 폴더 안에 생성된 3개 파일(`신도관리시스템 Setup 1.0.2.exe`, `신도관리시스템 Setup 1.0.2.exe.blockmap`, `latest.yml`)을 드래그해서 올리고 **[Publish release]**를 클릭합니다.

> **주의**: GitHub 저장소가 `Private`(비공개)이면 사찰 PC에서 토큰 없이 다운로드할 수 없으므로, 저장소는 `Public`으로 두어야 합니다.

---

## 3. 자동 업데이트 직접 테스트해보는 방법 (`1.0.1` → `1.0.2`)

내 PC 한 대에서도 실제로 자동 업데이트가 작동하는지 바로 테스트해볼 수 있습니다.

1. **`1.0.1` 버전 설치하기**
   - `package.json`의 `"version"`을 `"1.0.1"`로 맞춘 뒤 `npm run dist`를 실행합니다.
   - 생성된 `release/신도관리시스템 Setup 1.0.1.exe`를 실행하여 내 PC에 설치합니다.
   - 설치된 앱이 켜지면 로그인 화면과 상단 헤더에 **`v1.0.1`**로 표시되는지 확인하고 앱을 종료합니다.
2. **`1.0.2` 버전 자동 배포하기**
   - 터미널에서 아래 명령어를 실행합니다:
     ```bash
     npm run release
     ```
   - 자동으로 버전이 `1.0.2`로 바뀌고 GitHub로 푸시됩니다.
   - GitHub 저장소의 **Actions** 탭에서 빌드가 완료된 후, **Releases** 탭에 `v1.0.2` 릴리즈가 게시(Published)되었는지 확인합니다. (Draft 상태라면 **[Publish release]** 클릭)
3. **자동 업데이트 확인**
   - 바탕화면(또는 시작 메뉴)에 설치되어 있던 **`1.0.1` 버전 앱(`신도관리시스템`)**을 실행합니다.
   - 실행 후 약 5~15초 뒤(백그라운드 다운로드 완료 직후) **"업데이트 준비 완료 - 새로운 버전(v1.0.2)이 다운로드되었습니다. 지금 재시작하여 업데이트를 적용하시겠습니까?"** 창이 자동으로 뜹니다.
   - **[지금 재시작]**을 누르면 앱이 자동으로 재설치 후 다시 켜지며, 상단 버전 표기가 **`v1.0.2`**로 바뀐 것을 확인할 수 있습니다.

---


# Firebase 운영 인증 및 배포 가이드

운영 로그인은 **Firebase Authentication 사용자**와 **Firestore의
`temples/{uid}` 승인 프로필**이 모두 있어야 가능합니다. Firebase Auth 사용자만
만들어서는 앱에 접근할 수 없습니다. 운영 빌드에 Firebase 설정이 없으면 로그인 화면을
우회하지 않고 설정 오류를 표시합니다.

## 1. Firebase 콘솔 최초 설정

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트를 만들고,
   **Authentication > Sign-in method**에서 **이메일/비밀번호**를 사용 설정합니다.
   일반 사찰은 앱에서 회원가입을 할 수 없습니다. `masterAdmin` 권한의 마스터 계정만 전용 관리 화면에서 사찰 계정을 생성합니다.
2. **Firestore Database**를 `asia-northeast3`(서울) 등 운영 지역으로 생성합니다.
3. **프로젝트 설정 > 내 앱 > 웹 앱**에서 설정 값을 확인하고, 프로젝트 루트의
   `.env.example`을 `.env`로 복사해 모든 `VITE_FIREBASE_*` 값을 입력합니다.
4. Firebase 없이 UI를 점검하는 개발 상황에서만 `.env`에
   `VITE_ENABLE_LOCAL_AUTH_BYPASS=true`를 추가합니다. 이 우회는 `npm run dev`에서만
   동작하며, `npm run build`로 만든 운영 앱에서는 항상 차단됩니다.

## 2. Firestore 보안 규칙 배포

저장소의 [firebase.json](firebase.json)과 [firestore.rules](firestore.rules)을
Firebase CLI로 배포합니다. 기존의 모든 하위 경로 쓰기를 허용하는 단순 규칙을 사용하면
안 됩니다.

```bash
npx firebase-tools login
npx firebase-tools use --add
npm run firebase:deploy-rules
```

배포된 규칙은 사찰이 자기 `temples/{uid}` 경로만 읽게 하며, `loginId`,
`templeName`, `isActive` 같은 승인 필드는 앱에서 변경하지 못하게 막습니다. 계정이
비활성화되면 남아 있는 인증 토큰으로도 하위 운영 데이터에 접근할 수 없습니다.

## 3. 사찰 계정 생성·승인·비활성화

사찰 계정은 Firebase 콘솔에서 개별 생성하지 말고, 저장소의 관리자 도구를 사용합니다.
이 도구는 Firebase Auth 사용자와 Firestore 승인 프로필을 한 번에 처리합니다.

1. Google Cloud Console에서 해당 Firebase 프로젝트의 서비스 계정 JSON 키를 만들고,
   관리자 PC의 안전한 경로에만 보관합니다. Git에 올리면 안 됩니다.
2. 서비스 계정 경로를 설정합니다.

```bash
# macOS / Linux
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/service-account.json"

# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\service-account.json"
```

3. 프로젝트 의존성을 설치한 뒤 아래 명령으로 계정을 관리합니다. 로그인 아이디
   `jogyesa`는 Firebase 이메일 `jogyesa@temple-manager.app`으로 생성됩니다.

```bash
npm install

# 새 사찰 계정 생성 및 승인
npm run firebase:manage-temple -- --login-id jogyesa --temple-name "조계사" --password "초기-안전-비밀번호"

# 계정 비활성화 또는 재활성화
npm run firebase:manage-temple -- --login-id jogyesa --active false
npm run firebase:manage-temple -- --login-id jogyesa --active true

# 비밀번호 재설정
npm run firebase:manage-temple -- --login-id jogyesa --password "새-안전-비밀번호" --reset-password
```

상세 절차는 [Firebase 운영 배포 문서](docs/firebase-deployment.md)를 참고합니다.
처음 Firebase를 실제 연결하거나 운영 설치본을 검증할 때는
[Firebase 인증 연동: 남은 작업 실행 가이드](docs/firebase-remaining-work.md)를 순서대로 진행하세요.

마스터 관리자 계정 생성과 Cloud Function 배포 절차도 위 Firebase 운영 배포 문서에 포함되어 있습니다.

## 4. Firestore 저장 구조와 권한

- **`temples/{uid}`**: 관리자만 생성·승인 상태를 수정합니다.
  - 관리자 전용: `loginId`, `templeName`, `isActive`, `createdAt`, `updatedAt`
  - 앱 기록용: `lastLoginAt`, `lastActiveAt`, `appVersion`, `solapiBalance`,
    `mdbStatus`, `locationStats`
- **`temples/{uid}/config/settings`**: 사찰별 환경설정 백업입니다. 솔라피 API Secret을
  포함할 수 있으므로 서비스 계정과 사찰 계정을 엄격히 관리해야 합니다.
- **`temples/{uid}/sms_history/{id}`**: 문자 발송 이력용 경로입니다.
- **`temples/{uid}/error_logs/{id}`**: 오류 이력용 경로입니다. 앱에서는 추가만 가능하며
  수정·삭제는 막습니다.

## 5. 운영 배포 전 확인

```bash
npm install
npm run build
```

활성 사찰 계정은 로그인되고, 비활성 계정은 거부되는지 확인합니다. Firebase 환경변수가
없는 운영 빌드에서는 설정 오류 화면이 표시되어야 합니다. 개발 로컬 우회와 운영 배포판을
혼용하지 마세요.

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
- **`main.tsx`**: 앱 진입점. 로그인 세션 게이트(`AppRoot`) 및 전역 런타임 에러 바운더리(`ErrorBoundary`)
- **`Dashboard.tsx`**: 메인 화면. 회원 테이블, 위치별 카드, 검색, 페이지네이션, 클라우드 요약 동기화
- **`components/LoginPage.tsx`**: 사찰 계정 로그인 화면 (Firebase Auth, 개발 전용 로컬 우회 모드)
- **`service/firebaseConfig.ts`**: Firebase SDK 초기화, 환경변수(`.env`) 검증, 로그인 유지 범위 설정
- **`service/firebaseSyncService.ts`**: Firebase 실제 세션·사찰 승인 상태 인증, 설정 백업, 요약 통계 동기화, 통합 오류 이력(`error_logs`) 기록 서비스
- **`hooks/useMembers.ts`**: 회원 데이터 페이징 로드, 필터/정렬/검색, 로딩 상태, 초기화 로직
- **`components/header.tsx`**: 헤더. 각종 모달 진입점 버튼, 로그인 계정 표시 및 로그아웃
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
- 명단초기화 로직 확인 필요 => 초기화해도 화면상 달라지는점 없음 (10.18 로컬 DB 및 화면 즉시 갱신 완료 / 원본 MDB 파일 영향 없음)
  - 이 프로그램의 리스트 초기화기능 필요여부 논의 필요
- 카드접기/펼치기로 변경되는 카드부분 높이값 펼치기시 카드 높이 기준으로 키우기 (10.18 반영 완료)
- 카드가 2개 이상일떄 전체의 카운팅이 필요할지 논의 필요

