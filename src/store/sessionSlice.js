import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { authAppApi } from '../auth/authAppApi.js'

/**
 * Global session/viewer state — the `/api/auth-app/me` payload (user, org
 * memberships, active salon). Single source of truth for role-based UI
 * (owner/admin vs stylist) instead of each screen fetching `me()` itself.
 */
export const fetchMe = createAsyncThunk(
  'session/fetchMe',
  async (_arg, { rejectWithValue }) => {
    try {
      return await authAppApi.me()
    } catch (e) {
      // Preserve HTTP status for consumers (401 → "sign in" flows).
      return rejectWithValue({
        status: e?.status,
        message: e?.message || 'Failed to load session',
      })
    }
  },
  {
    condition: (arg, { getState }) => {
      const { session } = getState()
      if (session.status === 'loading') return false
      // Cached unless a consumer explicitly wants fresh data.
      if (!arg?.force && session.status === 'succeeded') return false
      return true
    },
  },
)

/**
 * Await-friendly wrapper: resolves with the me payload (cached or fresh),
 * throws an Error with `.status` on real failures. Unlike `fetchMe().unwrap()`
 * it does not reject when the fetch was skipped because data is already cached.
 */
export const ensureMe =
  (arg) =>
  async (dispatch, getState) => {
    const action = await dispatch(fetchMe(arg))
    const me = getState().session.me
    if (me) return me
    const payload = action.payload
    const err = new Error(payload?.message || 'Failed to load session')
    if (payload?.status) err.status = payload.status
    throw err
  }

const sessionSlice = createSlice({
  name: 'session',
  initialState: {
    me: null,
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
  },
  reducers: {
    sessionCleared(state) {
      state.me = null
      state.status = 'idle'
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.me = action.payload
        state.status = 'succeeded'
        state.error = null
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.me = null
        state.status = 'failed'
        state.error =
          action.payload?.message ||
          action.error?.message ||
          'Failed to load session'
      })
  },
})

export const { sessionCleared } = sessionSlice.actions

export const selectMe = (state) => state.session.me
export const selectSessionStatus = (state) => state.session.status
export const selectSessionError = (state) => state.session.error
export const selectActiveSalon = (state) => state.session.me?.activeSalon || null

export const selectViewerRole = (state) => {
  const me = state.session.me
  if (!me) return null
  const activeOrgId = me?.session?.activeOrganizationId || null
  const members = Array.isArray(me?.members) ? me.members : []
  const mine = activeOrgId
    ? members.find((m) => m.organizationId === activeOrgId)
    : members[0]
  return mine ? String(mine.role || '').toLowerCase() : null
}

/**
 * Owner/admin see all staff columns; a plain member (stylist) sees only their
 * own. Defaults to "see all" while the session is unknown so the calendar is
 * never blanked out during load / offline mode.
 */
export const selectCanSeeAllStaff = (state) => {
  const me = state.session.me
  if (!me) return true
  const role = selectViewerRole(state)
  if (!role) return true
  return role === 'owner' || role === 'admin'
}

export default sessionSlice.reducer
