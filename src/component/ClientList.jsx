import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
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

const APPOINTMENTS = [
  {
    id: 'cristi',
    name: 'Cristi Curls',
    time: '8:00 AM – 9:10 AM',
    service: 'Extension install',
    payload: {
      name: 'Cristi Curls',
      service: 'Extension install',
      price: 300,
      consultationDate: '7.2.2025',
      duration: '30 min',
      notes:
        'Redken shades EQ 7N. 7WB. No left developer.\n Next time use more 7N \n A Kool dude!!! \n Sister in law is pregnant and expecting twins. They just \n started rebuilding the cabin. Jennifer is going to FSU',
      services: [
        { name: 'Hair Gloss Treatment', price: 70 },
        { name: 'Blonding Service', price: 120 },
      ],
      recommendations: [{ name: 'Blonding Service', price: 120 }],
      homeCare: 'Use sulfate-free shampoo and conditioner. Apply hair mask weekly.',
    },
  },
  {
    id: 'jon',
    name: 'Jon Klein',
    time: '9:15 AM – 10:00 AM',
    service: 'Full lived-in color',
    payload: {
      name: 'Jon Klein',
      service: 'Full lived-in color',
      price: 220,
      consultationDate: '8.15.2025',
      duration: '45 min',
      notes:
        'Redken shades EQ 7N. 7WB. No left developer.\nNext time use more 7N\nA Kool dude!!!\nSister in law is pregnant and expecting twins. They just\n started rebuilding the cabin. Jennifer is going to FSU',
      services: [
        { name: 'Balayage', price: 150 },
        { name: 'Toner Application', price: 60 },
      ],
      recommendations: [{ name: 'Deep Conditioning Treatment', price: 50 }],
      homeCare: [
        { name: 'Rusk: Rusk COLORxConditioner', price: 25, img: './img1.png' },
        { name: 'Rusk: Rusk VHAB Shampoo', price: 30, img: './img2.png' },
      ],
    },
  },
  {
    id: 'joe',
    name: 'Joe Styles',
    time: '10:15 AM – 10:55 AM',
    service: 'Men’s haircut and color',
    initialState: { kind: 'completed' },
    payload: {
      name: 'Joe Styles',
      service: 'Men’s haircut and color',
      price: 125,
      consultationDate: '9.5.2025',
      duration: '40 min',
      notes:
        'Used Redken for men’s color.\nTrimmed sides and blended top.\nClient prefers natural look.',
      services: [
        { name: 'Haircut', price: 60 },
        { name: 'Color Touch-up', price: 65 },
      ],
      recommendations: [{ name: 'Scalp Treatment', price: 40 }],
      homeCare: 'Use moisturizing shampoo. Avoid heavy styling products.',
    },
  },
  {
    id: 'nita',
    name: 'Nita Haredoo',
    time: '11:00 AM – 11:45 AM',
    service: 'Extensions and color consultation',
  },
  {
    id: 'sara',
    name: 'Sara Bloom',
    time: '12:00 PM – 1:00 PM',
    service: 'Partial highlights',
    payload: {
      name: 'Sara Bloom',
      service: 'Partial highlights',
      price: 185,
      consultationDate: '10.4.2025',
      duration: '60 min',
      notes: 'Wheat-blonde balayage maintenance.\nAvoid going lighter at temples.',
      services: [
        { name: 'Partial Highlights', price: 130 },
        { name: 'Toner', price: 55 },
      ],
      recommendations: [{ name: 'Bond Repair', price: 40 }],
      homeCare: 'Use violet shampoo 1× per week.',
    },
  },
  {
    id: 'mark',
    name: 'Mark Rivera',
    time: '1:15 PM – 1:45 PM',
    service: 'Beard sculpt + cut',
    payload: {
      name: 'Mark Rivera',
      service: 'Beard sculpt + cut',
      price: 55,
      consultationDate: '10.18.2025',
      duration: '30 min',
      notes: 'Keep #2 fade on sides, scissor crown.\nHot towel + balm.',
      services: [
        { name: "Men's Cut", price: 35 },
        { name: 'Beard Trim', price: 20 },
      ],
      recommendations: [],
      homeCare: 'Beard oil 2× daily.',
    },
  },
  {
    id: 'ava',
    name: 'Ava Chen',
    time: '2:00 PM – 3:15 PM',
    service: 'Bridal trial',
    payload: {
      name: 'Ava Chen',
      service: 'Bridal trial',
      price: 150,
      consultationDate: '11.2.2025',
      duration: '75 min',
      notes: 'Soft updo, off-center part. Reference photo on file.',
      services: [{ name: 'Bridal Trial', price: 150 }],
      recommendations: [{ name: 'Day-of Bridal Hair', price: 200 }],
      homeCare: 'Avoid heavy styling night before.',
    },
  },
];

