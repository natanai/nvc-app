# Bedrock route/runtime ownership matrix

This matrix records which route classes currently require the large shared `scripts/inventory.js` controller at first load and which are candidates for the Home/Feed intent-loaded model.

The purpose is to prevent a performance refactor from treating every page as interchangeable. A route may defer the shared controller only when its first-paint UI, persisted presentation state, and immediately usable route features do not depend on that controller.

## Classification meanings

- **Eager / protected** — keep `inventory.js` parser-loaded until the immediate feature that owns it has been extracted or replaced by an equivalent deterministic owner.
- **Lazy canary** — controller is intentionally absent from first load and restored on owned interaction intent; requires browser acceptance before the model is expanded further.
- **Likely lazy candidate** — source inspection shows no obvious immediate controller-owned feature, but the route still needs browser/state audit before migration.
- **Audit required** — route has enough independent functionality that its startup dependencies need a dedicated pass before classification.

## Current matrix

| Route class | Current status | Why |
| --- | --- | --- |
| `/` Home | **Lazy canary** | Static theme/nav/magnet state and desktop Customizer shell are present before paint. A small loader restores the Inventory count and loads the canonical controller only for Customizer, Journal, Account/data, backup/restore, profile, or sharing intent. |
| `/feed/` Shared Strategies | **Lazy canary** | Feed browsing, public strategy loading, signed-out behavior, and its own route session work do not require the shared controller. Controller-owned shell actions are intent-loaded. |
| `/inventory/` | **Eager / protected** | The page is the Inventory workspace itself; its visible views, filters, editing, counts, and strategy behavior are controller-owned. |
| `/inventory/journal/` | **Eager / protected** | Dedicated Journal is an explicit eager owner. Its store/module ordering is intentionally declared rather than inherited globally. |
| Need detail pages (`/needs/<slug>/`) | **Eager / protected** | They visibly expose the personal strategy form and save/profile behavior on first load. Deferring the controller would make an already-visible feature temporarily inert. |
| Feeling detail pages (`/feelings/<slug>/`) | **Likely lazy candidate** | Representative pages are primarily static content + magnets + route-specific reverse inference. No visible Inventory strategy form was found in the representative detail-page audit. |
| Faux-feeling detail pages (`/faux-feelings/<slug>/`) | **Likely lazy candidate** | Representative pages are static content and feeling/need magnet boards; the shared controller appears to serve shell capabilities rather than the page's primary feature. |
| Alexithymia Support | **Eager / protected for Journal capability** | This route directly consumes Journal APIs and remains an explicit eager exception to the ordinary lazy-Journal model. |
| Body Cues | **Audit required / likely candidate** | Its page feature has dedicated static CSS and route JS, but its full interaction/state relationship with the shared controller must be checked before migration. |
| Observations | **Audit required** | It has a substantial independent editor/guide system. The shared controller may be shell-only here, but the route needs a focused check for strategy/profile/Journal integration before classification. |
| Feelings index | **Audit required / likely candidate** | Audit independently from Feeling detail pages; index-level controls may differ. |
| Faux Feelings index | **Audit required / likely candidate** | Audit independently from faux-feeling detail pages. |
| Needs index | **Audit required** | Do not infer behavior from Need detail pages or vice versa; inspect index-specific controls before changing script ownership. |

## Rollout rule

The Home canary is the browser-acceptance gate for ordinary generated pages. Do not bulk-remove `inventory.js` from Feeling/Faux Feeling or other candidate route classes solely because source-level tests are green.

After Home passes real desktop/mobile acceptance:

1. migrate one representative Feeling detail page through the generator;
2. verify first paint, Customizer first activation, Journal, Account/data, persisted nav state, magnet positions, physics/tilt, and route-specific reverse inference;
3. if clean, apply the same explicit generator capability to the Feeling detail class;
4. repeat independently for Faux Feeling details and other candidate classes;
5. keep Need detail, Inventory, dedicated Journal, and any other route with immediately visible controller-owned features eager until those features have a smaller explicit owner.

## Architectural destination

The long-term goal is not to make `inventory.js` lazy everywhere. It is to make it unnecessary as a global monolith by extracting stable ownership boundaries:

- tiny pre-paint/persisted presentation bootstrap;
- global shell/Customizer/navigation state;
- Inventory/strategy feature runtime;
- Journal feature runtime;
- account/restore/share capabilities;
- route-specific feature modules.

Until those seams are fully extracted, route-selective eager vs. intent-loaded ownership is the safe intermediate architecture.
