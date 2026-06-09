const CACHE_NAME = 'fifa2026-morocco-premium-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/api.js',
  './js/socket.js',
  './js/components/matches.js',
  './data/locales/fr.json',
  './data/locales/ar.json',
  './data/locales/en.json',
  './data/locales/es.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch(err => console.warn('SW cache addAll warning:', err))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
