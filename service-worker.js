/*
 * allneeds.app Bedrock offline-cache canary
 *
 * This worker deliberately starts small. Home owns registration during the
 * Bedrock canary; once registered, the worker has root scope and may serve
 * cached same-origin static resources across the site.
 *
 * Dynamic account/API traffic is never cached here. The first milestone is
 * safe static-shell caching; full-site background warming is a later layer.
 */

const CACHE_PREFIX = 'allneeds-static-';
const CACHE_VERSION = 'bedrock-v2';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const CORE_URLS = [
  '/',
  '/styles.css',
  '/site.webmanifest',
  '/browserconfig.xml',
  '/assets/js/ui/contrast.js',
  '/scripts/shell-runtime-loader.js',
  '/scripts/inventory-core-shell.js',
  '/scripts/magnets.js',
  '/styles/feelings-magnet-icons.css',
  '/styles/needs-magnet-icons.css',
  '/styles/shared-density.css',
  '/styles/inventory-core-shell.css',
  '/styles/nav-critical.css',
  '/data/index.json',
];

function isSafeStaticRequest(request) {
  if (!request || request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (request.headers.get('authorization')) return false;

  return true;
}

function cacheKeyFor(request) {
  const url = new URL(request.url);
  // Cache-busting query strings on immutable static files should not create a
  // second copy. OAuth/navigation query state remains in window.location even
  // when the static HTML body is served from its canonical pathname key.
  return new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
}

function canStore(response) {
  return Boolean(response && response.ok && response.type === 'basic');
}

async function refresh(cache, request, key) {
  try {
    const response = await fetch(request);
    if (canStore(response)) {
      await cache.put(key, response.clone());
    }
    return response;
  } catch (error) {
    return null;
  }
}

async function cacheFirstWithRefresh(event) {
  const request = event.request;
  const key = cacheKeyFor(request);
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(key);

  if (cached) {
    event.waitUntil(refresh(cache, request, key));
    return cached;
  }

  const response = await refresh(cache, request, key);
  return response || Response.error();
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // A single unavailable optional asset must not prevent the worker from
    // installing. Each core resource is therefore warmed independently.
    await Promise.allSettled(CORE_URLS.map(async (path) => {
      const request = new Request(new URL(path, self.location.origin), {
        credentials: 'same-origin',
      });
      const response = await fetch(request);
      if (canStore(response)) {
        await cache.put(cacheKeyFor(request), response);
      }
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (!isSafeStaticRequest(event.request)) return;
  event.respondWith(cacheFirstWithRefresh(event));
});
