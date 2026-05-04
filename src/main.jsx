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
  const [size, setSize] = useState({
    w: SHELL_W,
    h: SHELL_H,
    scale: 1,
    scaledW: SHELL_W,
    scaledH: SHELL_H,
    offsetTop: 0,
    offsetLeft: 0,
  })

  useEffect(() => {
    const compute = () => {
      const vv = window.visualViewport
      const w = vv ? vv.width : window.innerWidth
      const h = vv ? vv.height : window.innerHeight
      const offsetTop = vv ? vv.offsetTop : 0
      const offsetLeft = vv ? vv.offsetLeft : 0
      // Uniform scale: same factor on X and Y so UI is not stretched/squashed.
      // Letterbox / pillarbox with black bars when viewport aspect ≠ 393:852.
      // Logical layout stays exactly SHELL_W × SHELL_H inside the scaled layer.
      const sx = w / SHELL_W
      const sy = h / SHELL_H
      const scale = Math.min(sx, sy)
      const scaledW = SHELL_W * scale
      const scaledH = SHELL_H * scale
      setSize({ w, h, scale, scaledW, scaledH, offsetTop, offsetLeft })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('orientationchange', compute)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', compute)
      window.visualViewport.addEventListener('scroll', compute)
    }
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('orientationchange', compute)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', compute)
        window.visualViewport.removeEventListener('scroll', compute)
      }
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: size.offsetTop,
        left: size.offsetLeft,
        width: size.w,
        height: size.h,
        boxSizing: 'border-box',
        backgroundColor: '#000',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Clip box = post-scale footprint so flex centering matches the painted size */}
      <div
        style={{
          width: size.scaledW,
          height: size.scaledH,
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${SHELL_W}px`,
            height: `${SHELL_H}px`,
            transform: `scale(${size.scale})`,
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
