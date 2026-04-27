import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './route/router.jsx'
import { AppProvider } from './context/AppContext.jsx'
// import ScreenController from './components/ScreenController.jsx'

createRoot(document.getElementById('root')).render(

  <StrictMode>
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#121212",
      position: "relative",
    }}>
      <AppProvider>



        {/* Phone shell — no orange rim (content provides accent) */}
        <div
          style={{
            width: "393px",
            height: "852px",
            borderRadius: "24px",
            overflow: "hidden",
            position: "relative",
            backgroundColor: "#0a0a0c",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.55)",
          }}
        >
          <RouterProvider router={router} />
        </div>

      </AppProvider>
    </div>
  </StrictMode>,
)
