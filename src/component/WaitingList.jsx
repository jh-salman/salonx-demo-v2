import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dismissParkedItem,
  dismissWaitlistItem,
  useCalendarParked,
  useCalendarWaitlist,
} from '../data/calendarEventsStore';
import { dismissRampQueueItem, useRampS1Queue } from '../data/rampLocalQueueStore';
import { rampQueuePath } from '../presentation/ramp/rampPaths';
import { useTheme } from '../context/ThemeContext';
import { accentCardGradientCss } from '../theme/primaryTheme';

const QUEUE_ATTENTION_LABEL = 'Need Attention';
const QUEUE_SECTION_LABELS = ['RAMP', 'Waiting List', 'Park'];
const SWIPE_DELETE_THRESHOLD_PX = 72;
const SWIPE_MAX_PX = 120;
const SWIPE_AXIS_LOCK_PX = 6;
const SWIPE_VERTICAL_BIAS = 1.35;

/** Match Screen1 today's appointment cards (ClientList). */
const CARD_HEIGHT = 70;
const S1_CARD_STACK_GAP_PX = 10;

const stackStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  width: '100%',
  boxSizing: 'border-box',
  gap: 0,
  /* Pull flush under last appointment card (ClientCard marginBottom). */
  marginTop: `-${S1_CARD_STACK_GAP_PX}px`,
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  margin: 0,
  width: '100%',
  minHeight: 0,
  lineHeight: 1,
  background: 'transparent',
  boxShadow: 'none',
  boxSizing: 'border-box',
};

const innerFlexStyle = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 0,
  lineHeight: 1,
  paddingLeft: '14px',
  gap: '8px',
  flexWrap: 'wrap',
};

const headerCountStyle = {
  fontSize: '9px',
  fontWeight: 600,
  color: 'rgba(245, 245, 247, 0.55)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  lineHeight: 1,
  paddingRight: '14px',
};

const rowsStyle = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  padding: 0,
  boxSizing: 'border-box',
  gap: S1_CARD_STACK_GAP_PX,
};

const swipeWrapStyle = {
  position: 'relative',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  height: `${CARD_HEIGHT}px`,
  overflow: 'hidden',
  borderRadius: '11.5px',
  touchAction: 'pan-y',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

const swipeDeleteBgStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: '55px',
  boxSizing: 'border-box',
  background: 'rgba(255, 255, 255, 0.08)',
  borderRadius: '11.5px',
};

const swipeDeleteLabelStyle = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(245, 245, 247, 0.72)',
};

function cardOuterStyle(cardGradient) {
  return {
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    height: `${CARD_HEIGHT}px`,
    padding: '1.5px',
    borderRadius: '11.5px',
    background: cardGradient,
    boxSizing: 'border-box',
    willChange: 'transform',
    touchAction: 'pan-y',
  };
}

const cardInnerStyle = {
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

const clientNameStyle = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#f5f5f7',
  margin: 0,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};


function metaStyle(accent) {
  return {
    fontSize: '10.5px',
    margin: 0,
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: accent,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textAlign: 'right',
    flexShrink: 0,
  };
}

function headerLabelStyle(accent) {
  return {
    color: accent,
    fontSize: '0.72rem',
    fontWeight: 'bold',
    margin: 0,
    lineHeight: 1,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };
}

function headerLabelSepStyle() {
  return {
    color: 'rgba(245, 245, 247, 0.35)',
    fontSize: '0.72rem',
    fontWeight: 600,
    lineHeight: 1,
    userSelect: 'none',
  };
}

function indicatorDotStyle(accent) {
  return {
    width: '8px',
    height: '8px',
    flexShrink: 0,
    background: accent,
    borderRadius: '50%',
    boxShadow: `0 0 4px ${accent}`,
  };
}

function UnifiedQueueHeader({ labels, accent, totalCount }) {
  return (
    <div style={headerStyle}>
      <div style={innerFlexStyle}>
        <div style={indicatorDotStyle(accent)} aria-hidden />
        {labels.map((label, index) => (
          <React.Fragment key={label}>
            {index > 0 ? (
              <span style={headerLabelSepStyle()} aria-hidden>
                ·
              </span>
            ) : null}
            <h2 style={headerLabelStyle(accent)}>{label}</h2>
          </React.Fragment>
        ))}
      </div>
      <span style={headerCountStyle} aria-label={`${totalCount} entries`}>
        {totalCount}
      </span>
    </div>
  );
}

