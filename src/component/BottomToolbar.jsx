import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, User, Lightning, CalendarBlank, Gear } from 'phosphor-react';
import { writePersistedCalendarBack } from '../data/appointmentStateStore';
import './BottomToolbar.css';

const BOTTOM_TOOLBAR_ITEMS = [
  { Icon: Scissors, label: 'Stylist', to: '/screen1' },
  // Profile icon now opens the Clients picker; tapping a client there forwards
  // to Screen2 with the proper apt payload.
  { Icon: User, label: 'Clients', to: '/clients' },
  { Icon: Lightning, label: 'Checkout', to: '/climax' },
  { Icon: CalendarBlank, label: 'Calendar', to: '/calendar' },
  { Icon: Gear, label: 'Settings', to: '/settings' },
];

/**
 * `aria-current='page'` is set on the active tab so CSS can size the glyph in
 * standalone / PWA (see BottomToolbar.css).
 */
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
          return (
            <button
              key={label}
              type="button"
              className="bottom-toolbar-btn"
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
                  /* No apt — Climax uses walk-in defaults unless opened from Screen2 checkout. */
                  navigate(to, { state: { from } });
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
                weight={isActive ? 'fill' : 'regular'}
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
