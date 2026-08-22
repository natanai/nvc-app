# Bedrock Inventory controller ownership seams

`scripts/inventory.js` is still the largest shared browser controller in allneeds.app. Bedrock should make it smaller by moving independently owned behavior to explicit route or capability runtimes, not by splitting the file arbitrarily.

This document records the ownership seams visible in the current controller and the safe extraction order. It complements `docs/bedrock-route-runtime-matrix.md`: route-level lazy loading remains gated on browser acceptance, while internal ownership extraction can proceed when behavior is unchanged and regression coverage is strong.

## Already outside the monolith

Several responsibilities that used to be implicitly global already have smaller owners:

- shared Menu markup, navigation, Account & data shell, and menu activation: `scripts/inventory-core-shell.js`;
- optional Bluesky/account loading: `scripts/inventory-bluesky.js` + `scripts/inventory-bluesky-runtime.js`;
- profile restore/reload protection: `scripts/profile-restore-rehydration.js`;
- dedicated Journal store/model: `assets/js/journal/store.js` and `assets/js/journal/module.js`;
- Home/Feed controller intent loading: `scripts/shell-runtime-loader.js` and the Shared Strategies route loader;
- magnet persistence/physics: `scripts/magnets.js`;
- Body Cues and feeling reverse inference: route-specific modules.

## Remaining seams inside `inventory.js`

### 1. Need-page strategy deck — route-owned, extraction-ready

The tail of `inventory.js` is a self-contained IIFE for `[data-strategy-deck]` / `[data-strategy-stack]`. It owns only:

- initial card shuffle and active/previous/next positioning;
- previous/next/shuffle controls;
- “View all” mode;
- card-body overflow shadow hints;
- pointer swipe behavior and the guard that prevents deck gestures from stealing clicks from buttons/links/form controls.

It does not read or write the shared Inventory state object, persistence, profile state, Journal state, Customizer state, or account state. This is the first extraction target: `scripts/strategy-deck.js`, loaded only by generated Need detail pages.

### 2. Legacy Journal URL redirect — shell/navigation concern

The `#journal-dashboard` redirect is independent from Inventory data. It can move out after the first extraction, but its execution timing should remain before the Inventory initializer becomes active. Treat this as a navigation-compatibility move, not a cleanup-only deletion.

### 3. Account/data operations — capability owner

The shared Menu shell already invokes account/data actions through explicit `window` capability functions. The controller still implements the underlying backup/import/export, backend snapshot, and personal-strategy sharing actions. Those functions are candidates for a dedicated Account & data runtime loaded on intent, provided restore-transaction and magnet-pause invariants stay at the canonical restore boundary.

This seam should reduce ordinary controller work without changing the Menu shell itself.

### 4. Customizer + navigation settings — global shell owner

Theme palette state, roundness, optional navigation magnets, and their mirrored storage helpers are shell-level state rather than Inventory-workspace state. They remain tightly coupled inside `inventory.js` today.

Do not extract these by merely moving code into another always-loaded file. The useful destination is a smaller explicit shell/Customizer owner that:

- adopts the statically rendered Customizer control rather than replacing it;
- preserves first-paint theme/nav restoration;
- keeps localStorage/sessionStorage mirror selection semantics;
- preserves tilt/physics integration;
- works with Home/Feed early-intent replay.

Because this seam affects first paint and persisted presentation, browser acceptance is more important here than for the strategy deck.

### 5. Journal integration shell — separate from Journal data model

The Journal data store/model is already modular, but `inventory.js` still coordinates the global Journal panel, edit-location handling, and shell controls. Keep the distinction clear:

- Journal storage/model belongs to the Journal modules;
- global open/close/edit-shell behavior is a shell capability;
- dedicated Journal and Alexithymia Support remain explicit eager owners until their visible behavior has an equivalent smaller owner.

### 6. Inventory/strategy workspace — keep in the feature runtime

The following belong together until a later feature-level split has a concrete benefit:

- personal strategy persistence and normalization;
- Need↔strategy association/backfill;
- Inventory workspace views, filters, counts, search, expansion state, edit/delete actions;
- Need-page save-to-device/profile buttons and their synchronization with saved state.

This is the actual Inventory feature. Moving these functions merely to reduce file size would create cross-module state coupling without reducing route ownership.

## Extraction rules

For each extraction:

1. identify a block with no hidden dependency on the shared `state` object, or define a narrow explicit capability boundary first;
2. preserve script/init timing intentionally;
3. keep generated-page ownership explicit in `build-pages.mjs` rather than adding scripts by post-processing output;
4. regenerate only the compiler scopes/routes that actually own the new runtime;
5. reject collateral generated paths;
6. add a regression that asserts the old monolith no longer owns the extracted behavior and the correct route does;
7. run Site Quality and require the full authoring build to remain zero-diff.

## Order of work

Current safe order:

1. **Need strategy deck** — source-level independence is already demonstrated.
2. **Legacy Journal redirect** — small navigation compatibility seam; preserve timing.
3. **Account/data capability implementation** — after mapping the existing exported `window` contract and restore tests.
4. **Customizer/navigation settings** — after real-device Home canary acceptance because it touches first-paint/persisted presentation state.
5. **Journal shell integration** — after dedicated Journal/Alexithymia behavior is independently covered.
6. **Inventory workspace internals** — only when a concrete smaller feature boundary emerges.

Route-class lazy expansion remains a separate decision. A successful internal extraction does not, by itself, authorize removing `inventory.js` from Feeling/Faux Feeling or other candidate routes before the Home canary passes browser/device acceptance.
