# Observations presentation and task-flow contract

## Ownership

- `styles/observations.css` is the single route-specific presentation owner for `/observations/` on desktop and phone.
- Phone presentation lives in the one `@media (max-width: 640px)` block in that file. The former route-critical and separate phone stylesheets are retired.
- `scripts/observation-guide.mjs` keeps the shared navigation critical region navigation-only and ensures the route stylesheet is parser-discovered after `styles.css`.
- Shared navigation, Journal overlays, fonts, and other cross-route primitives keep their existing shared owners. Their presence is not a second Observations presentation owner.

## Primary flow

The authored DOM order is: observation input → Load matches/results → Quick Check → example → recipe. CSS must not reorder those task stages.

Before loading, the result heading, panels, and exact/nearby provenance are absent from the visual flow. Load matches is the one primary action. After loading, Needs and Feelings become the primary content, exact/nearby lives inside “Why these matches?”, and the completed Load matches button no longer remains as a large disabled control.

“Why these matches?” explains which detector groups and observation slots led to the suggestions. It does not replace exact/nearby provenance. Exact counts are synchronized from the same loaded module result that renders the visible direct suggestions; nearby counts come from the fallback queue.

## Native visual language

Observations follows `docs/native-app-visual-language.md`. Quick Check uses an inset grouped list. Example, Observation recipe, Why these matches, Why try this, Full guide & research, and guide subpanels share the grouped-row/disclosure grammar. Closed disclosures use a right chevron; open disclosures rotate it downward. A quiet secondary label identifies each row’s function—such as match rationale, writing example, step-by-step prompts, purpose, or detailed reference—without inventing a different affordance for each one. Result panels use one neutral grouped surface rather than independent yellow and green card treatments. Desktop results use the full editor width rather than nesting a two-column result grid inside the former left editor column.

Journal conversion loads the shared Journal form module before activating the existing Journal opener. The form is created, prefilled with the submitted observation in the same browser task, and therefore paints already populated; a fixed-delay post-open retry is not an accepted handoff mechanism.

The ordinary validity messages “Ready for matches,” pending, and valid remain available to assistive technology without occupying another visual card. Invalid and error guidance stays visible.

## Detector resilience

The generated module artifact remains sufficient for direct matching if cue-row delivery is unavailable. `tests/observation-suggest.test.mjs` protects detector delivery and data behavior; `tests/observations-native-language.test.mjs` protects presentation ownership, real DOM task order, loaded-result provenance, and the shared disclosure grammar.

## Acceptance

On iPhone: type and load both the built-in example and a manually written observation; open “Why these matches?” and verify exact/nearby agrees with the visible result; convert the result and verify the Journal opens already populated; verify all disclosures use the same chevron language; verify Quick Check and help remain secondary; and repeatedly scroll a long highlighted observation to confirm overlays remain aligned. On desktop: verify the editor and result panels use the available width, the Journal opens already populated, and the recipe, guide tabs, dialogs, and result interactions remain functional.
