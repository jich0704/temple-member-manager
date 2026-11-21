/*
 * Firebase Admin SDK로 사찰 계정과 Firestore 승인 프로필을 함께 관리한다.
 * 실행 전 GOOGLE_APPLICATION_CREDENTIALS 또는 FIREBASE_SERVICE_ACCOUNT_JSON을 설정해야 한다.
 */
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const EMAIL_DOMAIN = 'temple-manager.app';

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasOption(name) {
  return process.argv.includes(name);
}

function printUsage() {
  console.error(`
사용법:
  npm run firebase:manage-temple -- --login-id jogyesa --temple-name "조계사" --password "초기비밀번호"
  npm run firebase:manage-temple -- --login-id jogyesa --active false
  npm run firebase:manage-temple -- --login-id jogyesa --password "새비밀번호" --reset-password
  npm run firebase:manage-temple -- --master --login-id master --password "안전한초기비밀번호"

필수 환경변수:
  GOOGLE_APPLICATION_CREDENTIALS=/절대경로/service-account.json
  또는 FIREBASE_SERVICE_ACCOUNT_JSON='서비스 계정 JSON 전체'
`);
}

const loginId = getOption('--login-id')?.trim();
const templeName = getOption('--temple-name')?.trim();
const password = getOption('--password');
const activeOption = getOption('--active');
const resetPassword = hasOption('--reset-password');
const masterAdmin = hasOption('--master');

if (!loginId || !/^[A-Za-z0-9._-]{3,64}$/.test(loginId)) {
  printUsage();
  throw new Error('login-id는 영문, 숫자, 점(.), 밑줄(_), 하이픈(-)만 사용해 3~64자로 입력하세요.');
}
if (activeOption && !['true', 'false'].includes(activeOption)) {
  throw new Error('--active 값은 true 또는 false여야 합니다.');
}
if (resetPassword && !password) {
  throw new Error('--reset-password 사용 시 --password가 필요합니다.');
}

const active = activeOption !== 'false';
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const credential = serviceAccountJson
  ? cert(JSON.parse(serviceAccountJson))
  : applicationDefault();

const appOptions = { credential };
const app = getApps().length > 0 ? getApps()[0] : initializeApp(appOptions);
const auth = getAuth(app);
const db = getFirestore(app);
const email = `${loginId}@${EMAIL_DOMAIN}`;

let user;
let createdUser = false;
try {
  user = await auth.getUserByEmail(email);
  const updates = {
    disabled: !active,
    ...(templeName ? { displayName: templeName } : {}),
    ...(resetPassword ? { password } : {}),
  };
  user = await auth.updateUser(user.uid, updates);
} catch (error) {
  if (error?.code !== 'auth/user-not-found') throw error;
  if (!password) {
    throw new Error('새 사찰 계정 생성에는 --password가 필요합니다.');
  }
  user = await auth.createUser({
    email,
    password,
    displayName: templeName || (masterAdmin ? '마스터 관리자' : loginId),
    disabled: !active,
    emailVerified: true,
  });
  createdUser = true;
}

if (masterAdmin) {
  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    masterAdmin: true,
  });
  console.log(`마스터 관리자 계정 처리 완료: ${email} (uid: ${user.uid}, 활성: ${active})`);
  process.exit(0);
}

const templeProfile = {
  loginId,
  isActive: active,
  updatedAt: FieldValue.serverTimestamp(),
};

// 기존 사찰명이 관리자 화면에서 별도로 변경된 경우, 계정 상태 변경으로 덮어쓰지 않는다.
if (templeName || createdUser) {
  templeProfile.templeName = templeName || user.displayName || loginId;
}
if (createdUser) {
  templeProfile.createdAt = FieldValue.serverTimestamp();
}

await db.collection('temples').doc(user.uid).set(templeProfile, { merge: true });

console.log(`사찰 계정 처리 완료: ${email} (uid: ${user.uid}, 활성: ${active})`);
