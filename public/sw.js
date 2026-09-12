/*
 * NEON TAP service worker — hand-written, no libraries.
 *
 * The two placeholders below are filled by scripts/build-sw.ts after `vite build`:
 *   BUILD    — short hash of the app shell; versions the shell cache
 *   PRECACHE — the app shell: '/', hashed assets/*, manifest, privacy page
 * In dev the worker is never registered (src/app/main.tsx), so the placeholders are harmless.
 *
 * Strategies
 *   navigation / index.html      network-first, offline → cached shell
 *   /assets/*  (hashed)          cache-first (precached; anything missing is fetched and kept)
 *   /music /sfx /voice /icons    cache-first, runtime cache with a 200 MB cap, evicted oldest-first
 *   /charts                      cache-first + refresh in the background (charts are regenerated)
 *   Google Fonts                 cache-first
 *   /api/* and everything else   untouched (network)
 *
 * Updates: a new worker waits until the page sends SKIP_WAITING (update toast) — except on the
 * very first install, when it activates immediately and claims the open pages.
 */
const BUILD = '__NEON_BUILD__';
const PRECACHE = /* __NEON_PRECACHE__ */ [];

const SHELL_CACHE = `neon-shell-${BUILD}`;
const MEDIA_CACHE = 'neon-media-v1';
const FONT_CACHE = 'neon-fonts-v1';
const KEEP_CACHES = new Set([SHELL_CACHE, MEDIA_CACHE, FONT_CACHE]);
/** Synthetic entry inside MEDIA_CACHE holding `{ entries: [{ url, size, at }] }` in insertion order. */
const INDEX_KEY = '/__neon-media-index__';
const MEDIA_CAP = 200 * 1024 * 1024;
const MEDIA_PREFIXES = ['/music/', '/sfx/', '/voice/', '/icons/'];
const REVALIDATE_PREFIXES = ['/charts/'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(PRECACHE.length ? PRECACHE : ['/']);
      // First install: nothing to wait for. Later versions wait for the toast (SKIP_WAITING).
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('neon-') && !KEEP_CACHES.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const path = url.pathname;
    if (req.mode === 'navigate' || path === '/' || path === '/index.html') {
      event.respondWith(networkFirstNavigation(event, req, path));
    } else if (path.startsWith('/api/') || path === '/sw.js') {
      return;
    } else if (path.startsWith('/assets/')) {
      event.respondWith(cacheFirst(event, req, SHELL_CACHE));
    } else if (path === '/manifest.webmanifest' || path === '/privacy.html') {
      event.respondWith(networkFirst(event, req, SHELL_CACHE));
    } else if (REVALIDATE_PREFIXES.some((p) => path.startsWith(p))) {
      if (req.headers.has('range')) return;
      event.respondWith(mediaCache(event, req, true));
    } else if (MEDIA_PREFIXES.some((p) => path.startsWith(p))) {
      if (req.headers.has('range')) return;
      event.respondWith(mediaCache(event, req, false));
    }
    return;
  }
  if (FONT_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(event, req, FONT_CACHE));
});

/* ---------- strategies ---------- */

function cacheable(res) {
  // 200 only (never a partial 206); opaque cross-origin responses are fine for fonts.
  return res && (res.status === 200 || res.type === 'opaque');
}

function navigationKey(path) {
  return path === '/' || path === '/index.html' ? '/' : path;
}

async function networkFirstNavigation(event, req, path) {
  const key = navigationKey(path);
  try {
    const res = await fetch(req);
    if (res.status === 200) {
      const copy = res.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put(key, copy)));
    }
    return res;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const hit = (await cache.match(key)) || (await cache.match('/')) || (await cache.match('/index.html'));
    return hit || offlineResponse();
  }
}

async function networkFirst(event, req, cacheName) {
  try {
    const res = await fetch(req);
    if (cacheable(res)) {
      const copy = res.clone();
      event.waitUntil(caches.open(cacheName).then((c) => c.put(req, copy)));
    }
    return res;
  } catch {
    const hit = await caches.match(req);
    return hit || offlineResponse();
  }
}

async function cacheFirst(event, req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) {
    const copy = res.clone();
    event.waitUntil(caches.open(cacheName).then((c) => c.put(req, copy)));
  }
  return res;
}

/** Cache-first for media with the size-capped index; `revalidate` refreshes a hit in the background. */
async function mediaCache(event, req, revalidate) {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(req);
  if (hit) {
    if (revalidate) event.waitUntil(fetchAndStore(cache, req).catch(() => undefined));
    return hit;
  }
  const res = await fetch(req);
  if (cacheable(res)) event.waitUntil(store(cache, req, res.clone()).catch(() => undefined));
  return res;
}

async function fetchAndStore(cache, req) {
  const res = await fetch(req);
  if (cacheable(res)) await store(cache, req, res);
}

function offlineResponse() {
  return new Response('offline', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } });
}

/* ---------- media index: insertion-ordered LRU with a byte cap ---------- */

/** All index mutations run through this chain so concurrent fetches never lose an entry. */
let indexQueue = Promise.resolve();

async function store(cache, req, res) {
  const size = await responseSize(res.clone());
  if (size > MEDIA_CAP) return; // a single file larger than the whole budget is never cached
  await cache.put(req, res);
  indexQueue = indexQueue.then(() => remember(cache, req.url, size)).catch(() => undefined);
  await indexQueue;
}

async function responseSize(res) {
  const len = Number(res.headers.get('content-length'));
  if (Number.isFinite(len) && len > 0) return len;
  return (await res.arrayBuffer()).byteLength;
}

async function readIndex(cache) {
  try {
    const res = await cache.match(INDEX_KEY);
    if (!res) return { entries: [] };
    const data = await res.json();
    return data && Array.isArray(data.entries) ? data : { entries: [] };
  } catch {
    return { entries: [] };
  }
}

function writeIndex(cache, index) {
  return cache.put(INDEX_KEY, new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } }));
}

/** Append (or move to the end on refresh) and evict from the front until the total fits the cap. */
async function remember(cache, url, size) {
  const index = await readIndex(cache);
  const entries = index.entries.filter((e) => e.url !== url);
  entries.push({ url, size, at: Date.now() });
  let total = entries.reduce((n, e) => n + (e.size || 0), 0);
  while (total > MEDIA_CAP && entries.length > 1) {
    const oldest = entries.shift();
    total -= oldest.size || 0;
    await cache.delete(oldest.url);
  }
  await writeIndex(cache, { entries });
}
