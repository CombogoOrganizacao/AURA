// AURA Service Worker — Offline Cache & Instant Load
const CACHE_NAME = 'aura-cache-v3.6.1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/manifest.json',
  '/js/engine/i18n.js',
  '/js/engine/standards.js',
  '/js/engine/rulesEngine.js',
  '/js/engine/documentParser.js',
  '/js/engine/noticeParser.js',
  '/js/engine/languageAndStats.js',
  '/js/engine/exportEngine.js',
  '/js/mock/sampleData.js',
  '/js/components/homeView.js',
  '/js/components/editorView.js',
  '/js/components/noticesView.js',
  '/js/components/dashboardView.js',
  '/js/components/modals.js',
  '/js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('PWA Cache error:', err));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network first with fallback to cache
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
