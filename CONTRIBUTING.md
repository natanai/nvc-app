# Contributing to allneeds.app

Start with `README.md`, then use `docs/architecture-map.md` to find the canonical owner before editing. If you cannot name the markup, style, behavior, and data owner for a change, trace those first.

## Normal workflow

1. Install the repository tools with `npm ci`.
2. Change canonical source rather than generated HTML, JSON, CSS, or icon output.
3. Run `npm run test:all` for the complete committed-site suite.
4. Run `npm run build` to regenerate declared outputs.
5. Confirm the build leaves no unexpected diff. Generated changes belong in the same commit as their source change.

Focused `test:*` commands remain available for faster iteration, but they are not a substitute for `test:all` before review.

## Boundaries

- Do not add post-paint DOM rearrangers, runtime CSS injection, one-shot finalizers, or a second responsive implementation of a component.
- Do not edit generated vocabulary pages directly. `scripts/build-pages.mjs` owns them.
- Do not remove compatibility files merely because their primary system is retired. `service-worker.js` and `scripts/inventory-legacy-journal-redirect.js` have explicit removal conditions documented in the architecture map.
- Preserve localStorage and import normalization unless a versioned migration proves existing user data remains readable.
- Add a regression for every ownership, persistence, accessibility, or responsive-layout invariant changed.

## Review evidence

A functional change is ready for review when the exhaustive tests pass, the canonical build is deterministic, browser entrypoints are referenced, generated output is current, and the relevant phone/desktop interaction has been exercised when static tests cannot prove it.
