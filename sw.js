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
const CACHE_VERSION = 'famz-v1.0.2';  // ← BUMP VERSION
const CACHE_STATIC = CACHE_VERSION + '-static';
const CACHE_RUNTIME = CACHE_VERSION + '-runtime';

// Hanya cache file yang AMAN untuk cache
// CSS dan JS TIDAK di-cache biar selalu fresh dari server
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

const RUNTIME_CACHE_PATTERNS = [
  /^https:\/\/fonts\.googleapis\.com\//,
  /^https:\/\/fonts\.gstatic\.com\//
];

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — INSTALL
   ───────────────────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — ACTIVATE (hapus cache lama)
   ───────────────────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('famz-') && key !== CACHE_STATIC && key !== CACHE_RUNTIME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — FETCH STRATEGY
   ───────────────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Skip non-GET
  if (req.method !== 'GET') return;

  // Skip chrome extensions
  if (url.startsWith('chrome-extension://')) return;

  // Skip range requests (video streaming)
  if (req.headers.get('range')) return;

  // ✅ CSS & JS: NETWORK ONLY (selalu fresh, gak di-cache)
  if (url.endsWith('.css') || url.endsWith('.js')) {
    return; // biarkan browser handle langsung
  }

  // ✅ HTML: network-first
  if (url.endsWith('.html') || url.endsWith('/')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ✅ Fonts: stale-while-revalidate
  if (isRuntimePattern(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Default: network only
});

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — STRATEGIES
   ───────────────────────────────────────────────────────────── */
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(req, res.clone());
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

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_RUNTIME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.status === 200) {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — HELPERS
   ───────────────────────────────────────────────────────────── */
function isRuntimePattern(url) {
  return RUNTIME_CACHE_PATTERNS.some((pattern) => pattern.test(url));
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — MESSAGE HANDLER
   ───────────────────────────────────────────────────────────── */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('famz-')).map((k) => caches.delete(k)))
    );
  }
});

console.log('[SW] 𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬 Service Worker loaded');