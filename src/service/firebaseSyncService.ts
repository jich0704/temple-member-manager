import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  auth,
  configureAuthPersistence,
  db,
  functions,
  isFirebaseConfigured,
  isLocalAuthBypassAllowed,
} from './firebaseConfig';
import type { Settings, SmsHistoryItem } from '../types/member';

export interface TempleAccount {
  uid: string;
  loginId: string;
  templeName: string;
  isActive: boolean;
  isLocalMode?: boolean;
  isMasterAdmin?: boolean;
}

export type ErrorLogCategory = 'MDB_SYNC' | 'SMS_SEND' | 'AUTO_SMS' | 'APP_RUNTIME';

export interface TempleSummaryPatch {
  appVersion?: string;
  lastActiveAt?: string;
  solapiBalance?: number | null;

  mdbStatus?: {
    state: 'idle' | 'syncing' | 'error';
    filePath?: string;
    lastSyncAt?: string;
    rowCount?: number;
    lastError?: string;
  };
  locationStats?: Record<string, {
    total: number;
    active: number;
    oneMonth: number;
    twoWeeks: number;
    expired: number;
  }>;
}

const DEFAULT_EMAIL_DOMAIN = 'temple-manager.app';
const SESSION_STORAGE_KEY = 'temple_auth_session';

export type TempleAuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; message?: string }
  | { status: 'configuration-error'; message: string }
  | { status: 'authenticated'; account: TempleAccount };

/**
 * 일반 아이디('jogyesa')를 입력해도 Firebase 이메일 로그인에 사용할 수 있도록 변환
 */