function SwipeableQueueCard({ row, cardGradient, accent, onPress, onDismiss }) {
  const [offsetX, setOffsetX] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const dragRef = useRef({
    active: false,
    axis: null,
    startX: 0,
    startY: 0,
    baseOffset: 0,
    moved: false,
    pointerId: null,
    captured: false,
  });

  const setSwipeOffset = useCallback((next) => {
    offsetRef.current = next;
    setOffsetX(next);
  }, []);

  const finishDismiss = useCallback(() => {
    setRemoving(true);
    setSwipeOffset(-520);
    window.setTimeout(() => {
      onDismiss?.(row);
    }, 180);
  }, [onDismiss, row, setSwipeOffset]);

  const handlePointerDown = useCallback(
    (e) => {
      if (removing) return;
      dragRef.current = {
        active: true,
        axis: null,
        startX: e.clientX,
        startY: e.clientY,
        baseOffset: offsetRef.current,
        moved: false,
        pointerId: e.pointerId,
        captured: false,
      };
    },
    [removing],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.axis) {
        if (Math.abs(dx) < SWIPE_AXIS_LOCK_PX && Math.abs(dy) < SWIPE_AXIS_LOCK_PX) {
          return;
        }
        if (Math.abs(dy) >= Math.abs(dx) * SWIPE_VERTICAL_BIAS && Math.abs(dy) > SWIPE_AXIS_LOCK_PX) {
          drag.active = false;
          drag.axis = 'y';
          return;
        }
        if (Math.abs(dx) < SWIPE_AXIS_LOCK_PX) return;
        drag.axis = 'x';
        setDragging(true);
        if (!drag.captured) {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.captured = true;
          } catch {
            /* ignore */
          }
        }
        if (drag.axis === 'x' && dx < 0) {
          e.preventDefault();
        }
      }

      if (drag.axis !== 'x') return;
      if (Math.abs(dx) > 6) drag.moved = true;
      const next = Math.min(0, Math.max(-SWIPE_MAX_PX, drag.baseOffset + dx));
      setSwipeOffset(next);
    },
    [setSwipeOffset],
  );

  const handlePointerEnd = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (drag.pointerId !== e.pointerId) return;

      if (drag.captured) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      if (drag.axis === 'x') {
        if (offsetRef.current <= -SWIPE_DELETE_THRESHOLD_PX) {
          finishDismiss();
        } else {
          setSwipeOffset(0);
        }
      }

      drag.active = false;
      drag.axis = null;
      drag.pointerId = null;
      drag.captured = false;
      setDragging(false);
    },
    [finishDismiss, setSwipeOffset],
  );

  const handleClick = useCallback(() => {
    if (dragRef.current.moved || removing) return;
    onPress?.();
  }, [onPress, removing]);

  const interactive = typeof onPress === 'function';

  return (
    <div
      style={swipeWrapStyle}
      aria-label={`${row.name} — swipe left to remove`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div style={swipeDeleteBgStyle} aria-hidden>
        <span style={swipeDeleteLabelStyle}>Remove</span>
      </div>
      <div
        style={{
          ...cardOuterStyle(cardGradient),
          transform: `translateX(${offsetX}px)`,
          transition: dragging ? 'none' : 'transform 180ms ease-out',
        }}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? handleClick : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
      >
        <div style={cardInnerStyle}>
          <span style={clientNameStyle}>{row.name}</span>
          <span style={metaStyle(accent)}>{row.meta}</span>
        </div>
      </div>
    </div>
  );
}

function WaitingList() {
  const navigate = useNavigate();
  const { primaryHex } = useTheme();
  const cardGradient = useMemo(
    () => accentCardGradientCss(primaryHex),
    [primaryHex],
  );

  const parked = useCalendarParked();
  const waitlist = useCalendarWaitlist();
  const rampQueue = useRampS1Queue();

  const rampRows = useMemo(
    () =>
      rampQueue.map((item) => ({
        key: `ramp-${item.id}`,
        id: item.id,
        name: item.name,
        meta: item.meta || QUEUE_ATTENTION_LABEL,
        kind: 'ramp',
      })),
    [rampQueue],
  );

  const waitlistRows = useMemo(
    () =>
      waitlist.map((w) => ({
        key: `wait-${w.id}`,
        id: String(w.id || ''),
        name: w.title || 'Unknown',
        meta: QUEUE_ATTENTION_LABEL,
        kind: 'wait',
      })),
    [waitlist],
  );

  const parkRows = useMemo(
    () =>
      parked.map((p) => ({
        key: `parked-${p.id}`,
        id: String(p.id || ''),
        name: p.title || 'Unknown',
        meta: QUEUE_ATTENTION_LABEL,
        kind: 'park',
      })),
    [parked],
  );

  const allRows = useMemo(
    () => [...rampRows, ...waitlistRows, ...parkRows],
    [rampRows, waitlistRows, parkRows],
  );

  const handleDismiss = useCallback((row) => {
    if (row.kind === 'ramp') {
      dismissRampQueueItem(row.id);
      return;
    }
    if (row.kind === 'wait') {
      dismissWaitlistItem(row.id);
      return;
    }
    if (row.kind === 'park') {
      dismissParkedItem(row.id);
    }
  }, []);

  const handlePress = useCallback(
    (row) => {
      if (row.kind !== 'ramp') return;
      navigate(rampQueuePath(row.id));
    },
    [navigate],
  );

  if (!allRows.length) return null;

  return (
    <div style={stackStyle} aria-label={QUEUE_SECTION_LABELS.join(', ')}>
      <UnifiedQueueHeader
        labels={QUEUE_SECTION_LABELS}
        accent={primaryHex}
        totalCount={allRows.length}
      />
      <div style={rowsStyle}>
        {allRows.map((row) => (
          <SwipeableQueueCard
            key={row.key}
            row={row}
            cardGradient={cardGradient}
            accent={primaryHex}
            onDismiss={handleDismiss}
            onPress={row.kind === 'ramp' ? () => handlePress(row) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default WaitingList;
