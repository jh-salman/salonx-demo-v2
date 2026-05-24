import { fetchServiceCatalog, saveServiceCatalogRemote, saveProductCatalogRemote } from './calendarCatalogApi.js';
import { fetchProductCatalog } from './screen2RemoteApi.js';
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js';

export const CALENDAR_V1_STORAGE_KEY = '@salonx/calendar/v1';
export const CALENDAR_UPDATED_EVENT = 'salonx:calendar-updated';

export function normalizeServiceCatalogEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id != null ? String(raw.id) : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;
  const price = typeof raw.price === 'number' && !Number.isNaN(raw.price) ? raw.price : 0;
  const out = { id, name, price };
  const img = typeof raw.image === 'string' ? raw.image.trim() : '';
  const imgUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '';
  if (img) out.image = img;
  if (imgUrl) out.imageUrl = imgUrl;
  if (raw.kind) out.kind = raw.kind;
  return out;
}

export function normalizeProductCatalogEntry(raw, fallbackId = '') {
  if (!raw || typeof raw !== 'object') return null;
  const idRaw = raw.id != null ? String(raw.id).trim() : '';
  const id = idRaw || (typeof fallbackId === 'string' ? fallbackId.trim() : '');
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;
  const brand = typeof raw.brand === 'string' ? raw.brand.trim() : '';
  const price = typeof raw.price === 'number' && !Number.isNaN(raw.price) ? raw.price : 0;
  const out = {
    id,
    name,
    brand: brand || 'Product',
    price,
    color: typeof raw.color === 'string' && raw.color.trim() ? raw.color.trim() : '#1a1612',
  };
  if (typeof raw.shortName === 'string' && raw.shortName.trim()) out.shortName = raw.shortName.trim();
  if (typeof raw.imageUrl === 'string' && raw.imageUrl.trim()) out.imageUrl = raw.imageUrl.trim();
  if (typeof raw.abbr === 'string' && raw.abbr.trim()) out.abbr = raw.abbr.trim();
  if (typeof raw.stationTag === 'string' && raw.stationTag.trim()) out.stationTag = raw.stationTag.trim();
  return out;
}

export function loadServiceCatalogFromCalendarStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const json = window.localStorage.getItem(CALENDAR_V1_STORAGE_KEY);
    if (!json) return [];
    const data = JSON.parse(json);
    const cat = data?.serviceCatalog;
    if (!Array.isArray(cat) || !cat.length) return [];
    return cat.map(normalizeServiceCatalogEntry).filter(Boolean);
  } catch {
    return [];
  }
}

function dispatchCalendarUpdated() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CALENDAR_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

function mergeServiceCatalogIntoCalendarStorage(serviceCatalog) {
  if (typeof window === 'undefined') return;
  try {
    const json = window.localStorage.getItem(CALENDAR_V1_STORAGE_KEY);
    const data = json ? JSON.parse(json) : {};
    data.serviceCatalog = serviceCatalog;
    window.localStorage.setItem(CALENDAR_V1_STORAGE_KEY, JSON.stringify(data));
    dispatchCalendarUpdated();
  } catch {
    // ignore
  }
}

/** Service catalog — API first, then Calendar localStorage slice. */
export async function fetchDynamicServiceCatalog() {
  if (isAppointmentsApiAvailable()) {
    const data = await fetchServiceCatalog();
    if (data?.stored && Array.isArray(data.serviceCatalog)) {
      const list = data.serviceCatalog.map(normalizeServiceCatalogEntry).filter(Boolean);
      return { list, updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null };
    }
  }
  return { list: loadServiceCatalogFromCalendarStorage(), updatedAt: null };
}

/** Product catalog — API / Postgres only (no mock fallback). */
export async function fetchDynamicProductCatalog() {
  if (!isAppointmentsApiAvailable()) {
    return { list: [], updatedAt: null };
  }
  const data = await fetchProductCatalog();
  if (data?.stored && Array.isArray(data.products)) {
    const list = data.products
      .map((raw, i) => normalizeProductCatalogEntry(raw, `legacy-prod-${i}`))
      .filter(Boolean);
    return { list, updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null };
  }
  return { list: [], updatedAt: null };
}

export async function appendServiceCatalogEntry(entry, expectedUpdatedAt = null) {
  const normalized = normalizeServiceCatalogEntry(entry);
  if (!normalized) return { list: [], updatedAt: null };

  const { list, updatedAt } = await fetchDynamicServiceCatalog();
  const next = [...list.filter((s) => s.id !== normalized.id), normalized];

  if (isAppointmentsApiAvailable()) {
    const res = await saveServiceCatalogRemote({
      serviceCatalog: next,
      ...(expectedUpdatedAt ?? updatedAt ? { expectedUpdatedAt: expectedUpdatedAt ?? updatedAt } : {}),
    });
    return {
      list: (res?.serviceCatalog || next).map(normalizeServiceCatalogEntry).filter(Boolean),
      updatedAt: typeof res?.updatedAt === 'string' ? res.updatedAt : updatedAt,
    };
  }

  mergeServiceCatalogIntoCalendarStorage(next);
  return { list: next, updatedAt: null };
}

export async function appendProductCatalogEntry(entry, expectedUpdatedAt = null) {
  const normalized = normalizeProductCatalogEntry(entry);
  if (!normalized) return { list: [], updatedAt: null };

  const { list, updatedAt } = await fetchDynamicProductCatalog();
  const next = [...list.filter((p) => p.id !== normalized.id), normalized];

  if (!isAppointmentsApiAvailable()) {
    return { list: next, updatedAt: null };
  }

  const res = await saveProductCatalogRemote({
    products: next,
    ...(expectedUpdatedAt ?? updatedAt ? { expectedUpdatedAt: expectedUpdatedAt ?? updatedAt } : {}),
  });
  return {
    list: (res?.products || next).map(normalizeProductCatalogEntry).filter(Boolean),
    updatedAt: typeof res?.updatedAt === 'string' ? res.updatedAt : updatedAt,
  };
}
