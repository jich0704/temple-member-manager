import {
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebaseConfig';
import type { Settings, SmsHistoryItem } from '../types/member';

export interface TempleAccount {
  uid: string;
  loginId: string;
  templeName: string;
  isActive: boolean;
  isLocalMode?: boolean;
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

/**
 * 일반 아이디('jogyesa')를 입력해도 Firebase 이메일 로그인에 사용할 수 있도록 변환
 */
export function toFirebaseEmail(loginId: string): string {
  const trimmed = loginId.trim();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@${DEFAULT_EMAIL_DOMAIN}`;
}

export function getSavedSession(): TempleAccount | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TempleAccount;
  } catch {
    return null;
  }
}

export function saveSession(account: TempleAccount | null, remember: boolean = true) {
  try {
    if (!account || !remember) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(account));
  } catch {
    // ignore storage errors
  }
}

/**
 * 사찰 계정 로그인 (Firebase 미설정 시 로컬 데모 로그인 지원)
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

  // 1) 아직 Firebase 프로젝트 키가 설정되지 않은 경우 로컬 모드로 동작
  if (!isFirebaseConfigured || !auth || !db) {
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

  // 2) Firebase Auth 로그인 및 Firestore 사찰 문서 초기화/확인
  try {
    const email = toFirebaseEmail(cleanId);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    const nowIso = new Date().toISOString();

    const templeRef = doc(db, 'temples', uid);
    const templeSnap = await getDoc(templeRef);

    let templeName = cleanId;
    if (templeSnap.exists()) {
      const data = templeSnap.data();
      templeName = data.templeName || cleanId;
      await setDoc(
        templeRef,
        {
          loginId: cleanId,
          isActive: true,
          lastLoginAt: nowIso,
          lastActiveAt: nowIso,
        },
        { merge: true }
      );
    } else {
      await setDoc(templeRef, {
        loginId: cleanId,
        templeName: cleanId,
        isActive: true,
        createdAt: nowIso,
        lastLoginAt: nowIso,
        lastActiveAt: nowIso,
      });
    }

    const account: TempleAccount = {
      uid,
      loginId: cleanId,
      templeName,
      isActive: true,
      isLocalMode: false,
    };
    saveSession(account, rememberMe);
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
        isActive: true,
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
