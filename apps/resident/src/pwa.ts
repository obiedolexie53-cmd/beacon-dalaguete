import { registerSW } from 'virtual:pwa-register';

/** Registers the service worker that caches the app shell for fast, installable loading. */
export function registerServiceWorker(): void {
  if (import.meta.env.PROD) {
    registerSW({ immediate: true });
  }
}
