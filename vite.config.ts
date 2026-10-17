import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET

  return {
    plugins: [
      vue(),
      // PrimeVue components (Dialog, Select, DatePicker, ToggleSwitch, ...) are auto-imported
      Components({ resolvers: [PrimeVueResolver()] }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Dev only: the browser calls /api/... on its own origin and Vite forwards it to the
      // backend. No CORS preflight, and ngrok's browser warning page is skipped server-side.
      proxy: proxyTarget
        ? {
          '/api': {
            target: proxyTarget,
            changeOrigin: true,
            secure: true,
            headers: { 'ngrok-skip-browser-warning': 'true' },
          },
        }
        : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return id.toString().split('node_modules/')[1].split('/')[0].toString()
            }
          },
        },
      },
    },
  }
})
