import { useCallback, useEffect, useState } from 'react';
import { uploadRampComposed } from './rampAssetUpload.js';
import { generateRampImage, isRampApiAvailable } from './rampApi.js';
import {
  buildRampImagePrompt,
  imageRefToFile,
  revokeRampObjectUrl,
} from './rampGenerate.js';
import { ensureRampImageUploaded } from './rampUpload.js';
import {
  getRampPost,
  isRampRuntimeApiAvailable,
  patchRampPost,
  startRampPostGeneration,
} from './rampRuntimeApi.js';

const STORAGE_KEY = 'ramp:generation:v1';
const POLL_MS = 2000;
const STALE_MS = 12 * 60 * 1000;

/** @typedef {'idle'|'generating'|'done'|'error'} GenStatus */
/** @typedef {'prepare'|'generating'|'uploading'|'finishing'} GenPhase */

/** @type {Map<string, { status: GenStatus, phase?: GenPhase, error?: string, result?: object, promise?: Promise<void>, startedAt?: number }>} */
const jobs = new Map();

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/** @type {Set<Function>} */
const globalListeners = new Set();

/** @type {Map<string, () => void>} */
const pollStops = new Map();

function resolvePostKey(post) {
  if (!post) return null;
  const id = post.id;
  if (!id) return null;
  return String(id);
}

function isServerPostId(postId) {
  return postId && !String(postId).startsWith('ramp-post-') && !String(postId).startsWith('ramp-q-');
}

