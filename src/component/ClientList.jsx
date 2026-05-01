import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { useTimers } from '../context/TimersContext';
import {
  formatTimeShort,
  isSameLocalDay,
  useCalendarEvents,
} from '../data/calendarEventsStore';
import { MOCK_CLIENTS } from '../data/mockClients';
import TimerModal from './TimerModal';

const ACCENT = '#ff7819';

const CARD_WIDTH = 380;
const CARD_HEIGHT = 56;

const fmt2 = (n) => String(n).padStart(2, '0');

function fmtCountdown(remainingMs) {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${fmt2(m)}:${fmt2(s)}`;
  return `${m}:${fmt2(s)}`;
}

function fmtElapsed(elapsedMs) {
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${fmt2(m)}:${fmt2(s)}`;
  return `${m}:${fmt2(s)}`;
}

const ClientCard = ({
  cardId,
  name,
  time,
  service,
  isActive,
  timerState,
  onCardClick,
  onTimerBoxClick,
}) => {
  const outerStyle = {
    position: 'relative',
    width: `${CARD_WIDTH}px`,
    height: `${CARD_HEIGHT}px`,
    marginBottom: '6px',
    padding: '1.5px',
    borderRadius: '11.5px',
    background: `linear-gradient(to right, ${ACCENT} 0%, ${ACCENT}cc 18%, ${ACCENT}66 45%, ${ACCENT}00 85%)`,
    cursor: 'pointer',
    boxSizing: 'border-box',
  };

  const innerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#1A1A1A',
    borderRadius: '10px',
    padding: '8px 72px 8px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    boxSizing: 'border-box',
  };

  const leftStyle = {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  };

  const nameStyle = {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f5f5f7',
    lineHeight: 1.15,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  };

  const timeStyle = {
    fontSize: '10px',
    color: 'rgba(245, 245, 247, 0.55)',
    letterSpacing: '0.02em',
    margin: 0,
  };

  const centerStyle = {
    flex: '1 1 0',
    minWidth: 0,
    fontSize: '10.5px',
    color: 'rgba(245, 245, 247, 0.72)',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    padding: '0 4px',
  };

  const timerBtnBase = {
    flex: '0 0 auto',
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    border: '1.5px solid #000',
    borderRadius: '8px',
    padding: 0,
    fontSize: '10.5px',
    fontWeight:500,
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
    border: `1.5px solid ${ACCENT}`,
    boxShadow: '0 0 14px rgba(255, 120, 25, 0.45), inset 0 0 6px rgba(255, 120, 25, 0.08)',
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  };

  const timerBtnCompleted = {
    ...timerBtnBase,
    background: '#000',
    border: `1.5px solid ${ACCENT}`,
    padding: '7px',
    animation: 'timerCompletedBlink 1s ease-in-out infinite',
  };

  const handleTimerClick = (e) => {
    e.stopPropagation();
    if (onTimerBoxClick) onTimerBoxClick(cardId);
  };

  let timerNode;
  if (timerState?.kind === 'completed') {
    timerNode = (
      <div style={timerBtnCompleted} onClick={handleTimerClick} aria-label="Timer completed">
        <img
          src="/salonx.png"
          alt="Salonx"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    );
  } else if (timerState?.kind === 'timerRunning') {
    timerNode = (
      <div style={timerBtnActive} onClick={handleTimerClick} aria-label="Active timer">
        {fmtCountdown(timerState.remainingMs)}
      </div>
    );
  } else if (timerState?.kind === 'stopwatchRunning') {
    timerNode = (
      <div style={timerBtnActive} onClick={handleTimerClick} aria-label="Stopwatch running">
        {fmtElapsed(timerState.elapsedMs)}
      </div>
    );
  } else {
    timerNode = (
      <div style={timerBtnBase} onClick={handleTimerClick} aria-label="Set timer">
        Set<br />Timer
      </div>
    );
  }

  return (
    <div style={outerStyle} onClick={onCardClick} role="button" tabIndex={0}>
      <div style={innerStyle}>
        <div style={leftStyle}>
          <div style={nameStyle}>{name}</div>
          {time ? <div style={timeStyle}>{time}</div> : null}
        </div>
        <div style={centerStyle}>{service}</div>
        {timerNode}
      </div>
    </div>
  );
};

// ClientList renders the appointments scheduled for *today*, sourced from the
// Calendar screen's events store (the single source of truth for all
// appointment data across the app). When the user adds, moves, cancels, or
// resizes an appointment in Calendar, the persisted store dispatches a
// "salonx:calendar-updated" event and this list re-renders automatically.

function buildPayloadFromEvent(ev) {
  if (!ev) return null;
  const target = (ev.clientName || '').toLowerCase();
  const knownClient = MOCK_CLIENTS.find(
    (c) => (c.name || '').toLowerCase() === target,
  );
  const durationMin = Math.max(
    0,
    Math.round((ev.end.getTime() - ev.start.getTime()) / 60000),
  );
  const consultationDate = `${ev.start.getMonth() + 1}.${ev.start.getDate()}.${ev.start.getFullYear()}`;
  return {
    name: ev.clientName || '',
    service: ev.service || '',
    price: typeof ev.price === 'number' ? ev.price : 0,
    consultationDate,
    duration: durationMin ? `${durationMin} min` : '',
    notes: ev.notes || '',
    phone: knownClient?.phone || '',
    email: knownClient?.email || '',
    services: [],
    recommendations: [],
    homeCare: '',
  };
}

