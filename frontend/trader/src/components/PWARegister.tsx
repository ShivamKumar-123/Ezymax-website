'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker (client-side, after load). Kept minimal and
 * fail-safe — any error is swallowed so a SW hiccup never affects the app.
 */
export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
