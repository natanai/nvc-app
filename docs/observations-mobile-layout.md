# Observations mobile layout contract

`/observations/` keeps its established behavior and data hooks while using a dedicated phone presentation owner.

## Ownership

- `styles/observations-critical.css` remains the route-critical first-paint base used by the Observations compiler.
- `styles/observations-mobile.css` is the authoritative presentation layer for `/observations/` at `<= 640px`.
- `observations/index.html` parser-discovers `styles/observations-mobile.css` after `styles.css`, so the phone layout is resolved before paint rather than repaired by JavaScript.
- `scripts/nav-prepaint.mjs` remains the shared owner for responsive navigation-position prefill. The phone layout must not introduce a second navigation restore path.

## Phone presentation goals

The mobile page uses the available viewport instead of presenting the tool as a bordered card inside another bordered page. Safe-area-aware gutters preserve comfortable edge spacing while the main Observations surface removes the global page border, large outer shadow, and redundant side padding.

The editor follows an iOS-style grouped hierarchy: the observation text area remains primary; Quick check becomes one compact grouped list with 44–48px rows and separators; example/help disclosures become lightweight rows; coaching, match status, suggestions, and the guide use restrained one-pixel surfaces and compact spacing instead of stacked heavy cards and shadows.

## Non-negotiable behavior

The density layer must not rename/remove existing DOM hooks or change observation analysis, matching, example insertion, Quick check state, suggestion behavior, guide behavior, dialogs, Journal conversion, or navigation magnets. Touch targets remain at least 44px where controls are interactive.

Permanent coverage lives in `tests/shared-density-polish.test.mjs`, including parser discovery, full-width phone ownership, grouped Quick check rows, disclosure treatment, minimum touch target sizing, and the ban on `!important` patch chains.
