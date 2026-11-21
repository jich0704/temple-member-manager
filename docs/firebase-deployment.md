# Firebase 운영 배포 절차

이 프로젝트의 운영 인증은 Firebase Authentication 사용자와 Firestore의
`temples/{uid}` 승인 프로필이 모두 있어야 로그인됩니다. Firebase Auth 사용자만
만들어서는 앱에 접근할 수 없습니다.

처음 Firebase 프로젝트를 연결하고 운영 설치본까지 검증하는 전체 절차는
[Firebase 인증 연동: 남은 작업 실행 가이드](firebase-remaining-work.md)를 따르세요.

## 1. Firebase 콘솔 최초 설정

1. Firebase 프로젝트를 만들고 **Authentication > Sign-in method**에서
   **이메일/비밀번호**를 사용 설정합니다. 일반 사찰은 회원가입을 할 수 없고, 마스터 관리자만 관리자 메뉴에서 사찰 계정을 생성합니다.
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

## 4. Cloud Function 설치·배포

마스터 관리자 화면은 클라이언트가 Firebase Auth를 직접 수정하지 않고 Callable Cloud Function `createTempleAccount`를 호출합니다. 배포 전에 Functions 의존성을 설치합니다.

```bash
cd functions
npm install
cd ..
npm run firebase:deploy-admin
```

배포가 완료되면 Firebase Console의 **Functions** 목록에 `createTempleAccount`가 `asia-northeast3` 리전에 표시되어야 합니다. 이 함수는 호출자의 ID 토큰에서 `masterAdmin: true` Claim을 검증한 뒤에만 계정을 생성합니다.

## 5. 마스터 관리자 계정과 GUI 사찰 생성

먼저 서비스 계정이 설정된 관리자 PC에서 마스터 계정을 한 번 만듭니다. 이 명령은 Firebase Custom Claim `masterAdmin: true`를 설정하며, 이 권한은 클라이언트에서 임의로 만들 수 없습니다.

```bash
npm run firebase:manage-master -- \
  --login-id master \
  --password "10자이상의안전한초기비밀번호"
```

마스터 계정으로 앱에 로그인하면 **사찰 계정 관리** 화면이 표시됩니다. 여기서 사찰명·로그인 아이디·초기 비밀번호를 입력하면 Cloud Function이 Firebase Auth 사용자와 `temples/{uid}` 승인 문서를 함께 만듭니다.

Cloud Function은 호출자의 ID 토큰에 `masterAdmin: true`가 있는지 서버에서 검증합니다. 일반 사찰 계정이 화면 요청을 위조해도 계정을 만들 수 없습니다.

### 생성 결과와 운영 원칙

- 새 사찰은 `아이디@temple-manager.app` Firebase Auth 계정으로 생성됩니다.
- 동시에 `temples/{uid}`에 `loginId`, `templeName`, `isActive: true`, 생성 시각과 생성한 마스터 UID가 기록됩니다.
- 초기 비밀번호는 함수 로그, Firestore, 앱 화면에 저장되지 않습니다. 생성 담당자가 사찰에 안전한 방법으로 전달해야 합니다.
- 마스터 계정은 사찰별 회원 목록을 열지 않고 계정 관리 화면만 사용합니다.
- 마스터 권한을 회수하려면 Admin SDK로 해당 사용자의 Custom Claim에서 `masterAdmin`을 제거한 뒤 다시 로그인시켜야 합니다.

## 6. 운영 배포 전 확인

```bash
npm install
npm run build
```

운영 빌드에서 Firebase 환경변수가 비어 있으면 로그인 화면 대신 설정 오류 화면이
표시되어, 로컬 로그인 우회가 불가능해야 합니다. 활성 사찰 계정과 비활성 사찰 계정으로
각각 로그인도 확인합니다.

마스터 기능은 아래 시나리오도 확인합니다.

1. 마스터 계정 로그인 시 **사찰 계정 관리** 화면이 나타난다.
2. 사찰 계정을 만든 뒤 생성된 아이디로 로그인할 수 있다.
3. 일반 사찰 계정에서는 관리자 화면이 나타나지 않는다.
4. 일반 계정의 Callable Function 생성 요청은 `permission-denied`로 거부된다.

## 문제 해결

| 증상 | 확인할 항목 |
| --- | --- |
| 마스터 로그인 후 일반 로그인 화면으로 돌아감 | `firebase:manage-master`에 사용한 서비스 계정이 현재 Firebase 프로젝트의 것인지, 로그아웃 후 다시 로그인했는지 확인 |
| 관리자 화면에서 계정 생성 실패 | `functions` 의존성 설치 및 `npm run firebase:deploy-admin` 성공 여부, Functions 리전이 `asia-northeast3`인지 확인 |
| `permission-denied` | 생성 요청 계정의 최신 ID 토큰에 `masterAdmin: true` Claim이 있는지 확인. Claim 변경 뒤에는 재로그인 필요 |
| 이미 사용 중인 아이디 | Firebase Auth에 같은 `아이디@temple-manager.app` 이메일이 있는지 확인 |
