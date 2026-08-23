# Observations mobile layout contract

`/observations/` keeps its established behavior and data hooks while using a dedicated phone presentation owner.

## Ownership

- `styles/observations-critical.css` remains the route-critical first-paint base used by the Observations compiler.
- `styles/observations-mobile.css` is the authoritative presentation layer for `/observations/` at `<= 640px`.
- `observations/index.html` parser-discovers `styles/observations-mobile.css` after `styles.css`, so the phone layout is resolved before paint rather than repaired by JavaScript.
- `scripts/nav-prepaint.mjs` remains the shared owner for responsive navigation-position prefill. The phone layout must not introduce a second navigation restore path.

## Phone presentation goals

The mobile page uses the available viewport instead of presenting the tool as a bordered card inside another bordered page. Safe-area-aware gutters preserve comfortable edge spacing while the main Observations surface removes the global page border, large outer shadow, and redundant side padding.

The editor follows an iOS-style grouped hierarchy: the observation text area remains primary; Quick check becomes one compact grouped list with 44–48px rows and separators; example/help disclosures become lightweight rows; coaching, match status, suggestions, and the guide use restrained one-pixel surfaces and compact spacing instead of stacked heavy cards and shadows. Results keep the submitted observation to a two-line context preview, use a compact status/action row, render the Unmet/Met choice as a native-style segmented control, and keep Needs, Feelings, rationale, and recipe surfaces visually quiet.

The highlight layer is paint-only: highlighted text is explicitly transparent (including WebKit text fill), while the visible textarea remains the sole text owner. Highlight/formula overlays are programmatically scrollable with hidden scrollbars, and the editor re-synchronizes them after formula markup is rendered so iOS textarea scrolling cannot expose a duplicated or offset second copy of highlighted text.

## Detector delivery resilience

The generated `data/observation_cue_modules.json` artifact is sufficient to preserve exact-match detection and its feeling/need suggestions even if the supplemental cue-row CSV cannot be delivered. The CSV still enriches cue-level and nearby/fallback behavior when available. Runtime loading treats those assets independently instead of allowing one failed fetch to silently zero the entire detector. The built-in example is a permanent regression fixture and must produce at least one exact module hit under the normal runtime limits.

`tests/observation-suggest.test.mjs` now exercises both the full cue library and module-artifact-only path, and it runs inside `npm run test:data-integrity` so normal Site Quality checks protect this runtime contract rather than leaving it as an optional standalone test.

## Non-negotiable behavior

The density layer must not rename/remove existing DOM hooks or change observation analysis, matching, example insertion, Quick check state, suggestion behavior, guide behavior, dialogs, Journal conversion, or navigation magnets. Touch targets remain at least 44px where controls are interactive.

Permanent coverage lives in `tests/shared-density-polish.test.mjs`, including parser discovery, full-width phone ownership, grouped Quick check rows, disclosure treatment, minimum touch target sizing, the overlay paint/scroll synchronization contract, compact result actions, segmented Unmet/Met ownership, and the ban on `!important` patch chains.

Live-device acceptance should include a filled observation long enough to scroll inside the textarea: scroll it repeatedly on iOS, confirm the green highlights stay aligned without duplicated text, then load matches and verify the compact result controls remain fully tappable.

Current CI checkpoint for this refinement: Site Quality run 676 passed the full canonical build, zero-diff generated-artifact check, performance budgets, navigation/flicker contracts, and the permanent interaction regressions.
