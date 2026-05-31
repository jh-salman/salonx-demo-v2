import React from 'react';

export default function RampS5ReadyHero({
  clientName = '',
  preparing = false,
  children,
}) {
  return (
    <div className="ramp-post-it__readyHero">
      <div className="ramp-post-it__readyMeta">
        <span className="ramp-post-it__statusPill ramp-post-it__statusPill--ready">Ready</span>
        {clientName ? (
          <span className="ramp-post-it__clientChip ramp-post-it__clientChip--inline">
            {clientName}
          </span>
        ) : null}
      </div>
      <div className="ramp-post-it__artifactStage">
        {children}
        {preparing ? (
          <div className="ramp-post-it__artifactOverlay" role="status" aria-live="polite">
            <span className="ramp-post-it__spinner" aria-hidden />
            <span className="ramp-post-it__overlayCopy">Preparing image for Messages…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
