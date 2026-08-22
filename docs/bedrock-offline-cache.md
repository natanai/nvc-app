# Bedrock offline-cache architecture

## Goal

allneeds.app is mostly a static application: generated HTML pages, shared JavaScript, CSS, icons, and generated JSON are served from the same origin. That makes it a strong candidate for a service-worker-backed warm cache.

The target user experience is not a blocking splash screen. Home should become usable as soon as its normal critical resources are ready. After that, a small unobtrusive progress indicator may warm the rest of the static application in the background. When that warm pass finishes, ordinary static navigation should be satisfiable from Cache Storage without waiting on the network.

Dynamic online capabilities are a separate ownership class and must not be presented as offline:

- Bluesky OAuth and profile synchronization;
- Shared Strategies/community network data;
- any future authenticated or mutating API request;
- third-party resources such as Google Fonts until those fonts are intentionally self-hosted.

## Bedrock canary

The first service-worker milestone is intentionally narrower than the final warm-cache design.

Home already owns the lazy-runtime canary through `scripts/shell-runtime-loader.js`. That same small loader now owns service-worker registration during Bedrock testing. Registration happens only after the window `load` event and then during idle time when `requestIdleCallback` is available, so service-worker setup is not added to Home's critical parser/first-paint path.

`service-worker.js` is rooted at `/`, giving it authority over the whole static site after registration. The canary:

1. precaches a small core set: Home, global CSS, the manifest, shared shell/magnet runtimes, directly imported shell styles, and `data/index.json`;
2. intercepts only same-origin `GET` requests;
3. refuses `/api/` paths, requests carrying an `Authorization` header, cross-origin requests, and all mutations;
4. serves an already cached static response immediately and refreshes it in the background;
5. stores a successful same-origin response after the first network visit;
6. does **not** substitute Home HTML for an uncached deep route when offline;
7. deletes obsolete allneeds static-cache versions when a new cache version activates.

A failed optional core fetch does not prevent the service worker from installing. This keeps the cache layer an acceleration/offline feature rather than a new single point of failure.

## Why the first version does not download the entire site

There are roughly 180 generated pages plus standalone app surfaces. Their HTML repeats intentionally in order to preserve static-first rendering, accessibility, per-page metadata, and relative-link behavior. Downloading every page before allowing Home to become usable would move work away from later navigation but make the most important first visit slower and more data-heavy.

The desired architecture is therefore **render first, warm second**.

A future full-site warmer should:

1. wait for Home's ordinary load and the service-worker canary to be healthy on real devices;
2. derive Feeling, Need, and Faux Feeling routes from canonical `data/index.json` rather than maintaining a second handwritten list of generated vocabulary routes;
3. add the fixed app surfaces (Home, indexes, Observations, Body Cues, Inventory, Journal, Guided Check-in, Shared Strategies, Emotions Wheel, and any other deliberate standalone route);
4. discover or compile every browser-owned same-origin CSS/JS/icon/data dependency under an explicit offline ownership contract;
5. warm in bounded batches so low-memory phones are not flooded with simultaneous requests;
6. report progress to Home through `postMessage` so a small progress bar can represent the background warm operation;
7. preserve the previous complete cache until the new version has finished warming, then atomically promote the new cache and retire the old one;
8. record completion per cache version so an already-warm browser does not repeat the whole download on every visit;
9. degrade gracefully if the browser denies storage, evicts Cache Storage, loses connectivity mid-warm, or does not support service workers.

## Loading indicator

The proposed progress UI should be informational, not a gate. A first-time visitor should be able to use Home while the bar advances. Suggested copy is closer to "Preparing allneeds for faster/offline use" than "Loading site", because the page is already usable.

The indicator should appear only while meaningful background work is occurring and disappear after completion. If warming fails or is interrupted, the application remains usable and the worker can resume or retry on a later visit.

## What "never load again" can and cannot mean

Once a complete static cache is warm, ordinary pages and same-origin static resources can be returned without a network wait. This can make navigation feel effectively instantaneous and can support offline use.

It cannot guarantee that a browser will literally never perform another network operation:

- browsers may evict cache data under storage pressure;
- application updates need a way to fetch the new version;
- authenticated/community features inherently depend on remote services;
- third-party fonts/resources are outside the allneeds service-worker origin;
- browsers retain control over HTTP cache, Cache Storage quotas, memory, and process lifetime.

The practical target is stronger and more useful: **no user-visible network wait for already-warmed static application behavior, while online-only capabilities remain explicit and updates remain safe.**

## Acceptance gate before full-site warming

Do not expand the Home canary into whole-site prewarming until desktop/mobile acceptance verifies:

- first Home render is not delayed or visually shifted by worker registration;
- Home, Menu, Customizer, Inventory count, Journal intent, and early first interaction still behave correctly;
- navigating to a previously visited static page can be served from the cache without regressions;
- refreshing and revisiting after a service-worker update does not create mixed-version behavior;
- Bluesky sign-in/profile restore and Shared Strategies continue using their real network owners rather than Cache Storage;
- disabling network after cached visits produces honest behavior: cached surfaces work and uncached/dynamic surfaces fail without misleading substitutions.

Once that gate passes, the full-site background warmer and progress indicator are the next offline-performance milestone.
