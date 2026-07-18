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
  const useDemoApi =
    String(env.VITE_DEV_USE_DEMO_API || '')
      .trim()
      .toLowerCase() === 'true'

  /** When demo-api mode: also proxy bare `/api` so mis-prefixed clients still hit :4000. */
  const proxy = {
    '/salonx-admin': {
      target: useDemoApi ? demoApiTarget : proxyTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/salonx-admin/, '') || '/',
    },
    '/salonx-demo-api': {
      target: demoApiTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/salonx-demo-api/, '') || '/',
      configure: (proxyInst) => {
        proxyInst.on('proxyReq', (proxyReq, req) => {
          if (req.url?.includes('/api/config/stream')) {
            proxyReq.setHeader('Accept', 'text/event-stream')
          }
        })
      },
    },
  }
  if (useDemoApi) {
    proxy['/api'] = {
      target: demoApiTarget,
      changeOrigin: true,
    }
  }

  return {
    plugins: [react()],
    server: {
      proxy,
    },
  }
})
