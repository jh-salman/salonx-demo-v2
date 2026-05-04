import React, { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { accentCardGradientCss } from '../theme/primaryTheme';

const CARD_WIDTH = 380;
const CARD_HEIGHT = 28;

const waitingClients = [
  { name: 'John Doe', service: 'Need Attention' },
  { name: 'Jane Smith', service: 'Need Attention' },
  { name: 'Alice Johnson', service: 'Need Attention' },
  { name: 'Marcus Lee', service: 'Walk-in · Cut' },
  { name: 'Priya Shah', service: 'Color consult' },
  { name: 'Diego Ramos', service: 'Beard trim' },
  { name: 'Emma Park', service: 'Blowout' },
];

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

function WaitingList() {
  const { primaryHex } = useTheme();

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
      </div>

      <div style={clientsContainerStyle}>
        {waitingClients.map((client, index) => (
          <div key={index} style={cardOuterStyle}>
            <div style={cardInnerStyle}>
              <span style={clientNameStyle}>{client.name}</span>
              <span style={clientServiceStyle}>{client.service}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WaitingList;
