# Bedrock performance budget

Bedrock treats performance as an ownership problem first: a route should not download and parse a large capability merely because that capability exists somewhere in the application.

The permanent regression test in `tests/performance-budget.test.mjs` measures **raw first-party JavaScript bytes referenced directly by `<script src>` in representative committed HTML pages**. It also places raw-size ceilings on the largest shared browser assets.

This is deliberately a stable static metric, not a claim about real transferred bytes or Core Web Vitals.

It does **not** include:

- gzip/Brotli/Zstandard transfer compression;
- browser/CDN cache hits;
- transitive ES-module imports;
- JavaScript loaded later in response to user intent;
- inline scripts;
- execution time, long tasks, LCP, INP, CLS, or memory use.

Those require browser/network measurement. The static budget exists to catch architectural regressions such as putting `inventory.js` back on lightweight content routes or letting a shared controller grow indefinitely without an explicit decision.

## Post-Bedrock immediate-response canary

The merged `inventory-core-overhaul` branch remains the Bedrock production baseline. `performance/immediate-response-v1` is the first post-Bedrock live-device performance canary. It expands the proven Home/Shared Strategies intent-loader model to generated category hubs, Feeling detail pages, Faux Feeling detail pages, and Body Cues while preserving immediately visible route-owned behavior.

The canary does **not** make `inventory.js` lazy everywhere. Need detail, Inventory, dedicated Journal, and Alexithymia Support remain eager because visible behavior on those routes still depends on the controller.

The latest green Site Quality measurement on the canary reports:

| Representative route | Raw direct JS | Canary ceiling |
| --- | ---: | ---: |
| Home | 101.9 KiB | 110 KB |
| Shared Strategies | 115.3 KiB | 125 KB |
| Feelings index | 101.9 KiB | 115 KB |
| Needs index | 101.9 KiB | 115 KB |
| Faux Feelings index | 101.9 KiB | 115 KB |
| Need detail | 337.3 KiB | 355 KB |
| Feeling detail | **118.2 KiB** | 130 KB |
| Faux-feeling detail | **101.9 KiB** | 115 KB |
| Body Cues | **116.8 KiB** | 130 KB |
| Inventory | 330.2 KiB | 345 KB |
| Journal | 399.5 KiB | 415 KB |

For comparison, immediately before this canary, Feeling detail was about 339.0 KiB, Faux-feeling detail about 322.6 KiB, and Body Cues about 337.6 KiB. The ownership change therefore removes roughly 220 KiB of direct parser-discovered JavaScript from each of those representative content routes without reducing the protected eager route graphs.

The test now requires the newly intent-loaded generated content routes to stay at or below 40% of the representative Need-detail parser graph, in addition to their absolute ceilings. This makes the performance win a permanent architectural invariant rather than a one-time measurement.

These are source-level and CI measurements. The branch still requires real phone and desktop acceptance before the canary can be treated as production truth.

## Why the reduction is structurally safe

The reduction comes from changing startup ownership, not from deleting product capability:

- `scripts/inventory-core-shell.js` remains eager for Menu/navigation shell behavior.
- `scripts/magnets.js` remains eager on magnet routes.
- Feeling detail pages keep `scripts/feeling-reverse-inference.js` eager.
- Body Cues keeps `scripts/body-cues-tool.js` eager.
- the small `scripts/shell-runtime-loader.js` loads the canonical Inventory controller when the user asks for Customizer, Journal, Account & data, backup/restore, sharing, import/export, or another controller-owned shell capability, including capture/replay of an early click after controller initialization.
- Need detail keeps `inventory.js` eager because its personal-strategy form and save/profile controls are immediately visible.
- Inventory, dedicated Journal, and Alexithymia Support remain eager for the same ownership reason.

The generator is the canonical owner of these route script graphs. Generated HTML was regenerated rather than edited as the source of the optimization.

## Largest shared-asset ceilings

The canary changes *where* the large controller is required; it does not pretend the controller itself has become small.

| Asset | Current raw size | Ceiling |
| --- | ---: | ---: |
| `scripts/inventory.js` | 227.2 KiB | 238 KB |
| `scripts/strategy-deck.js` | 8.1 KiB | 10 KB |
| `styles.css` | 169.7 KiB | 175 KB |
| `scripts/magnets.js` | 61.6 KiB | 65 KB |
| `scripts/inventory-core-shell.js` | 26.2 KiB | 30 KB |
| `scripts/alexithymia-support.js` | 59.4 KiB | 85 KB |

Raising one of these ceilings should be an explicit architectural decision. Prefer reducing ownership scope or extracting a real capability boundary rather than moving code between equally eager files merely to satisfy the test.

