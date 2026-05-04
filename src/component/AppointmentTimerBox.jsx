import React from 'react';
import './appointmentTimerBox.css';

/** Matches Stylist (S1) appointment card timer — same pixels, colors, and states */
const ACCENT = '#ff7819';

const fmt2 = (n) => String(n).padStart(2, '0');

export function fmtCountdown(remainingMs) {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${fmt2(m)}:${fmt2(s)}`;
  return `${m}:${fmt2(s)}`;
}

export function fmtElapsed(elapsedMs) {
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${fmt2(m)}:${fmt2(s)}`;
  return `${m}:${fmt2(s)}`;
}

function buildTimerStyles(compact) {
  /* compact = Screen2 LOOK row: same footprint as .s2-consultCard .s2-lookThumb (35×35, r7) */
  const size = compact ? 35 : 44;
  const br = compact ? 7 : 8;
  const fontBase = compact ? 7.5 : 10.5;
  const fontActive = compact ? 9 : 12;
  const completedPad = compact ? 4 : 7;
  const borderW = compact ? '1px' : '1.5px';
  const shadow = compact
    ? '0 0 8px rgba(255, 120, 25, 0.32), inset 0 0 3px rgba(255, 120, 25, 0.08)'
    : '0 0 14px rgba(255, 120, 25, 0.45), inset 0 0 6px rgba(255, 120, 25, 0.08)';

  const timerBtnBase = {
    flex: '0 0 auto',
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    border: `${borderW} solid #000`,
    borderRadius: `${br}px`,
    padding: 0,
    fontSize: `${fontBase}px`,
    fontWeight: 500,
    color: 'rgba(245, 245, 247, 0.73)',
    background: 'rgb(19, 19, 20)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    lineHeight: 1.1,
    letterSpacing: '0.03em',
    boxSizing: 'border-box',
    cursor: 'pointer',
  };

  const timerBtnActive = {
    ...timerBtnBase,
    color: ACCENT,
    background: '#000',
    border: `${borderW} solid ${ACCENT}`,
    boxShadow: shadow,
    fontSize: `${fontActive}px`,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  };

  const timerBtnCompleted = {
    ...timerBtnBase,
    background: '#000',
    border: `${borderW} solid ${ACCENT}`,
    padding: `${completedPad}px`,
    animation: 'timerCompletedBlink 1s ease-in-out infinite',
  };

  return { timerBtnBase, timerBtnActive, timerBtnCompleted };
}

/**
 * @param {object} props
 * @param {{ kind: string, remainingMs?: number, elapsedMs?: number } | null | undefined} props.timerState
 * @param {(e: React.MouseEvent) => void} props.onPress
 * @param {boolean} [props.compact] — Screen2 LOOK row: 35×35 to match consult NOW/WANT/LAST thumbs; S1 cards omit
 */
export default function AppointmentTimerBox({ timerState, onPress, compact = false }) {
  const { timerBtnBase, timerBtnActive, timerBtnCompleted } = buildTimerStyles(compact);

  const handleClick = (e) => {
    e.stopPropagation();
    onPress(e);
  };

  if (timerState?.kind === 'completed') {
    return (
      <div style={timerBtnCompleted} onClick={handleClick} aria-label="Timer completed">
        <img
          src="/salonx.png"
          alt="Salonx"
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    );
  }
  if (timerState?.kind === 'timerRunning') {
    return (
      <div style={timerBtnActive} onClick={handleClick} aria-label="Active timer">
        {fmtCountdown(timerState.remainingMs)}
      </div>
    );
  }
  if (timerState?.kind === 'stopwatchRunning') {
    return (
      <div style={timerBtnActive} onClick={handleClick} aria-label="Stopwatch running">
        {fmtElapsed(timerState.elapsedMs)}
      </div>
    );
  }
  const idleStyle = compact
    ? { ...timerBtnBase, lineHeight: 1.05, letterSpacing: '0.02em' }
    : timerBtnBase;

  return (
    <div style={idleStyle} onClick={handleClick} aria-label="Set timer">
      Set
      <br />
      Timer
    </div>
  );
}
