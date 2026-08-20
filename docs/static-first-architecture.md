# Static-first UI architecture

allneeds.app is a static HTML application that deliberately aims to feel immediate and app-like. The first rendered frame should therefore already be the correct interface for the current page and viewport.

This is an architectural principle, not a ban on JavaScript. JavaScript owns interaction, user-specific state, remote data, and progressive behavior. It should not repair deterministic presentation after the page has already started rendering.

## Core rule

If the browser can know a visible element, its copy, its layout, or its required CSS before the user interacts with the page, make it available before first paint.

Prefer this order:

1. Build scripts generate the complete deterministic HTML structure.
2. Parser-discovered CSS determines the correct responsive layout.
3. Small synchronous prepaint bootstraps may apply persisted user preferences when doing so prevents a flash of the wrong state.
4. Browser JavaScript hydrates existing controls and responds to interaction, user data, or network data.

Avoid this order:

1. Render a provisional page.
2. Wait for a deferred/module script.
3. Inject a stylesheet, rename or move visible controls, replace layout markup, or reveal deterministic page chrome.

That pattern creates avoidable layout shifts and makes the static application feel slower than it is.

## What belongs in generated HTML

Deterministic page chrome should normally be generated rather than created during browser runtime. Examples include:

- page headings, instructions, disclosure controls, and empty states;
- sliders, fields, buttons, tabs, and other controls whose existence is known at build time;
- static diagrams and SVG structures whose data is known at build time;
- navigation destinations and page-local actions;
- initial ARIA relationships and labels;
- fallback/empty UI that should be visible before interaction.

A browser module may attach listeners, populate user-specific values, reorder changing result data, or toggle an already-present interactive state.

## CSS rules

Required first-paint CSS must be discoverable from HTML/CSS without waiting for browser JavaScript.

Allowed patterns include:

- normal `<link rel="stylesheet">` elements in generated HTML;
- media-qualified stylesheet links;
- CSS imported by an already parser-discovered stylesheet;
- critical CSS emitted by the build where first-paint stability justifies it.

Do not use browser JavaScript to append a stylesheet link or `document.write()` a stylesheet as a page-specific visual repair. If a page needs a stylesheet, make that relationship part of the build/static document.

Responsive presentation should normally use CSS media/container queries. `matchMedia()` is appropriate when interaction behavior itself differs by viewport; it should not be necessary just to make the initial page look correct.

## Intentional prepaint exception

Persisted user preferences are different from deterministic page layout. allneeds uses small synchronous head bootstraps for things such as saved theme values, navigation visibility, and saved magnet placement so the browser does not first paint defaults and then visibly switch to the user's stored state.

A prepaint bootstrap is acceptable when all of the following are true:

- it runs before the affected content can paint;
- the state genuinely depends on persisted user/device data;
- applying it later would cause a visible flash or jump;
- it is small, synchronous, defensive, and has a stable static fallback.

Do not use this exception as a general mechanism for page redesign or responsive layout.

## Runtime DOM that is appropriate

Runtime-created DOM is appropriate when the content does not exist until runtime, for example:

- feeling matches calculated after a Body Cues slider changes;
- journal entries and saved strategies read from local storage;
- remote Shared Strategies results;
- validation, suggestions, and highlights derived from current user input;
- dialogs/popovers created only after an explicit user action;
- hidden menu/account content that is not part of first paint;
- loading, success, failure, or signed-in states that depend on a network request.

The test is not “does JavaScript create DOM?” The test is “could this visible initial DOM have been correct before JavaScript ran?”

## Interaction exceptions

Magnet physics is intentionally an interactive visual system. Shuffling, dragging, persisted magnet positions, and physics-ready state are not a template for ordinary page layout. The static fallback must remain usable, while prepaint restoration may prevent saved layouts from flashing through a default arrangement.

Likewise, focus/viewport handling needed for mobile keyboards or accessibility is interaction behavior, not a first-paint layout repair.

## Generated artifacts are source-controlled output

The repository commits generated HTML. A source/build change is incomplete if a clean build would immediately modify committed pages.

CI should therefore:

1. run the normal build;
2. fail if `git diff` is non-empty afterward;
3. run architecture/regression tests that protect important first-paint assumptions.

This keeps the checked-in site identical to what the build system says the site is.

## Build ownership

Prefer one authoritative build-time owner for each presentation decision. If a post-generation finalizer exists, keep it deterministic and narrow. Over time, stable page-specific decisions should move into the generator/template that owns that page rather than accumulating regex/string patches in a generic finalization step.

A finalizer is still build time and therefore does not create browser flicker; the concern is maintainability and source-of-truth clarity.

## Adding or changing a page

Before merging a page change, verify:

- the initial page is coherent with JavaScript disabled;
- all first-paint styles are parser-discovered;
- responsive layout does not require a later JavaScript repair;
- deterministic controls are present in static HTML;
- runtime-generated content is genuinely interaction-, user-, or network-dependent;
- a clean build leaves the repository clean;
- mobile and desktop behavior are both regression-checked when shared selectors are changed.

## Flexibility

Static-first is a performance and clarity constraint, not rigidity for its own sake. A new interaction can use whatever runtime behavior it needs. The important boundary is that JavaScript should enhance a correctly rendered page, not rescue a provisional one.
