# Bedrock route/runtime ownership matrix

This matrix records which route classes require the large shared `scripts/inventory.js` controller at parser first load and which use the smaller intent-loaded shell model.

The purpose is to prevent performance work from treating every page as interchangeable. A route may defer the shared controller only when its first-paint UI, persisted presentation state, and immediately usable route features do not depend on that controller.

The merged `inventory-core-overhaul` branch remains the Bedrock production baseline. The branch `performance/immediate-response-v1` is a post-Bedrock live-device canary: it expands the already proven Home/Feed intent-loader contract to additional content routes without changing the protected eager routes. It must pass phone and desktop acceptance before merge.

## Classification meanings

- **Eager / protected** — keep `inventory.js` parser-loaded because an immediately visible feature still depends on it.
- **Intent-loaded canary** — `inventory.js` is absent from parser first load. `scripts/shell-runtime-loader.js` loads it only for owned shell intent such as Customizer, Journal, Account & data, backup/restore, profile, or sharing.
- **Audit required** — route has enough independent functionality that its startup dependencies need a dedicated pass before classification.

## Current performance-canary matrix

| Route class | Current status | Why |
| --- | --- | --- |
| `/` Home | **Intent-loaded canary** | Static theme/nav/magnet state and the Customizer shell arrive before paint. The small loader restores the Inventory count and loads the canonical controller only when a controller-owned action is requested. |
| `/feed/` Shared Strategies | **Intent-loaded canary** | Public feed browsing and route session behavior are route-owned. Controller-owned shell actions remain intent-loaded. |
| Feelings index | **Intent-loaded canary** | The hub's visible work is generated content, search/magnets, navigation, and persisted magnet state. Those owners remain eager; the shared Inventory controller is shell-only here. |
| Needs index | **Intent-loaded canary** | The index is a generated magnet/search hub and does not expose the Need-detail personal-strategy editor. Do not infer this status onto Need detail pages. |
| Faux Feelings index | **Intent-loaded canary** | The hub's visible content and magnet interactions remain eager while shell-only Inventory capabilities are deferred. |
| Feeling detail pages (`/feelings/<slug>/`) | **Intent-loaded canary** | Static feeling content, magnets, and `scripts/feeling-reverse-inference.js` remain eager. The shared Inventory controller is loaded only for explicit shell capabilities. |
| Faux-feeling detail pages (`/faux-feelings/<slug>/`) | **Intent-loaded canary** | Static content and feeling/need magnets remain eager. No immediately visible Inventory-owned editor is present. |
| Body Cues | **Intent-loaded canary** | `scripts/body-cues-tool.js`, Body Cues CSS, magnets, and the shared shell remain eager. Source and regression audits found no primary Body Cues interaction owned by `inventory.js`. |
| `/inventory/` | **Eager / protected** | The page is the Inventory workspace itself; its visible views, filters, editing, counts, and strategy behavior are controller-owned. |
| `/inventory/journal/` | **Eager / protected** | Dedicated Journal is an explicit eager owner. Its store/module ordering is intentionally declared rather than inherited globally. |
| Need detail pages (`/needs/<slug>/`) | **Eager / protected** | They visibly expose the personal strategy form and save/profile behavior on first load. Deferring the controller would make visible controls temporarily inert. |
| Alexithymia Support | **Eager / protected for Journal capability** | This route directly consumes Journal APIs and remains an explicit eager exception to the ordinary lazy-Journal model. |
| Observations | **Audit required** | It has a substantial independent editor/guide system. The shared controller may be shell-only, but strategy/profile/Journal integration needs a focused route audit before changing its startup graph. |

## Preserved interaction contract

The performance canary changes ownership of startup work, not product behavior:

- `scripts/inventory-core-shell.js` stays eager so Menu/navigation shell behavior remains immediately available.
- `scripts/magnets.js` stays eager on magnet routes so dragging, physics, persistence, tilt, and saved layouts keep their established owner.
- Feeling reverse inference stays eager on Feeling detail pages.
- Body Cues keeps its dedicated route runtime eager.
- `scripts/shell-runtime-loader.js` captures/warm-loads the canonical Inventory controller for Customizer, Journal, Account & data, backup/restore, profile, sharing, import/export, and related shell actions, then replays an early interaction after controller initialization when necessary.
- Need detail, Inventory, dedicated Journal, and Alexithymia Support remain eager because they expose controller-owned features immediately.

Permanent runtime tests protect those distinctions. Performance budgets additionally require the newly intent-loaded content routes to remain at or below 40% of the representative eager Need-detail direct-JavaScript graph.

## Live acceptance rule

Before this canary can become production truth, test representative routes on both phone and desktop. At minimum verify:

1. Feelings, Needs, and Faux Feelings hubs: search, magnets, saved layouts, Menu, and Customizer first activation.
2. One Feeling detail: magnets, reverse-inference disclosure, Menu, Customizer, Journal, and Account & data.
3. One Faux Feeling detail: magnets plus the same shared-shell actions.
4. Body Cues: region/option interaction, possible-feelings results, mobile pin behavior, Menu, Customizer, and Journal access.
5. Protected routes: one Need detail personal-strategy form, Inventory, dedicated Journal, and Alexithymia Support to confirm they remain fully eager and unchanged.

A source-level green build is necessary but does not replace this real-device acceptance boundary.

## Architectural destination

The long-term goal is not to make `inventory.js` lazy everywhere. It is to make it unnecessary as a global monolith by extracting stable ownership boundaries:

- tiny pre-paint/persisted presentation bootstrap;
- global shell/Customizer/navigation state;
- Inventory/strategy feature runtime;
- Journal feature runtime;
- account/restore/share capabilities;
- route-specific feature modules.

Until those seams are fully extracted, route-selective eager vs. intent-loaded ownership is the safe architecture.
