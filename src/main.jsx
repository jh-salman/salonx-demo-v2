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
  const [size, setSize] = useState({ w: SHELL_W, h: SHELL_H, sx: 1, sy: 1 })

  useEffect(() => {
    const compute = () => {
      const w =
        (window.visualViewport && window.visualViewport.width) ||
        window.innerWidth
      const h =
        (window.visualViewport && window.visualViewport.height) ||
        window.innerHeight
      // Edge-to-edge: stretch the 393×852 mockup to fill the entire viewport.
      // Aspect ratio ≈ 1:2.17 closely matches modern phones, so non-uniform
      // scale is imperceptible while guaranteeing zero gray bars.
      setSize({ w, h, sx: w / SHELL_W, sy: h / SHELL_H })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('orientationchange', compute)
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

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        backgroundColor: '#000',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: `${SHELL_W}px`,
          height: `${SHELL_H}px`,
          transform: `scale(${size.sx}, ${size.sy})`,
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
