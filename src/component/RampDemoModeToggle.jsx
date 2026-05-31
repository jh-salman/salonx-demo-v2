import React, { useCallback, useSyncExternalStore } from 'react';
import {
  isRampDemoMode,
  setRampDemoMode,
  subscribeRampDemoMode,
} from '../lib/rampDemoTransport.js';

function getDemoModeSnapshot() {
  return isRampDemoMode();
}

function getDemoModeServerSnapshot() {
  return true;
}

/** Visible DEMO MODE toggle — localStorage, default ON. */
export default function RampDemoModeToggle({ className = '' }) {
  const demoOn = useSyncExternalStore(
    subscribeRampDemoMode,
    getDemoModeSnapshot,
    getDemoModeServerSnapshot,
  );

  const toggle = useCallback(() => {
    setRampDemoMode(!demoOn);
  }, [demoOn]);

  return (
    <button
      type="button"
      className={`ramp-demo-toggle${demoOn ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onClick={toggle}
      aria-pressed={demoOn}
      aria-label={demoOn ? 'Demo mode on' : 'Demo mode off'}
    >
      <span className="ramp-demo-toggle__dot" aria-hidden />
      DEMO MODE: {demoOn ? 'ON' : 'OFF'}
    </button>
  );
}
