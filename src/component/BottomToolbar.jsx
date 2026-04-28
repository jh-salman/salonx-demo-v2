import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, User, Lightning, CalendarBlank, X } from 'phosphor-react';

const BOTTOM_TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Stylist', to: '/screen1' },
  { Icon: User, label: 'Client details', to: '/screen2' },
  { Icon: Lightning, label: 'Checkout', to: '/checkout' },
  { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
  { Icon: X, label: 'Home', to: '/' },
];

const wrapperStyle = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 64,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  padding: '0 14px',
  background: '#0e0e10',
  borderTop: '1px solid #2b2b2b',
  zIndex: 60,
  boxSizing: 'border-box',
};

const buttonBase = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#ff7819',
  padding: '6px 9px',
  transition: 'opacity 120ms',
  lineHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
};

function BottomToolbar({ activeIndex = -1, style }) {
  const navigate = useNavigate();
  return (
    <div style={{ ...wrapperStyle, ...style }} role="toolbar" aria-label="Screen toolbar">
      {BOTTOM_TOOLBAR_ITEMS.map(({ Icon, label, to }, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={label}
            type="button"
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => navigate(to)}
            style={{
              ...buttonBase,
              opacity: isActive ? 1 : 0.48,
              filter: isActive ? 'drop-shadow(0 0 10px rgba(255, 120, 25, 0.35))' : 'none',
            }}
          >
            <Icon
              size={isActive ? 26 : 24}
              weight={isActive ? 'fill' : 'regular'}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

export default BottomToolbar;
