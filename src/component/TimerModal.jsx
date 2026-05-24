import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../presentation/style/screen1.css';

const fmt2 = (n) => String(n).padStart(2, '0');

const PICKER_ITEM_H = 44;
const PICKER_VISIBLE_ITEMS = 3;
const PICKER_PAD_ITEMS = Math.floor(PICKER_VISIBLE_ITEMS / 2);

function PickerColumn({ items, value, onChange, label }) {
  const ref = useRef(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, items.findIndex((v) => v === value));
    el.scrollTop = idx * PICKER_ITEM_H;
    lastValueRef.current = value;
  }, [value, items]);

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / PICKER_ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    const next = items[clamped];
    if (next !== lastValueRef.current) {
      lastValueRef.current = next;
      onChange(next);
    }
  }, [items, onChange]);

  return (
    <div className="timerModal__picker">
      <div className="timerModal__pickerBand" aria-hidden />
      <div
        ref={ref}
        className="timerModal__pickerScroll"
        onScroll={handleScroll}
        role="listbox"
        aria-label={label}
      >
        <div style={{ height: PICKER_ITEM_H * PICKER_PAD_ITEMS }} aria-hidden />
        {items.map((item) => (
          <div
            key={item}
            className={`timerModal__pickerItem${item === value ? ' is-current' : ''}`}
            onClick={() => onChange(item)}
          >
            {fmt2(item)}
          </div>
        ))}
        <div style={{ height: PICKER_ITEM_H * PICKER_PAD_ITEMS }} aria-hidden />
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function fmtClock(totalMs) {
  const sec = Math.max(0, Math.ceil(totalMs / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${fmt2(h)}:${fmt2(m)}:${fmt2(s)}`;
}

function fmtStopwatch(totalMs) {
  const totalCs = Math.floor(totalMs / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${fmt2(m)}:${fmt2(s)}.${fmt2(cs)}`;
}

function TimerModal({
  open,
  clientName,
  runningState,
  onClose,
  onStartTimer,
  onStartStopwatch,
  onStopStopwatch,
  onStopTimer,
  onResetTimer,
  mode: initialMode = 'timer',
  /** 'sheet' = Stylist (S1); 'center' = Screen2 */
  placement = 'sheet',
}) {
  const [mode, setMode] = useState(initialMode);
  const [view, setView] = useState('set');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [stopwatchInModalRunning, setStopwatchInModalRunning] = useState(false);
  const [stopwatchInModalElapsed, setStopwatchInModalElapsed] = useState(0);
  const swStartRef = useRef(null);
  const swRafRef = useRef(null);

  // Initialize per-open
  useEffect(() => {
    if (!open) return;
    if (runningState && runningState.kind === 'timerRunning') {
      setMode('timer');
      setView('running');
    } else if (runningState && runningState.kind === 'stopwatchRunning') {
      setMode('stopwatch');
      setView('running');
    } else if (runningState && runningState.kind === 'completed') {
      // Timer ended — show the acknowledge/stop view so the user can turn off
      // the blinking everywhere (S1 list, Screen2 LOOK row, Calendar bell).
      setMode('timer');
      setView('completed');
    } else {
      setMode(initialMode);
      setView('set');
      setHours(0);
      setMinutes(0);
      setStopwatchInModalRunning(false);
      setStopwatchInModalElapsed(0);
    }
  }, [open, initialMode, runningState && runningState.kind]); // eslint-disable-line

  // RAF tick for the in-modal stopwatch view (used only when no external runningState)
  useEffect(() => {
    if (!stopwatchInModalRunning) {
      if (swRafRef.current) cancelAnimationFrame(swRafRef.current);
      return;
    }
    swStartRef.current = performance.now() - stopwatchInModalElapsed;
    const tick = () => {
      setStopwatchInModalElapsed(performance.now() - swStartRef.current);
      swRafRef.current = requestAnimationFrame(tick);
    };
    swRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (swRafRef.current) cancelAnimationFrame(swRafRef.current);
    };
  }, [stopwatchInModalRunning]); // eslint-disable-line

  if (!open) return null;

  // Always portal to `document.body`. `#screen1-modal-root` lives inside the
  // Screen1 keep-alive layer (`display:none` when S2/outlet is active), which
  // hid the modal and blocked taps on S2+.
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  const totalSec = hours * 3600 + minutes * 60;
  const startDisabled = mode === 'timer' && totalSec <= 0;
  const isExternalTimerRunning = runningState && runningState.kind === 'timerRunning';
  const isExternalStopwatchRunning = runningState && runningState.kind === 'stopwatchRunning';
  const isExternalCompleted = runningState && runningState.kind === 'completed';
  const isExternalRunning = isExternalTimerRunning || isExternalStopwatchRunning;
  const showRunningView = view === 'running' && isExternalRunning;
  const showCompletedView = view === 'completed' && isExternalCompleted;

  const handleStart = () => {
    if (mode === 'timer') {
      if (totalSec <= 0) return;
      onStartTimer && onStartTimer(totalSec);
    } else {
      if (!stopwatchInModalRunning) {
        setStopwatchInModalRunning(true);
        onStartStopwatch && onStartStopwatch();
      } else {
        setStopwatchInModalRunning(false);
        onStopStopwatch && onStopStopwatch(stopwatchInModalElapsed);
      }
    }
  };

  const handleResetSet = () => {
    setStopwatchInModalRunning(false);
    setStopwatchInModalElapsed(0);
  };

  const handleStopRunning = () => {
    if (isExternalTimerRunning) {
      onStopTimer && onStopTimer();
    } else if (isExternalStopwatchRunning) {
      onStopStopwatch && onStopStopwatch();
    }
  };

  const handleResetRunning = () => {
    if (isExternalTimerRunning) {
      onResetTimer && onResetTimer();
    } else if (isExternalStopwatchRunning) {
      onStopStopwatch && onStopStopwatch();
    }
    setView('set');
    setHours(0);
    setMinutes(0);
  };

  const handleChangeTime = () => {
    setView('set');
    setHours(0);
    setMinutes(0);
  };

  // Acknowledge a finished timer: clear the shared state (which stops the
  // blinking on every surface — S1 cards, Screen2 LOOK row, Calendar bell).
  const handleAcknowledgeCompleted = () => {
    if (onStopTimer) onStopTimer();
    else if (onClose) onClose();
  };

  // Start a fresh timer from the completed view without leaving the modal.
  const handleSetNewFromCompleted = () => {
    setMode('timer');
    setView('set');
    setHours(0);
    setMinutes(0);
  };

  let runningDisplay = '00:00:00';
  if (isExternalTimerRunning) runningDisplay = fmtClock(runningState.remainingMs);
  if (isExternalStopwatchRunning) runningDisplay = fmtClock(runningState.elapsedMs);

  const rootClass =
    placement === 'center' ? 'timerModal timerModal--center' : 'timerModal';

  return createPortal(
    <div
      className={rootClass}
      role="dialog"
      aria-modal="true"
      aria-label={`${mode === 'timer' ? 'Timer' : 'Stopwatch'} for ${clientName}`}
    >
      <button
        type="button"
        className="timerModal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="timerModal__panel">
        <h2 className="timerModal__title">{mode === 'timer' ? 'Timer' : 'Stopwatch'}</h2>
        <div className="timerModal__client">{clientName}</div>

        {showCompletedView ? (
          <div className="timerModal__running timerModal__running--completed">
            <div className="timerModal__runningLabel">TIMER ENDED</div>
            <div className="timerModal__runningClock">00:00:00</div>
            <div className="timerModal__primaryRow">
              <button
                type="button"
                className="timerModal__btn timerModal__btn--primary"
                onClick={handleAcknowledgeCompleted}
              >
                Stop
              </button>
              <button
                type="button"
                className="timerModal__btn timerModal__btn--ghost"
                onClick={handleSetNewFromCompleted}
              >
                Set new
              </button>
            </div>
          </div>
        ) : showRunningView ? (
          <div className="timerModal__running">
            <div className="timerModal__runningLabel">RUNNING</div>
            <div className="timerModal__runningClock">{runningDisplay}</div>
            <div className="timerModal__primaryRow">
              <button
                type="button"
                className="timerModal__btn timerModal__btn--primary"
                onClick={handleStopRunning}
              >
                Stop
              </button>
              <button
                type="button"
                className="timerModal__btn timerModal__btn--ghost"
                onClick={handleResetRunning}
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              className="timerModal__changeTime"
              onClick={handleChangeTime}
            >
              Change time
            </button>
          </div>
        ) : mode === 'timer' ? (
          <>
            <div className="timerModal__pickers">
              <PickerColumn items={HOURS} value={hours} onChange={setHours} label="Hours" />
              <PickerColumn items={MINUTES} value={minutes} onChange={setMinutes} label="Minutes" />
            </div>
            <div className="timerModal__primaryRow">
              <button
                type="button"
                className={`timerModal__btn timerModal__btn--primary${startDisabled ? ' is-disabled' : ''}`}
                onClick={handleStart}
                disabled={startDisabled}
              >
                Start
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="timerModal__stopwatch">{fmtStopwatch(stopwatchInModalElapsed)}</div>
            <div className="timerModal__primaryRow">
              <button
                type="button"
                className="timerModal__btn timerModal__btn--ghost"
                onClick={handleResetSet}
              >
                Reset
              </button>
              <button
                type="button"
                className={`timerModal__btn timerModal__btn--primary${stopwatchInModalRunning ? ' is-running' : ''}`}
                onClick={handleStart}
              >
                {stopwatchInModalRunning ? 'Stop' : 'Start'}
              </button>
            </div>
          </>
        )}

        <div className="timerModal__tabs">
          <button
            type="button"
            className={`timerModal__tab${mode === 'timer' ? ' is-active' : ''}`}
            onClick={() => {
              setMode('timer');
              setView('set');
            }}
          >
            Timer
          </button>
          <button
            type="button"
            className={`timerModal__tab${mode === 'stopwatch' ? ' is-active' : ''}`}
            onClick={() => {
              setMode('stopwatch');
              setView('set');
            }}
          >
            Stopwatch
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}

export default TimerModal;
