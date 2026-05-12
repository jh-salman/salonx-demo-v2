import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimers } from '../context/TimersContext';
import {
  buildAptNavPayload,
  writePersistedScreen2Apt,
} from '../data/appointmentStateStore';
import {
  formatTimeShort,
  isSameLocalDay,
  useCalendarEvents,
} from '../data/calendarEventsStore';
import AppointmentTimerBox from './AppointmentTimerBox';
import TimerModal from './TimerModal';
import { useTheme } from '../context/ThemeContext';
import { accentCardGradientCss } from '../theme/primaryTheme';

const CARD_WIDTH = 380;
const CARD_HEIGHT = 70;

/** Screen1: same gap between appointment rows (matches demo `--s1demo-section-gap` rhythm). */
const S1_CARD_STACK_GAP_PX = 10;

const ClientCard = ({
  cardId,
  name,
  time,
  service,
  isActive,
  timerState,
  onCardClick,
  onTimerBoxClick,
  cardGradient,
}) => {
  const outerStyle = {
    position: 'relative',
    width: `${CARD_WIDTH}px`,
    height: `${CARD_HEIGHT}px`,
    marginBottom: `${S1_CARD_STACK_GAP_PX}px`,
    padding: '1.5px',
    borderRadius: '11.5px',
    background: cardGradient,
    cursor: 'pointer',
    boxSizing: 'border-box',
  };

  const innerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#1A1A1A',
    borderRadius: '10px',
    /* right padding: room for timer + curve — nudged 20px toward curve vs older 92px */
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

  const handleTimerClick = (e) => {
    e.stopPropagation();
    if (onTimerBoxClick) onTimerBoxClick(cardId);
  };

  return (
    <div style={outerStyle} onClick={onCardClick} role="button" tabIndex={0}>
      <div style={innerStyle}>
        <div style={leftStyle}>
          <div style={nameStyle}>{name}</div>
          {time ? <div style={timeStyle}>{time}</div> : null}
        </div>
        <div style={centerStyle}>{service}</div>
        <AppointmentTimerBox timerState={timerState} onPress={handleTimerClick} />
      </div>
    </div>
  );
};

// ClientList renders the appointments scheduled for *today*, sourced from the
// Calendar screen's events store (the single source of truth for all
// appointment data across the app). When the user adds, moves, cancels, or
// resizes an appointment in Calendar, the persisted store dispatches a
// "salonx:calendar-updated" event and this list re-renders automatically.
//
// Tapping a card navigates to Screen2 (client details) for *that* appointment.
// The same `apt` payload is also stashed in sessionStorage so a full refresh
// (which drops `location.state`) still resumes the correct appointment.
// Screen2 -> Climax then propagates the apt so checkout reads the per-
// appointment service / product queue from `appointmentStateStore`.

const ClientList = ({ stylistFromPath = '/screen1' }) => {
  const { primaryHex } = useTheme();
  const cardGradient = useMemo(() => accentCardGradientCss(primaryHex), [primaryHex]);

  const wrapperStyle = {
    width: '100%',
    padding: '0',
    boxSizing: 'border-box',
  };

  const navigate = useNavigate();
  const { timers, setTimer, clearTimer } = useTimers();
  const calendarEvents = useCalendarEvents();

  // Derive today's appointments from the Calendar event store. Sorted by start
  // time so the list matches the calendar day view top-to-bottom. The full
  // event is stashed on each row so card tap can hand it to Screen2 verbatim.
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
        apt: buildAptNavPayload(ev),
      }));
  }, [calendarEvents]);

  const [now, setNow] = useState(() => Date.now());
  /** Matches `TimersContext` / Calendar: one timer per appointment id (not client name). */
  const [timerModalKey, setTimerModalKey] = useState(/** @type {string | null} */ (null));

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
    Object.entries(liveTimers).forEach(([key, t]) => {
      if (t.kind === 'completed' && timers[key]?.kind === 'timerRunning') {
        setTimer(key, { kind: 'completed' });
      }
    });
  }, [liveTimers, timers, setTimer]);

  const handleClientClick = useCallback(
    (apt) => {
      if (!apt) return;
      // Persist for refresh-survival (Screen2 reads it back if `state` is gone),
      // including the origin so Screen2's Back button returns to Stylist.
      writePersistedScreen2Apt(apt, stylistFromPath);
      navigate('/screen2', { state: { apt, from: stylistFromPath } });
    },
    [navigate, stylistFromPath],
  );

  const handleTimerBoxClick = useCallback((aptTimerKey) => {
    setTimerModalKey(aptTimerKey);
  }, []);

  const handleStartTimer = useCallback(
    (totalSec) => {
      if (!timerModalKey) return;
      setTimer(timerModalKey, {
        kind: 'timerRunning',
        endsAt: Date.now() + totalSec * 1000,
      });
      setNow(Date.now());
      setTimerModalKey(null);
    },
    [timerModalKey, setTimer],
  );

  const handleStartStopwatch = useCallback(() => {
    if (!timerModalKey) return;
    setTimer(timerModalKey, {
      kind: 'stopwatchRunning',
      startedAt: Date.now(),
    });
    setNow(Date.now());
  }, [timerModalKey, setTimer]);

  const handleStopStopwatch = useCallback(() => {
    if (!timerModalKey) return;
    clearTimer(timerModalKey);
    setTimerModalKey(null);
  }, [timerModalKey, clearTimer]);

  const handleStopTimer = useCallback(() => {
    if (!timerModalKey) return;
    clearTimer(timerModalKey);
    setTimerModalKey(null);
  }, [timerModalKey, clearTimer]);

  const handleResetTimer = useCallback(() => {
    if (!timerModalKey) return;
    clearTimer(timerModalKey);
  }, [timerModalKey, clearTimer]);

  const activeAppointment = todaysAppointments.find((a) => a.id === timerModalKey);
  const activeRunningState = timerModalKey ? liveTimers[timerModalKey] : null;

  return (
    <div style={wrapperStyle}>
      {todaysAppointments.map((a) => (
      <ClientCard
          key={a.id}
          cardId={String(a.id)}
          name={a.name}
          time={a.time}
          service={a.service}
          isActive
          cardGradient={cardGradient}
          timerState={liveTimers[String(a.id)]}
          onTimerBoxClick={handleTimerBoxClick}
          onCardClick={a.apt ? () => handleClientClick(a.apt) : undefined}
        />
      ))}

      <TimerModal
        open={timerModalKey !== null}
        clientName={activeAppointment?.name || ''}
        runningState={activeRunningState}
        onClose={() => setTimerModalKey(null)}
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
