# allneeds.app UX Design Quality Bar

**Target:** highly polished, professional-grade, app-like product quality, with Apple iOS as the primary interaction-quality reference.

This document defines the design standard for the legacy-site UX audit. It complements `docs/ux-audit-engineering-playbook.md`, which covers architecture and implementation safety.

The goal is **not** to make allneeds.app visually imitate Apple or discard its colorful, tactile identity. The goal is to bring the site's interaction quality, hierarchy, stability, spacing, responsiveness, and attention to detail up to the level users expect from a well-designed native iOS app.

## Core standard

Every screen should feel deliberately composed rather than accumulated.

A user should be able to understand, at a glance:

- where they are;
- what the screen is asking them to do;
- what the primary action is;
- what is optional or secondary;
- what changed after an interaction;
- how to go back or continue;
- whether a control is enabled, disabled, selected, loading, or complete.

If a user has to infer those things from button placement, opacity, scrolling, or trial-and-error, the screen is not finished.

## iOS-inspired principles to adopt

### 1. Clarity before decoration

Controls should communicate purpose immediately. Decorative borders, shadows, gradients, and playful physicality should support hierarchy rather than compete with it.

Use the strongest treatment for the most important interactive element on a screen. Static containers and explanatory copy should generally be quieter.

### 2. Deference to content

The content and current task should dominate. Chrome should recede.

Avoid:

- giant containers around containers;
- repeated headings that restate nearby labels;
- large buttons that repeat information already clear from context;
- permanent instructional copy for interactions that become obvious after first use;
- controls that consume vertical space without advancing the task.

### 3. Depth should communicate function

Shadows/elevation should imply interactivity, layering, or focus—not simply decorate every panel.

A static information card should not look as pressable as a primary CTA. A modal/sheet should visually separate from its background. A selected control should look selected because of state, not only because it happens to have another shadow.

### 4. Stable geometry

Native-feeling interfaces do not jump around unexpectedly.

Dynamic labels, timers, results, validation messages, and loading states should have enough reserved space that nearby controls do not move unnecessarily.

Changing content should preferably update *within* a stable component footprint.

### 5. Predictable navigation

Guided flows should have one obvious progression model.

Primary navigation vocabulary:

- **Back** for returning to the previous step;
- **Continue** for moving forward;
- **Finish** when completing the lane;
- a clearly secondary **Not sure**, **Skip**, or equivalent when the user can proceed without answering.

Do not label a progression control only with the conceptual name of the destination (`Emotions`, `Compass`, etc.) when the user needs to know whether it is an action, a tool, or the next step.

### 6. Familiar symbols, never mystery symbols for important actions

Use icons where users already have strong conventions: close, add, remove, back, forward, play, pause, reset, expand/collapse.

For primary or nuanced actions, pair the icon with a short label unless the meaning is genuinely universal in context.

Icon-only controls must still have an accurate accessible name.

### 7. Minimum touch quality

Interactive targets should be comfortably tappable on iPhone, generally at least 44x44 CSS pixels even when the visible icon is smaller.

Do not create tiny visual controls by also making the actual hit target tiny. Conversely, do not inflate every secondary action into a giant full-width button merely to satisfy touch sizing.

### 8. Intentional disabled states

A disabled primary control must communicate why it is unavailable and what enables it.

Opacity alone is not sufficient when the user could reasonably think the control is broken.

If `Continue` requires interacting with the compass, the same viewport should make that requirement understandable.

### 9. Progressive disclosure

Especially in the Support Lane, show only what the user needs for the current decision.

The Support Lane is intentionally distinct from Body Cues:

- **Body Cues:** broad exploratory tool; more information/results can coexist.
- **Support Lane:** guided experience; one manageable task at a time.

Do not turn the Support Lane into a long dashboard or expose future steps just because their data has already been calculated.

### 10. Native-feeling overlays and sheets

Full-screen experiences must actually fill the current dynamic viewport on mobile Safari.

Shared overlays should have one owner and one lifecycle. Do not fork a second implementation because one entry point needs different data.

Opening the Journal from navigation and opening Journal from the Support Lane should feel identical except for intentionally prefilled context.

### 11. Mobile-first composition, not desktop squeezed smaller

Do not preserve desktop row arrangements when they become cramped on phones.

Recompose based on hierarchy. For example, two important navigation actions can occupy a primary row while a fallback action moves below. The goal is visual logic, not symmetry with desktop.

### 12. Respect safe areas and browser chrome

Real iOS Safari is authoritative for viewport behavior.

Test screens:

- at initial page load;
- after scrolling enough for Safari chrome to collapse/expand;
- with the on-screen keyboard where relevant;
- in portrait first, then landscape for critical overlays;
- in Private Browsing when cache/persistence needs isolation.

Prefer dynamic viewport units (`dvh`) for live full-screen overlays; do not override them later with `svh` unless the small viewport is specifically the desired behavior.

### 13. Motion should be purposeful

Motion should explain state changes, spatial relationships, or interaction—not create visual activity merely because it is possible.

Avoid layout-affecting animation that causes text or controls to jump. Respect reduced-motion preferences.

The playful magnet physics can remain playful because it is part of the product's character, but unrelated interface elements should not inherit that level of motion.

### 14. Typography should establish hierarchy without shouting

Use size, weight, spacing, and case deliberately.

Avoid large blocks of uppercase text when sentence case improves scanability. Avoid excessive letter-spacing on long labels. Keep line lengths and wrapping intentional, especially on iPhone.

Dynamic button labels should be short enough to remain stable at supported widths.

### 15. Whitespace is structural, not leftover space

Whitespace should create grouping and rhythm. It should not come from oversized padding, unused rows, giant empty containers, or controls that reserve space they do not need.

When a screenshot feels sparse in the wrong way, identify the actual source of the wasted space before shrinking everything globally.

## allneeds.app-specific visual direction

The site should retain its identity:

- colorful palette;
- tactile magnet metaphor;
- rounded geometry;
- playful but purposeful physicality;
- approachable emotional vocabulary;
- strong personalization/customizer support.

The refinement is to make that identity feel **designed**, not indiscriminately applied.

A useful three-tier hierarchy remains:

1. **Primary interactive** — strong tactile treatment, clear affordance.
2. **Secondary interactive** — quieter, compact, still obviously actionable.
3. **Structural/content** — flatter and calmer, optimized for reading and comprehension.

## Definition of polished enough

A UX pass is not complete merely because:

- the bug is gone;
- the page validates;
- CI is green;
- the desktop layout looks acceptable;
- the user can technically reach the next screen.

A screen is ready when it also satisfies these questions:

1. Does the hierarchy make sense within two seconds?
2. Is the primary action obvious?
3. Does every visible control earn the space it occupies?
4. Are labels concise and unambiguous?
5. Does anything jump when content changes?
6. Are touch targets comfortable?
7. Does the layout feel intentionally composed at iPhone width?
8. Does it behave correctly with Safari's dynamic chrome?
9. Are shared interactions actually shared rather than duplicated?
10. Does it preserve allneeds.app's personality while feeling professionally finished?

## Implementation reminder

Do not pursue this quality bar by layering more fixes onto fragile architecture.

Use the engineering playbook's sequence:

**trace ownership → identify root cause → remove duplication/conflict → preserve prepaint/persistence → refine hierarchy → test on real iPhone → verify desktop → inspect final diff.**

Apple/iOS is the benchmark for interaction discipline and finish. allneeds.app should still look and feel like allneeds.app.