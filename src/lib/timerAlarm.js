/** Buzz + ding when a countdown timer reaches zero (PWA / iOS safe). */

const COMPLETION_VIBRATE_MS = [120, 80, 120, 80, 240, 80, 120, 80, 400];

/** @type {AudioContext | null} */
let sharedCtx = null;
let unlockListenersInstalled = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioCtx();
  }
  return sharedCtx;
}

/** Resume AudioContext after a user gesture (required on iOS / standalone PWA). */
export function unlockTimerAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

function installUnlockListeners() {
  if (unlockListenersInstalled || typeof window === 'undefined') return;
  unlockListenersInstalled = true;
  const unlock = () => unlockTimerAudio();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('click', unlock, { passive: true });
}

function playTone(ctx, freq, startTime, durationSec, volume = 0.22) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.05);
}

async function playTimerDing() {
  installUnlockListeners();
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') return;

    const t0 = ctx.currentTime + 0.02;
    playTone(ctx, 880, t0, 0.2);
    playTone(ctx, 880, t0 + 0.26, 0.2);
    playTone(ctx, 1174.66, t0 + 0.52, 0.38, 0.26);
  } catch (_) {
    /* audio blocked or unsupported */
  }
}

export function fireTimerAlarm() {
  if (typeof window === 'undefined') return;

  installUnlockListeners();

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(COMPLETION_VIBRATE_MS);
    }
  } catch (_) {
    /* vibrate blocked */
  }

  void playTimerDing();
}
