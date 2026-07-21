import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, CaretRight, CaretLeft } from 'phosphor-react';
import { NewCustomerScreen } from '../../component/calendar/CalendarOverlays.jsx';
import { MOCK_CLIENTS } from '../../data/mockClients';
import {
  CLIENT_AVATAR_DB_UPDATED,
  getClientAvatar,
} from '../../data/clientAvatarDb';
import {
  CLIENTS_CATALOG_UPDATED,
  addClientToCatalog,
  clearClientsCatalogCache,
  refreshClientsCatalogCache,
} from '../../data/clientProfileAvatar';
import { useDispatch } from 'react-redux';
import { ensureMe } from '../../store/sessionSlice.js';
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
import '../style/clients.css';
import '../style/calendar.css';

// Client picker styled like Settings: simple list + search, themed with --salonx-primary.

const NEW_CLIENTS_STORAGE_PREFIX = '@salonx/clientsExtra/v1';

function extrasStorageKey(salonId) {
  return salonId
    ? `${NEW_CLIENTS_STORAGE_PREFIX}/${salonId}`
    : NEW_CLIENTS_STORAGE_PREFIX;
}

function loadExtraClients(salonId) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(extrasStorageKey(salonId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveExtraClients(list, salonId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      extrasStorageKey(salonId),
      JSON.stringify(list),
    );
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

  const backTarget =
    (location?.state?.from && String(location.state.from)) || '/screen1';

  const [activeSalonId, setActiveSalonId] = useState(null);
  const [extraClients, setExtraClients] = useState([]);
  const [consultStore, setConsultStore] = useState(() => loadConsultStore());
  const [idbAvatarByKey, setIdbAvatarByKey] = useState({});
  const [catalogClients, setCatalogClients] = useState([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [newClientError, setNewClientError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await dispatch(ensureMe());
        if (cancelled) return;
        const sid = me?.activeSalon?.id || null;
        setActiveSalonId(sid);
        setExtraClients(loadExtraClients(sid));
      } catch {
        if (!cancelled) {
          setActiveSalonId(null);
          setExtraClients([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isAppointmentsApiAvailable()) {
      setCatalogLoaded(true);
      return;
    }
    let cancelled = false;
    clearClientsCatalogCache();
    void refreshClientsCatalogCache().then((list) => {
      if (cancelled) return;
      setCatalogClients(Array.isArray(list) ? list : []);
      setCatalogLoaded(true);
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
  }, [activeSalonId]);

  const allClients = useMemo(() => {
    const map = new Map();
    // When demo-api is on, clients are org-scoped — never blend global MOCK_CLIENTS.
    const base = isAppointmentsApiAvailable()
      ? catalogLoaded
        ? catalogClients
        : []
      : MOCK_CLIENTS;
    base.forEach((c) => map.set(clientKey(c.name), c));
    extraClients.forEach((c) => map.set(clientKey(c.name), c));
    return Array.from(map.values());
  }, [extraClients, catalogClients, catalogLoaded]);

  const clientNames = useMemo(
    () => allClients.map((c) => c.name).filter(Boolean),
    [allClients],
  );

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
      if (
        !e ||
        e.key === null ||
        e.key === extrasStorageKey(activeSalonId)
      ) {
        setExtraClients(loadExtraClients(activeSalonId));
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
  }, [activeSalonId]);

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
    return allClients.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
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
      writePersistedScreen2Apt(apt, '/clients', client.phone || '');
      navigate('/screen2', { state: { apt, from: '/clients' } });
    },
    [navigate],
  );

  const closeNewClientModal = useCallback(() => {
    if (newClientSaving) return;
    setNewClientOpen(false);
    setNewClientError('');
  }, [newClientSaving]);

  const handleClientCreated = useCallback(
    async (draft) => {
      const name = String(draft?.name || '').trim();
      if (!name || newClientSaving) return;

      const existing = allClients.find(
        (c) => clientKey(c.name) === clientKey(name),
      );
      if (existing) {
        closeNewClientModal();
        openClient(existing);
        return;
      }

      setNewClientSaving(true);
      setNewClientError('');

      const newClient = {
        id: draft?.id || `c-${Date.now().toString(36)}`,
        name,
        phone: String(draft?.phone || '').trim(),
        email: String(draft?.email || '').trim(),
        notes: String(draft?.notes || '').trim(),
      };

      try {
        if (isAppointmentsApiAvailable()) {
          const saved = await addClientToCatalog(newClient);
          if (saved) {
            const list = await refreshClientsCatalogCache();
            if (list) setCatalogClients(list);
            closeNewClientModal();
            openClient(saved);
            return;
          }
        }

        const next = [...extraClients, newClient];
        setExtraClients(next);
        saveExtraClients(next, activeSalonId);
        closeNewClientModal();
        openClient(newClient);
      } catch (e) {
        setNewClientError(
          e instanceof Error ? e.message : 'Could not save client',
        );
      } finally {
        setNewClientSaving(false);
      }
    },
    [
      activeSalonId,
      allClients,
      closeNewClientModal,
      extraClients,
      newClientSaving,
      openClient,
    ],
  );

  const handleBack = useCallback(() => {
    navigate(backTarget);
  }, [navigate, backTarget]);

  return (
    <div className="clients-root">
      <div className="clients-main">
        <div className="clients-top">
          <button
            type="button"
            className="clients-back"
            aria-label="Back"
            onClick={handleBack}
          >
            <CaretLeft size={24} weight="bold" aria-hidden />
          </button>
          <h1 className="clients-title">Clients</h1>
        </div>

        <p className="clients-sub">
          Pick someone to open their stage. Toolbar profile also lands here when you tap
          the person icon elsewhere.
        </p>

        <div className="clients-sectionLabel">Search</div>
        <div className="clients-search">
          <MagnifyingGlass
            size={18}
            weight="regular"
            aria-hidden
            className="clients-search__icon"
          />
          <input
            className="clients-search__input"
            type="search"
            placeholder="Search by name, phone, or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search clients"
            autoCapitalize="words"
            autoCorrect="off"
          />
        </div>

        <div className="clients-sectionLabel">Directory</div>
        <div className="clients-list" role="list">
          <button
            type="button"
            className="clients-row clients-row--new"
            onClick={() => {
              setNewClientError('');
              setNewClientOpen(true);
            }}
            role="listitem"
          >
            <span className="clients-row__avatar" aria-hidden>
              <Plus size={22} weight="bold" />
            </span>
            <div className="clients-row__body">
              <div className="clients-row__name">New client</div>
            </div>
            <CaretRight size={18} weight="bold" className="clients-row__chevron" aria-hidden />
          </button>

          {filtered.map((client) => {
            const k = clientKey(client.name);
            const rec = consultStore[k] || {};
            const avatar =
              consultTileImageUrl(client, rec) || idbAvatarByKey[k] || null;
            return (
              <button
                key={client.id || client.name}
                type="button"
                className="clients-row"
                onClick={() => openClient(client)}
                role="listitem"
                aria-label={`Open ${client.name}`}
              >
                <span className="clients-row__avatar">
                  {avatar ? (
                    <img
                      className="clients-row__avatarImg"
                      src={avatar}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    <span className="clients-row__initials">{initialsFor(client.name)}</span>
                  )}
                </span>
                <div className="clients-row__body">
                  <div className="clients-row__name">{client.name || 'Unnamed'}</div>
                  {client.phone || client.email ? (
                    <div className="clients-row__meta">
                      {[client.phone, client.email].filter(Boolean).join(' · ')}
                    </div>
                  ) : null}
                </div>
                <CaretRight size={18} weight="regular" className="clients-row__chevron" aria-hidden />
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && query.trim() ? (
          <div className="clients-empty" role="status">
            No clients match &quot;{query.trim()}&quot;
          </div>
        ) : null}
      </div>

      {newClientOpen ? (
        <NewCustomerScreen
          onCancel={closeNewClientModal}
          onSave={(client) => {
            void handleClientCreated(client);
          }}
          saving={newClientSaving}
          error={newClientError}
        />
      ) : null}
    </div>
  );
}
