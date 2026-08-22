# Bedrock offline-cache architecture

## Status during Bedrock acceptance

The earlier root-scoped service-worker cache canary is **retired** on the Bedrock test branch.

That experiment was useful for proving that allneeds.app is technically a strong candidate for a warm static cache, but it was a poor fit for the current rapid phone-acceptance loop: an installed root worker could place Cache Storage in front of freshly published test-branch HTML/CSS/JavaScript and make a real-device regression appear to persist after its source had already changed.

Bedrock therefore does not currently install or use a service worker for ordinary navigation or static assets.

`scripts/shell-runtime-loader.js` now performs a bounded cleanup after normal Home load/idle time on browsers that received the experiment:

- it finds a lingering `/service-worker.js` registration and unregisters it;
- it removes only Cache Storage entries whose names begin with `allneeds-static-`;
- it does not register a replacement cache worker;
- it does not intercept requests or implement another navigation owner.

`service-worker.js` remains temporarily as a retirement shim for browsers that already installed the old worker. If the browser requests an update to that registration, the shim immediately replaces the old worker, removes only the retired `allneeds-static-*` cache namespace, unregisters itself, and owns no `fetch` events.

This retirement path is CI-enforced in `tests/offline-cache.test.mjs`.

## Why this is the right Bedrock boundary

The original Bedrock finish line is deterministic ownership, preserved behavior/state, less unnecessary runtime work, and clean real-device first-paint/navigation behavior. A whole-site offline cache is not required to satisfy that goal.

Keeping Cache Storage out of the test branch's ordinary request path makes phone acceptance easier to reason about:

```text
publish new Bedrock source
        ↓
normal browser/network cache rules
        ↓
phone receives the current test assets
```

rather than:

```text
publish new Bedrock source
        ↓
old root service worker may answer first
        ↓
phone can continue showing an obsolete test asset
```

On a phone that previously installed the canary, visit Home once and reload before judging a newly published visual/runtime repair. That gives the retirement path an opportunity to clear the old registration and cache namespace.

## Post-Bedrock warm-cache opportunity

allneeds.app remains unusually well suited to a deliberately designed warm/offline layer after Bedrock is accepted. Most of the application is static: generated HTML, same-origin CSS/JavaScript/icons, and generated JSON. Canonical `data/index.json` already identifies the generated Feeling, Need, and Faux Feeling vocabulary routes, so a future warmer would not need a second handwritten route registry.

The target user experience should still be **render first, warm second**, not a blocking splash screen:

1. Home becomes usable through its normal critical path.
2. A small optional progress indicator begins after first render/idle time.
3. Static application resources warm in bounded batches.
4. A complete versioned cache is promoted only after its entire declared asset set is ready.
5. Ordinary static navigation can then be served locally for that complete version.
6. Dynamic online capabilities remain outside that static owner.

A future implementation should use versioned/atomic cache ownership so an update never leaves the browser with a mixture of two application versions.

## Dynamic capabilities remain online

Even a future fully warmed static application should not pretend these are offline:

- Bluesky OAuth and profile synchronization;
- Shared Strategies/community network data;
- authenticated or mutating API requests;
- third-party resources such as Google Fonts unless they are intentionally self-hosted.

Browsers may also evict Cache Storage under storage pressure, and a new allneeds release necessarily needs to download its new version once.

The useful future promise is therefore not literally "the browser never performs another network operation." It is: **after a complete static version is warmed, ordinary application navigation can have no user-visible network wait while online-only capabilities remain explicit.**

## Gate for revisiting this after Bedrock

Do not reintroduce a root-scoped navigation cache during the remaining Bedrock acceptance/refactor cycle. Revisit whole-site warming only after:

- Home and representative mobile/desktop routes have passed the real-device first-paint and persistence checklist;
- the magnet object-permanence/scrolling issues are accepted on phone;
- remaining high-value runtime ownership work is complete or intentionally deferred;
- the rapidly changing test branch no longer needs immediate asset visibility on every publish;
- a versioned cache manifest/derivation strategy and update/rollback behavior are designed together rather than added incrementally.

At that point, full-site background warming and its progress indicator can be treated as a separate performance/PWA milestone without moving the Bedrock completion goal.