const CACHE_NAME = 'opgavehelte-app-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './src/styles.css',
  './src/app.js',
  './src/vendor/supabase-js.js',
  './src/config/appConfig.js',
  './src/config/supabaseConfig.js',
  './src/pwa/registerServiceWorker.js',
  './src/services/choreService.js',
  './src/services/corruptionRecoveryService.js',
  './src/services/feedbackService.js',
  './src/services/orphanedRecordService.js',
  './src/services/periodService.js',
  './src/services/sprintService.js',
  './src/services/storageService.js',
  './src/services/supabaseService.js',
  './src/services/syncQueueService.js',
  './src/shared/choreMarker.js',
  './src/shared/dateTime.js',
  './src/shared/id.js',
  './src/shared/sectionDiff.js',
  './src/ui/choreView.js',
  './src/ui/mainView.js',
  './src/ui/syncStatusUI.js'
];

function toAppUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

function isSuccessful(response) {
  return Boolean(response && (response.ok || response.type === 'opaque'));
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL.map(toAppUrl));
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(cacheName => cacheName !== CACHE_NAME)
      .map(cacheName => caches.delete(cacheName))
  );
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAssetRequest(request, url) {
  if (request.method !== 'GET' || !isSameOrigin(url)) {
    return false;
  }

  if (request.mode === 'navigate') {
    return false;
  }

  return /\.(?:css|js|json|svg|png|jpg|jpeg|webp|gif|ico|webmanifest)$/i.test(url.pathname);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const appShellUrl = toAppUrl('./index.html');

  try {
    const response = await fetch(request);
    if (isSuccessful(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(appShellUrl)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async response => {
      if (isSuccessful(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || networkPromise || Response.error();
}

self.addEventListener('install', event => {
  event.waitUntil(
    precacheShell().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    cleanupOldCaches().then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate' && isSameOrigin(url)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
