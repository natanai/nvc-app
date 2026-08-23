# Bedrock runtime provenance

Bedrock uses one decision rule for browser mutations: **if the correct markup or presentation is knowable from the route/build, it must be emitted by its canonical compiler/style owner.** Runtime code is reserved for values that genuinely depend on saved user state, fetched data, authentication, permissions, device capabilities, or interaction state.

## Audit scope

The production-finalization provenance pass scanned the browser/build JavaScript under `scripts/` and `assets/js/` for the mutation patterns most likely to conceal a deterministic repair: runtime stylesheet/style creation, DOM removal, adjacent element insertion, button/link construction, class/copy rewrites, and inline-style mutation. Each candidate was then classified by ownership rather than mechanically deleted: mutations driven by stored state, fetched data, authentication, geometry, device capability, or direct interaction remain runtime concerns; route-known markup and presentation do not.

This matters because the audit deliberately looked beyond the defects already noticed on the phone. It found a small number of additional ownership violations rather than a broad hidden normalization layer, and the permanent provenance test now protects the concrete boundaries that were exposed.

## Blocking provenance failures

The production-finalization audit found and removed three classes of deterministic repair that had survived earlier green CI:

- Inventory markup that was emitted by the page compiler, hidden by CSS, and then deleted/rearranged by the shared shell after load. The compiler now emits only the final Inventory workspace.
- Device/Profile strategy controls that were cosmetically rewritten and partially constructed by `inventory.js`. The page compiler now emits the complete controls and save-target field; runtime only binds clicks and reflects saved/auth/edit state.
- Feeling-detail CSS that was inserted with a runtime `<link>`. Feeling pages now parser-discover that stylesheet in their generated head.

The audit also removed dead runtime fallback creators for optional navigation magnets that are already serialized by the canonical page compiler, and optional Bluesky code is no longer loaded by the global Menu shell until the user opens Account & data.

## Legitimate runtime mutation

These remain runtime by design:

- Customizer colors/roundness and profile restore, because values come from user-selected or persisted state.
- Magnet position, board height, dragging, shuffle, physics and tilt, because geometry and interaction are runtime state.
- Journal entries, History filters, Feeling intensity selections and draft/save status, because they depend on local user data and interaction.
- Journal History may choose a collapsed or expanded presentation for a long reflection because that decision depends on the user's stored entry content. The current History owner collapses reflections only when they exceed the defined word threshold and uses a native disclosure; the disclosure's deterministic density/presentation lives in `styles/shared-density.css` rather than being patched after paint.
- Observation suggestions, Body Cue results, reverse-inference results, Shared Strategy cards, and Bluesky status, because they depend on user input, fetched data, or authentication.
- Hidden interaction surfaces such as the global Menu may be constructed when activated; they are not first-paint repair of route content. Optional Bluesky code is deferred until Account & data is opened on routes that do not otherwise need it.

## Permanent gate

`tests/bedrock-runtime-provenance.test.mjs` protects the concrete ownership boundaries above. Existing tests that previously required post-load Inventory cleanup or save-button cosmetic normalization were inverted so CI now rejects those patterns instead of blessing them.

The provenance finalizer was exercised through the canonical build, the full 78-test flicker/runtime suite, page-generator ownership checks, and retired-architecture tombstones before its one-shot scaffolding was deleted. The temporary base-branch provenance runner was also removed after the clean source transformation landed.

This provenance gate complements, rather than replaces, generator zero-diff checks, route-runtime ownership tests, performance ceilings, persisted-state contracts, and real-device acceptance.
