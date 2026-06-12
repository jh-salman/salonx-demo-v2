import React from 'react';
import { Lightning, Camera, Wrench } from 'phosphor-react';
import '../presentation/style/ramp-control-popup.css';

/**
 * RAMP Control Pop-Up — shown when the bolt is tapped off a non-client screen.
 * Two routes: capture now (set the client after), or open the free-build
 * RAMP Station. On an in-chair screen (S2) the bolt skips this and captures
 * silently with the client inherited.
 */
export default function RampControlPopup({
  open,
  accent,
  onTakePhoto,
  onOpenStation,
  onClose,
}) {
  if (!open) return null;
  return (
    <div
      className="ramp-ctrl"
      style={{ ['--ramp-ctrl-accent']: accent }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="ramp-ctrl__sheet" role="dialog" aria-modal="true" aria-label="RAMP">
        <button
          type="button"
          className="ramp-ctrl__grab"
          onClick={onClose}
          aria-label="Close"
        />
        <div className="ramp-ctrl__bolt" aria-hidden>
          <Lightning size={26} weight="fill" />
        </div>
        <div className="ramp-ctrl__title">RAMP</div>

        <button type="button" className="ramp-ctrl__choice ramp-ctrl__choice--primary" onClick={onTakePhoto}>
          <span className="ramp-ctrl__eic" aria-hidden><Camera size={22} weight="bold" /></span>
          <span className="ramp-ctrl__lab">
            <span className="ramp-ctrl__t">Take a photo</span>
            <span className="ramp-ctrl__d">Capture now → set the client → queue</span>
          </span>
        </button>

        <button type="button" className="ramp-ctrl__choice" onClick={onOpenStation}>
          <span className="ramp-ctrl__eic" aria-hidden><Wrench size={22} weight="bold" /></span>
          <span className="ramp-ctrl__lab">
            <span className="ramp-ctrl__t">Open RAMP Station</span>
            <span className="ramp-ctrl__d">Free-build a post — no appointment needed</span>
          </span>
        </button>
      </div>
    </div>
  );
}
