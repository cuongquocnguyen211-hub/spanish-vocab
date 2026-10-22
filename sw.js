// sw.js — service worker: keeps a copy of the app files so it opens offline.
// It only caches the APP FILES. Your vocabulary lives in IndexedDB and is never touched here.
// When you change any app file, increase VERSION so phones download the new files.
const VERSION = 'v1.0.2';
const CACHE = 'vocab-es-' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/db.js', './js/srs.js', './js/state.js', './js/util.js', './js/labels.js',
  './js/nav.js', './js/practice.js', './js/importer.js', './js/more.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('vocab-es-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Cache-first for this app's own files; anything else goes to the network unchanged.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (e) {
      return new Response('Offline and not cached.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
