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
    localStorage.setItem(DEMO_LOGIN_PHONE_KEY, digits10);
  } catch {
    /* quota / private mode */
  }
}