export function toFirebaseEmail(loginId: string): string {
  const trimmed = loginId.trim();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@${DEFAULT_EMAIL_DOMAIN}`;
}

export function getSavedSession(): TempleAccount | null {
  // 실제 Firebase 계정의 로그인 상태는 localStorage가 아니라 onAuthStateChanged로만 복원한다.
  // 이 저장값은 Firebase 없이 화면을 확인하는 개발 전용 우회 모드에서만 사용한다.
  if (!isLocalAuthBypassAllowed) {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    return null;
  }
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const account = JSON.parse(raw) as TempleAccount;
    return account.isLocalMode ? account : null;
  } catch {
    return null;
  }
}

/** ErrorBoundary 등 React 훅 밖에서 현재 실제 Firebase 사용자만 조회할 때 사용한다. */
export function getCurrentAuthenticatedUid(): string | undefined {
  return auth?.currentUser?.uid;
}

export function saveSession(account: TempleAccount | null, remember: boolean = true) {
  try {
    if (!isLocalAuthBypassAllowed || !account || !account.isLocalMode || !remember) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(account));
  } catch {
    // ignore storage errors
  }
}

function configurationErrorMessage(): string {
  return 'Firebase 연결 설정이 없습니다. 운영 배포본은 Firebase 환경변수와 사찰 계정이 반드시 필요합니다.';
}

async function getApprovedTempleAccount(user: User): Promise<TempleAccount | null> {
  if (!db) return null;

  const token = await user.getIdTokenResult();
  if (token.claims.masterAdmin === true) {
    return {
      uid: user.uid,
      loginId: user.email?.split('@')[0] || user.uid,
      templeName: user.displayName || '마스터 관리자',
      isActive: true,
      isMasterAdmin: true,
    };
  }

  const templeRef = doc(db, 'temples', user.uid);
  const templeSnap = await getDoc(templeRef);
  if (!templeSnap.exists()) return null;

  const data = templeSnap.data();
  if (data.isActive !== true) return null;

  return {
    uid: user.uid,
    loginId: typeof data.loginId === 'string' ? data.loginId : user.email?.split('@')[0] || user.uid,
    templeName: typeof data.templeName === 'string' ? data.templeName : user.email?.split('@')[0] || '사찰',
    isActive: true,
    isLocalMode: false,
  };
}

/**
 * 운영 환경의 유일한 로그인 복원 경로.
 * localStorage 값만으로 대시보드에 진입하지 못하도록 Firebase 세션과 사찰 승인 문서를 함께 확인한다.
 */
export function observeTempleAuthState(
  onChange: (state: TempleAuthState) => void
): Unsubscribe {
  const firebaseAuth = auth;
  const firestoreDb = db;
  if (!isFirebaseConfigured || !firebaseAuth || !firestoreDb) {
    if (isLocalAuthBypassAllowed) {
      const saved = getSavedSession();
      onChange(saved ? { status: 'authenticated', account: saved } : { status: 'signed-out' });
    } else {
      onChange({ status: 'configuration-error', message: configurationErrorMessage() });
    }
    return () => {};
  }

  let disposed = false;
  let profileUnsubscribe: Unsubscribe | null = null;
  const stopProfileObserver = () => {
    profileUnsubscribe?.();
    profileUnsubscribe = null;
  };
  const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
    if (!user) {
      stopProfileObserver();
      onChange({ status: 'signed-out' });
      return;
    }

    try {
      const account = await getApprovedTempleAccount(user);
      if (disposed) return;
      if (!account) {
        await signOut(firebaseAuth);
        if (!disposed) {
          onChange({ status: 'signed-out', message: '승인되지 않았거나 비활성화된 사찰 계정입니다.' });
        }
        return;
      }

      if (account.isMasterAdmin) {
        stopProfileObserver();
        onChange({ status: 'authenticated', account });
        return;
      }

      stopProfileObserver();
      profileUnsubscribe = onSnapshot(doc(firestoreDb, 'temples', account.uid), async (snapshot) => {
        if (disposed || (snapshot.exists() && snapshot.data().isActive === true)) return;
        await signOut(firebaseAuth);
        if (!disposed) {
          onChange({ status: 'signed-out', message: '비활성화되었거나 삭제된 사찰 계정입니다.' });
        }
      }, () => {
        // 네트워크 일시 장애는 이미 열린 로컬 화면을 즉시 로그아웃시키지 않는다.
      });
      onChange({ status: 'authenticated', account });
    } catch {
      if (!disposed) {
        onChange({ status: 'signed-out', message: '사찰 계정 정보를 확인하지 못했습니다. 네트워크 연결을 확인해 주세요.' });
      }
    }
  });

  return () => {
    disposed = true;
    stopProfileObserver();
    unsubscribe();
  };
}

/**
 * 사찰 계정 로그인. Firebase 없는 로그인은 개발 전용 환경변수를 켠 경우에만 가능하다.
 */
export async function loginTempleAccount(
  loginId: string,
  password: string,
  rememberMe: boolean = true
): Promise<{ ok: boolean; account?: TempleAccount; error?: string }> {
  const cleanId = loginId.trim();
  if (!cleanId || !password) {
    return { ok: false, error: '아이디와 비밀번호를 모두 입력해 주세요.' };
  }

  // 1) 개발 서버에서 명시적으로 허용한 경우에만 로컬 화면 점검 모드로 동작
  if (!isFirebaseConfigured || !auth || !db) {
    if (!isLocalAuthBypassAllowed) {
      return { ok: false, error: configurationErrorMessage() };
    }
    const localAccount: TempleAccount = {
      uid: `local-${cleanId}`,
      loginId: cleanId,
      templeName: cleanId,
      isActive: true,
      isLocalMode: true,
    };
    saveSession(localAccount, rememberMe);
    return { ok: true, account: localAccount };
  }

  // 2) Firebase Auth 로그인 및 관리자가 사전에 만든 사찰 승인 문서 확인
  try {
    await configureAuthPersistence(rememberMe);
    const email = toFirebaseEmail(cleanId);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const nowIso = new Date().toISOString();

    const account = await getApprovedTempleAccount(cred.user);
    if (!account) {
      await signOut(auth);
      return { ok: false, error: '승인되지 않았거나 비활성화된 사찰 계정입니다. 관리자에게 문의해 주세요.' };
    }

    // isActive, loginId, templeName은 관리 전용 필드이며 클라이언트는 활동 시각만 기록한다.
    await setDoc(doc(db, 'temples', account.uid), {
      lastLoginAt: nowIso,
      lastActiveAt: nowIso,
    }, { merge: true });
    return { ok: true, account };
  } catch (error: any) {
    const code = error?.code || '';
    let message = '로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      message = '아이디 또는 비밀번호가 일치하지 않습니다.';
    } else if (code === 'auth/too-many-requests') {
      message = '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }
    return { ok: false, error: message };
  }
}

export async function logoutTempleAccount(): Promise<void> {
  saveSession(null, false);
  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
  }
}

export interface CreateTempleAccountInput {
  loginId: string;
  templeName: string;
  password: string;
}

export interface CreatedTempleAccount {
  uid: string;
  loginId: string;
  templeName: string;
  email: string;
}

/** 마스터 관리자만 호출 가능한 Cloud Function으로 사찰 인증 계정과 승인 문서를 함께 만든다. */
export async function createTempleAccount(input: CreateTempleAccountInput): Promise<CreatedTempleAccount> {
  if (!functions) throw new Error('Firebase 관리자 기능이 설정되지 않았습니다.');
  const callable = httpsCallable<CreateTempleAccountInput, CreatedTempleAccount>(functions, 'createTempleAccount');
  try {
    const result = await callable(input);
    return result.data;
  } catch (error: any) {
    const code = String(error?.code || '');
    if (code.endsWith('permission-denied')) throw new Error('마스터 관리자 권한이 필요합니다.');
    if (code.endsWith('already-exists')) throw new Error('이미 사용 중인 사찰 아이디입니다.');
    throw new Error(error?.message || '사찰 계정을 만들지 못했습니다.');
  }
}

/**
 * 1. 사찰 실시간 요약 상태 동기화 (temples/{uid})
 * - 48만 건 원본 대신 요약 통계(locationStats), 솔라피 잔액, MDB 동기화 상태만 가볍게 업데이트
 */
export async function syncTempleSummary(uid: string, patch: TempleSummaryPatch): Promise<void> {
  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local-')) return;
  try {
    const templeRef = doc(db, 'temples', uid);
    await setDoc(
      templeRef,
      {
        ...patch,
        lastActiveAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[Firebase] 사찰 요약 상태 업데이트 실패:', error);
  }
}

/**
 * 2. 사찰 환경설정 불러오기 / 저장하기 (temples/{uid}/config/settings)
 */
export async function loadCloudSettings(uid: string): Promise<{
  settings?: Partial<Settings>;
  autoSmsConfig?: any;
  mdbConfig?: any;
} | null> {
  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local-')) return null;
  try {
    const settingsRef = doc(db, 'temples', uid, 'config', 'settings');
    const snap = await getDoc(settingsRef);
    if (!snap.exists()) return null;
    return snap.data() as any;
  } catch (error) {
    console.warn('[Firebase] 클라우드 설정 로드 실패:', error);
    return null;
  }
}

export async function saveCloudSettings(
  uid: string,
  payload: {
    settings?: Partial<Settings>;
    autoSmsConfig?: any;
    mdbConfig?: any;
  }
): Promise<void> {
  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local-')) return;
  try {
    const settingsRef = doc(db, 'temples', uid, 'config', 'settings');
    await setDoc(
      settingsRef,
      {
        ...payload,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[Firebase] 클라우드 설정 저장 실패:', error);
  }
}

/**
 * 3. 문자 발송 이력 클라우드 기록 (temples/{uid}/sms_history/{id})
 */
export async function syncSmsHistoryToCloud(uid: string, item: SmsHistoryItem): Promise<void> {
  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local-')) return;
  try {
    const historyRef = doc(db, 'temples', uid, 'sms_history', String(item.id));
    await setDoc(historyRef, {
      ...item,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[Firebase] 문자 발송 이력 동기화 실패:', error);
  }
}

/**
 * 4. 통합 오류 이력 기록 (temples/{uid}/error_logs/{autoId})
 * - MDB 동기화 오류, 문자 발송 실패, 자동 발송 오류, 런타임 에러 등을 중앙 기록
 */
export async function logTempleError(
  uid: string | undefined,
  category: ErrorLogCategory,
  message: string,
  detail?: Record<string, any> | string
): Promise<void> {
  if (!isFirebaseConfigured || !db || !uid || uid.startsWith('local-')) return;
  try {
    const errorColRef = collection(db, 'temples', uid, 'error_logs');
    await addDoc(errorColRef, {
      category,
      message,
      detail: detail ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[Firebase] 오류 이력 기록 실패:', error);
  }
}
