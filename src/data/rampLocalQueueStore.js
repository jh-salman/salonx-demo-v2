import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { resolveCalendarSocketEndpoint } from '../sync/calendarRealtimeSync.js';
import { enrichRampQueueItems } from './rampClients.js';
import { getRampGenState } from './rampGenerationStore.js';
import {
  createRampPost,
  fetchRampPosts,
  isRampRuntimeApiAvailable,
  patchRampPost,
} from './rampRuntimeApi.js';

const UPDATE_EVENT = 'salonx:ramp-queue-updated';

/** @type {RampQueueItem[]} */
let queue = [];
let loading = false;

/**
 * @typedef {Object} RampQueueItem
 * @property {string} id          RampPost id (also used as postId)
 * @property {string} postId
 * @property {string} name
 * @property {string} [clientId]
 * @property {string} meta
 * @property {string} [heroImage]
 * @property {string} [emoji]
 * @property {string} [thumb]
 * @property {number} createdAt
 */

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}

function postToQueueItem(post) {
  const captured = Array.isArray(post.capturedImages) ? post.capturedImages : [];
  const generated = Array.isArray(post.generatedImages) ? post.generatedImages : [];
  return {
    id: post.id,
    postId: post.id,
    name: post.clientName,
    clientId: post.clientId || null,
    meta: post.clientSub || 'Captured',
    heroImage: post.heroImage || captured[0] || null,
    emoji: post.clientEmoji || '🧑',
    thumb: 't1',
    status: post.status || 'queued',
    genState: post.genState || 'idle',
    generatedImages: generated,
    createdAt: post.createdAt ? new Date(post.createdAt).getTime() : Date.now(),
  };
}

export async function refreshRampQueue() {
  if (!isRampRuntimeApiAvailable()) return queue;
  loading = true;
  try {
    const posts = await fetchRampPosts('active');
    queue = enrichRampQueueItems(posts.map(postToQueueItem));
    emit();
    return queue;
  } catch {
    return queue;
  } finally {
    loading = false;
  }
}

export async function addRampQueueItem({
  name,
  clientId = null,
  sub = 'Captured',
  capturedUrl = null,
  emoji = '🧑',
  source = 'capture',
} = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Client name is required');

  if (isRampRuntimeApiAvailable()) {
    const post = await createRampPost({
      clientName: trimmed,
      clientId,
      clientSub: sub,
      clientEmoji: emoji,
      source,
      status: 'queued',
      capturedImages: capturedUrl ? [capturedUrl] : [],
      heroImage: capturedUrl,
    });
    await refreshRampQueue();
    return post ? postToQueueItem(post) : null;
  }

  const item = {
    id: `ramp-q-local-${Date.now()}`,
    postId: null,
    name: trimmed,
    clientId: clientId ? String(clientId) : null,
    meta: sub,
    heroImage: capturedUrl,
    emoji,
    thumb: 't1',
    createdAt: Date.now(),
  };
  queue = [item, ...queue];
  emit();
  return item;
}

export async function dismissRampQueueItem(id) {
  const key = String(id || '');
  if (!key) return;

  if (isRampRuntimeApiAvailable()) {
    try {
      await patchRampPost(key, { status: 'dismissed' });
    } catch {
      /* */
    }
    await refreshRampQueue();
    return;
  }

  queue = queue.filter((item) => item.id !== key);
  emit();
}

export function getRampQueueItems() {
  return queue;
}

export function findRampQueueItem(id) {
  return queue.find((item) => item.id === String(id || '')) || null;
}

export function useRampS1Queue() {
  const [items, setItems] = useState(() => [...queue]);

  const sync = useCallback(() => {
    setItems([...queue]);
  }, []);

  useEffect(() => {
    void refreshRampQueue().then(sync);
    window.addEventListener(UPDATE_EVENT, sync);

    const onPost = () => {
      void refreshRampQueue().then(sync);
    };

    let socket = null;
    const endpoint = resolveCalendarSocketEndpoint();
    if (endpoint && isRampRuntimeApiAvailable()) {
      socket = io(endpoint.origin, {
        path: endpoint.path,
        transports: ['websocket', 'polling'],
      });
      socket.on('ramp:post:updated', onPost);
    }

    const poll = window.setInterval(() => {
      if (!isRampRuntimeApiAvailable() || loading) return;
      const hasGenerating = queue.some(
        (item) => item.genState === 'generating' || getRampGenState(item.id)?.status === 'generating',
      );
      if (hasGenerating) void refreshRampQueue().then(sync);
    }, 2000);

    const slowPoll = window.setInterval(() => {
      if (isRampRuntimeApiAvailable() && !loading) {
        void refreshRampQueue().then(sync);
      }
    }, 8000);

    return () => {
      window.removeEventListener(UPDATE_EVENT, sync);
      window.clearInterval(poll);
      window.clearInterval(slowPoll);
      try {
        socket?.disconnect();
      } catch {
        /* */
      }
    };
  }, [sync]);

  return items;
}
