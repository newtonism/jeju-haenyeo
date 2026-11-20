import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  Auth,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const RESERVATION_RECIPIENT = 'jejudoremi@gmail.com';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Use in-memory persistence + explicit popup resolver so cross-origin iframes
// with partitioned IndexedDB/localStorage do not abort signInWithPopup immediately.
function initFirebaseAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
}

const auth = initFirebaseAuth();
auth.languageCode = 'ko';

// In-memory access token cache (never stored in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface ReservationEmailPayload {
  bookingCode: string;
  name: string;
  contact: string;
  program: string;
  date: string;
  guests: string;
  note: string;
}

export interface GmailAuthErrorInfo {
  code: string;
  message: string;
  hint?: string;
  showNewTabAction: boolean;
  showMailtoFallback: boolean;
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function initGmailAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

export async function signInWithGoogleForGmail(forceConsent = false): Promise<{
  user: User;
  accessToken: string;
}> {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: forceConsent ? 'consent select_account' : 'select_account',
  });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      const tokenErr = new Error(
        'Google 계정에서 Gmail 발송 권한 토큰을 가져오지 못했습니다.'
      ) as Error & { code?: string };
      tokenErr.code = 'auth/missing-access-token';
      throw tokenErr;
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('[GmailAuth] Google sign-in failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

export function formatGmailAuthError(error: unknown): GmailAuthErrorInfo {
  const errObj = error as { code?: string; message?: string } | null;
  const code = errObj?.code ?? 'auth/unknown';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const embedded = isRunningInIframe();

  switch (code) {
    case 'auth/unauthorized-domain':
      return {
        code,
        message: `현재 접속 도메인(${hostname || '알 수 없음'})이 Firebase 승인 도메인에 등록되어 있지 않아 팝업이 즉시 닫혔습니다.`,
        hint: `Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 "${hostname}"을 추가하거나, 아래 기본 메일 앱으로 문의를 보낼 수 있습니다.`,
        showNewTabAction: false,
        showMailtoFallback: true,
      };
    case 'auth/popup-blocked':
      return {
        code,
        message: '브라우저가 Google 로그인 팝업 창을 차단했습니다.',
        hint: embedded
          ? '미리보기 창에서는 팝업이 차단될 수 있습니다. 주소창에서 팝업을 허용하거나 아래 버튼으로 새 탭에서 열어 시도해 주세요.'
          : '브라우저 주소창의 팝업 차단 설정을 허용한 뒤 다시 시도해 주세요.',
        showNewTabAction: embedded,
        showMailtoFallback: true,
      };
    case 'auth/popup-closed-by-user':
      return {
        code,
        message: 'Google 로그인 창이 인증을 마치기 전에 닫혔습니다.',
        hint: embedded
          ? '내장 미리보기(iframe)나 브라우저 서드파티 쿠키 차단 환경에서는 팝업이 자동으로 닫힐 수 있습니다. 아래 "새 탭에서 열기"로 접속해 로그인해 주세요.'
          : '팝업 창을 닫지 말고 계정 선택 및 Gmail 발송 권한 허용까지 완료해 주세요.',
        showNewTabAction: embedded,
        showMailtoFallback: true,
      };
    case 'auth/internal-error':
      return {
        code,
        message: '브라우저 보안 정책(서드파티 쿠키 차단 등)으로 팝업 인증을 초기화하지 못했습니다.',
        hint: embedded
          ? '아래 "새 탭에서 열기"로 직접 접속하거나 서드파티 쿠키를 허용한 뒤 다시 시도해 주세요.'
          : '시크릿 모드나 서드파티 쿠키 차단 설정을 해제한 뒤 다시 시도해 주세요.',
        showNewTabAction: embedded,
        showMailtoFallback: true,
      };
    case 'auth/cancelled-popup-request':
      return {
        code,
        message: '이전 로그인 요청이 중단되었습니다.',
        hint: '버튼을 한 번만 누르고 팝업 창이 열릴 때까지 잠시 기다려 주세요.',
        showNewTabAction: false,
        showMailtoFallback: false,
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        message: 'Firebase 프로젝트에서 Google 로그인 제공업체가 비활성화되어 있습니다.',
        hint: 'Firebase 콘솔 → Authentication → 로그인 방법에서 Google을 활성화해 주세요.',
        showNewTabAction: false,
        showMailtoFallback: true,
      };
    case 'auth/network-request-failed':
      return {
        code,
        message: '네트워크 오류 또는 광고 차단 확장 프로그램으로 Google 인증 서버에 연결하지 못했습니다.',
        hint: '인터넷 연결과 브라우저 확장 프로그램 설정을 확인한 뒤 다시 시도해 주세요.',
        showNewTabAction: false,
        showMailtoFallback: true,
      };
    case 'auth/missing-access-token':
      return {
        code,
        message: 'Gmail 발송 권한이 부여되지 않았습니다.',
        hint: 'Google 권한 동의 화면에서 "나를 대신하여 이메일 전송" 항목에 체크한 뒤 계속 진행해 주세요.',
        showNewTabAction: false,
        showMailtoFallback: true,
      };
    default:
      return {
        code,
        message: 'Google 로그인 연결에 실패했습니다.',
        hint: embedded
          ? '미리보기 창에서 팝업 인증이 제한될 수 있습니다. 새 탭에서 열거나 기본 메일 앱으로 문의를 보내 보세요.'
          : errObj?.message || '잠시 후 다시 시도해 주세요.',
        showNewTabAction: embedded,
        showMailtoFallback: true,
      };
  }
}

export function buildReservationMailtoUrl(form: {
  name: string;
  contact: string;
  program: string;
  date: string;
  guests: string;
  note: string;
}): string {
  const subject = `[제주 해녀 아카이브] 체험 예약 문의${form.name.trim() ? ` — ${form.name.trim()}` : ''}`;
  const body = [
    '제주 해녀 아카이브 체험 예약 문의드립니다.',
    '',
    `신청자 성함: ${form.name.trim() || '(미입력)'}`,
    `연락처 / 이메일: ${form.contact.trim() || '(미입력)'}`,
    `희망 프로그램: ${form.program}`,
    `방문 희망일: ${form.date || '(미선택)'}`,
    `참여 인원: ${form.guests}명`,
    `추가 요청 사항: ${form.note.trim() || '(없음)'}`,
  ].join('\n');

  return `mailto:${RESERVATION_RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

export async function signOutGmail(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function toBase64Url(str: string): string {
  return utf8ToBase64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendReservationEmail(
  payload: ReservationEmailPayload
): Promise<{ id: string }> {
  const accessToken = getGmailAccessToken();
  if (!accessToken) {
    throw new Error('AUTH_REQUIRED');
  }

  const subject = `[제주 해녀 아카이브] 체험 예약 문의 — ${payload.name} (${payload.bookingCode})`;
  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(subject)}?=`;

  const bodyLines = [
    '제주 해녀 아카이브 웹사이트에서 새로운 체험 예약 문의가 접수되었습니다.',
    '',
    '────────────────────────────────────',
    `접수 번호: ${payload.bookingCode}`,
    `신청자 성함: ${payload.name}`,
    `연락처 / 이메일: ${payload.contact}`,
    `희망 프로그램: ${payload.program}`,
    `방문 희망일: ${payload.date}`,
    `참여 인원: ${payload.guests}명`,
    `추가 요청 사항: ${payload.note.trim() ? payload.note.trim() : '(없음)'}`,
    '────────────────────────────────────',
    '',
    '제주 해녀 아카이브 예약 문의 시스템에서 발송되었습니다.',
  ];
  const bodyText = bodyLines.join('\r\n');

  const mimeMessage = [
    `To: ${RESERVATION_RECIPIENT}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(bodyText),
  ].join('\r\n');

  const raw = toBase64Url(mimeMessage);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (response.status === 401) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (response.status === 403) {
    cachedAccessToken = null;
    throw new Error('GMAIL_SCOPE_REQUIRED');
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gmail 발송 실패 (${response.status}): ${errText || response.statusText}`);
  }

  const data = (await response.json()) as { id?: string };
  return { id: data.id ?? payload.bookingCode };
}
