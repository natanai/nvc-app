# Bedrock performance budget

Bedrock treats performance as an ownership problem first: a route should not download and parse a large capability merely because that capability exists somewhere in the application.

The permanent regression test in `tests/performance-budget.test.mjs` measures **raw first-party JavaScript bytes referenced directly by `<script src>` in representative committed HTML pages**. It also places raw-size ceilings on the largest shared browser assets.

This is deliberately a stable static metric, not a claim about real transferred bytes or Core Web Vitals.

It does **not** include:

- gzip/Brotli transfer compression;
- browser/CDN cache hits;
- transitive ES-module imports;
- JavaScript loaded later in response to user intent;
- inline scripts;
- execution time, long tasks, LCP, INP, CLS, or memory use.

Those require browser/network measurement. The static budget exists to catch architectural regressions such as putting `inventory.js` back on Home first load or letting a shared controller grow indefinitely without an explicit decision.

## Current Bedrock route ceilings

The ceilings intentionally leave a small amount of breathing room above the current branch. They are **regression ceilings, not optimization targets**. When a validated optimization lowers a route's normal first-load graph, the ceiling should be ratcheted downward.

| Representative route | Current raw direct JS | Ceiling |
| --- | ---: | ---: |
| Home | ~101.7 KiB | 110 KB |
| Shared Strategies | ~115.1 KiB | 125 KB |
| Need detail | ~335.6 KiB | 355 KB |
| Feeling detail | ~337.5 KiB | 355 KB |
| Faux-feeling detail | ~320.5 KiB | 337 KB |
| Body Cues | ~335.5 KiB | 355 KB |
| Inventory | ~328.1 KiB | 345 KB |
| Journal | ~394.5 KiB | 415 KB |

The test also requires Home to remain at or below 40% of the representative Need-detail parser graph. This protects the Home lazy-controller canary independently of absolute file-size changes.

Two internal controller extractions have now reduced shared ownership without changing visible route behavior:

- the Need strategy-card deck moved into `scripts/strategy-deck.js`. Need detail remains essentially flat because that route still needs the deck, while Feeling, Faux Feeling, Body Cues, Inventory, and Journal each stopped parsing roughly 8.3 KiB of unrelated deck behavior;
- the legacy `#journal-dashboard` Inventory compatibility redirect moved into the Inventory-only `scripts/inventory-legacy-journal-redirect.js`, which executes before `inventory.js`. That removed roughly another 1 KiB from the shared controller while leaving Inventory's own total essentially flat.

## Largest shared-asset ceilings

| Asset | Current raw size | Ceiling |
| --- | ---: | ---: |
| `scripts/inventory.js` | ~225.2 KiB | 238 KB |
| `scripts/strategy-deck.js` | ~8.4 KiB | 10 KB |
| `styles.css` | ~166.1 KiB | 175 KB |
| `scripts/magnets.js` | ~60.1 KiB | 65 KB |
| `scripts/inventory-core-shell.js` | ~27.5 KiB | 30 KB |
| `scripts/alexithymia-support.js` | ~81.2 KiB | 85 KB |

Raising one of these ceilings should be an explicit architectural decision. Prefer reducing ownership scope or extracting a real capability boundary rather than moving code between equally eager files merely to satisfy the test.

## CSS delivery checkpoint

The shared stylesheet is still broad, but its dependency graph is no longer hidden behind serial CSS imports. `styles.css` contains no `@import` rules. The page compiler now exposes Google Fonts, Feeling magnet icons, Need magnet icons, shared density, and Inventory shell styles directly in HTML before the main stylesheet, preserving the former cascade order while making those requests parser-discoverable immediately.

The explicit hand-owned surfaces follow the same ownership rule: Feed, Observations, and the standalone Emotions Wheel declare the same blocking dependency order directly; Alexithymia Support declares the same graph through its existing non-blocking `media="print"`/`onload` strategy and mirrors it in its `<noscript>` fallback. The old late `@import './styles/nav-critical.css'` in `styles.css` was also removed because it occurred after ordinary rules and was therefore invalid/dormant; generated pages continue to receive repaired critical navigation CSS from the canonical page compiler.

This is a delivery-graph improvement, not a claim that the CSS itself is fully minimized. Selector pruning, route-specific stylesheet ownership, and font packaging remain separate opportunities.

## What the current numbers tell us

Bedrock has already removed a large amount of ordinary first-load work from Home and Shared Strategies, and the first controller extractions have produced measurable shared-route reductions. The site still has meaningful performance headroom:

1. **The shared Inventory controller remains large.** Need details, Feeling/Faux Feeling details, Inventory, Body Cues, and the dedicated Journal still eagerly load the roughly 225 KiB controller because some visible or shell behavior remains owned there. Further extraction should happen only where a real independent capability boundary exists; backup/restore, profile sync, and first-paint Customizer state are intentionally not being split merely to make the file smaller.
2. **The global stylesheet remains broad.** `styles.css` is roughly 166 KiB. Its shared dependencies are now parser-visible rather than nested imports, so the next CSS gains should come from measuring actual unused selectors/route ownership rather than adding more discovery wrappers.
3. **Magnet behavior is substantial.** `scripts/magnets.js` is roughly 60 KiB and is intentionally shared because magnet persistence/physics is a core interaction. Future work should profile its parse/execution cost before splitting it arbitrarily.
4. **Dedicated feature surfaces are intentionally heavier.** Journal and Alexithymia Support own real interactive behavior. Their goal is not minimum bytes at any cost; it is to avoid loading unrelated capabilities and to keep expensive work off routes that do not need it.

## Remaining performance work after Bedrock behavior is accepted

The highest-value order is expected to be:

1. continue capability extraction from `inventory.js` only where a real independent owner exists;
2. expand lazy-controller route ownership only after each candidate route passes explicit browser/device acceptance;
3. audit `styles.css` and the directly linked shared CSS by route, moving deterministic route-only presentation to explicit route stylesheets where that lowers unused CSS without changing first paint;
4. measure and improve font delivery (for example self-hosting/subsetting/preload only if the browser data supports it);
5. add production minification, content-versioned assets, and deliberate long-lived cache policy;
6. verify CDN/Cloudflare gzip/Brotli and cache headers rather than assuming raw repository size equals transfer size;
7. use real-browser measurements for LCP, INP, CLS, long tasks, memory, and request waterfalls, then optimize whichever metric is actually limiting users.

There is no meaningful state where a non-trivial web app is "as efficient as humanly possible." Performance has diminishing returns and tradeoffs. Bedrock's goal is instead to make ownership explicit enough that future performance work is measurable, safe, and local: reduce bytes/work where users benefit, without sacrificing correctness, accessibility, persistence, or maintainability.
