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
| Home | ~101.3 KiB | 110 KB |
| Shared Strategies | ~115.2 KiB | 125 KB |
| Need detail | ~336.7 KiB | 355 KB |
| Feeling detail | ~338.6 KiB | 355 KB |
| Faux-feeling detail | ~321.7 KiB | 337 KB |
| Body Cues | ~336.6 KiB | 355 KB |
| Inventory | ~328.3 KiB | 345 KB |
| Journal | ~395.6 KiB | 415 KB |

The test also requires Home to remain at or below 40% of the representative Need-detail parser graph. This protects the Home lazy-controller canary independently of absolute file-size changes.

The first internal controller extraction moved the Need strategy-card deck into `scripts/strategy-deck.js`. Need detail remains essentially flat because that route still needs the deck, but other eager routes no longer parse it. The measured reduction was about 8.3 KiB on Feeling, Faux Feeling, Body Cues, Inventory, and Journal, so those route ceilings were ratcheted downward.

## Largest shared-asset ceilings

| Asset | Current raw size | Ceiling |
| --- | ---: | ---: |
| `scripts/inventory.js` | ~226.2 KiB | 238 KB |
| `scripts/strategy-deck.js` | ~8.5 KiB | 10 KB |
| `styles.css` | ~166.8 KiB | 175 KB |
| `scripts/magnets.js` | ~60.2 KiB | 65 KB |
| `scripts/inventory-core-shell.js` | ~27.5 KiB | 30 KB |
| `scripts/alexithymia-support.js` | ~81.2 KiB | 85 KB |

Raising one of these ceilings should be an explicit architectural decision. Prefer reducing ownership scope or extracting a real capability boundary rather than moving code between equally eager files merely to satisfy the test.

## What the current numbers tell us

Bedrock has already removed a large amount of ordinary first-load work from Home and Shared Strategies, and the first monolith extraction has now produced a measurable shared-route reduction. The site still has meaningful performance headroom:

1. **The shared Inventory controller remains large.** Need details, Feeling/Faux Feeling details, Inventory, Body Cues, and the dedicated Journal still eagerly load the roughly 226 KiB controller because some visible or shell behavior remains owned there.
2. **The global stylesheet remains broad.** `styles.css` is roughly 167 KiB before its imported stylesheets, and it currently discovers Google Fonts through CSS. Route-specific CSS ownership, selector pruning, font delivery, and final packaging remain separate optimization opportunities after behavior is locked.
3. **Magnet behavior is substantial.** `scripts/magnets.js` is roughly 60 KiB and is intentionally shared because magnet persistence/physics is a core interaction. Future work should profile its parse/execution cost before splitting it arbitrarily.
4. **Dedicated feature surfaces are intentionally heavier.** Journal and Alexithymia Support own real interactive behavior. Their goal is not minimum bytes at any cost; it is to avoid loading unrelated capabilities and to keep expensive work off routes that do not need it.

## Remaining performance work after Bedrock behavior is accepted

The highest-value order is expected to be:

1. continue capability extraction from `inventory.js` where a real independent owner exists;
2. expand lazy-controller route ownership only after the Home browser/device canary is accepted;
3. audit `styles.css` and imported CSS by route, moving deterministic route-only presentation to explicit route stylesheets where that lowers unused CSS without changing first paint;
4. measure and improve font delivery (for example self-hosting/subsetting/preload only if the browser data supports it);
5. add production minification, content-versioned assets, and deliberate long-lived cache policy;
6. verify CDN/Cloudflare gzip/Brotli and cache headers rather than assuming raw repository size equals transfer size;
7. use real-browser measurements for LCP, INP, CLS, long tasks, memory, and request waterfalls, then optimize whichever metric is actually limiting users.

There is no meaningful state where a non-trivial web app is "as efficient as humanly possible." Performance has diminishing returns and tradeoffs. Bedrock's goal is instead to make ownership explicit enough that future performance work is measurable, safe, and local: reduce bytes/work where users benefit, without sacrificing correctness, accessibility, persistence, or maintainability.
