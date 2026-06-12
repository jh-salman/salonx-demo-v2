import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Lightning, MagnifyingGlass } from 'phosphor-react';
import { MOCK_CLIENTS } from '../data/mockClients.js';
import {
  CLIENTS_CATALOG_UPDATED,
  getCachedClientsCatalog,
  refreshClientsCatalogCache,
} from '../data/clientProfileAvatar.js';
import '../presentation/style/ramp-smart-field.css';

const ASSUMED = [
  { k: 'Salon', v: 'Salon X · Orlando' },
  { k: 'Brand partners', v: 'Danger Jones · R+Co' },
  { k: 'Stylist', v: 'Joe' },
];

function buildDirectory(catalog) {
  const base = Array.isArray(catalog) && catalog.length ? catalog : MOCK_CLIENTS;
  const map = new Map();
  base.forEach((c) => {
    if (c?.name) map.set(String(c.name).trim().toLowerCase(), c);
  });
  return Array.from(map.values());
}

/**
 * RAMP Station smart field — phone-preferred free-build entry.
 * digits → phone lookup (existing) · letters → name search (existing/new) ·
 * skip → generic salon/brand post. Salon, brand partners, stylist are assumed.
 */
export default function RampSmartField({ accent, onBuild, onClose }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [directory, setDirectory] = useState(() => buildDirectory(getCachedClientsCatalog()));

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!cancelled) setDirectory(buildDirectory(getCachedClientsCatalog()));
    };
    sync();
    void refreshClientsCatalogCache().then(sync).catch(() => {});
    window.addEventListener(CLIENTS_CATALOG_UPDATED, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(CLIENTS_CATALOG_UPDATED, sync);
    };
  }, []);

  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, '');
  const isPhoneQuery = digits.length >= 3 && digits.length >= trimmed.replace(/\s/g, '').length - 1;

  const matches = useMemo(() => {
    if (!trimmed) return [];
    const q = trimmed.toLowerCase();
    return directory
      .filter(
        (c) =>
          String(c.name || '').toLowerCase().includes(q) ||
          (digits && String(c.phone || '').replace(/\D/g, '').includes(digits)),
      )
      .slice(0, 5);
  }, [directory, trimmed, digits]);

  const mode = !trimmed ? 'generic' : selected ? 'existing' : matches.length ? 'search' : 'new';

  const handleBuild = () => {
    if (selected) {
      onBuild({ name: String(selected.name || '').trim(), phone: String(selected.phone || '').trim() });
      return;
    }
    if (!trimmed) {
      onBuild({ generic: true });
      return;
    }
    onBuild({
      name: isPhoneQuery ? '' : trimmed,
      phone: isPhoneQuery ? trimmed : '',
      isNew: true,
    });
  };

  return (
    <div className="ramp-sf" style={{ ['--ramp-sf-accent']: accent }}>
      <div className="ramp-sf__topbar">
        <button type="button" className="ramp-sf__back" onClick={onClose} aria-label="Back">
          <ArrowLeft size={20} weight="bold" aria-hidden />
        </button>
        <h3 className="ramp-sf__topTitle">RAMP Station</h3>
      </div>

      <div className="ramp-sf__scroll">
        <div className="ramp-sf__hero">
          <Lightning size={26} weight="fill" aria-hidden className="ramp-sf__bolt" />
          <span className="ramp-sf__brand">RAMP</span>
          <span className="ramp-sf__kicker">Start a post</span>
        </div>

        <div className="ramp-sf__lbl">Who's this post for?</div>
        <label className="ramp-sf__field">
          <MagnifyingGlass size={18} weight="bold" aria-hidden />
          <input
            value={query}
            inputMode="text"
            autoComplete="off"
            placeholder="Phone or name…"
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
          />
        </label>
        <p className="ramp-sf__help">
          Phone finds them fastest. No number? Type a name. Or skip for a salon/brand post.
        </p>

        {mode === 'search' && !selected ? (
          <ul className="ramp-sf__matches" role="listbox">
            {matches.map((c) => (
              <li key={c.id}>
                <button type="button" className="ramp-sf__match" onClick={() => setSelected(c)}>
                  <span className="ramp-sf__matchAv" aria-hidden>{(c.name || 'C').charAt(0)}</span>
                  <span className="ramp-sf__matchBody">
                    <span className="ramp-sf__matchName">{c.name}</span>
                    <span className="ramp-sf__matchTag">{c.phone}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {mode === 'existing' && selected ? (
          <div className="ramp-sf__found">
            <span className="ramp-sf__foundAv" aria-hidden>{(selected.name || 'C').charAt(0)}</span>
            <div>
              <div className="ramp-sf__foundName">{selected.name}</div>
              <div className="ramp-sf__foundTag">✓ Found · existing client</div>
            </div>
            <button type="button" className="ramp-sf__clear" onClick={() => { setSelected(null); setQuery(''); }}>
              Change
            </button>
          </div>
        ) : null}

        {mode === 'new' ? (
          <div className="ramp-sf__new">
            <span className="ramp-sf__newAv" aria-hidden>＋</span>
            <div>
              <div className="ramp-sf__newName">New client</div>
              <div className="ramp-sf__newDesc">Will be created from “{trimmed}”</div>
            </div>
          </div>
        ) : null}

        {mode === 'generic' ? (
          <div className="ramp-sf__generic">
            No client — this becomes a <b>generic salon/brand post</b>. Salon, stylist,
            brand &amp; partners are still attributed automatically.
          </div>
        ) : null}

        <div className="ramp-sf__assume">
          <div className="ramp-sf__assumeHead">RAMP already assumes</div>
          {ASSUMED.map((row) => (
            <div className="ramp-sf__assumeRow" key={row.k}>
              <span className="ramp-sf__assumeK">{row.k}</span>
              <span className="ramp-sf__assumeV">{row.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ramp-sf__dock">
        <button type="button" className="ramp-sf__cta" onClick={handleBuild}>
          {mode === 'generic' ? 'Build a generic post →' : 'Build the post →'}
        </button>
        {mode !== 'generic' ? (
          <button
            type="button"
            className="ramp-sf__skip"
            onClick={() => onBuild({ generic: true })}
          >
            Skip — build a generic salon/brand post
          </button>
        ) : null}
      </div>
    </div>
  );
}
