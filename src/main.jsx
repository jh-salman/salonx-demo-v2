import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './route/router.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { TimersProvider } from './context/TimersContext.jsx'

const SHELL_MIN_W = 350
const SHELL_MAX_W = 550
/** Logical layout size — Screen1 / calendar / clients mockups are authored to this footprint */
const DESIGN_W = 393
const DESIGN_H = 852

function ResponsivePhoneShell({ children }) {
  const [size, setSize] = useState({
    fullW: typeof window !== 'undefined' ? window.innerWidth : SHELL_MAX_W,
    h: typeof window !== 'undefined' ? window.innerHeight : DESIGN_H,
  })

  useEffect(() => {
    const compute = () => {
      setSize({
        fullW: window.innerWidth,
        h: window.innerHeight,
      })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('orientationchange', compute)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('orientationchange', compute)
    }
  }, [])

  // Column width: min(screen, 550), min 350 — content scales to fill this width edge-to-edge.
  const columnW = Math.max(SHELL_MIN_W, Math.min(SHELL_MAX_W, size.fullW))
  // Layout viewport height only (no visualViewport / keyboard shrinking).
  const shellH = size.h
  // Independent X/Y scale: fills columnW × shellH so all 393×852 content is visible (may look “chepta”).
  const scaleX = columnW / DESIGN_W
  const scaleY = shellH / DESIGN_H

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: size.fullW,
        height: shellH,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: `clamp(${SHELL_MIN_W}px, 100%, ${SHELL_MAX_W}px)`,
          minWidth: SHELL_MIN_W,
          maxWidth: SHELL_MAX_W,
          height: '100%',
          alignSelf: 'stretch',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
          backgroundColor: '#000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: DESIGN_W,
              height: DESIGN_H,
              transform: `scale(${scaleX}, ${scaleY})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
              backgroundColor: '#000',
              overflow: 'hidden',
            }}
          >
            {children}
          </div>
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