const ClientList = () => {
  const wrapperStyle = {
    width: '100%',
    padding: '6px 0 8px',
    boxSizing: 'border-box',
  };

  const { setSelectedClientData } = useContext(AppContext);
  const { timers, setTimer, clearTimer } = useTimers();
  const calendarEvents = useCalendarEvents();

  // Derive today's appointments from the Calendar event store. Sorted by start
  // time so the list matches the calendar day view top-to-bottom.
  const todaysAppointments = useMemo(() => {
    const today = new Date();
    return calendarEvents
      .filter((ev) => isSameLocalDay(ev.start, today))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((ev) => ({
        id: ev.id,
        name: ev.clientName || '',
        time: `${formatTimeShort(ev.start)} – ${formatTimeShort(ev.end)}`,
        service: ev.service || '',
        payload: buildPayloadFromEvent(ev),
      }));
  }, [calendarEvents]);

  const [now, setNow] = useState(() => Date.now());
  const [modalForName, setModalForName] = useState(null);

  useEffect(() => {
    const hasRunning = Object.values(timers).some(
      (t) => t && (t.kind === 'timerRunning' || t.kind === 'stopwatchRunning'),
    );
    if (!hasRunning) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timers]);

  const liveTimers = useMemo(() => {
    const out = {};
    Object.entries(timers).forEach(([name, t]) => {
      if (!t) return;
      if (t.kind === 'timerRunning') {
        const remainingMs = t.endsAt - now;
        if (remainingMs <= 0) {
          out[name] = { kind: 'completed' };
        } else {
          out[name] = { kind: 'timerRunning', remainingMs };
        }
      } else if (t.kind === 'stopwatchRunning') {
        out[name] = { kind: 'stopwatchRunning', elapsedMs: now - t.startedAt };
      } else {
        out[name] = t;
      }
    });
    return out;
  }, [timers, now]);

  // Promote expired timers in shared store to 'completed'
  useEffect(() => {
    Object.entries(liveTimers).forEach(([name, t]) => {
      if (t.kind === 'completed' && timers[name]?.kind === 'timerRunning') {
        setTimer(name, { kind: 'completed' });
      }
    });
  }, [liveTimers, timers, setTimer]);

  const handleClientClick = useCallback(
    (clientData) => {
      setSelectedClientData({ ...clientData, color: ACCENT });
    },
    [setSelectedClientData],
  );

  const handleTimerBoxClick = useCallback((name) => {
    setModalForName(name);
  }, []);

  const handleStartTimer = useCallback(
    (totalSec) => {
      if (!modalForName) return;
      setTimer(modalForName, {
        kind: 'timerRunning',
        endsAt: Date.now() + totalSec * 1000,
      });
      setNow(Date.now());
      setModalForName(null);
    },
    [modalForName, setTimer],
  );

  const handleStartStopwatch = useCallback(() => {
    if (!modalForName) return;
    setTimer(modalForName, {
      kind: 'stopwatchRunning',
      startedAt: Date.now(),
    });
    setNow(Date.now());
  }, [modalForName, setTimer]);

  const handleStopStopwatch = useCallback(() => {
    if (!modalForName) return;
    clearTimer(modalForName);
    setModalForName(null);
  }, [modalForName, clearTimer]);

  const handleStopTimer = useCallback(() => {
    if (!modalForName) return;
    clearTimer(modalForName);
    setModalForName(null);
  }, [modalForName, clearTimer]);

  const handleResetTimer = useCallback(() => {
    if (!modalForName) return;
    clearTimer(modalForName);
  }, [modalForName, clearTimer]);

  const activeAppointment = todaysAppointments.find((a) => a.name === modalForName);
  const activeRunningState = modalForName ? liveTimers[modalForName] : null;

  return (
    <div style={wrapperStyle}>
      {todaysAppointments.map((a) => (
        <ClientCard
          key={a.id}
          cardId={a.name}
          name={a.name}
          time={a.time}
          service={a.service}
          isActive
          timerState={liveTimers[a.name]}
          onTimerBoxClick={handleTimerBoxClick}
          onCardClick={a.payload ? () => handleClientClick(a.payload) : undefined}
        />
      ))}

      <TimerModal
        open={modalForName !== null}
        clientName={activeAppointment?.name || modalForName || ''}
        runningState={activeRunningState}
        onClose={() => setModalForName(null)}
        onStartTimer={handleStartTimer}
        onStartStopwatch={handleStartStopwatch}
        onStopStopwatch={handleStopStopwatch}
        onStopTimer={handleStopTimer}
        onResetTimer={handleResetTimer}
      />
    </div>
  );
};

export default ClientList;
