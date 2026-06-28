import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRampGenState, subscribeRampGen, subscribeRampGenGlobal } from './rampGenerationStore.js';

export const RAMP_STATUS = {
  PENDING: 'pending',
  READY: 'ready',
  GENERATING: 'generating',
};

/**
 * Derive live RAMP status for queue + build UI.
 *
 * Pending   — captured / in queue, not generated yet
 * Generating — AI job in flight (local or server)
 * Ready     — generated image exists, ready to review / ship
 */
export function deriveRampStatus({
  status = 'queued',
  genState = 'idle',
  generatedImages = [],
  postId = null,
  isLocalGenerating = false,
} = {}) {
  const localGen = postId ? getRampGenState(postId) : null;
  const generating =
    isLocalGenerating ||
    genState === 'generating' ||
    localGen?.status === 'generating';

  if (generating) return RAMP_STATUS.GENERATING;

  const hasGenerated = Array.isArray(generatedImages) && generatedImages.length > 0;
  if (status === 'generated' || hasGenerated) return RAMP_STATUS.READY;

  return RAMP_STATUS.PENDING;
}

export function rampStatusLabel(status) {
  if (status === RAMP_STATUS.GENERATING) return 'Generating';
  if (status === RAMP_STATUS.READY) return 'Ready';
  return 'Pending';
}

/** Queue card pill shape. */
export function rampStatusPill(input) {
  const status = typeof input === 'string' ? input : deriveRampStatus(input);
  return {
    label: rampStatusLabel(status),
    dot: true,
    tone: status,
  };
}

const QUEUE_UPDATE_EVENT = 'salonx:ramp-queue-updated';

/** Live status for a queue row — re-renders on generation + queue sync. */
export function useRampItemStatus(item) {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    const postId = item?.id || item?.postId;
    if (!postId) return undefined;

    const unsubGen = subscribeRampGen(postId, bump);
    const unsubGlobal = subscribeRampGenGlobal((event) => {
      if (String(event.postId) === String(postId)) bump();
    });
    const onQueue = () => bump();
    window.addEventListener(QUEUE_UPDATE_EVENT, onQueue);

    return () => {
      unsubGen();
      unsubGlobal();
      window.removeEventListener(QUEUE_UPDATE_EVENT, onQueue);
    };
  }, [item?.id, item?.postId, bump]);

  return useMemo(() => rampStatusPill(item), [item, revision]);
}
