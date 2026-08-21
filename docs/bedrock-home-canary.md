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
- hold and replay direct Customizer, Journal, backup/restore, profile save/load, and personal-sharing activation until the canonical controller is ready.

It must not become a second implementation of Inventory, Journal, Customizer, account sync, restore, or sharing behavior.

When `scripts/inventory.js` loads, `buildPaletteUi()` must adopt the already-rendered Home Customizer container and button rather than replacing the visible desktop control.

## Browser acceptance checklist

Before applying the same loading model to more routes, verify Home on both desktop and phone with normal browsing as well as saved state:

1. Home first paint looks unchanged; no Customizer, nav, theme, or magnet-position pop-in is visible.
2. Desktop floating Customizer `+` is present immediately and opens on the first activation.
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

## Rollout gate

Do not remove `scripts/inventory.js` from additional ordinary routes solely because Home's source-level tests pass. Expand this loading model only after the Home canary has passed the browser acceptance checklist and each candidate route has been audited for route-specific immediate Inventory/controller behavior.
