import React, { useMemo } from 'react';
import {
  useCalendarParked,
  useCalendarWaitlist,
} from '../data/calendarEventsStore';
import { useRampQueue } from '../data/rampQueueStore';

const QUEUE_ATTENTION_LABEL = 'Need Attention';

/** S1 queue sections — unified blue (RAMP / Waiting List / Park). */
const S1_QUEUE_INDICATOR_BLUE = '#25AFFF';

const CARD_HEIGHT = 56;
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

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  boxSizing: 'border-box',
  gap: 0,
  margin: 0,
  padding: 0,
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

const cardInnerStyle = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: '#1A1A1A',
  borderRadius: '9px',
  padding: '2px 74px 2px 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  boxSizing: 'border-box',
};

const clientNameStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#f5f5f7',
  margin: 0,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const metaStyle = (accent) => ({
  fontSize: '11px',
  margin: 0,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: accent,
  fontWeight: 700,
  letterSpacing: '0.04em',
});

function headerTextStyle(accent) {
  return {
    color: accent,
    fontSize: '0.72rem',
    fontWeight: 'bold',
    paddingLeft: '10px',
    margin: 0,
    lineHeight: 1,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
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

function cardOuterStyle(accent) {
  return {
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    height: `${CARD_HEIGHT}px`,
    padding: '1.5px',
    borderRadius: '10.5px',
    background: `linear-gradient(to right, ${accent} 0%, ${accent}cc 18%, ${accent}66 45%, ${accent}00 85%)`,
    boxSizing: 'border-box',
  };
}

function QueueSection({ label, accent, items }) {
  if (!items.length) return null;

  return (
    <section style={sectionStyle} aria-label={label}>
      <div style={headerStyle}>
        <div style={innerFlexStyle}>
          <div style={indicatorDotStyle(accent)} aria-hidden />
          <h2 style={headerTextStyle(accent)}>{label}</h2>
        </div>
        <span style={headerCountStyle} aria-label={`${items.length} entries`}>
          {items.length}
        </span>
      </div>

      <div style={rowsStyle}>
        {items.map((row) => (
          <div key={row.key} style={cardOuterStyle(accent)}>
            <div style={cardInnerStyle}>
              <span style={clientNameStyle}>{row.name}</span>
              <span style={metaStyle(accent)}>{row.meta}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WaitingList() {
  const parked = useCalendarParked();
  const waitlist = useCalendarWaitlist();
  const rampItems = useRampQueue();

  const rampRows = useMemo(
    () =>
      rampItems.map((row) => ({
        key: `ramp-${row.token || row.id}`,
        name: row.title || 'Client',
        meta: QUEUE_ATTENTION_LABEL,
      })),
    [rampItems],
  );

  const waitlistRows = useMemo(
    () =>
      waitlist.map((w) => ({
        key: `wait-${w.id}`,
        name: w.title || 'Unknown',
        meta: QUEUE_ATTENTION_LABEL,
      })),
    [waitlist],
  );

  const parkRows = useMemo(
    () =>
      parked.map((p) => ({
        key: `parked-${p.id}`,
        name: p.title || 'Unknown',
        meta: QUEUE_ATTENTION_LABEL,
      })),
    [parked],
  );

  const hasAnyQueue =
    rampRows.length > 0 || waitlistRows.length > 0 || parkRows.length > 0;

  if (!hasAnyQueue) return null;

  const visibleSections = [
    { key: 'ramp', label: 'RAMP', accent: S1_QUEUE_INDICATOR_BLUE, items: rampRows },
    {
      key: 'waitlist',
      label: 'Waiting List',
      accent: S1_QUEUE_INDICATOR_BLUE,
      items: waitlistRows,
    },
    { key: 'park', label: 'Park', accent: S1_QUEUE_INDICATOR_BLUE, items: parkRows },
  ].filter((section) => section.items.length > 0);

  return (
    <div style={stackStyle}>
      {visibleSections.map((section) => (
        <QueueSection
          key={section.key}
          label={section.label}
          accent={section.accent}
          items={section.items}
        />
      ))}
    </div>
  );
}

export default WaitingList;
