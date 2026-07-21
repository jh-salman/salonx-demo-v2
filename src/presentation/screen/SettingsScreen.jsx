import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import { signOut } from '../../auth/authClient.js';
import { sessionCleared } from '../../store/sessionSlice.js';
import '../style/settings.css';

/** SalonX v2 admin — external station (Build Station / RAMP). */
export const V2_ADMIN_STATION_URL =
  String(import.meta.env.VITE_V2_ADMIN_STATION_URL || '').trim() ||
  'https://salonx-demo-admin.onrender.com/station';

const APP_VERSION = String(import.meta.env.VITE_APP_VERSION || '').trim() || '2.0.0';

const IconOrg = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M4 21V6l8-3 8 3v15" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9 21v-5h6v5M9 10h.01M15 10h.01M9 13h.01M15 13h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconHours = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconStaff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.7c2.4.5 4 2.4 4 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconGlobe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 12h17M12 3.5c2.5 2.3 2.5 14.7 0 17M12 3.5c-2.5 2.3-2.5 14.7 0 17" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);
const IconAdmin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);
const IconChevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconExternal = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/**
 * Settings home — reference-style grouped list (search → sections → rows),
 * rendered in the SalonX theme. Each row is a chevron target to a sub-route;
 * Admin Station opens the v2 admin in a new tab.
 */
function SettingsScreen() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const sections = useMemo(
    () => [
      {
        id: 'workspace',
        label: 'Workspace',
        items: [
          { id: 'org', label: 'Organization', hint: 'Switch or create a salon', Icon: IconOrg, to: '/settings/organization' },
          { id: 'hours', label: 'Business hours', hint: 'Online booking availability', Icon: IconHours, to: '/settings/hours' },
          { id: 'staff', label: 'Staff', hint: 'Invite & manage your team', Icon: IconStaff, to: '/settings/staff' },
          { id: 'schedules', label: 'Stylist schedules', hint: 'Per-stylist hours, lunch & breaks', Icon: IconHours, to: '/settings/schedules' },
          { id: 'waitlist', label: 'Waiting list', hint: 'Clients waiting for a time', Icon: IconStaff, to: '/settings/waitlist' },
        ],
      },
      {
        id: 'site',
        label: 'Site & tools',
        items: [
          { id: 'microsite', label: 'Microsite', hint: 'Public booking page & theme', Icon: IconGlobe, to: '/microsite' },
          { id: 'admin', label: 'Admin Station', hint: 'Build Station & RAMP', Icon: IconAdmin, to: '/settings/admin' },
        ],
      },
    ],
    [],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            (it.hint || '').toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, q]);

  function openItem(item) {
    if (item.external) {
      window.open(item.external, '_blank', 'noopener,noreferrer');
      return;
    }
    if (item.to) navigate(item.to);
  }

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      /* ignore — still leave the session */
    }
    dispatch(sessionCleared());
    navigate('/');
  }

  return (
    <div className="settings-root settings-menu-root">
      <div className="settings-menu__head">
        <span className="settings-menu__title">Settings</span>
      </div>

      <label className="settings-search">
        <span className="settings-search__icon">
          <IconSearch />
        </span>
        <input
          className="settings-search__input"
          type="search"
          placeholder="Search feature or setting"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="settings-menu__scroll">
        {filtered.length === 0 ? (
          <p className="settings-menu__empty">No settings match “{query}”.</p>
        ) : (
          filtered.map((section) => (
            <section key={section.id} className="settings-group">
              <div className="settings-group__label">{section.label}</div>
              <div className="settings-group__list">
                {section.items.map((item) => {
                  const { Icon } = item;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="settings-item"
                      onClick={() => openItem(item)}
                    >
                      <span className="settings-item__icon">
                        <Icon />
                      </span>
                      <span className="settings-item__text">
                        <span className="settings-item__label">{item.label}</span>
                        {item.hint ? (
                          <span className="settings-item__hint">{item.hint}</span>
                        ) : null}
                      </span>
                      <span className="settings-item__chevron">
                        {item.external ? <IconExternal /> : <IconChevron />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}

        <button
          type="button"
          className="settings-logout"
          onClick={handleLogout}
          disabled={signingOut}
        >
          {signingOut ? 'Logging out…' : 'Log out'}
        </button>

        <p className="settings-version">Version {APP_VERSION}</p>
      </div>
    </div>
  );
}

export default SettingsScreen;
