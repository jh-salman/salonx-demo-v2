import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, X, MagnifyingGlass } from 'phosphor-react';
import { MOCK_CLIENTS } from '../../data/mockClients';
import {
  CLIENT_AVATAR_DB_UPDATED,
  getClientAvatar,
} from '../../data/clientAvatarDb';
import {
  CLIENTS_CATALOG_UPDATED,
  refreshClientsCatalogCache,
} from '../../data/clientProfileAvatar';
import { isAppointmentsApiAvailable } from '../../data/v2AppointmentsApi';
import { writePersistedScreen2Apt } from '../../data/appointmentStateStore';
import {
  CONSULT_STORAGE_KEY,
  CONSULTATION_REMOTE_UPDATED,
  consultTileImageUrl,
  hydrateConsultStoreFromApi,
  loadConsultStore,
  mergeConsultRecordIntoStore,
} from '../../data/screen2RemoteStore';
import { normalizeClientKey } from '../../data/screen2RemoteApi';
import { startCalendarRealtimeSync } from '../../sync/calendarRealtimeSync';
import BottomToolbar from '../../component/BottomToolbar';
import '../style/clients.css';

// "Select client" picker. Wired to the bottom-toolbar Profile (User) icon so the
// stylist can jump straight to a client's detail page from anywhere.
//
// Tap a client tile → navigates to Screen2 with a synthetic `apt` payload
// containing `clientName` (no real Calendar event id, since the user isn't
// coming from an appointment). Screen2 then loads consultation notes /
// per-client photos by name as it always has.
//
// `from: '/clients'` is also passed so Screen2's top-left Back button returns
// here instead of the default Stylist screen.

const NEW_CLIENTS_STORAGE_KEY = '@salonx/clientsExtra/v1';
const BRAND_LABEL = 'DANGER JONES';

