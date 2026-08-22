# Bedrock Home runtime canary

The Home route is the first ordinary content route on the Bedrock branch that does not parser-load the large shared `scripts/inventory.js` controller.

This is deliberately a canary, not a catalog-wide rollout. Inventory and Need surfaces remain eager while Home is validated in real browsers.

## First-paint contract

Home must arrive with the same visible and persisted shell state it had before the controller was deferred:

- saved theme colors and roundness are applied before paint by the existing prepaint theme bootstrap;
- saved navigation visibility is restored by the existing nav bootstrap;
- saved navigation magnet locations are restored by the existing `magnetPositions:site-nav` prepaint path;
- the desktop floating Customizer `+` control exists in static HTML before runtime JavaScript upgrades it;
- mobile continues to use the nav Customizer control while CSS hides the desktop floating control;
- the Inventory-count badge is restored from the same `nvcApp.inventory` local-storage snapshot Home previously used when the Inventory store module was absent;
- Menu and magnet physics remain available on initial load.

## Runtime ownership contract

`scripts/shell-runtime-loader.js` is intentionally small. It may:

- restore the Home Inventory-count badge;
- warm/load the canonical classic `scripts/inventory.js` controller when an interaction needs a capability it owns;
- hold and replay direct Customizer, Journal, backup/restore, profile save/load, and personal-sharing activation until the canonical controller is ready;
- retire the abandoned Bedrock root service-worker/cache namespace on browsers that installed the earlier offline experiment.

It must not become a second implementation of Inventory, Journal, Customizer, account sync, restore, sharing, or static navigation caching behavior.

When `scripts/inventory.js` loads, `buildPaletteUi()` must adopt the already-rendered Home Customizer container and button rather than replacing the visible desktop control.

A script `load` event is not by itself proof that the controller is ready. If `inventory.js` executes while the document is still parsing, its initializer intentionally waits for `DOMContentLoaded`. The Home intent loader therefore must not replay a held activation until that DOM initialization boundary has passed. This protects very early taps/clicks from reaching Customizer, Journal, or Menu-owned actions before their canonical listeners exist.

## Browser acceptance checklist

Before applying the same loading model to more routes, verify Home on both desktop and phone with normal browsing as well as saved state:

1. Home first paint looks unchanged; no Customizer, nav, theme, or magnet-position pop-in is visible.
2. Desktop floating Customizer `+` is present immediately and opens on the first activation, including a very fast first click/tap during initial page load.
3. Mobile nav Customizer opens on the first activation; there is no extra floating desktop control on phone.
4. A saved custom palette and unusual roundness appear correctly before and after reload/navigation.
5. Saved optional nav magnets remain shown/hidden correctly before and after reload.
6. Move nav magnets to obvious positions, reload, navigate away/back, and verify the locations persist.
7. The Inventory badge matches the saved Inventory count.
8. Menu opens normally without first loading the Inventory controller merely because the Menu was opened.
9. Menu → Journal works on the first activation.
10. Menu → Account & data opens normally; backup download, backup restore, profile save, and profile load still reach their canonical handlers.
11. From Nat → personal-strategy sharing still reaches the canonical exporter/email flow.
12. Magnet dragging, physics toggle, shuffle, and supported tilt behavior remain unchanged.
13. Watch specifically for any control that appears, disappears, shifts, or becomes enabled only after a noticeable second-stage correction.

Any visible, interaction, persistence, or conditional-behavior difference from the pre-canary Home should be treated as a regression unless separately approved.

## Magnet object-permanence acceptance

The Feelings, Needs, and Faux Feelings hubs now use the same compiler-owned prepaint persistence path as navigation magnets. A saved hub layout is restored before the normal magnet module reveals the board, generated hub magnets have deterministic tilt/offset values, and runtime hydration preserves those authored values rather than replacing them with a new random pose.

On phone, verify this specifically:

1. Move several Feelings and Needs magnets to unmistakable positions, leave the page, return, and reload. The first visible frame should already show the saved positions; there should be no tiny seed-layout flash or second-stage pose change.
2. Scroll the Feelings hub repeatedly with normal and momentum scrolling. The illustrated SVG art inside the magnets should remain continuously painted rather than blinking while the magnet shell remains visible.
3. Repeat the scroll check after toggling magnet physics on and off and after a shuffle.
4. Verify the page background still looks intentional on phone. Touch-first devices intentionally use a scrolling root background rather than the desktop fixed-root treatment to avoid full-page mobile recomposition during momentum scrolling.
5. Verify Needs and Faux Feelings retain stable labels/poses and saved positions even though they do not use the Feeling illustration layer.

The earlier root-scoped offline-cache canary has now been retired because it made rapid real-device acceptance harder by putting Cache Storage in front of ordinary test-branch assets. A small retirement shim replaces any previously installed worker, removes only `allneeds-static-*` caches, and unregisters itself; Home also performs the same cleanup after load/idle as a belt-and-suspenders path. On a phone that installed the old canary, allow one ordinary Home load and reload before judging this rendering milestone so stale cached CSS/JS is not part of the comparison.

## Rollout gate

Do not remove `scripts/inventory.js` from additional ordinary routes solely because Home's source-level tests pass. Expand this loading model only after the Home canary has passed the browser acceptance checklist and each candidate route has been audited for route-specific immediate Inventory/controller behavior.
