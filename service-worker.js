/*
 * Bedrock service-worker retirement shim.
 *
 * The root-scoped offline-cache canary caused a real-device UX regression by
 * placing Cache Storage in front of ordinary site navigation and assets. This
 * file intentionally owns no requests. It exists only long enough to replace
 * already-installed canary workers, clear their caches, and unregister the
 * registration on browsers that previously received the experiment.
 */

const RETIRED_CACHE_PREFIX = 'allneeds-static-';

self.addEventListener('install', () => {
  // Replace an already-installed cache worker immediately so it stops owning
  // future requests as soon as the browser sees this retirement version.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(RETIRED_CACHE_PREFIX))
          .map((key) => caches.delete(key)),
      );
    } finally {
      // Unregister even if Cache Storage cleanup is unavailable or partially
      // fails. This worker deliberately has no fetch handler.
      await self.registration.unregister();
    }
  })());
});
