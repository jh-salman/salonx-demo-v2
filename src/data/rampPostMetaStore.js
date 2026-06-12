import { useEffect, useState } from 'react';

/**
 * Per-token RAMP post metadata that the queue cards need but the backend
 * `/api/ramp/recent` does not yet return (post type + armed indicator).
 *
 * This is a device-local bridge written by the Build Station edit layer and
 * read by the S1 queue / Master Queue cards. Phase 5 moves this to the DB.
 */

const STORE_KEY = 'salonx:ramp-post-meta:v1';
const EVENT_NAME = 'salonx:ramp-post-meta-updated';

/** Post types that arm a smart-send toggle (tap opens the option first). */
const ARMED_POST_TYPES = new Set(['Before / After']);

function readAll() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota — meta is best-effort */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* ignore */
  }
}

/** @param {string} token */
export function readRampPostMeta(token) {
  const key = String(token || '').trim();
  if (!key) return null;
  const map = readAll();
  return map[key] || null;
}

/** @param {string} token @param {{ postType?: string }} patch */
export function writeRampPostMeta(token, patch) {
  const key = String(token || '').trim();
  if (!key || !patch || typeof patch !== 'object') return;
  const map = readAll();
  const prev = map[key] || {};
  const postType =
    typeof patch.postType === 'string' && patch.postType.trim()
      ? patch.postType.trim()
      : prev.postType;
  const next = {
    ...prev,
    ...(postType ? { postType } : {}),
    armed: postType ? ARMED_POST_TYPES.has(postType) : Boolean(prev.armed),
  };
  map[key] = next;
  writeAll(map);
}

export function rampPostTypePillLabel(postType) {
  switch (String(postType || '').trim()) {
    case 'Professional':
      return 'Professional';
    case 'Hype / Event':
      return 'Hype';
    case 'Before / After':
      return 'Before/After';
    case 'Curiosity':
      return 'Curiosity';
    default:
      return '';
  }
}

/** Reactive map of token → { postType, armed }. */
export function useRampPostMetaMap() {
  const [map, setMap] = useState(() => readAll());

  useEffect(() => {
    const refresh = () => setMap(readAll());
    window.addEventListener(EVENT_NAME, refresh);
    const onStorage = (e) => {
      if (!e.key || e.key === STORE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return map;
}
