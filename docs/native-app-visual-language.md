# Native app visual language

allneeds.app uses an iOS-inspired native-app target for task-oriented screens. The goal is not to imitate Safari chrome or reproduce proprietary Apple assets. It is to use familiar platform conventions: clear hierarchy, grouped controls, restrained surfaces, predictable disclosure affordances, and comfortable touch targets.

This document defines the reusable visual grammar. It complements the broader product standard in `docs/ux-design-quality-bar.md` and the implementation rules in `docs/ux-audit-engineering-playbook.md`.

## Reference implementations

The existing Journal metadata groups and Inventory segmented controls are the reference implementations. New work should reuse their shared tokens and interaction structure before inventing a route-specific treatment.

- Grouped surfaces use a near-white/lavender background, a one-pixel low-contrast outline, and separators between rows.
- Interactive rows are at least 44px high; primary phone actions generally use 52px.
- Segmented controls use one shared capsule, a quiet tinted track, and a white selected segment with restrained elevation.
- Ordinary surfaces do not stack decorative shadows. Shadows are reserved for overlays, sheets, or selected state when depth communicates meaning.
- Secondary copy uses the shared soft-ink color at reduced contrast instead of a new tint for every section.

## Hierarchy

A screen should make the next useful action obvious. One task stage gets one dominant action. Completed actions become status or context rather than disabled buttons that continue to compete for attention. Help, examples, explanations, and research remain available below the primary task.

Use color to communicate content or meaning, not to give every container its own visual identity. Surfaces with the same interaction role should normally share the same background, border, radius, typography, and affordance.

## Grouped rows and disclosures

Disclosure rows use one trailing chevron: `›`. Closed points right; open rotates downward. Do not mix plus buttons, literal `v` glyphs, circled plus controls, and chevrons for equivalent expand/collapse behavior on the same screen. The row owns the visible surface; opened content stays within that surface behind a one-pixel separator instead of becoming a second nested card.

Top-level optional learning sections may include a short secondary label such as “Optional context,” but the action or title remains the strongest text in the row.

## Buttons and state

Use sentence case for task actions. Primary actions can span the available phone width when they are the clear next step. After completion, remove that primary emphasis and expose only useful follow-up actions. Destructive or reset actions such as Clear should be visually secondary unless data-loss risk requires stronger treatment.

Do not use a disabled primary button as a persistent status badge. Use compact metadata or plain status text instead.

## Overlay and sheet dismissal

Every modal, popover, full-screen sheet, or long scrolling menu has one clearly labelled close control with a minimum 44px touch target. The control belongs to a non-scrolling or sticky header so it remains available throughout the content on phone and desktop. Do not make a user scroll back to the beginning to leave an overlay.

An opener may change visual state while its overlay is active, but it must not become a second competing close button beside the overlay's own close control. When an anchored desktop launcher would remain visible immediately beside the open sheet, hide that launcher until the sheet closes. Escape and backdrop dismissal remain useful secondary paths, not substitutes for the visible close control.

## Typography

Phone page titles use the compact, non-uppercase app-screen treatment established on Inventory. Section labels may use the small uppercase grouped-section style. Row titles and action labels use sentence case. Do not introduce a new display treatment for every component.

## Ownership

Shared foundations live in shared stylesheet owners. A complex route may have one route-specific presentation file when needed, but it must not split one screen across a critical stylesheet, a mobile repair stylesheet, and browser-side cosmetic mutation. Responsive rules belong in that route owner.

For Observations, `styles/observations.css` is the sole route-specific presentation owner. Shared navigation remains independently owned by the shared navigation CSS and prepaint contract. Runtime JavaScript owns state and interaction lifecycle, not deterministic styling.

## Review checklist

Before accepting a phone UI change, verify: one obvious next action; 44px minimum touch targets; one disclosure grammar; one segmented-control grammar; grouped rows rather than card-on-card nesting; restrained color and shadow; sentence-case actions; no runtime cosmetic mutation; and one named canonical style owner for route-specific presentation.
