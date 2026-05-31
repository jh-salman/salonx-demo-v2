import { useEffect, useState } from 'react';
import {
  dismissRampFromQueue,
  fetchRampRecent,
  isRampApiAvailable,
} from './rampApi.js';

const UPDATE_EVENT_NAME = 'salonx:ramp-queue-updated';
const QUEUE_POLL_MS = 1000;
const RAMP_QUEUE_STATUSES = new Set([
  'pending',
  'generating',
  'processing',
  'ready',
  'failed',
  'sent',
]);

/** @type {Array<{ id: string, token?: string, title: string, status?: string, createdAt?: string }>} */
let rampQueueMemory = [];

let pollIntervalId = null;
let pollSubscriberCount = 0;
/** @type {Promise<unknown[]> | null} */
let rampQueueFetch = null;

function isRampPostQueueItem(status) {
  return RAMP_QUEUE_STATUSES.has(String(status || '').trim());
}

function notifyRampQueueUpdated() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT_NAME));
  } catch {
    /* ignore */
  }
}

function normalizeRampQueueRow(row) {
  if (!row || typeof row !== 'object') return null;
  const token = row.token ? String(row.token).trim() : '';
  const id = row.id ? String(row.id).trim() : token;
  if (!id) return null;
  const status = String(row.status || 'pending').trim();
  if (!isRampPostQueueItem(status)) return null;
  const title = String(row.title || 'RAMP post').trim() || 'RAMP post';
  return {
    id,
    token: token || undefined,
    title,
    status,
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

function setRampQueueMemory(items) {
  rampQueueMemory = Array.isArray(items)
    ? items.map(normalizeRampQueueRow).filter(Boolean)
    : [];
  notifyRampQueueUpdated();
}

export function resetRampQueueMemory() {
  rampQueueMemory = [];
  notifyRampQueueUpdated();
}

/** @returns {Array<{ id: string, token?: string, title: string, status?: string, createdAt?: string }>} */
export function loadRampQueue() {
  return rampQueueMemory;
}

/** DB is source of truth — replace in-memory list from `/api/ramp/recent`. */
export async function syncRampQueueFromApi() {
  if (!isRampApiAvailable()) {
    setRampQueueMemory([]);
    return [];
  }

  if (rampQueueFetch) return rampQueueFetch;

  rampQueueFetch = (async () => {
    try {
      const data = await fetchRampRecent();
      const items = Array.isArray(data?.items) ? data.items : [];
      setRampQueueMemory(items);
      return loadRampQueue();
    } catch {
      setRampQueueMemory([]);
      return [];
    } finally {
      rampQueueFetch = null;
    }
  })();

  return rampQueueFetch;
}

/** After server-side queue mutation, pull fresh list from DB. */
export function upsertRampQueueItem(_item) {
  void syncRampQueueFromApi();
}

/** @param {string} tokenOrId */
export function removeRampQueueItem(tokenOrId) {
  const key = String(tokenOrId || '').trim();
  if (!key || typeof window === 'undefined') return;
  void (async () => {
    try {
      await dismissRampFromQueue(key);
    } catch {
      /* token may already be gone */
    }
    await syncRampQueueFromApi();
  })();
}

function startSharedRampQueuePoll(refresh) {
  if (typeof window === 'undefined') return;
  pollSubscriberCount += 1;
  if (pollIntervalId != null) return;

  void syncRampQueueFromApi().then(refresh);
  pollIntervalId = window.setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    void syncRampQueueFromApi().then(refresh);
  }, QUEUE_POLL_MS);
}

function stopSharedRampQueuePoll() {
  pollSubscriberCount = Math.max(0, pollSubscriberCount - 1);
  if (pollSubscriberCount === 0 && pollIntervalId != null) {
    window.clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

export function useRampQueue() {
  const [items, setItems] = useState(() => loadRampQueue());

  useEffect(() => {
    const refresh = () => setItems(loadRampQueue());
    window.addEventListener(UPDATE_EVENT_NAME, refresh);
    startSharedRampQueuePoll(refresh);

    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, refresh);
      stopSharedRampQueuePoll();
    };
  }, []);

  return items;
}

export function rampStatusLabel(status) {
  switch (String(status || '').trim()) {
    case 'pending':
      return 'Pending';
    case 'generating':
      return 'Generating';
    case 'processing':
      return 'Pending';
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
    case 'posted':
      return 'Posted';
    case 'sent':
      return 'Sent';
    default:
      return 'RAMP';
  }
}
