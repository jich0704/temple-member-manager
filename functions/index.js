const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

initializeApp();

const EMAIL_DOMAIN = 'temple-manager.app';
const LOGIN_ID_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
const MIN_PASSWORD_LENGTH = 10;

function requireText(value, label, maxLength = 100) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) {
    throw new HttpsError('invalid-argument', `${label}을(를) 확인해 주세요.`);
  }
  return text;
}

exports.createTempleAccount = onCall({ region: 'asia-northeast3' }, async (request) => {
  if (request.auth?.token?.masterAdmin !== true) {
    throw new HttpsError('permission-denied', '마스터 관리자만 사찰 계정을 만들 수 있습니다.');
  }

  const loginId = requireText(request.data?.loginId, '사찰 아이디', 64);
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    throw new HttpsError('invalid-argument', '사찰 아이디는 영문, 숫자, 점, 밑줄, 하이픈으로 3~64자여야 합니다.');
  }
  const templeName = requireText(request.data?.templeName, '사찰명', 100);
  const password = typeof request.data?.password === 'string' ? request.data.password : '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError('invalid-argument', `초기 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }

  const auth = getAuth();
  const db = getFirestore();
  const email = `${loginId}@${EMAIL_DOMAIN}`;
  let user;
  try {
    user = await auth.createUser({
      email,
      password,
      displayName: templeName,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', '이미 사용 중인 사찰 아이디입니다.');
    }
    logger.error('Temple account creation failed.', error);
    throw new HttpsError('internal', '사찰 인증 계정을 만들지 못했습니다.');
  }

  try {
    await db.collection('temples').doc(user.uid).set({
      loginId,
      templeName,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });
  } catch (error) {
    // Auth만 남은 고아 계정은 즉시 되돌린다.
    await auth.deleteUser(user.uid).catch(() => {});
    logger.error('Temple profile creation failed.', error);
    throw new HttpsError('internal', '사찰 승인 정보를 저장하지 못했습니다.');
  }

  logger.info('Temple account created by master administrator.', { createdUid: user.uid, creatorUid: request.auth.uid });
  return { uid: user.uid, loginId, templeName, email };
});
