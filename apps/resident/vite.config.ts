/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/beacon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'BEACON – Dalaguete Disaster Reporting',
        short_name: 'BEACON',
        description:
          'Report disaster incidents directly to the Dalaguete MDRRMO and track the status of your reports.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b2545',
        theme_color: '#0b2545',
        categories: ['utilities', 'government'],
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache only the app shell (JS, CSS, fonts, icons). API responses contain
        // personal and report data and are never cached by the service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    environment: 'jsdom',
  },
});
