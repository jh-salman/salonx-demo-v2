/** Persist S5 "ready" snapshot so reopening a queue card skips the loading animation. */

const RAMP_S5_READY_KEY = '@salonx/ramp/s5-ready/v1';
const MAX_ENTRIES = 40;

function readMap() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RAMP_S5_READY_KEY);
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
    window.localStorage.setItem(RAMP_S5_READY_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

function pickPostFields(row) {
  if (!row || typeof row !== 'object') return null;
  const compositeUrl = String(row.compositeUrl || '').trim();
  if (!compositeUrl) return null;
  return {
    token: String(row.token || '').trim(),
    status: 'ready',
    compositeUrl,
    caption: row.caption ?? null,
    careCardUrl: row.careCardUrl ?? null,
    landingUrl: String(row.landingUrl || '').trim(),
    recipientName: String(row.recipientName || '').trim(),
    recipientPhone: String(row.recipientPhone || '').trim(),
    stylistName: String(row.stylistName || '').trim(),
    brandSlug: String(row.brandSlug || '').trim(),
    products: Array.isArray(row.products) ? row.products : [],
    cachedAt: new Date().toISOString(),
  };
}

/** @param {string} token @returns {object | null} */
export function readRampS5ReadyCache(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const entry = readMap()[t];
  if (!entry?.compositeUrl) return null;
  return entry;
}

/** @param {string} token @param {object} post */
export function writeRampS5ReadyCache(token, post) {
  const t = String(token || '').trim();
  const snapshot = pickPostFields({ ...post, token: t });
  if (!t || !snapshot) return;

  const map = readMap();
  map[t] = snapshot;

  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys
      .map((k) => ({ k, at: map[k]?.cachedAt || '' }))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const drop = sorted.length - MAX_ENTRIES;
    for (let i = 0; i < drop; i += 1) {
      delete map[sorted[i].k];
    }
  }
  writeMap(map);
}

/** @param {string} token */
export function clearRampS5ReadyCache(token) {
  const t = String(token || '').trim();
  if (!t) return;
  const map = readMap();
  if (!(t in map)) return;
  delete map[t];
  writeMap(map);
}
