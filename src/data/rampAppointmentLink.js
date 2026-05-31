/**
 * Local appointment → RAMP post link.
 *
 * When a RAMP post is designed/queued for an appointment we remember its token
 * so a later Climax checkout (from S2) can go straight to checkout and surface
 * the live RAMP status — without re-opening the RAMP station.
 */
const RAMP_APPT_LINK_KEY = '@salonx/ramp/appt-link/v1';

function readMap() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RAMP_APPT_LINK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RAMP_APPT_LINK_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

/** @param {string|number|null|undefined} appointmentId @param {string} token */
export function writeRampAppointmentLink(appointmentId, token) {
  const id = String(appointmentId || '').trim();
  const t = String(token || '').trim();
  if (!id || !t) return;
  const map = readMap();
  map[id] = { token: t, createdAt: new Date().toISOString() };
  writeMap(map);
}

/** @param {string|number|null|undefined} appointmentId @returns {string} */
export function readRampAppointmentToken(appointmentId) {
  const id = String(appointmentId || '').trim();
  if (!id) return '';
  const entry = readMap()[id];
  return entry && typeof entry.token === 'string' ? entry.token : '';
}

/** @param {string|number|null|undefined} appointmentId */
export function removeRampAppointmentLink(appointmentId) {
  const id = String(appointmentId || '').trim();
  if (!id) return;
  const map = readMap();
  if (id in map) {
    delete map[id];
    writeMap(map);
  }
}

/** True when this token was queued from Screen 2 → Climax checkout flow. */
export function isRampTokenLinkedToAppointment(token) {
  const t = String(token || '').trim();
  if (!t) return false;
  return Object.values(readMap()).some(
    (entry) => entry && typeof entry === 'object' && entry.token === t,
  );
}

/** Clear any appointment link pointing at this RAMP token (queue swipe dismiss). */
export function removeRampAppointmentLinkByToken(token) {
  const t = String(token || '').trim();
  if (!t) return;
  const map = readMap();
  let changed = false;
  for (const [id, entry] of Object.entries(map)) {
    if (entry && typeof entry === 'object' && entry.token === t) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) writeMap(map);
}
