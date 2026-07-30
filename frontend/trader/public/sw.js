/* FXArtha PWA service worker — deliberately conservative.
 *
 * NETWORK-FIRST for everything: while online every request hits the network,
 * so users always get fresh JS chunks (no stale-bundle errors after a deploy)
 * and live prices. The cache is only a fallback when the network fails, giving
 * a basic offline shell + Android installability. API / auth / websocket
 * traffic is never touched. */
const CACHE = 'fxartha-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Only same-origin GETs. Never intercept API, auth or realtime traffic.
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('/ws')
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const net = await fetch(req);
        if (net && net.ok && net.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(req, net.clone()).catch(() => {});
        }
        return net;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = await caches.match('/dashboard');
          if (shell) return shell;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })(),
  );
});
