import { clearApiAppointmentsMemoryCache } from './apiAppointmentsSessionCache.js'
import { clearS1DemoMemory } from './s1DemoMemoryStore.js'
import { resetRampQueueMemory } from './rampQueueStore.js'
import {
  setApiModeCalendarEventsMirror,
  setApiModeToolbarMirror,
} from './calendarEventsStore.js'
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js'

const LOCAL_KEYS = [
  '@salonx/calendar/v1',
  '@salonx/v2-appointments-session/v1',
  '@salonx/ramp/queue/v1',
  '@salonx/ramp/queue/dismissed/v1',
  '@salonx/s1-demo-image/v1',
  '@salonx/v2admin-config-cache/v1',
]

const SESSION_KEYS = [
  '@salonx/s1-demo-image/v1',
  '@salonx/v2-appointments-session/v1',
  '@salonx/s2-marquee/v1',
  '@salonx/s4-climax/v1',
]

/** Drop stale device caches — S1 queue + media load from demo-api / DB only. */
export function clearS1ApiCaches() {
  if (!isAppointmentsApiAvailable()) return

  if (typeof localStorage !== 'undefined') {
    for (const key of LOCAL_KEYS) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* private mode */
      }
    }
  }

  if (typeof sessionStorage !== 'undefined') {
    for (const key of SESSION_KEYS) {
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* private mode */
      }
    }
  }

  clearS1DemoMemory()
  clearApiAppointmentsMemoryCache()
  setApiModeCalendarEventsMirror([])
  setApiModeToolbarMirror({ parkedFromDrag: [], toolbarEvents: [] })
  resetRampQueueMemory()
}
