# Firebase 인증 연동: 남은 작업 실행 가이드

이 문서는 코드 반영 후 Firebase 인증을 실제 운영 환경에 연결하고 검증하는 순서입니다.
각 단계를 완료한 뒤 다음 단계로 진행하세요.

## 현재 코드에서 완료된 범위

- 운영 앱은 Firebase Auth의 실제 로그인 세션과 `temples/{uid}`의 `isActive: true`를
  모두 만족해야 대시보드를 표시합니다.
- Firebase 설정이 누락된 운영 빌드에서는 로그인 우회가 불가능하며 설정 오류 화면을 표시합니다.
- 로컬 테스트 로그인은 `npm run dev`에서 `VITE_ENABLE_LOCAL_AUTH_BYPASS=true`를
  명시한 경우에만 허용됩니다.
- 사찰 계정의 생성·활성화·비활성화·비밀번호 변경은
  `scripts/manage-temple-account.mjs` 관리자 도구로 처리합니다.
- [firestore.rules](../firestore.rules)은 사찰별 데이터 분리와 활성 계정 검증을 담당합니다.

## 시작 전 준비물

- Firebase 프로젝트를 생성하거나 사용할 권한
- Firestore 및 Authentication 설정 권한
- 관리자 계정 생성용 Google Cloud 서비스 계정 JSON 키
- Node.js 및 프로젝트 의존성

```bash
npm install
```

> 서비스 계정 JSON은 절대 Git, 메신저, 사찰 PC 설치 파일에 넣지 않습니다.

## 1단계 — Firebase 프로젝트 생성 및 서비스 활성화

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트를 만듭니다.
2. **Authentication > Sign-in method**에서 **이메일/비밀번호**를 사용 설정합니다.
3. **Firestore Database**를 생성합니다. 한국 운영 환경이라면 일반적으로
   `asia-northeast3`(서울)을 선택합니다.
4. **프로젝트 설정 > 내 앱 > 웹 앱**에서 웹 앱을 등록하고 Firebase 설정 값을 확인합니다.

완료 기준: Firebase 콘솔에서 Authentication과 Firestore를 모두 열 수 있어야 합니다.

## 2단계 — 개발 PC의 Firebase 환경변수 설정

프로젝트 루트에서 `.env.example`을 복사해 `.env`를 만들고 Firebase 콘솔 값으로 채웁니다.

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=프로젝트ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=프로젝트ID
VITE_FIREBASE_STORAGE_BUCKET=프로젝트ID.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef...

# 개발 중 Firebase 없이 UI를 볼 때만 true. 운영 배포에는 사용하지 않습니다.
VITE_ENABLE_LOCAL_AUTH_BYPASS=false
```

`.env`는 Git에서 제외됩니다. Firebase 웹 설정값은 배포 앱에 포함되지만, 실제 접근 권한은
Firestore 보안 규칙과 Firebase 계정으로 통제합니다.

완료 기준: `npm run dev` 실행 시 Firebase 초기화 오류가 나타나지 않아야 합니다.

## 3단계 — Firestore 보안 규칙 배포

프로젝트 루트에서 Firebase CLI에 로그인하고 대상 프로젝트를 선택합니다.

```bash
npx firebase-tools login
npx firebase-tools use --add
npm run firebase:deploy-rules
```

배포할 파일은 다음 두 개입니다.

- [firebase.json](../firebase.json): Firebase CLI가 규칙 파일 위치를 찾는 설정
- [firestore.rules](../firestore.rules): 실제 Firestore 접근 제어 규칙

완료 기준: Firebase 콘솔의 **Firestore Database > Rules** 내용이
`firestore.rules`와 같고, 배포 명령이 성공해야 합니다.

## 4단계 — 관리자 서비스 계정 준비

1. Google Cloud Console에서 이 Firebase 프로젝트의 서비스 계정 JSON 키를 만듭니다.
2. JSON 파일을 관리자 PC의 접근 제한된 경로에 보관합니다.
3. 현재 터미널에만 파일 경로를 설정합니다.

```bash
# macOS / Linux
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/service-account.json"

# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\service-account.json"
```

이 키는 Firebase Auth 사용자와 Firestore 승인 프로필을 관리하는 권한이 필요합니다.

## 5단계 — 사찰 계정 생성 및 승인

아래 명령은 Firebase Auth 사용자와 `temples/{uid}` 문서를 함께 생성합니다.

```bash
npm run firebase:manage-temple -- \
  --login-id jogyesa \
  --temple-name "조계사" \
  --password "초기-안전-비밀번호"
```

앱에서 입력하는 아이디는 `jogyesa`이고, Firebase Auth에는
`jogyesa@temple-manager.app` 이메일로 생성됩니다.

완료 기준:

- Firebase Authentication > Users에 사용자가 생성됩니다.
- Firestore의 `temples/{uid}`에 `loginId`, `templeName`, `isActive: true`가 생성됩니다.

### 계정 관리 명령

```bash
# 비활성화: Firebase Auth와 Firestore 접근을 함께 차단
npm run firebase:manage-temple -- --login-id jogyesa --active false

# 재활성화
npm run firebase:manage-temple -- --login-id jogyesa --active true

# 비밀번호 변경
npm run firebase:manage-temple -- \
  --login-id jogyesa \
  --password "새-안전-비밀번호" \
  --reset-password
```

## 6단계 — 개발 환경 로그인 확인

```bash
npm run dev
```

확인 항목:

- 생성한 사찰 계정으로 로그인된다.
- 로그아웃 후 로그인 화면으로 돌아간다.
- “로그인 상태 유지”를 해제한 경우 앱을 완전히 종료한 뒤 다시 실행했을 때 자동 로그인되지 않는다.
- `isActive: false`로 비활성화한 계정은 로그인되지 않는다.

## 7단계 — Windows 운영 설치본 확인

개발 서버가 아닌 실제 설치본을 반드시 확인합니다.

```bash
npm run dist
```

테스트 시나리오:

1. Firebase 값이 포함된 상태에서 빌드한 설치본으로 정상 계정 로그인
2. 로그인 유지 선택/해제 후 재시작 동작 확인
3. 로그인한 상태에서 관리자 명령으로 계정 비활성화 후 앱이 로그아웃되는지 확인
4. Firebase 값이 없는 별도 운영 빌드에서는 로그인 대신 설정 오류 화면이 나타나는지 확인

> Windows 설치본은 `file://` 환경에서 실행되므로, 반드시 실제 `.exe`에서 로그인과
> 로그인 유지 동작을 확인해야 합니다.

## 문제 해결

| 증상 | 확인할 항목 |
| --- | --- |
| 설정 오류 화면 | `.env`의 `VITE_FIREBASE_*` 여섯 값이 모두 있는지, 설정 후 다시 빌드했는지 확인 |
| 아이디·비밀번호 오류 | Firebase Authentication에서 이메일이 `아이디@temple-manager.app` 형식인지 확인 |
| 승인되지 않은 계정 | Admin 도구로 `temples/{uid}` 문서가 생성됐는지와 `isActive: true`인지 확인 |
| 로그인 직후 다시 로그아웃 | Firestore 규칙을 실제로 배포했는지, 문서 UID가 Firebase Auth UID와 같은지 확인 |
| 설정/통계 동기화 실패 | Firestore Rules의 최신 배포 여부와 브라우저 개발자 도구 콘솔 오류 확인 |
| 관리자 도구 권한 오류 | `GOOGLE_APPLICATION_CREDENTIALS` 경로, 서비스 계정 프로젝트, Auth/Firestore 관리 권한 확인 |

## 운영 시 참고할 기존 문서

- 전체 개요와 Firebase 데이터 구조: [README](../README.md#firebase-운영-인증-및-배포-가이드)
- Firebase 규칙·관리자 도구의 간단한 배포 절차: [Firebase 운영 배포 문서](firebase-deployment.md)
- 실제 접근 제어 내용: [Firestore Rules](../firestore.rules)

## 다음 선택 작업

인증 연결과 별개로, 현재 `sms_history`는 Firestore 저장 함수는 준비되어 있지만
수동·자동 문자 이력을 자동으로 올리는 연결 작업은 남아 있습니다. 클라우드에서 문자 이력을
통합 조회하려면 이를 후속 작업으로 진행합니다.