Two earlier controller extractions also reduced shared ownership without changing visible route behavior:

- the Need strategy-card deck moved into `scripts/strategy-deck.js`. Need detail remains essentially flat because that route still needs the deck, while unrelated routes stopped parsing that behavior;
- the legacy `#journal-dashboard` Inventory compatibility redirect moved into the Inventory-only `scripts/inventory-legacy-journal-redirect.js`, which executes before `inventory.js`.

## CSS and font delivery checkpoint

The shared stylesheet is still broad, but its dependency graph is no longer hidden behind serial CSS imports. `styles.css` contains no `@import` rules. The page compiler exposes Google Fonts, Feeling magnet icons, Need magnet icons, shared density, and Inventory shell styles directly in HTML before the main stylesheet, preserving cascade order while making those requests parser-discoverable immediately.

The explicit hand-owned surfaces follow the same ownership rule: Feed, Observations, the standalone Emotions Wheel, and Alexithymia Support declare the same blocking dependency order directly. Alexithymia keeps an eager magnet and Journal runtime because those interactions are visible immediately, so its shared layout CSS must also settle before those runtimes measure the page; the former route-only `media="print"`/`onload` exception is retired.

Every page that requests the Google Fonts stylesheet preconnects to both `fonts.googleapis.com` and `fonts.gstatic.com` first. `tests/font-delivery.test.mjs` enforces that ordering for every committed Google Fonts consumer and for the canonical page compiler.

Self-hosting/subsetting fonts and route-level CSS extraction remain possible optimizations, but neither should be attempted by adding late runtime repair or arbitrary bundles. Measure actual browser/route benefit first, then move ownership only where a real seam exists.

## Live production-delivery verification

A one-shot live-header audit on 2026-08-22 verified the published delivery stack instead of assuming repository byte size equals network cost. The temporary audit workflow was removed after measurement.

Observed behavior from `https://allneeds.app/` and representative static assets:

- the public site is fronted by Cloudflare, with a Varnish-style upstream cache visible through `Via`/`X-Served-By` headers;
- responses use HTTP/2 and correctly vary on `Accept-Encoding`;
- HTML was served with Zstandard compression and `Cache-Control: max-age=600`;
- CSS, JavaScript, and SVG responses were served compressed with gzip and `Cache-Control: max-age=14400`;
- a repeated identical CSS request changed Cloudflare's status from `MISS` to `HIT`, confirming active edge caching for static assets.

The exact encoding or cache node may vary by client/edge, but the important conclusion is stable: production compression and static edge caching are active. There is no current architectural reason to add a repository-level pseudo-header layer or a second cache system merely to claim performance work.

## What the current numbers tell us

The canary demonstrates that startup ownership was the highest-value next optimization: ordinary generated content can stay immediately interactive without parsing the ~227 KiB Inventory controller before first use.

Meaningful performance headroom still exists:

1. **The shared Inventory controller remains large.** Protected eager routes still genuinely need it. Further extraction should happen only when a clean independent owner exists; backup/restore, profile sync, strategy editing, and Journal integration should not be split merely to make a file smaller.
2. **The global stylesheet remains broad.** `styles.css` is about 170 KiB raw. Future CSS gains should come from measured unused selectors and route ownership, not late overrides or duplicate route-specific copies.
3. **Magnet behavior is substantial.** `scripts/magnets.js` is about 62 KiB and intentionally shared because magnet persistence/physics is a core interaction. Profile parse/execution cost before splitting it arbitrarily.
4. **Dedicated feature surfaces are intentionally heavier.** Journal, Inventory, Need strategy editing, and Alexithymia Support own real interactive behavior. Their goal is not minimum bytes at any cost; it is to avoid unrelated capability and keep startup work aligned with visible function.

## Next performance work after live acceptance

Do not stack additional invasive packaging changes on this canary before its interaction contract is exercised on real devices. Once the canary is accepted, the next work should be measurement-led:

1. audit Observations and any remaining route classes independently before changing their startup graph;
2. profile real unused CSS by route before extracting stable CSS owners;
3. capture real-browser LCP, INP, CLS, long tasks, memory, and request waterfalls on cold and repeat phone/desktop loads;
4. consider deterministic minification and content-versioned assets with longer immutable cache lifetimes if real delivery measurements justify the added build complexity;
5. consider self-hosted/subset fonts only if external font delivery is materially limiting first paint;
6. continue decomposing `inventory.js` only at genuine capability boundaries.

There is no meaningful state where a non-trivial web app is "as efficient as humanly possible." The useful target is a measurable architecture in which each route receives the minimum work needed for its immediate function, while correctness, accessibility, persistence, and maintainability remain intact.
