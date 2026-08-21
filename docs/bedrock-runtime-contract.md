# Bedrock runtime contract — full-pass v1

This branch is a behavior-preserving architecture pass. The live `inventory-core-overhaul` branch is the visual and interaction baseline. Bedrock work may make loading and ownership simpler, but it must not silently remove behavior because that behavior is dormant on a default page load.

## Protected runtime contracts

The following are first-class app systems and must continue to work across refactors:

- **Customizer:** saved palette, presets, corner roundness, desktop/mobile trigger behavior, contrast handling, and tilt controls.
- **Navigation personalization:** saved visible/hidden magnets, including supplemental Faux Feelings, Body Cues, and Journal History magnets.
- **Persistent magnet layouts:** `magnetPositions:*` localStorage entries, stable magnet IDs, board height, play-state metadata, drag/shuffle persistence, and restoration on reload.
- **Pre-paint restoration:** saved theme, nav visibility, and nav magnet positions must be applied before the user sees a default state that later jumps into place.
- **Magnet physics:** play on/off state, dragging, shuffle, pointer behavior, optional device tilt, and permission-denied/unsupported paths.
- **Inventory and strategies:** local inventory data, filters, editing, import/export, and strategy save targets.
- **Journal:** journal storage, overlay/history paths, and legacy navigation handling.
- **Profile/backup restoration:** a full saved snapshot is authoritative. Replacing localStorage must synchronize the Customizer's `nvcApp.theme` and `nvcApp.navSettings` sessionStorage mirrors before the running page rehydrates, and successful full restore must restart before live magnet state can overwrite imported positions.
- **Automatic post-sign-in restore:** Bluesky sign-in may not use a weaker restore path than the explicit “Load saved profile” action. The same restore guard must be installed before the automatic backend snapshot is applied.
- **Account/Bluesky paths:** disconnected, sign-in, callback, backend save/load, and shared-strategy behavior remain available even when hidden from the main Inventory surface.

## Architecture rule

Use static/parser-discovered HTML and CSS whenever the correct result is deterministic from the route/build. Keep runtime code where the correct result genuinely depends on persisted user state, permissions, authentication, device capabilities, or interaction.

A feature is not dead merely because it is invisible in the default state. Before removing runtime code, identify its caller, activation condition, persisted state, and restoration path.

### Full-snapshot transaction invariant

A full profile/backup restore is one storage transaction, not a sequence of loosely related UI repairs. The snapshot replacement owner must leave localStorage and any sessionStorage mirrors coherent *before* the current document reads restored presentation state. Page-specific repaint workarounds are not an acceptable substitute for completing that transaction at its source.

The canonical implementation is `importLocalStorageSnapshot()` in `scripts/inventory.js`: after localStorage replacement succeeds, it synchronizes the restored theme/navigation mirrors before `refreshStateFromLocalStorageSnapshot()` reads them. The post-sign-in path also installs and verifies the existing full-restore guard before invoking the backend profile loader, so automatic and explicit profile loads share the same magnet/reload safety boundary.

## Full-pass v1 changes

- Inventory phone CSS is linked statically by the generator after shared/base Inventory styles.
- The old JavaScript stylesheet injection for Inventory and Body Cues is removed from the pre-paint contrast utility.
- Duplicate/obsolete <=640px Inventory presentation rules are removed from the generator and shared shell so `styles/inventory-mobile.css` has one clear phone-layout ownership boundary.
- Existing desktop Inventory rules, Customizer code, nav bootstrap, saved magnet restoration, Journal/Inventory data, restore handling, and conditional account features are intentionally left functionally unchanged.
- Source tests now enforce parser-discovered route CSS and the protected persisted-state namespaces/integration points.

## Manual phone acceptance checklist

When this branch is published, compare it directly with the legacy/live branch. The goal is *identical behavior and appearance, with less loading/correction underneath*.

1. Open Home, Feelings, Needs, Body Cues, Inventory, Journal, and Shared strategies.
2. Open/close the Customizer; change colors and corner roundness; reload and navigate between pages. The chosen theme must persist without a visible default-theme flash.
3. Change which navigation magnets are visible, including at least one supplemental magnet; reload and navigate. Visibility must persist without a visible hide/show correction.
4. Drag several nav magnets to obvious locations. Reload the same page, navigate away/back, and revisit after changing orientation/viewport size. Positions must persist sensibly.
5. Toggle magnet physics on/off, move/shuffle magnets, reload, and verify the expected play/layout state remains coherent.
6. If available on the device, exercise tilt permission (allow and deny paths) and confirm the Customizer status remains correct.
7. On Inventory mobile, compare title, Add strategy action, Needs/Strategies tabs, filters, empty/filled need rows, scrolling, and tap targets with the legacy branch.
8. Add/edit a strategy, search/filter it, export/import data, and verify Inventory counts update.
9. Open Journal and verify existing entries/history and new-entry behavior.
10. If using profile/Bluesky features, verify sign-in/account data controls and a restore path. The saved palette/roundness/nav state must reconcile on the callback/current page rather than waiting for a later navigation, and restored magnet state must survive the restore restart.
11. Watch specifically for any first-paint jump: theme flash, nav magnet visibility flash, magnet layout jump, Inventory mobile restyling after load, or Body Cues restyling after load.

Any difference in pixels, interaction, stored state, or conditional behavior is a regression unless it is explicitly approved as a separate product change.

## Deferred, intentionally not attempted in v1

The largest remaining performance opportunity is separating the genuinely global app shell (Customizer/navigation/persistence integration) from feature-specific portions of the very large `scripts/inventory.js`. That split should happen only after this Bedrock branch has been exercised against the activation paths above; it should be an extraction with compatibility tests, not a deletion-by-default-state audit.
