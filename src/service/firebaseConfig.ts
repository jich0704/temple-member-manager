import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

/**
 * Firebase 프로젝트 설정값(apiKey, projectId)이 입력되어 있는지 여부
 * 아직 Firebase 프로젝트 생성 전이면 false가 되어 로컬 모드로 동작합니다.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

/**
 * 로컬 인증 우회는 개발 서버에서 명시적으로 켠 경우에만 허용한다.
 * 배포본(Vite production build)에서는 Firebase 설정 누락을 인증 실패로 취급한다.
 */
export const isLocalAuthBypassAllowed = Boolean(
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_AUTH_BYPASS === 'true'
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app, 'asia-northeast3');
  } catch (error) {
    console.error('[Firebase] 초기화 실패:', error);
  }
}

export { app, auth, db, functions };

/** Firebase 인증 토큰의 유지 범위를 '로그인 상태 유지' 선택과 일치시킨다. */
export async function configureAuthPersistence(rememberMe: boolean): Promise<void> {
  if (!auth) return;
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
}
