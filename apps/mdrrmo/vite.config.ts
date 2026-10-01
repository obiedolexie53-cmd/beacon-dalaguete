/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API runs on :8000 in development; proxying keeps requests same-origin so
// auth cookies work without extra CORS configuration.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    // BEACON_API_URL lets the end-to-end tests point at their own API server.
    proxy: { '/api': process.env.BEACON_API_URL ?? 'http://localhost:8000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
