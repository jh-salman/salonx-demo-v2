import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, User, Lightning, CalendarBlank, Gear } from 'phosphor-react';

const BOTTOM_TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Stylist', to: '/screen1' },
  // Profile icon now opens the Clients picker; tapping a client there forwards
  // to Screen2 with the proper apt payload.
  { Icon: User, label: 'Clients', to: '/clients' },
  { Icon: Lightning, label: 'Checkout', to: '/climax' },
  { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
  { Icon: Gear, label: 'Settings', to: '/settings' },
];

const wrapperStyle = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  paddingLeft: 14,
  paddingRight: 14,
  paddingTop: 10,
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
  background: '#0e0e10',
  borderTop: '1px solid #2b2b2b',
  zIndex: 60,
  boxSizing: 'border-box',
};

const buttonBase = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--salonx-primary)',
  padding: '6px 9px',
  transition: 'opacity 120ms',
  lineHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
};

// `originPath` is the route the consuming screen lives on. When the toolbar
// navigates to a screen that needs to know where the user came from (e.g. the
// Clients picker uses it to decide what its X button should close back to), we
// forward `state: { from: originPath }`.
function BottomToolbar({ activeIndex = -1, style, originPath }) {
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
            onClick={() => {
              if (to === '/clients' && originPath) {
                navigate(to, { state: { from: originPath } });
                return;
              }
              if (to === '/climax') {
                const from =
                  originPath && originPath.startsWith('/') ? originPath : '/screen1';
                navigate(to, { state: { from } });
                return;
              }
              navigate(to);
            }}
            style={{
              ...buttonBase,
              opacity: isActive ? 1 : 0.48,
              filter: isActive
                ? 'drop-shadow(0 0 10px rgba(var(--salonx-primary-rgb), 0.35))'
                : 'none',
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
