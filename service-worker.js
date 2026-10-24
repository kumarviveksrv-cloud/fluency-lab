/* ============================================
   FLUENCY LAB — SERVICE WORKER
   Caches app shell for offline use
   ============================================ */

const CACHE_NAME = 'fluency-lab-v1';
const CACHE_VERSION = 1;

// Files to cache on install (app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/warmup.html',
  '/practice.html',
  '/characters.html',
  '/character.html',
  '/phrases.html',
  '/phrase.html',
  '/log.html',
  '/progress.html',
  '/manifest.json',
  '/css/design-system.css',
  '/js/app.js',
  '/js/airtable.js',
  '/js/audio.js',
];

// ─── INSTALL ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache API calls (Airtable, Cloudflare Workers)
  if (
    url.hostname.includes('airtable.com') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('openai.com')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for app shell files
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            // Cache valid responses
            if (response && response.status === 200) {
              const cloned = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, cloned));
            }
            return response;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// ─── PUSH NOTIFICATIONS (Future) ─────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  self.registration.showNotification(data.title || 'Fluency Lab', {
    body: data.body || 'Time for your daily practice',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    data: { url: data.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
