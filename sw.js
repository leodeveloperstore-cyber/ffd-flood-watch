/* ============================================================
   PakFlood Watch — Service Worker
   Caches app shell for offline use
============================================================ */

const CACHE_NAME = 'pakflood-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
];

/* Install — cache app shell */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CACHE_URLS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

/* Activate — remove old caches */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Fetch — network first, cache fallback */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin API calls (let them go to network)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('open-meteo') || url.hostname.includes('flood-api')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache a clone of good responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* Push Notifications (FCM ready) */
self.addEventListener('push', event => {
  let data = { title: 'PakFlood Watch Alert', body: 'New flood update available.' };
  try { data = event.data.json(); } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'PakFlood Watch', {
      body: data.body || 'Check latest river status.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'pakflood-alert',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/index.html' },
      actions: [
        { action: 'open', title: '🌊 Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
  }
});
