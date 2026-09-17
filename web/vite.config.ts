import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'SiberianGym',
        short_name: 'SiberianGym',
        description: 'Экосистема фитнес-клуба SiberianGym',
        lang: 'ru',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f6f7fb',
        theme_color: '#0369a1',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Всё под /api — реальные данные, не кэшируем как статику;
        // навигационные запросы (HashRouter) всегда падают на index.html.
        navigateFallbackDenylist: [/^\/api\//],
        // Обработчик Web Push (P2.4): generateSW не встраивает свой код,
        // поэтому доклеиваем его отдельным скриптом из public/.
        importScripts: ['push-handler.js'],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  base: './',
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
