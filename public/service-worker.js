const CACHE_NAME = 'fifa2026-morocco-premium-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './data/locales/fr.json',
  './data/locales/ar.json',
  './data/locales/en.json',
  './data/locales/es.json'
];

// Installation : Mise en cache des assets de base et activation immédiate
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW cache addAll warning:', err))
  );
});

// Activation : Nettoyage des anciens caches et prise de contrôle immédiate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Nettoyage ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de cache : Network-First pour s'assurer que les scores en direct
// et les mises à jour de build (CSS/JS hashés par Vite) sont toujours à jour si le réseau est disponible.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // Toujours contourner le cache pour les requêtes de l'API /api-proxy
  if (url.pathname.includes('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Si la réponse réseau est valide, on la clone et on la met en cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseCopy);
          });
        }
        return response;
      })
      .catch(() => {
        // En cas de panne de réseau, retour vers le cache
        return caches.match(e.request);
      })
  );
});
