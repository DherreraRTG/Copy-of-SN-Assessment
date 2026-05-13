const CACHE = 'sn-assessment-v7';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Pre-cache known static assets
      await cache.addAll(['/', '/index.html', '/rtg-logo.png']);

      // Fetch root HTML, cache it, and extract + cache the hashed JS bundle URL
      try {
        const res = await fetch('/');
        const html = await res.clone().text();
        await cache.put('/', res);
        const match = html.match(/src="(\/_expo\/static\/js\/web\/[^"]+)"/);
        if (match) await cache.add(match[1]);
      } catch (_) {}
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: 'SW_ACTIVATED' }));
  });
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept SN API calls or non-GET requests
  if (url.hostname.includes('service-now.com')) return;
  if (event.request.method !== 'GET') return;

  // Cache-first for hashed static assets — they're content-addressed and never change
  if (url.pathname.startsWith('/_expo/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Network-first for everything else, fall back to cache then index.html
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/index.html');
          return new Response('', { status: 503, statusText: 'Offline' });
        })
      )
  );
});
