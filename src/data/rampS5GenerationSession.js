const ACTIVE_STATUSES = new Set(['pending', 'generating', 'processing']);

/** @type {Map<string, { startedAt: number; hasShownIntro: boolean }>} */
const sessions = new Map();

function key(token) {
  return String(token || '').trim();
}

/** @param {string} token */
export function ensureRampS5GenerationSession(token) {
  const t = key(token);
  if (!t) return null;
  let session = sessions.get(t);
  if (!session) {
    session = { startedAt: Date.now(), hasShownIntro: false };
    sessions.set(t, session);
  }
  return session;
}

/** @param {string} token */
export function markRampS5IntroShown(token) {
  const session = ensureRampS5GenerationSession(token);
  if (session) session.hasShownIntro = true;
}

/** @param {string} token @param {string} [status] */
export function shouldUseRampS5ResumeMode(token, status) {
  const session = sessions.get(key(token));
  if (!session?.hasShownIntro) return false;
  return ACTIVE_STATUSES.has(String(status || '').trim());
}

/** @param {string} token */
export function getRampS5GenerationStartedAt(token) {
  return sessions.get(key(token))?.startedAt ?? Date.now();
}

/** @param {string} token */
export function clearRampS5GenerationSession(token) {
  sessions.delete(key(token));
}

export function isRampS5ActiveStatus(status) {
  return ACTIVE_STATUSES.has(String(status || '').trim());
}
