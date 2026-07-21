import { createSlice } from '@reduxjs/toolkit'
import { MOCK_CLIENTS } from '../data/mockClients'
import { MOCK_SERVICES } from '../data/mockServices'
import { isAppointmentsApiAvailable } from '../data/v2AppointmentsApi.js'

const CALENDAR_STORAGE_KEY = '@salonx/calendar/v1'

/**
 * Warm-start the catalogs from the persisted calendar blob (same source the
 * Calendar screen used before Redux). API mode: persisted arrays or empty
 * until the server load dispatches *Loaded. Offline/mock mode: bundled mocks.
 */
function readPersistedCatalogs() {
  const out = { clients: [], serviceCatalog: [], staffRoster: [] }
  let persisted = null
  try {
    const json =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(CALENDAR_STORAGE_KEY)
        : null
    persisted = json ? JSON.parse(json) : null
  } catch {
    persisted = null
  }
  const apiMode = isAppointmentsApiAvailable()
  const arr = (v) => (Array.isArray(v) ? v : null)

  out.clients =
    arr(persisted?.clients)?.length
      ? persisted.clients
      : apiMode
        ? []
        : arr(persisted?.clients) || MOCK_CLIENTS
  out.serviceCatalog =
    arr(persisted?.serviceCatalog)?.length
      ? persisted.serviceCatalog
      : apiMode
        ? []
        : arr(persisted?.serviceCatalog) || MOCK_SERVICES
  out.staffRoster = arr(persisted?.staffRoster) || []
  return out
}

const catalogsSlice = createSlice({
  name: 'catalogs',
  initialState: readPersistedCatalogs,
  reducers: {
    clientsLoaded(state, action) {
      state.clients = Array.isArray(action.payload) ? action.payload : []
    },
    clientAdded(state, action) {
      state.clients.unshift(action.payload)
    },
    servicesLoaded(state, action) {
      state.serviceCatalog = Array.isArray(action.payload) ? action.payload : []
    },
    serviceAdded(state, action) {
      state.serviceCatalog.unshift(action.payload)
    },
    staffLoaded(state, action) {
      state.staffRoster = Array.isArray(action.payload) ? action.payload : []
    },
  },
})

export const {
  clientsLoaded,
  clientAdded,
  servicesLoaded,
  serviceAdded,
  staffLoaded,
} = catalogsSlice.actions

export const selectClients = (state) => state.catalogs.clients
export const selectServiceCatalog = (state) => state.catalogs.serviceCatalog
export const selectStaffRoster = (state) => state.catalogs.staffRoster

/** The viewer's own staff row id (staff item linked via userId), or null. */
export const selectViewerStaffId = (state) => {
  const uid = state.session.me?.user?.id
  if (!uid) return null
  const mine = state.catalogs.staffRoster.find(
    (s) => String(s.userId || '') === String(uid),
  )
  return mine ? mine.id : null
}

export default catalogsSlice.reducer
