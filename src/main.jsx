import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './route/router.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { TimersProvider } from './context/TimersContext.jsx'

const SHELL_W = 393
const SHELL_H = 852

function ResponsivePhoneShell({ children }) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      // Leave a small breathing margin so the mockup doesn't touch device edges
      const PAD = w < 480 ? 0 : 16 // mobile: edge-to-edge; desktop/tablet: 16px gap
      const availW = Math.max(0, w - PAD * 2)
      const availH = Math.max(0, h - PAD * 2)
      // Fit by the smaller dimension — scale up on big screens too
      const next = Math.min(availW / SHELL_W, availH / SHELL_H)
      setScale(Number.isFinite(next) && next > 0 ? next : 1)
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('orientationchange', compute)
    // Mobile browsers fire visualViewport resize on URL-bar show/hide
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', compute)
    }
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('orientationchange', compute)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', compute)
      }
    }
  }, [])

  const scaledW = SHELL_W * scale
  const scaledH = SHELL_H * scale

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100dvh',
        backgroundColor: '#121212',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: `${scaledW}px`,
          height: `${scaledH}px`,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${SHELL_W}px`,
            height: `${SHELL_H}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
            borderRadius: scale >= 1 ? '0px' : '24px',
            overflow: 'hidden',
            backgroundColor: '#0a0a0c',
            boxShadow: scale >= 1 ? 'none' : '0 12px 48px rgba(0, 0, 0, 0.55)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <TimersProvider>
        <ResponsivePhoneShell>
          <RouterProvider router={router} />
        </ResponsivePhoneShell>
      </TimersProvider>
    </AppProvider>
  </StrictMode>,
)
