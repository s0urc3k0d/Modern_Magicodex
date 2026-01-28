import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Use Vite env (define VITE_PWA=false in .env or CLI to disable SW & caches during debugging)
// (We access via process.env at runtime build step is fine, but TypeScript here lacks Node types.)
// So we rely on import.meta.env inside a function scope later instead.
const isPWAEnabled = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flag = (import.meta as any).env?.VITE_PWA;
  return (flag ?? 'true') !== 'false';
};

export default defineConfig({
  plugins: [
    react(),
  isPWAEnabled() && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Magicodex',
        short_name: 'Magicodex',
        description: 'MTG Collection Manager',
        theme_color: '#0b0f1a',
        background_color: '#0b0f1a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        navigateFallback: '/offline.html',
        runtimeCaching: [
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            urlPattern: ({ url }: any) => (url?.pathname || '').startsWith('/api'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 },
            }
          },
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            urlPattern: ({ request }: any) => request?.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Temporarily disable aggressive manualChunks to rule out inter-chunk evaluation issues.
        // We only keep large feature page buckets if harmless; comment them out for now.
        // manualChunks: undefined
      }
    }
  }
})