const ClientList = () => {
  const wrapperStyle = {
    width: '100%',
    padding: '6px 0 8px',
    boxSizing: 'border-box',
  };

  const { setSelectedClientData } = useContext(AppContext);

  const [timersById, setTimersById] = useState(() => {
    const out = {};
    APPOINTMENTS.forEach((a) => {
      if (a.initialState) out[a.id] = a.initialState;
    });
    return out;
  });

  const [now, setNow] = useState(() => Date.now());
  const [modalForCardId, setModalForCardId] = useState(null);

  useEffect(() => {
    const hasRunning = Object.values(timersById).some(
      (t) => t && (t.kind === 'timerRunning' || t.kind === 'stopwatchRunning'),
    );
    if (!hasRunning) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timersById]);

  const liveTimers = useMemo(() => {
    const out = {};
    Object.entries(timersById).forEach(([cardId, t]) => {
      if (!t) return;
      if (t.kind === 'timerRunning') {
        const remainingMs = t.endsAt - now;
        if (remainingMs <= 0) {
          out[cardId] = { kind: 'completed' };
        } else {
          out[cardId] = { kind: 'timerRunning', remainingMs };
        }
      } else if (t.kind === 'stopwatchRunning') {
        out[cardId] = { kind: 'stopwatchRunning', elapsedMs: now - t.startedAt };
      } else {
        out[cardId] = t;
      }
    });
    return out;
  }, [timersById, now]);

  useEffect(() => {
    const expired = Object.entries(liveTimers)
      .filter(([cardId, t]) => t.kind === 'completed' && timersById[cardId]?.kind === 'timerRunning')
      .map(([cardId]) => cardId);
    if (expired.length === 0) return;
    setTimersById((prev) => {
      const next = { ...prev };
      expired.forEach((cardId) => {
        next[cardId] = { kind: 'completed' };
      });
      return next;
    });
  }, [liveTimers, timersById]);

  const handleClientClick = useCallback(
    (clientData) => {
      setSelectedClientData({ ...clientData, color: ACCENT });
    },
    [setSelectedClientData],
  );

  const handleTimerBoxClick = useCallback((cardId) => {
    setModalForCardId(cardId);
  }, []);

  const handleStartTimer = useCallback(
    (totalSec) => {
      if (!modalForCardId) return;
      setTimersById((prev) => ({
        ...prev,
        [modalForCardId]: {
          kind: 'timerRunning',
          endsAt: Date.now() + totalSec * 1000,
        },
      }));
      setNow(Date.now());
      setModalForCardId(null);
    },
    [modalForCardId],
  );

  const handleStartStopwatch = useCallback(() => {
    if (!modalForCardId) return;
    setTimersById((prev) => ({
      ...prev,
      [modalForCardId]: {
        kind: 'stopwatchRunning',
        startedAt: Date.now(),
      },
    }));
    setNow(Date.now());
  }, [modalForCardId]);

  const handleStopStopwatch = useCallback(() => {
    if (!modalForCardId) return;
    setTimersById((prev) => {
      const next = { ...prev };
      delete next[modalForCardId];
      return next;
    });
    setModalForCardId(null);
  }, [modalForCardId]);

  const handleStopTimer = useCallback(() => {
    if (!modalForCardId) return;
    setTimersById((prev) => {
      const next = { ...prev };
      delete next[modalForCardId];
      return next;
    });
    setModalForCardId(null);
  }, [modalForCardId]);

  const handleResetTimer = useCallback(() => {
    if (!modalForCardId) return;
    setTimersById((prev) => {
      const next = { ...prev };
      delete next[modalForCardId];
      return next;
    });
  }, [modalForCardId]);

  const activeAppointment = APPOINTMENTS.find((a) => a.id === modalForCardId);
  const activeRunningState = modalForCardId ? liveTimers[modalForCardId] : null;

  return (
    <div style={wrapperStyle}>
      {APPOINTMENTS.map((a) => (
        <ClientCard
          key={a.id}
          cardId={a.id}
          name={a.name}
          time={a.time}
          service={a.service}
          isActive
          timerState={liveTimers[a.id]}
          onTimerBoxClick={handleTimerBoxClick}
          onCardClick={a.payload ? () => handleClientClick(a.payload) : undefined}
        />
      ))}

      <TimerModal
        open={modalForCardId !== null}
        clientName={activeAppointment?.name || ''}
        runningState={activeRunningState}
        onClose={() => setModalForCardId(null)}
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
