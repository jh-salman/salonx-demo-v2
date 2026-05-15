import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = (env.V2_ADMIN_PROXY_TARGET || 'http://localhost:3000').replace(
    /\/$/,
    '',
  )
  const demoApiTarget = (env.VITE_DEMO_API_PROXY_TARGET || 'http://localhost:4000').replace(
    /\/$/,
    '',
  )

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/salonx-admin': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/salonx-admin/, '') || '/',
        },
        '/salonx-demo-api': {
          target: demoApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/salonx-demo-api/, '') || '/',
        },
      },
    },
  }
})
