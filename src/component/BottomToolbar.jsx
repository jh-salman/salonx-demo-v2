import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, User, Lightning, CalendarBlank, Gear } from 'phosphor-react';
import { writePersistedCalendarBack } from '../data/appointmentStateStore';
import './BottomToolbar.css';

const BOTTOM_TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Stylist', to: '/screen1' },
  { Icon: User, label: 'Clients', to: '/clients' },
  { Icon: Lightning, label: 'RAMP', to: '/ramp' },
  { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
  { Icon: Gear, label: 'Settings', to: '/settings' },
];

function BottomToolbar({ activeIndex = -1, style, originPath }) {
  const navigate = useNavigate();

  return (
    <div
      className="bottom-toolbar-shell"
      style={style}
      role="toolbar"
      aria-label="Screen toolbar"
    >
      <div className="bottom-toolbar-row">
        {BOTTOM_TOOLBAR_ITEMS.map(({ Icon, label, to }, i) => {
          const isActive = i === activeIndex;
          const isRamp = label === 'RAMP';
          return (
            <button
              key={label}
              type="button"
              className="bottom-toolbar-btn"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (isRamp) {
                  if (originPath?.startsWith('/ramp')) {
                    window.dispatchEvent(new CustomEvent('salonx:ramp-open-bolt'));
                    return;
                  }
                  navigate('/ramp', { state: { openBolt: true } });
                  return;
                }
                if (to === '/clients' && originPath) {
                  navigate(to, { state: { from: originPath } });
                  return;
                }
                if (to === '/calendar') {
                  const from =
                    originPath && originPath.startsWith('/') && originPath !== '/calendar'
                      ? originPath
                      : null;
                  if (from) {
                    writePersistedCalendarBack(from);
                    navigate(to, { state: { from } });
                    return;
                  }
                  navigate(to);
                  return;
                }
                navigate(to);
              }}
            >
              <Icon
                size={isActive ? 26 : 24}
                weight={isActive || isRamp ? 'fill' : 'regular'}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
      <div className="bottom-toolbar-safe" aria-hidden />
    </div>
  );
}

export default BottomToolbar;
