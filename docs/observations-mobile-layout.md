# Observations mobile layout contract

`/observations/` keeps its established behavior and data hooks while using a dedicated phone presentation owner.

## Ownership

- `styles/observations-critical.css` remains the route-critical first-paint base used by the Observations compiler.
- `styles/observations-mobile.css` is the authoritative presentation layer for `/observations/` at `<= 640px`.
- `observations/index.html` parser-discovers `styles/observations-mobile.css` after `styles.css`, so the phone layout is resolved before paint rather than repaired by JavaScript.
- `scripts/nav-prepaint.mjs` remains the shared owner for responsive navigation-position prefill. The phone layout must not introduce a second navigation restore path.
- `assets/js/observation-editor.js` owns interaction state such as editing/results mode, match loading, fallback progression, highlight synchronization, and result provenance. It must not become a cosmetic layout owner.

## Phone presentation goals

The mobile page uses the available viewport instead of presenting the tool as a bordered card inside another bordered page. Safe-area-aware gutters preserve comfortable edge spacing while the main Observations surface removes the global page border, large outer shadow, and redundant side padding.

The primary task path is intentionally simple: **write the observation → Load matches → review results**. On phones, the parser-discovered layout places the Load matches action directly after the observation field. Quick check, examples, recipe guidance, and other coaching remain available below as secondary support instead of sitting between the observation and its primary action.

Before matches are loaded, the results heading, Clear action, Unmet/Met control, and exact/nearby provenance do not compete for attention. After Load matches, the result section moves naturally into the same place in the flow, with the submitted observation reduced to a two-line context preview, a compact Matches loaded/Clear row, a native-style Unmet/Met segmented control, and quiet Needs/Feelings panels. Exact/nearby provenance appears only in results mode and is visually subordinate to the actual suggestions.

Quick check remains one compact grouped list with 44–48px rows and separators; example/help disclosures remain lightweight rows; the guide and secondary result explanations use restrained one-pixel surfaces and compact spacing instead of stacked heavy cards and shadows.

The highlight layer is paint-only: highlighted text is explicitly transparent (including WebKit text fill), while the visible textarea remains the sole text owner. Highlight/formula overlays are programmatically scrollable with hidden scrollbars, and the editor re-synchronizes them after formula markup is rendered so iOS textarea scrolling cannot expose a duplicated or offset second copy of highlighted text.

## Match provenance contract

The exact/nearby display is **post-load provenance**, not a second pre-load prediction surface. When the person presses Load matches, `buildSuggestions()` produces the direct result set that actually renders the visible Needs and Feelings. `assets/js/observation-editor.js` synchronizes the displayed exact-match count from that same loaded result. If no direct result exists and fallback matching is used, nearby provenance comes from that fallback queue. This prevents a separately timed status path from saying `0 exact` while the loaded result is simultaneously showing direct suggestions.

The generated `data/observation_cue_modules.json` artifact is sufficient to preserve direct matching and its feeling/need suggestions even if the supplemental cue-row CSV cannot be delivered. The CSV still enriches cue-level and nearby/fallback behavior when available. Runtime loading treats those assets independently instead of allowing one failed fetch to silently zero the entire detector.

`tests/observation-suggest.test.mjs` exercises both the full cue library and module-artifact-only path and runs inside `npm run test:data-integrity`. `tests/shared-density-polish.test.mjs` protects the phone task order, post-load match-summary visibility, loaded-result provenance source, parser discovery, full-width phone ownership, grouped Quick check rows, touch targets, overlay synchronization, compact results, and the ban on `!important` patch chains.

## Non-negotiable behavior

The density layer must not rename/remove existing DOM hooks or change observation analysis, matching, example insertion, Quick check state, suggestion behavior, guide behavior, dialogs, Journal conversion, or navigation magnets. Touch targets remain at least 44px where controls are interactive.

Live-device acceptance should include both a built-in and manually typed observation. Before Load matches, no `0 exact / 0 nearby` card should compete with the primary action. After Load matches, visible suggestions and exact/nearby provenance must agree; then verify Unmet/Met, chips, fallback/nearby behavior, guide controls, Journal conversion, and repeated internal textarea scrolling on iOS.

Every accepted change must still pass the normal Site Quality workflow, including data integrity, interaction/flicker regressions, navigation magnets, static layout contracts, generator ownership, architecture tombstones, performance budgets, delivery contracts, fact-checking round-trip, the canonical build, and generated-output zero-diff verification.
