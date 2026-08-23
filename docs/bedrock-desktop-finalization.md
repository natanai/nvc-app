# Bedrock desktop finalization

The final desktop acceptance pass exposed four viewport/consistency defects that are now part of the Bedrock ownership contract rather than one-off presentation fixes.

## Dedicated Journal hierarchy

The generated Journal markup already places **Patterns** before **Backup & restore**. An obsolete desktop `grid-template-areas` rule from an older Journal layout was overriding that semantic order. The old named-grid arrangement and the dedicated Journal's two-column utility layout are retired. The browser now follows the canonical generated order on desktop as well as mobile: History, Patterns, Backup & restore, then the fallback editor.

## Responsive magnet persistence

Magnet positions are layout geometry, not a device-independent preference. Mobile and desktop therefore persist separate position payloads using the same canonical logical magnet board with responsive storage buckets (`@mobile` and `@desktop`). The prepaint restore path and runtime magnet controller use the same breakpoint and keys so saved layouts are restored before paint without cross-viewport contamination.

Existing unscoped layouts are migrated once into the first form factor that encounters them. Bluesky/profile snapshots already collect every `magnetPositions:` localStorage record, so the two responsive layouts travel together through the existing profile/backup path without a second synchronization system or backend schema.

## Body Cues pin ownership

The Body Cues pin action controls the compact sticky results shelf and only has a useful role on the phone layout. Its default hidden state now lives in the always-loaded Body Cues stylesheet; the mobile-only stylesheet explicitly enables it inside the phone breakpoint. Desktop no longer renders a visually broken no-op pin control.

## Shared Needs catalog selector

Journal and strategy forms now use one shared Needs catalog multi-select implementation in `assets/js/catalog-multiselect.js`. It owns the trigger, searchable popup, multi-selection, Clear/Done controls, summary text, and interaction behavior.

The Journal uses a hidden input as its data transport. Strategy forms use a hidden native multiple-select so their existing `FormData`, edit, and serialization contracts remain intact. The hidden transport is not a second UI: the visible selector and its behavior come from the same shared component in both contexts. Generated strategy pages serialize that final selector markup directly; runtime JavaScript only hydrates the shared interaction controller.

## Permanent regression boundary

`tests/desktop-bedrock-finalization.test.mjs` rejects regressions in all four areas:

- Patterns must precede Backup & restore without obsolete desktop grid-area reordering;
- mobile and desktop magnet persistence must use separate keys in both prepaint and runtime paths while remaining part of profile snapshots;
- Body Cues pin must be mobile-only at canonical CSS owners;
- Journal and strategy forms must share the same Needs catalog component, and the old Ctrl/Command native multi-select instruction must stay retired.

These fixes are part of the Bedrock merge boundary. Desktop acceptance should recheck exactly these surfaces before the production-finalization PR is merged into `inventory-core-overhaul`.