function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function writePersisted(data) {
  try {
    if (!data) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function emit(postId, state) {
  const set = listeners.get(postId);
  if (set) set.forEach((fn) => fn(state));
  globalListeners.forEach((fn) => fn({ postId, ...state }));
}

function setJob(postId, patch) {
  const prev = jobs.get(postId) || { status: 'idle' };
  const next = { ...prev, ...patch, postId };
  jobs.set(postId, next);

  if (next.status === 'generating') {
    writePersisted({
      postId,
      taskId: postId,
      status: 'generating',
      phase: next.phase || 'prepare',
      startedAt: next.startedAt || Date.now(),
    });
  } else if (next.status === 'done') {
    writePersisted({
      postId,
      taskId: postId,
      status: 'done',
      startedAt: next.startedAt,
      completedAt: Date.now(),
    });
  } else if (next.status === 'error') {
    writePersisted({
      postId,
      taskId: postId,
      status: 'error',
      error: next.error || 'Generation failed',
      startedAt: next.startedAt,
    });
  } else {
    writePersisted(null);
  }

  emit(postId, next);
  return next;
}

export function getRampGenState(postId) {
  if (!postId) return { status: 'idle', postId };
  const mem = jobs.get(postId);
  if (mem) return { ...mem, postId };
  const persisted = readPersisted();
  if (persisted?.postId === postId) return { ...persisted, postId };
  return { status: 'idle', postId };
}

export function subscribeRampGen(postId, listener) {
  if (!postId) return () => {};
  if (!listeners.has(postId)) listeners.set(postId, new Set());
  listeners.get(postId).add(listener);
  return () => listeners.get(postId)?.delete(listener);
}

export function subscribeRampGenGlobal(listener) {
  globalListeners.add(listener);
  return () => globalListeners.delete(listener);
}

function stopPoll(postId) {
  const stop = pollStops.get(postId);
  if (stop) {
    stop();
    pollStops.delete(postId);
  }
}

function waitForJobCompletion(postId) {
  const existing = jobs.get(postId);
  if (existing?.status === 'done' && existing.result) {
    return Promise.resolve(existing.result);
  }
  if (existing?.status === 'error') {
    return Promise.reject(new Error(existing.error || 'Generation failed'));
  }

  return new Promise((resolve, reject) => {
    const finish = () => {
      const job = jobs.get(postId);
      if (job?.status === 'done' && job.result) {
        resolve(job.result);
        return true;
      }
      if (job?.status === 'error') {
        reject(new Error(job.error || 'Generation failed'));
        return true;
      }
      return false;
    };

    if (finish()) return;

    const unsub = subscribeRampGen(postId, () => {
      if (finish()) unsub();
    });
  });
}

function startServerPoll(postId) {
  if (!isServerPostId(postId) || !isRampRuntimeApiAvailable()) return;
  if (pollStops.has(postId)) return;

  let cancelled = false;
  const stop = () => {
    cancelled = true;
  };
  pollStops.set(postId, stop);

  const tick = async () => {
    if (cancelled) return;

    try {
      const dto = await getRampPost(postId);
      if (cancelled || !dto) return;

      const generated = Array.isArray(dto.generatedImages) ? dto.generatedImages : [];
      const latest = generated.length > 0 ? generated[generated.length - 1] : null;
      const mem = jobs.get(postId);

      const completeResult = {
        generatedImage: latest,
        generatedImages: generated,
        buildPhase: 'ship',
        genState: 'done',
        status: 'generated',
      };

      if (latest && (dto.genState === 'done' || dto.status === 'generated')) {
        stopPoll(postId);
        setJob(postId, {
          status: 'done',
          phase: undefined,
          startedAt: mem?.startedAt,
          result: completeResult,
        });
        return;
      }

      // Stale server error after a successful upload (e.g. client timeout race).
      if (latest && dto.genState === 'error') {
        stopPoll(postId);
        setJob(postId, {
          status: 'done',
          phase: undefined,
          startedAt: mem?.startedAt,
          result: completeResult,
        });
        void patchRampPost(postId, { genState: 'done', status: 'generated' }).catch(() => {});
        return;
      }

      if (dto.genState === 'error') {
        stopPoll(postId);
        setJob(postId, {
          status: 'error',
          error: 'Generation failed on server',
          startedAt: mem?.startedAt,
        });
        return;
      }

      const persisted = readPersisted();
      const startedAt = persisted?.startedAt || mem?.startedAt;
      if (dto.genState === 'generating' && startedAt && Date.now() - startedAt > STALE_MS) {
        if (latest) {
          stopPoll(postId);
          setJob(postId, {
            status: 'done',
            phase: undefined,
            startedAt,
            result: completeResult,
          });
          void patchRampPost(postId, { genState: 'done', status: 'generated' }).catch(() => {});
          return;
        }
        stopPoll(postId);
        setJob(postId, {
          status: 'error',
          error: 'Generation timed out — tap Generate to try again',
          startedAt,
        });
        void patchRampPost(postId, { genState: 'error' }).catch(() => {});
      }
    } catch {
      /* retry on next tick */
    }

    if (!cancelled) window.setTimeout(tick, POLL_MS);
  };

  void tick();
}

export function resumeRampGenerationWatch(postId, serverGenState) {
  if (!postId) return;
  const mem = jobs.get(postId);
  if (mem?.status === 'generating' && mem.promise) return;

  const shouldWatch =
    serverGenState === 'generating' ||
    (readPersisted()?.postId === postId && readPersisted()?.status === 'generating');

  if (shouldWatch) {
    if (!mem || mem.status !== 'generating') {
      setJob(postId, {
        status: 'generating',
        phase: readPersisted()?.phase || 'generating',
        startedAt: readPersisted()?.startedAt || Date.now(),
      });
    }
    startServerPoll(postId);
  }
}

async function runServerGenerationPipeline(post, serverPostId, startedAt) {
  const postId = resolvePostKey(post);
  const promptText = String(post?.caption || '').trim();

  setJob(postId, { status: 'generating', phase: 'prepare', startedAt });
  await startRampPostGeneration(serverPostId, { caption: promptText });
  setJob(postId, { status: 'generating', phase: 'generating', startedAt });
  startServerPoll(postId);
  return waitForJobCompletion(postId);
}

async function runLocalGenerationPipeline(post, startedAt) {
  const postId = resolvePostKey(post);
  const promptText = String(post?.caption || '').trim();

  setJob(postId, { status: 'generating', phase: 'generating', startedAt });

  const prompt = buildRampImagePrompt({
    clientName: post.target?.name,
    direction: promptText,
  });

  let file = null;
  let imageUrl = null;
  if (post.heroImage) {
    file = await imageRefToFile(post.heroImage);
    if (!file) {
      imageUrl = await ensureRampImageUploaded(post.heroImage);
    }
  }

  const { blob, objectUrl } = await generateRampImage({
    prompt,
    imageFile: file,
    imageUrl: file ? null : imageUrl,
  });

  setJob(postId, { status: 'generating', phase: 'uploading', startedAt });

  let persistedUrl = objectUrl;
  let generatedImages = Array.isArray(post.generatedImages) ? [...post.generatedImages] : [];

  if (isRampRuntimeApiAvailable() && isServerPostId(postId)) {
    persistedUrl = await uploadRampComposed(blob);
    generatedImages = [...generatedImages, persistedUrl];
    setJob(postId, { status: 'generating', phase: 'finishing', startedAt });
    await patchRampPost(postId, {
      generatedImages,
      genState: 'done',
      status: 'generated',
    });
    revokeRampObjectUrl(objectUrl);
  }

  return {
    generatedImages,
    generatedImage: persistedUrl,
    buildPhase: 'ship',
    genState: 'done',
    status: 'generated',
  };
}

async function runGenerationPipeline(post) {
  const postId = resolvePostKey(post);
  if (!postId) throw new Error('Missing post id');

  if (!isRampApiAvailable()) throw new Error('API is not configured');

  const isStation = post?.source === 'station';
  if (!post?.heroImage && !isStation) {
    throw new Error('No photo on this post — capture one first.');
  }

  const promptText = String(post?.caption || '').trim();
  if (!promptText) throw new Error('Enter a prompt first.');

  const serverPostId = isServerPostId(postId) ? postId : null;
  const startedAt = Date.now();

  setJob(postId, { status: 'generating', phase: 'prepare', startedAt, error: undefined, result: undefined });

  try {
    const result =
      serverPostId && isRampRuntimeApiAvailable()
        ? await runServerGenerationPipeline(post, serverPostId, startedAt)
        : await runLocalGenerationPipeline(post, startedAt);

    stopPoll(postId);
    setJob(postId, { status: 'done', phase: undefined, startedAt, result });
    return result;
  } catch (err) {
    if (serverPostId && isRampRuntimeApiAvailable()) {
      void patchRampPost(serverPostId, { genState: 'error' }).catch(() => {});
    }
    stopPoll(postId);
    setJob(postId, {
      status: 'error',
      phase: undefined,
      startedAt,
      error: err?.message || 'Generation failed',
    });
    throw err;
  }
}

/**
 * Start or re-attach to an in-flight generation for this post.
 * Returns a promise that resolves when the job completes.
 */
export function startRampImageGeneration(post) {
  const postId = resolvePostKey(post);
  if (!postId) return Promise.reject(new Error('Missing post id'));

  const existing = jobs.get(postId);
  if (existing?.status === 'generating' && existing.promise) {
    return existing.promise;
  }

  if (existing?.status === 'done' && existing.result) {
    return Promise.resolve(existing.result);
  }

  const promise = runGenerationPipeline(post).finally(() => {
    const job = jobs.get(postId);
    if (job) jobs.set(postId, { ...job, promise: undefined });
  });
  jobs.set(postId, { ...(jobs.get(postId) || {}), promise });
  if (isServerPostId(postId)) startServerPoll(postId);
  return promise;
}

export function clearRampGenError(postId) {
  const mem = jobs.get(postId);
  if (mem?.status === 'error') {
    jobs.delete(postId);
    writePersisted(null);
    emit(postId, { status: 'idle', postId });
  }
}

/** Drop stale client error when the post already has a generated artifact. */
export function reconcileRampGenWithPost(post) {
  const postId = resolvePostKey(post);
  if (!postId) return;

  const generated = Array.isArray(post?.generatedImages) ? post.generatedImages : [];
  const hasGenerated = Boolean(post?.generatedImage) || generated.length > 0;
  if (!hasGenerated) return;

  const mem = jobs.get(postId);
  const persisted = readPersisted();
  const staleError =
    mem?.status === 'error' ||
    (persisted?.postId === postId && persisted?.status === 'error');

  if (!staleError) return;

  jobs.delete(postId);
  writePersisted(null);
  emit(postId, { status: 'idle', postId });
}

export function useRampGeneration(postId, serverGenState) {
  const [state, setState] = useState(() => getRampGenState(postId));

  useEffect(() => {
    if (!postId) {
      setState({ status: 'idle' });
      return undefined;
    }

    setState(getRampGenState(postId));
    resumeRampGenerationWatch(postId, serverGenState);

    const unsub = subscribeRampGen(postId, (next) => {
      setState({ ...next, postId });
    });

    return () => {
      unsub();
    };
  }, [postId, serverGenState]);

  const isGenerating = state.status === 'generating' || serverGenState === 'generating';
  const isDone = state.status === 'done';
  const isError = state.status === 'error';

  return {
    ...state,
    isGenerating: isGenerating && !isDone,
    isError,
    isDone,
    phase: state.phase || 'generating',
  };
}

export function useRampGenResultApplier(post, updatePost) {
  const postId = resolvePostKey(post);

  const applyResult = useCallback(
    (result) => {
      if (!post || !result) return;
      revokeRampObjectUrl(post.generatedImage);
      updatePost({
        ...post,
        generatedImages: result.generatedImages ?? post.generatedImages,
        generatedImage: result.generatedImage,
        buildPhase: result.buildPhase ?? 'ship',
        genState: result.genState ?? 'done',
        status: result.status ?? 'generated',
      });
    },
    [post, updatePost],
  );

  useEffect(() => {
    if (!postId) return undefined;
    return subscribeRampGen(postId, (job) => {
      if (job.status === 'done' && job.result) applyResult(job.result);
    });
  }, [postId, applyResult]);
}
