import React, { useEffect, useMemo, useState } from 'react';
import { Lightning } from 'phosphor-react';

const STEPS = [
  { id: 'pending', label: 'Queued' },
  { id: 'generating', label: 'AI build' },
  { id: 'processing', label: 'Brand layer' },
  { id: 'ready', label: 'Ready' },
];

const ACTIVE_STATUSES = new Set(['pending', 'generating', 'processing']);
const ESTIMATED_MS = 45_000;

function stepIndexForStatus(status, isInitialLoad) {
  const s = String(status || '').trim();
  if (isInitialLoad && !s) return -1;
  if (s === 'pending') return 0;
  if (s === 'generating') return 1;
  if (s === 'processing') return 2;
  if (s === 'ready') return 3;
  return 0;
}

function statusCopy(status, isInitialLoad, elapsedSec) {
  if (isInitialLoad) return 'Connecting to your RAMP post…';
  switch (String(status || '').trim()) {
    case 'pending':
      return 'Queued — starting generation shortly.';
    case 'generating':
      return elapsedSec > 0
        ? `AI build in progress · ${elapsedSec}s`
        : 'AI build in progress — updating live.';
    case 'processing':
      return 'Applying brand layer and caption polish.';
    default:
      return 'Building your RAMP — status updates automatically.';
  }
}

function statusBadge(status) {
  const s = String(status || 'pending').trim().toUpperCase();
  return s || 'PENDING';
}

export default function RampS5LoadingPanel({
  status,
  headline,
  clientName = '',
  isInitialLoad = false,
  resumeMode = false,
  generationStartedAt,
  children = null,
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(String(status || '').trim())) return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, [status]);

  const startedAt = generationStartedAt || Date.now();
  const elapsedSec = useMemo(
    () => Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startedAt, tick, status],
  );

  const activeStep = useMemo(
    () => stepIndexForStatus(status, isInitialLoad),
    [isInitialLoad, status],
  );

  const progressPct = useMemo(() => {
    const statusPct =
      activeStep < 0 ? 8 : Math.min(88, ((activeStep + 1) / STEPS.length) * 88);
    const timePct = Math.min(92, 8 + (elapsedSec / (ESTIMATED_MS / 1000)) * 84);
    return Math.max(statusPct, timePct);
  }, [activeStep, elapsedSec]);

  const panelClass = [
    'ramp-post-it__panel',
    'ramp-post-it__panel--loading',
    resumeMode ? 'ramp-post-it__panel--loading-resume' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={panelClass} role="status" aria-live="polite">
      <div className="ramp-post-it__loadingHero">
        <div className="ramp-post-it__loader" aria-hidden>
          {!resumeMode ? (
            <span className="ramp-post-it__loaderRing ramp-post-it__loaderRing--delay" />
          ) : null}
          <span className="ramp-post-it__loaderRing" />
          <Lightning size={24} weight="fill" className="ramp-post-it__loaderBolt" />
        </div>
        <div className="ramp-post-it__statusBadge">{statusBadge(status)}</div>
        <div className="ramp-post-it__eyebrow">Salon X · S5 · POST IT</div>
        {clientName ? (
          <div className="ramp-post-it__clientChip">{clientName}</div>
        ) : null}
        <div className="ramp-post-it__title">{headline}</div>
        <p className="ramp-post-it__copy ramp-post-it__copy--center">
          {statusCopy(status, isInitialLoad, elapsedSec)}
        </p>
      </div>

      <div className="ramp-post-it__progressTrack" aria-hidden>
        <span
          className="ramp-post-it__progressFill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="ramp-post-it__steps">
        {STEPS.map((step, index) => {
          const done = activeStep >= index;
          const current = activeStep === index;
          return (
            <li
              key={step.id}
              className={[
                'ramp-post-it__step',
                done ? 'is-done' : '',
                current ? 'is-current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="ramp-post-it__stepDot" aria-hidden />
              <span className="ramp-post-it__stepLabel">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {!resumeMode ? (
        <div className="ramp-post-it__skeletonCard" aria-hidden>
          <div className="ramp-post-it__skeletonShimmer" />
        </div>
      ) : null}

      {children}
    </div>
  );
}
