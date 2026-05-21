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



function applyIosStandalonePwaClass() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (typeof navigator.standalone === 'boolean' && navigator.standalone === true)
  if (isIOS && isStandalone) {
    document.documentElement.classList.add('salonx-ios-pwa')
  }
}

/** iOS PWA first paint: `100dvh` / safe-area can settle late — sync shell height from the real viewport. */
function startIosPwaViewportSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  if (!document.documentElement.classList.contains('salonx-ios-pwa')) return () => {}

  const sync = () => {
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight)
    if (h > 0) {
      document.documentElement.style.setProperty('--salonx-shell-height', `${h}px`)
    }
  }

  sync()
  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', sync)
  window.visualViewport?.addEventListener('resize', sync)
  return () => {
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', sync)
    window.visualViewport?.removeEventListener('resize', sync)
  }
}

function startApp() {
  applyIosStandalonePwaClass()
  startIosPwaViewportSync()
  applyCachedV2AdminConfigFromStorage()
  applySalonxPrimaryTheme(readStoredPrimaryHex())
  startV2AdminRealtimeSync()

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

  void syncFromV2Admin()
}

void startApp()
