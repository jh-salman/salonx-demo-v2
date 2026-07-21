import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { authAppApi } from '../auth/authAppApi.js'
import { sessionCleared } from './sessionSlice.js'

/**
 * Org team (members + invitations) for Settings → Staff.
 * Cached so revisiting the page does not flash a full reload; use
 * `force: true` after invite/cancel/remove mutations.
 */
export const fetchTeam = createAsyncThunk(
  'team/fetchTeam',
  async (_arg, { rejectWithValue }) => {
    try {
      const [inviteData, memberData] = await Promise.all([
        authAppApi.orgInvitations().catch(() => null),
        authAppApi.orgMembers().catch(() => null),
      ])
      return {
        invitations: Array.isArray(inviteData?.invitations)
          ? inviteData.invitations
          : [],
        members: Array.isArray(memberData?.members) ? memberData.members : [],
        callerRole: memberData?.callerRole || '',
      }
    } catch (e) {
      return rejectWithValue({
        status: e?.status,
        message: e?.message || 'Failed to load team',
      })
    }
  },
  {
    condition: (arg, { getState }) => {
      const { team } = getState()
      if (team.status === 'loading') return false
      if (!arg?.force && team.status === 'succeeded') return false
      return true
    },
  },
)

/**
 * Await-friendly: returns cached team when fresh, otherwise fetches.
 * Does not throw on ConditionError (skipped because already cached).
 */
export const ensureTeam =
  (arg) =>
  async (dispatch, getState) => {
    const action = await dispatch(fetchTeam(arg))
    const { team } = getState()
    if (team.status === 'succeeded') {
      return {
        members: team.members,
        invitations: team.invitations,
        callerRole: team.callerRole,
      }
    }
    const payload = action.payload
    const err = new Error(payload?.message || 'Failed to load team')
    if (payload?.status) err.status = payload.status
    throw err
  }

const teamSlice = createSlice({
  name: 'team',
  initialState: {
    members: [],
    invitations: [],
    callerRole: '',
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
  },
  reducers: {
    teamCleared(state) {
      state.members = []
      state.invitations = []
      state.callerRole = ''
      state.status = 'idle'
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeam.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchTeam.fulfilled, (state, action) => {
        state.members = action.payload.members
        state.invitations = action.payload.invitations
        state.callerRole = action.payload.callerRole || ''
        state.status = 'succeeded'
        state.error = null
      })
      .addCase(fetchTeam.rejected, (state, action) => {
        state.status = 'failed'
        state.error =
          action.payload?.message ||
          action.error?.message ||
          'Failed to load team'
      })
      // Logout / session wipe also clears team so the next login cannot see
      // another org's members for a flash.
      .addCase(sessionCleared, (state) => {
        state.members = []
        state.invitations = []
        state.callerRole = ''
        state.status = 'idle'
        state.error = null
      })
  },
})

export const { teamCleared } = teamSlice.actions

export const selectTeamMembers = (state) => state.team.members
export const selectTeamInvitations = (state) => state.team.invitations
export const selectTeamCallerRole = (state) => state.team.callerRole
export const selectTeamStatus = (state) => state.team.status

export default teamSlice.reducer
