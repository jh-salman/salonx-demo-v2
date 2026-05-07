import React, { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { accentCardGradientCss } from '../theme/primaryTheme';
import {
  useCalendarParked,
  useCalendarWaitlist,
} from '../data/calendarEventsStore';

const CARD_WIDTH = 380;
const CARD_HEIGHT = 28;

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  width: '100%',
  boxSizing: 'border-box',
};

const waitingListHeaderStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 14px 6px',
  width: '100%',
  background: '#0a0a0c',
  boxShadow: '0 6px 12px -8px rgba(0, 0, 0, 0.6)',
  boxSizing: 'border-box',
};

const innerFlexStyle = {
  display: 'flex',
  alignItems: 'center',
};

const headerCountStyle = {
  fontSize: '9px',
  fontWeight: 600,
  color: 'rgba(245, 245, 247, 0.55)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const clientsContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  padding: '6px 0 6px',
  boxSizing: 'border-box',
  gap: '6px',
};

const cardInnerStyle = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: '#1A1A1A',
  borderRadius: '6.5px',
  padding: '0 50px 0 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  boxSizing: 'border-box',
};

const clientNameStyle = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#f5f5f7',
  margin: 0,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const clientServiceStyle = {
  fontSize: '9.5px',
  color: 'rgba(245, 245, 247, 0.6)',
  margin: 0,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const clientServiceAttentionStyle = {
  ...clientServiceStyle,
  color: '#FF6B6B',
  fontWeight: 700,
  letterSpacing: '0.04em',
};

const emptyStyle = {
  padding: '14px 14px',
  fontSize: '10px',
  color: 'rgba(245, 245, 247, 0.5)',
  fontStyle: 'italic',
  textAlign: 'center',
};

// The Stylist's "Waiting List" panel mirrors the Calendar screen's two staging
// queues:
//   • Parked appointments — cards the stylist dragged off the schedule for
//     reasons like "client didn't show / running late". They need attention
//     because they have to be re-booked into a slot.
//   • Waitlist entries — clients who asked for an opening but haven't been
//     given a time yet.
// Both lists live in the Calendar screen's persisted state ("@salonx/calendar/v1")
// and update in-tab via the "salonx:calendar-updated" CustomEvent, so this
// list reflects every park/un-park/book action immediately.
function WaitingList() {
  const { primaryHex } = useTheme();
  const parked = useCalendarParked();
  const waitlist = useCalendarWaitlist();

  const items = useMemo(() => {
    const parkedRows = parked.map((p) => ({
      key: `parked-${p.id}`,
      name: p.title || 'Unknown',
      service: 'Need Attention',
      isAttention: true,
    }));
    const waitlistRows = waitlist.map((w) => ({
      key: `wait-${w.id}`,
      name: w.title || 'Unknown',
      service: w.service || 'Waiting',
      isAttention: false,
    }));
    return [...parkedRows, ...waitlistRows];
  }, [parked, waitlist]);

  const { indicatorDotStyle, waitingListHeaderTextStyle, cardOuterStyle } = useMemo(() => {
    const h = primaryHex;
    return {
      indicatorDotStyle: {
        width: '8px',
        height: '8px',
        background: h,
        borderRadius: '50%',
        boxShadow: `0 0 8px ${h}`,
      },
      waitingListHeaderTextStyle: {
        color: h,
        fontSize: '0.6rem',
        fontWeight: 'bold',
        paddingLeft: '10px',
        margin: 0,
        letterSpacing: '0.04em',
      },
      cardOuterStyle: {
        position: 'relative',
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        padding: '1px',
        borderRadius: '7.5px',
        background: accentCardGradientCss(primaryHex),
        boxSizing: 'border-box',
      },
    };
  }, [primaryHex]);

  return (
    <div style={containerStyle}>
      <div style={waitingListHeaderStyle}>
        <div style={innerFlexStyle}>
          <div style={indicatorDotStyle} />
          <h1 style={waitingListHeaderTextStyle}>Waiting List</h1>
        </div>
        <span style={headerCountStyle} aria-label={`${items.length} entries`}>
          {items.length}
        </span>
      </div>

      <div style={clientsContainerStyle}>
        {items.length === 0 ? (
          <div style={emptyStyle}>No parked appointments or waitlist clients</div>
        ) : (
          items.map((client) => (
            <div key={client.key} style={cardOuterStyle}>
              <div style={cardInnerStyle}>
                <span style={clientNameStyle}>{client.name}</span>
                <span
                  style={
                    client.isAttention ? clientServiceAttentionStyle : clientServiceStyle
                  }
                >
                  {client.service}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default WaitingList;
