import { MOCK_CLIENTS } from '../data/mockClients';
import { getCachedClientsCatalog } from '../data/clientProfileAvatar';

const CLIENTS_EXTRA_KEY = '@salonx/clientsExtra/v1';

export function loadExtraClients() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CLIENTS_EXTRA_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Real client directory: `/api/clients` catalog + locally-added clients; MOCK only as a last resort. */
export function mergeClientDirectory(catalog, extra) {
  const map = new Map();
  const base = Array.isArray(catalog) && catalog.length ? catalog : MOCK_CLIENTS;
  base.forEach((c) => {
    if (c?.name) map.set(String(c.name).trim().toLowerCase(), c);
  });
  extra.forEach((c) => {
    if (c?.name) map.set(String(c.name).trim().toLowerCase(), c);
  });
  return Array.from(map.values());
}

export function getRampClientDirectory() {
  return mergeClientDirectory(getCachedClientsCatalog(), loadExtraClients());
}
