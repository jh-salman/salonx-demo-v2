/** Persisted user choice for app-wide primary (toolbar, S2 accent, cards, etc.). */

/** SalonX default / “Blue” preset — Tailwind `blue-500` */
export const SALONX_BRAND_BLUE_HEX = '#3b82f6';

export const PRIMARY_STORAGE_KEY = 'salonx.primaryHex';
export const DEFAULT_PRIMARY_HEX = SALONX_BRAND_BLUE_HEX;

export function normalizePrimaryHex(hex) {
  let t = (hex || DEFAULT_PRIMARY_HEX).trim();
  if (!t.startsWith('#')) t = `#${t}`;
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1];
    const g = t[2];
    const b = t[3];
    t = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(t)) return DEFAULT_PRIMARY_HEX;
  return t.toLowerCase();
}

export function hexToRgb(hex) {
  const h = normalizePrimaryHex(hex);
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function clamp255(x) {
  return Math.max(0, Math.min(255, Math.round(x)));
}

export function lightenRgb({ r, g, b }, t) {
  return {
    r: clamp255(r + (255 - r) * t),
    g: clamp255(g + (255 - g) * t),
    b: clamp255(b + (255 - b) * t),
  };
}

export function darkenRgb({ r, g, b }, t) {
  return {
    r: clamp255(r * (1 - t)),
    g: clamp255(g * (1 - t)),
    b: clamp255(b * (1 - t)),
  };
}

export function rgbTupleString(rgb) {
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

/** Same soft card rim as legacy orange/blue: 8-digit hex alpha trail on base hex. */
export function accentCardGradientCss(hex) {
  const h = normalizePrimaryHex(hex);
  return `linear-gradient(to right, ${h} 0%, ${h}cc 18%, ${h}66 45%, ${h}00 85%)`;
}

export function readStoredPrimaryHex() {
  if (typeof localStorage === 'undefined') return DEFAULT_PRIMARY_HEX;
  try {
    const raw = localStorage.getItem(PRIMARY_STORAGE_KEY);
    return normalizePrimaryHex(raw || DEFAULT_PRIMARY_HEX);
  } catch {
    return DEFAULT_PRIMARY_HEX;
  }
}

/** Sets :root CSS vars used across CSS + inline SVG. */
export function applySalonxPrimaryTheme(hex) {
  if (typeof document === 'undefined') return;
  const base = hexToRgb(hex);
  const soft = lightenRgb(base, 0.28);
  const dark = darkenRgb(base, 0.32);
  const root = document.documentElement;
  const normalized = normalizePrimaryHex(hex);
  root.style.setProperty('--salonx-primary', normalized);
  root.style.setProperty('--salonx-primary-rgb', rgbTupleString(base));
  root.style.setProperty('--salonx-primary-soft-rgb', rgbTupleString(soft));
  root.style.setProperty('--salonx-primary-dark-rgb', rgbTupleString(dark));
}