function loadExtraClients() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(NEW_CLIENTS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveExtraClients(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NEW_CLIENTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

function clientKey(name) {
  return normalizeClientKey(name);
}

function initialsFor(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Clients() {
  const navigate = useNavigate();
  const location = useLocation();

  // Where the close (X) button should send the user. Falls back to Stylist.
  const backTarget =
    (location?.state?.from && String(location.state.from)) || '/screen1';

  const [extraClients, setExtraClients] = useState(() => loadExtraClients());
  const [consultStore, setConsultStore] = useState(() => loadConsultStore());
  const [idbAvatarByKey, setIdbAvatarByKey] = useState({});
  const [catalogClients, setCatalogClients] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return;
    let cancelled = false;
    void refreshClientsCatalogCache().then((list) => {
      if (!cancelled && list) setCatalogClients(list);
    });
    const onCatalog = () => {
      void refreshClientsCatalogCache().then((list) => {
        if (list) setCatalogClients(list);
      });
    };
    window.addEventListener(CLIENTS_CATALOG_UPDATED, onCatalog);
    return () => {
      cancelled = true;
      window.removeEventListener(CLIENTS_CATALOG_UPDATED, onCatalog);
    };
  }, []);

  const allClients = useMemo(() => {
    // Dedupe by lowercased name — extras win (most recent definition).
    const map = new Map();
    const base =
      isAppointmentsApiAvailable() && catalogClients.length > 0
        ? catalogClients
        : MOCK_CLIENTS;
    base.forEach((c) => map.set(clientKey(c.name), c));
    extraClients.forEach((c) => map.set(clientKey(c.name), c));
    return Array.from(map.values());
  }, [extraClients, catalogClients]);

  const clientNames = useMemo(
    () => allClients.map((c) => c.name).filter(Boolean),
    [allClients],
  );

  // Hydrate consultation cache from Postgres when API is available.
  useEffect(() => {
    if (!isAppointmentsApiAvailable() || !clientNames.length) return undefined;
    let cancelled = false;
    void hydrateConsultStoreFromApi(clientNames).then((store) => {
      if (!cancelled) setConsultStore(store);
    });
    return () => {
      cancelled = true;
    };
  }, [clientNames]);

  useEffect(() => {
    const onStorage = (e) => {
      if (!e || e.key === null || e.key === CONSULT_STORAGE_KEY) {
        setConsultStore(loadConsultStore());
      }
      if (!e || e.key === null || e.key === NEW_CLIENTS_STORAGE_KEY) {
        setExtraClients(loadExtraClients());
      }
    };
    const onAvatarDb = () => {
      setConsultStore(loadConsultStore());
    };
    const onCatalog = () => {
      setConsultStore(loadConsultStore());
      void refreshClientsCatalogCache().then((list) => {
        if (list) setCatalogClients(list);
      });
    };
    const onConsultRemote = () => {
      setConsultStore(loadConsultStore());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLIENT_AVATAR_DB_UPDATED, onAvatarDb);
    window.addEventListener(CLIENTS_CATALOG_UPDATED, onCatalog);
    window.addEventListener(CONSULTATION_REMOTE_UPDATED, onConsultRemote);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLIENT_AVATAR_DB_UPDATED, onAvatarDb);
      window.removeEventListener(CLIENTS_CATALOG_UPDATED, onCatalog);
      window.removeEventListener(CONSULTATION_REMOTE_UPDATED, onConsultRemote);
    };
  }, []);

  useEffect(() => {
    if (!isAppointmentsApiAvailable()) return undefined;
    return startCalendarRealtimeSync({
      onClientsCatalogUpdated: () => {
        void refreshClientsCatalogCache().then((list) => {
          if (list) setCatalogClients(list);
        });
      },
      onConsultationUpdated: (p) => {
        const key = typeof p?.clientKey === 'string' ? p.clientKey : '';
        if (!key || !p?.record || typeof p.record !== 'object') return;
        setConsultStore(mergeConsultRecordIntoStore(key, p.record));
      },
      onPoll: () => {
        if (!clientNames.length) return;
        void hydrateConsultStoreFromApi(clientNames).then(setConsultStore);
        void refreshClientsCatalogCache().then((list) => {
          if (list) setCatalogClients(list);
        });
      },
    });
  }, [clientNames]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = {};
      for (const client of allClients) {
        const k = clientKey(client.name);
        const rec = consultStore[k] || {};
        const hosted = consultTileImageUrl(client, rec);
        if (hosted && (hosted.startsWith('http://') || hosted.startsWith('https://'))) {
          next[k] = hosted;
          continue;
        }
        if (hosted && hosted.startsWith('data:')) {
          next[k] = hosted;
          continue;
        }
        const idbKey =
          (typeof rec.avatarDataKey === 'string' && rec.avatarDataKey.trim()) || k;
        const fromDb = await getClientAvatar(idbKey);
        if (fromDb) next[k] = fromDb;
      }
      if (!cancelled) setIdbAvatarByKey(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [allClients, consultStore]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allClients;
    return allClients.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [allClients, query]);

  const openClient = useCallback(
    (client) => {
      const apt = {
        id: `client:${client.id || clientKey(client.name)}`,
        clientName: client.name,
        service: '',
        color: null,
        price: 0,
        notes: '',
        start: null,
        end: null,
      };
      // Persist for refresh-survival; Screen2's Back will read `from: '/clients'`.
      writePersistedScreen2Apt(apt, '/clients');
      navigate('/screen2', { state: { apt, from: '/clients' } });
    },
    [navigate],
  );

  const handleNewClient = useCallback(() => {
    const raw = window.prompt('New client name');
    const name = (raw || '').trim();
    if (!name) return;
    const exists = allClients.some(
      (c) => clientKey(c.name) === clientKey(name),
    );
    if (exists) {
      // Just open the existing one — don't add a duplicate
      const existing = allClients.find(
        (c) => clientKey(c.name) === clientKey(name),
      );
      if (existing) openClient(existing);
      return;
    }
    const newClient = {
      id: `c-extra-${Date.now().toString(36)}`,
      name,
      phone: '',
      email: '',
      notes: '',
    };
    const next = [...extraClients, newClient];
    setExtraClients(next);
    saveExtraClients(next);
    openClient(newClient);
  }, [allClients, extraClients, openClient]);

  const closeScreen = useCallback(() => {
    navigate(backTarget);
  }, [navigate, backTarget]);

  return (
    <div className="clients-root">
      <div className="clients-bg" aria-hidden />

      <header className="clients-header">
        <div className="clients-brand">{BRAND_LABEL}</div>
        <h1 className="clients-title">SELECT CLIENT</h1>
        <span className="clients-titleRule" aria-hidden />
        <button
          type="button"
          className="clients-close"
          aria-label="Close"
          onClick={closeScreen}
        >
          <X size={18} weight="regular" aria-hidden />
        </button>
      </header>

      <div className="clients-search">
        <MagnifyingGlass size={16} weight="regular" aria-hidden className="clients-search__icon" />
        <input
          className="clients-search__input"
          type="search"
          placeholder="Search clients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search clients"
        />
      </div>

      <div className="clients-grid" role="list">
        <button
          type="button"
          className="clients-tile clients-tile--new"
          onClick={handleNewClient}
          role="listitem"
        >
          <span className="clients-tile__avatar clients-tile__avatar--new" aria-hidden>
            <Plus size={26} weight="bold" />
          </span>
          <span className="clients-tile__name">NEW CLIENT</span>
        </button>

        {filtered.map((client) => {
          const k = clientKey(client.name);
          const rec = consultStore[k] || {};
          const avatar =
            consultTileImageUrl(client, rec) ||
            idbAvatarByKey[k] ||
            null;
          return (
            <button
              key={client.id || client.name}
              type="button"
              className="clients-tile"
              onClick={() => openClient(client)}
              role="listitem"
              aria-label={`Open ${client.name}`}
            >
              <span className="clients-tile__avatar">
                {avatar ? (
                  <img
                    className="clients-tile__avatarImg"
                    src={avatar}
                    alt=""
                    draggable={false}
                  />
                ) : (
                  <span className="clients-tile__initials">{initialsFor(client.name)}</span>
                )}
              </span>
              <span className="clients-tile__name">{(client.name || '').toUpperCase()}</span>
            </button>
          );
        })}

        {filtered.length === 0 && query.trim() ? (
          <div className="clients-empty" role="status">
            No clients match "{query.trim()}"
          </div>
        ) : null}
      </div>
      <BottomToolbar activeIndex={1} originPath="/clients" />
    </div>
  );
}
