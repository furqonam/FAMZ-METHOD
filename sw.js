/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   sw.js
   Service Worker — cache strategy (network-first untuk CSS)
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — CONFIG
   ───────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'famz-v1.0.2';
const CACHE_STATIC  = CACHE_VERSION + '-static';
const CACHE_RUNTIME = CACHE_VERSION + '-runtime';

/* Static assets yang aman untuk di-cache offline */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

/* Pattern runtime cache (font, CDN) */
const RUNTIME_CACHE_PATTERNS = [
  /^https:\/\/fonts\.googleapis\.com\//,
  /^https:\/\/fonts\.gstatic\.com\//
];

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — INSTALL
   ───────────────────────────────────────────────────────────── */
self.addEventListener('install', function (event) {
  console.log('[SW] Installing', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(function (cache) {
        return cache.addAll(STATIC_ASSETS).catch(function (err) {
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — ACTIVATE (hapus cache lama)
   ───────────────────────────────────────────────────────────── */
self.addEventListener('activate', function (event) {
  console.log('[SW] Activating', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.startsWith('famz-') &&
                     key !== CACHE_STATIC &&
                     key !== CACHE_RUNTIME;
            })
            .map(function (key) {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — FETCH STRATEGY
   ───────────────────────────────────────────────────────────── */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  const url = req.url;

  /* 04.1 — Skip non-GET */
  if (req.method !== 'GET') return;

  /* 04.2 — Skip chrome extensions */
  if (url.startsWith('chrome-extension://')) return;

  /* 04.3 — Skip range requests (video streaming) */
  if (req.headers.get('range')) return;

  /* 04.4 — Skip cross-origin (biar gak konflik COEP) */
  if (!url.startsWith(self.location.origin) && !isRuntimePattern(url)) {
    return;
  }

  /* 04.5 — CSS & JS: NETWORK ONLY (selalu fresh) */
  if (url.endsWith('.css') || url.endsWith('.js')) {
    return;
  }

  /* 04.6 — HTML: network-first */
  if (url.endsWith('.html') || url.endsWith('/')) {
    event.respondWith(networkFirst(req));
    return;
  }

  /* 04.7 — Fonts & runtime CDN: stale-while-revalidate */
  if (isRuntimePattern(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  /* 04.8 — Default: network only */
});

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — STRATEGIES
   ───────────────────────────────────────────────────────────── */

/* 05.1 — Network first (HTML) */
async function networkFirst(req) {
  try {
    const res = await fetch(req);

    if (res && res.status === 200 && res.type === 'basic') {
      const cache = await caches.open(CACHE_STATIC);
      /* Non-blocking put */
      cache.put(req, res.clone()).catch(function () {});
    }

    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;

    const fallback = await caches.match('/index.html');
    if (fallback) return fallback;

    throw err;
  }
}

/* 05.2 — Stale while revalidate (fonts/CDN) */
async function staleWhileRevalidate(req) {
  const cache  = await caches.open(CACHE_RUNTIME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then(function (res) {
      /* Cuma cache response yang valid + bukan opaque */
      if (res && res.status === 200 && res.type !== 'opaque') {
        cache.put(req, res.clone()).catch(function () {});
      }
      return res;
    })
    .catch(function () {
      return cached;
    });

  return cached || fetchPromise;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — HELPERS
   ───────────────────────────────────────────────────────────── */
function isRuntimePattern(url) {
  for (let i = 0; i < RUNTIME_CACHE_PATTERNS.length; i++) {
    if (RUNTIME_CACHE_PATTERNS[i].test(url)) return true;
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — MESSAGE HANDLER
   ───────────────────────────────────────────────────────────── */
self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k.startsWith('famz-'); })
          .map(function (k) { return caches.delete(k); })
      );
    });
  }
});

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[SW] 𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬 Service Worker loaded');