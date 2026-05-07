import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = new URL(env.VITE_API_URL_BACKEND)

  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    server: {
      proxy: {
        '/prestashop-api': {
          target: backendUrl.origin,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => `${backendUrl.pathname.replace(/\/$/, '')}${path.replace(/^\/prestashop-api/, '')}`,
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
