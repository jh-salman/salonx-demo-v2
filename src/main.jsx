import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './route/router.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { TimersProvider } from './context/TimersContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { applySalonxPrimaryTheme, readStoredPrimaryHex } from './theme/primaryTheme.js'
import {
  applyCachedV2AdminConfigFromStorage,
  startV2AdminRealtimeSync,
  syncFromV2Admin,
} from './sync/v2AdminBootstrap.js'
import { clearS1ApiCaches } from './data/clearS1ApiCaches.js'
import {
  applyIosStandalonePwaClass,
  startSalonxViewportShellSync,
} from './layout/viewportShellSync.js'

async function startApp() {
  applyIosStandalonePwaClass()
  startSalonxViewportShellSync()
  clearS1ApiCaches()
  applyCachedV2AdminConfigFromStorage()
  applySalonxPrimaryTheme(readStoredPrimaryHex())
  startV2AdminRealtimeSync()
  await syncFromV2Admin()

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ThemeProvider>
        <AppProvider>
          <TimersProvider>
            {/* <ResponsivePhoneShell> */}
              <RouterProvider router={router} />
            {/* </ResponsivePhoneShell> */}
          </TimersProvider>
        </AppProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}

void startApp()
