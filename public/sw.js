/* MOVI Digital Service Worker
 * Strategy:
 *   - HTML entry (index.html): network-first, never cache
 *   - Hashed assets (/assets/*): cache-first (immutable, 1-year CDN headers)
 *   - API/Supabase calls: network-only (never intercept)
 *   - Everything else: stale-while-revalidate
 */

const CACHE_NAME = 'movi-v1';
const ASSET_CACHE = 'movi-assets-v1';

// Take control immediately on install — no waiting for old tabs to close
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Claim all open clients immediately so the new SW controls them
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Remove outdated caches
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME && k !== ASSET_CACHE)
            .map(k => caches.delete(k))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (Supabase, fonts, analytics, etc.)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Skip Supabase API calls — always network
  if (url.pathname.startsWith('/rest/') ||
      url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/functions/') ||
      url.pathname.startsWith('/realtime/')) {
    return;
  }

  // Hashed assets (/assets/*.js, /assets/*.css, /assets/*.woff2, etc.)
  // These are immutable — serve from cache, fall back to network
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // HTML (index.html and all SPA routes) — network-first, NO caching
  // This ensures users always get fresh HTML on every navigation
  if (request.headers.get('accept')?.includes('text/html') ||
      url.pathname === '/' ||
      !url.pathname.includes('.')) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html') || new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Static assets without hashes (icons, images, fonts from /public)
  // Stale-while-revalidate: serve cached version instantly, update in background
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached || new Response('', { status: 404 }));
      return cached || networkFetch;
    })
  );
});

// Listen for SKIP_WAITING message from the app (used by update notification UI)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
