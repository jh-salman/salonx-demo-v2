/** Demo login phone (10 digits) — stored for ramp / marketing follow-up flows. */
export const DEMO_LOGIN_PHONE_KEY = 'salonx.demoLoginPhone';

/** Fixed demo number when login uses fake Face ID (no real phone entry). */
export const DEMO_FACE_ID_PHONE = '5550000000';

export function readDemoLoginPhone() {
  if (typeof localStorage === 'undefined') return '';
  try {
    const raw = localStorage.getItem(DEMO_LOGIN_PHONE_KEY);
    return typeof raw === 'string' ? raw.replace(/\D/g, '') : '';
  } catch {
    return '';
  }
}

export function writeDemoLoginPhone(digits10) {
  if (typeof localStorage === 'undefined') return;
  try {
    const digits = String(digits10 || '').replace(/\D/g, '').slice(0, 10);
    if (digits.length === 10) {
      localStorage.setItem(DEMO_LOGIN_PHONE_KEY, digits);
    }
  } catch {
    /* quota / private mode */
  }
}

/** Prefer the appointment/session client phone, then unlock phone fallback. */
export function resolveClientCarePhone(sessionPhone) {
  const session = String(sessionPhone || '').replace(/\D/g, '');
  if (session.length >= 10) return session.slice(-10);
  const login = readDemoLoginPhone();
  if (login.length === 10) return login;
  return '';
}

export function formatStoredPhoneDisplay(digits10) {
  const d = String(digits10 || '').replace(/\D/g, '').slice(0, 10);
  if (d.length !== 10) return d;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
