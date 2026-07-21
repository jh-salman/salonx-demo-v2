import { configureStore } from '@reduxjs/toolkit'
import sessionReducer from './sessionSlice.js'
import catalogsReducer from './catalogsSlice.js'
import teamReducer from './teamSlice.js'

/**
 * Global app store — shared/server state lives here (session/viewer,
 * clients/staff/service catalogs, org team). Ephemeral, per-screen UI
 * state (drag, overlays, keyboard) intentionally stays in component state.
 */
export const store = configureStore({
  reducer: {
    session: sessionReducer,
    catalogs: catalogsReducer,
    team: teamReducer,
  },
})
