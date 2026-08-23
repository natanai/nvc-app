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

## Mobile magnet-paint regression acceptance

Real-phone A/B testing isolated a rendering regression to the page-canonicalization boundary:

- immediately before canonicalization: page flash **no**, Feeling-art scroll flicker **no**;
- immediately after canonicalization: page flash **yes**, Feeling-art scroll flicker **yes**.

Canonicalization had begun inlining the full `styles/nav-critical.css`, which activated two previously dormant paint behaviors: a global hidden-until-`data-ready` magnet visibility gate and `background-attachment: fixed` on the root page. The Bedrock repair removes both behaviors at their canonical CSS owner.

The later compensating architecture is intentionally gone. Category hubs do not have a second compiler-owned saved-layout prepaint owner, generated hub magnets do not carry compiler-authored deterministic tilt/offset values, and Feeling art does not use a special GPU/compositor workaround. The normal magnet runtime remains the owner of hub saved-position restoration and handmade tilt/offset. Navigation alone retains its lightweight saved-layout prepaint path because that is part of the established shell contract.

Permanent regression tests now require that:

1. critical CSS does not hide the whole magnet board pending JavaScript readiness;
2. critical CSS does not install a fixed root background;
3. Feeling art uses the normal paint path without a compensating `translateZ(0)`/backface-visibility layer;
4. category hubs do not inline a second saved-position restore owner;
5. the magnet runtime remains the single owner of hub tilt and offset.

### Accepted mobile result — 2026-08-22

After the root-cause repair was published to `bedrock/production-finalization-v2`, repeat testing on the same mobile device no longer reproduced the page flash or Feeling-art scrolling flicker. This closes the mobile rendering regression itself as accepted. Saved-position persistence remains part of the broader persistence/browser acceptance checklist and should continue to be checked while finishing Bedrock.

The earlier root-scoped offline-cache canary has been retired because it made rapid real-device acceptance harder by putting Cache Storage in front of ordinary test-branch assets. A small retirement shim replaces any previously installed worker, removes only `allneeds-static-*` caches, and unregisters itself; Home also performs the same cleanup after load/idle as a belt-and-suspenders path.

## Rollout gate

Do not remove `scripts/inventory.js` from additional ordinary routes solely because Home's source-level tests pass. Expand this loading model only after the Home canary has passed the relevant browser acceptance checklist and each candidate route has been audited for route-specific immediate Inventory/controller behavior.
