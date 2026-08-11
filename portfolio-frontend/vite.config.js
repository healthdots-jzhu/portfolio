import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL || 'http://localhost:5000'),
      __CDN_URL__: JSON.stringify(env.VITE_CDN_URL || 'http://localhost:9000'),
      __AUTH_DOMAIN__: JSON.stringify(env.VITE_AUTH_DOMAIN || ''),
      __AUTH_CLIENT_ID__: JSON.stringify(env.VITE_AUTH_CLIENT_ID || ''),
      __AUTH_REDIRECT_PATH__: JSON.stringify(env.VITE_AUTH_REDIRECT_PATH || '/callback'),
      __DEBUG__: JSON.stringify(env.VITE_DEBUG === 'true')
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5000',
          changeOrigin: true,
          rewrite: (path) => path
        }
      }
    },
    preview: {
      port: 5173
    }
  }
})
