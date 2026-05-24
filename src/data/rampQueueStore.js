import { useEffect, useState } from 'react';
import { fetchRampRecent, isRampApiAvailable } from './rampApi.js';

const RAMP_QUEUE_KEY = '@salonx/ramp/queue/v1';
const UPDATE_EVENT_NAME = 'salonx:ramp-queue-updated';

function notifyRampQueueUpdated() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT_NAME));
  } catch {
    /* ignore */
  }
}

/** @returns {Array<{ id: string, token?: string, title: string, status?: string, createdAt?: string }>} */
export function loadRampQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RAMP_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.title === 'string') : [];
  } catch {
    return [];
  }
}

/** @param {{ id?: string, token?: string, title: string, status?: string, createdAt?: string }} item */
export function upsertRampQueueItem(item) {
  if (typeof window === 'undefined' || !item?.title) return;
  const token = item.token ? String(item.token) : '';
  const id = item.id ? String(item.id) : token || `ramp-${Date.now()}`;
  const nextItem = {
    id,
    token: token || undefined,
    title: String(item.title).trim(),
    status: item.status ? String(item.status) : 'care_sent',
    createdAt: item.createdAt || new Date().toISOString(),
  };
  const list = loadRampQueue();
  const idx = list.findIndex(
    (row) => (token && row.token === token) || row.id === id,
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...nextItem };
  } else {
    list.unshift(nextItem);
  }
  try {
    window.localStorage.setItem(RAMP_QUEUE_KEY, JSON.stringify(list.slice(0, 40)));
    notifyRampQueueUpdated();
  } catch {
    /* quota / private mode */
  }
}

/** @param {Array<{ id?: string, token?: string, title?: string, status?: string, createdAt?: string }>} items */
function mergeRampQueueItems(items) {
  if (!Array.isArray(items)) return;
  for (const row of items) {
    if (!row?.title) continue;
    upsertRampQueueItem(row);
  }
}

export async function syncRampQueueFromApi() {
  if (!isRampApiAvailable()) return loadRampQueue();
  try {
    const data = await fetchRampRecent();
    if (Array.isArray(data?.items) && data.items.length) {
      mergeRampQueueItems(data.items);
    }
  } catch {
    /* offline / unreachable */
  }
  return loadRampQueue();
}

export function useRampQueue() {
  const [items, setItems] = useState(() => loadRampQueue());

  useEffect(() => {
    const refresh = () => setItems(loadRampQueue());
    window.addEventListener(UPDATE_EVENT_NAME, refresh);
    void syncRampQueueFromApi().then(refresh);
    return () => window.removeEventListener(UPDATE_EVENT_NAME, refresh);
  }, []);

  return items;
}

export function rampStatusLabel(status) {
  switch (status) {
    case 'care_sent':
      return 'Care card sent';
    case 'landing':
      return 'Link opened';
    case 'selfie_received':
      return 'Selfie received';
    case 'processing':
      return 'Processing';
    case 'ready':
      return 'POST IT ready';
    case 'posted':
      return 'Posted';
    default:
      return 'RAMP';
  }
}
