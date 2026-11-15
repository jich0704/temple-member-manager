# Firebase 운영 배포 절차

이 프로젝트의 운영 인증은 Firebase Authentication 사용자와 Firestore의
`temples/{uid}` 승인 프로필이 모두 있어야 로그인됩니다. Firebase Auth 사용자만
만들어서는 앱에 접근할 수 없습니다.

처음 Firebase 프로젝트를 연결하고 운영 설치본까지 검증하는 전체 절차는
[Firebase 인증 연동: 남은 작업 실행 가이드](firebase-remaining-work.md)를 따르세요.

## 1. Firebase 콘솔 최초 설정

1. Firebase 프로젝트를 만들고 **Authentication > Sign-in method**에서
   **이메일/비밀번호**를 사용 설정합니다. 앱 안에서 회원가입은 제공하지 않습니다.
2. **Firestore Database**를 `asia-northeast3`(서울) 등 운영 지역으로 생성합니다.
3. **프로젝트 설정 > 내 앱 > 웹 앱**에서 설정 값을 확인하고, 프로젝트 루트의
   `.env.example`을 `.env`로 복사해 `VITE_FIREBASE_*` 값을 채웁니다.
4. 개발 중 Firebase 없이 UI를 열어야 할 때만 `.env`에
   `VITE_ENABLE_LOCAL_AUTH_BYPASS=true`를 넣습니다. 이 우회는 `npm run dev`에서만
   작동하며, `npm run build`로 만든 운영 앱에서는 항상 차단됩니다.

## 2. Firestore 규칙 배포

이 저장소의 [firebase.json](../firebase.json)과
[firestore.rules](../firestore.rules)을 Firebase CLI로 배포합니다.

```bash
npx firebase-tools login
npx firebase-tools use --add
npm run firebase:deploy-rules
```

`firebase use --add`에서 운영 Firebase 프로젝트를 선택합니다. 배포 뒤에는 콘솔의
Firestore Rules 탭에서 배포된 규칙이 [firestore.rules](../firestore.rules)와 같은지
확인합니다.

## 3. 사찰 계정 생성·승인·비활성화

1. Google Cloud Console에서 이 Firebase 프로젝트의 서비스 계정을 만들고 JSON 키를
   **안전한 로컬 경로**에만 저장합니다. 이 파일은 절대 Git에 올리지 않습니다.
2. 터미널에서 서비스 계정 경로를 설정합니다.

```bash
# macOS / Linux
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/service-account.json"

# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\service-account.json"
```

3. 프로젝트 의존성을 설치합니다. `firebase-admin`은 개발 의존성으로 이미 포함되어 있습니다.

```bash
npm install
```

4. 아래 예시처럼 계정을 관리합니다. 로그인 아이디 `jogyesa`는 실제 Firebase 이메일
   `jogyesa@temple-manager.app`으로 생성됩니다.

```bash
# 새 사찰 계정 생성 및 승인
npm run firebase:manage-temple -- --login-id jogyesa --temple-name "조계사" --password "초기-안전-비밀번호"

# 계정 비활성화: Firebase Auth와 Firestore 승인 상태를 모두 막음
npm run firebase:manage-temple -- --login-id jogyesa --active false

# 계정 재활성화
npm run firebase:manage-temple -- --login-id jogyesa --active true

# 비밀번호 재설정
npm run firebase:manage-temple -- --login-id jogyesa --password "새-안전-비밀번호" --reset-password
```

생성된 서비스 계정 JSON에는 Firestore와 Authentication 사용자 관리 권한이 필요합니다.
운영에서는 관리자 PC 또는 보호된 CI에서만 이 명령을 실행하세요.

## 4. 운영 배포 전 확인

```bash
npm install
npm run build
```

운영 빌드에서 Firebase 환경변수가 비어 있으면 로그인 화면 대신 설정 오류 화면이
표시되어, 로컬 로그인 우회가 불가능해야 합니다. 활성 사찰 계정과 비활성 사찰 계정으로
각각 로그인도 확인합니다.
