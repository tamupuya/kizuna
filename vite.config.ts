import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      cacheId: 'kizuna-v0911',
      injectRegister: 'auto',
      // manifest
      manifest: {
        name: '绊 - 二次元扩列',
        short_name: '绊',
        description: '同人扩列 · 漫展雷达 · 中谷店',
        theme_color: '#2b2a26',
        background_color: '#fafaf8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/icon-512-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      // iOS 风格
      appleIOSPwa: true,
      // 注入 meta
      useCredentialsForManifestTag: false,
      // 静态资源 cache
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/map\.qq\.com\/api\/gljs/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tencent-map-sdk',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
        ],
      },
      devOptions: {
        enabled: false, // dev 不启用 SW
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 8080,
    host: true,
  },
})