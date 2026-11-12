import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = Number(env.PORT || 43127)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 54173,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          configure(proxy) {
            // The local Vite proxy is server-to-server; let the API bypass browser CORS.
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.removeHeader('origin')
              console.info(`[vite-api-proxy] forwarding ${req.method} ${new URL(req.url || '/', 'http://local').pathname} to API port ${apiPort}`)
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              console.info(`[vite-api-proxy] response ${proxyRes.statusCode} for ${req.method} ${new URL(req.url || '/', 'http://local').pathname}`)
            })
            proxy.on('error', (error, req) => {
              console.error(`[vite-api-proxy] upstream failed for ${req.method} ${new URL(req.url || '/', 'http://local').pathname}: ${error.code || error.name}: ${error.message}`)
            })
          },
        },
      },
    },
  }
})
