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
      // Fit by either dimension; never up-scale past native size
      const next = Math.min(w / SHELL_W, h / SHELL_H, 1)
      setScale(next)
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('orientationchange', compute)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('orientationchange', compute)
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
        minHeight: '100vh',
        backgroundColor: '#121212',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Outer footprint — exact scaled size, lets siblings center cleanly */}
      <div
        style={{
          width: `${scaledW}px`,
          height: `${scaledH}px`,
          position: 'relative',
        }}
      >
        {/* Inner shell at native 393×852 — content stays pixel-perfect, shell scales */}
        <div
          style={{
            width: `${SHELL_W}px`,
            height: `${SHELL_H}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
            borderRadius: '24px',
            overflow: 'hidden',
            backgroundColor: '#0a0a0c',
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.55)',
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
