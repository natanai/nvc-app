# Architecture map

This is the shortest route from a visible feature to its canonical owner.

| Area | Markup/data owner | Presentation owner | Behavior owner |
| --- | --- | --- | --- |
| Shared navigation | `scripts/build-pages.mjs`; marked hand-owned routes are synchronized by the same compiler | `styles/nav-critical.css` plus shared `styles.css` | `scripts/nav-prepaint.mjs`, `scripts/magnets.js`, and Customizer state in `scripts/inventory.js` |
| Menu and account shell | `scripts/inventory-core-shell.js` | `styles/inventory-core-shell.css` | `scripts/inventory-core-shell.js`; optional account work loads through `scripts/inventory-bluesky.js` |
| Vocabulary and detail pages | canonical sources under `data/` | shared CSS and generated icon CSS | route-specific modules declared by `scripts/build-pages.mjs` |
| Observations | `scripts/observation-guide.mjs` and observation data compilers | `styles/observations.css` | `assets/js/observation-editor.js` |
| Inventory | `scripts/build-pages.mjs` | `styles.css` and `styles/inventory-mobile.css` | `scripts/inventory.js` and `scripts/inventory-store.js` |
| Journal | `scripts/build-pages.mjs` | shared Journal rules in `styles.css` / `styles/shared-density.css` | `assets/js/journal/store.js` and `assets/js/journal/module.js` |
| Alexithymia Support | hand-owned `alexithymia-support/index.html`, with shared navigation synchronized by the compiler | shared styles plus route rules in `styles.css` | `scripts/alexithymia-support.js`, data, and logic modules |
| Shared Strategies | hand-owned `feed/index.html`, with shared navigation synchronized by the compiler | shared styles | `scripts/strategy-feed.js` |

## Tracked-file classifications

- **Canonical source:** data CSV/JSON, compiler templates, hand-owned route content, shared CSS, and browser modules.
- **Generated deployment output:** vocabulary HTML, compiled observation data, evidence exports, and generated icon CSS/assets. These remain committed because the production site is static.
- **Tests:** every `tests/*.test.mjs` file is automatically included by `npm run test:all` and Site Quality.
- **Compatibility support:** `service-worker.js` is a fetch-free retirement shim for browsers that installed the former worker. `scripts/inventory-legacy-journal-redirect.js` preserves the old `#journal-dashboard` URL. Remove either only after its documented support window closes.
- **Historical documentation:** files labelled historical in `docs/README.md` record why current contracts exist; they are not current branch or release instructions.

## Large owners

`scripts/inventory.js`, `scripts/build-pages.mjs`, and `styles.css` are large but active. Split them only along the explicit capability and route seams in `docs/bedrock-inventory-controller-seams.md`. A smaller file count or line count is not sufficient reason to introduce cross-module state or another presentation owner.
