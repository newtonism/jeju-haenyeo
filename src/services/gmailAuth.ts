import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const RESERVATION_RECIPIENT = 'jejudoremi@gmail.com';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

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

export async function signInWithGoogleForGmail(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google 계정에서 Gmail 발송 권한 토큰을 가져오지 못했습니다.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
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

  if (response.status === 401 || response.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gmail 발송 실패 (${response.status}): ${errText || response.statusText}`);
  }

  const data = (await response.json()) as { id?: string };
  return { id: data.id ?? payload.bookingCode };
}
