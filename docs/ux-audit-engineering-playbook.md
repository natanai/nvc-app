# UX Audit Engineering Playbook

**Project:** `natanai/nvc-app` / allneeds.app legacy production codebase  
**Working branch:** `ux-audit`  
**Production branch:** `backend`  
**Preservation branch:** `pre-ux-audit-2026-08-17`  
**Notes established:** 2026-08-18  

This document records the engineering and UX lessons learned during the mobile-first UX audit so that later work does not repeat regressions, rediscover architecture the hard way, or “clean up” code that is actually doing important compatibility work.

The most important lesson is that this is not a simple collection of static pages. It is a static-generated site with years of accumulated compatibility behavior, prepaint tricks, persisted user state, shared scripts, generated HTML, hand-maintained HTML, and mobile-browser workarounds. A change that looks local can have site-wide consequences.

---

## 1. Non-negotiable working rules

Before changing anything, remember these rules.

1. **Do not modify `backend` during experimental UX work.** Work on `ux-audit` until the user has tested the deployed branch and explicitly approves merging.
2. **Do not modify `natanai/allneeds` from this legacy-site audit.** That repository is the separate V2 project.
3. **Treat the real iPhone as part of the test suite.** Chrome desktop emulation is useful but is not authoritative for iOS Safari behavior.
4. **Do not assume duplicated-looking UI is actually duplicated behavior, or that same-looking behavior has one owner. Trace it.** Find the DOM trigger, event handler, state owner, CSS owner, and generated/manual source before editing.
5. **Do not “simplify” prepaint/critical-loading code without proving it is safe.** Some strange-looking code exists specifically to prevent flashes, jumps, and layout churn on a static site.
6. **Prefer fixing a root cause over masking its symptom.** Do not use global `overflow-x: hidden`, arbitrary fixed heights, forced scroll resets, or extra duplicate controllers when the actual source can be identified.
7. **Prefer subtraction and consolidation.** If two paths do the same job, make one path authoritative rather than repairing both.
8. **Preserve behavior while changing presentation unless behavior is explicitly the problem.** URLs, data attributes, localStorage keys, auth, Bluesky sync, journal storage, nav settings, physics, and accessibility hooks are all potentially relied upon elsewhere.
9. **Group coherent changes.** Avoid a string of tiny commits that each trigger the full Actions suite and make deployment history noisy.
10. **A green automated check is necessary but not sufficient.** The final standard is the actual site on the user’s phone and desktop.

---

## 2. Before touching a page: trace its architecture

For every UX task, answer these questions first.

### A. Is the page generated or hand-maintained?

Generated pages may be overwritten by `scripts/build-pages.mjs`. A direct edit can look successful and then disappear after the next build.

Hand-maintained pages can drift away from generated shared markup. `alexithymia-support/index.html` is an important example: it contains large embedded/shared sections and therefore can silently become inconsistent with generated pages.

**Rule:** identify the source of truth before editing the rendered HTML.

### B. What loads before first paint?

The site deliberately preloads/apply-styles before content appears. `assets/js/ui/contrast.js` is a synchronous head script and participates in the prepaint path.

If a visual change depends on CSS that is loaded later by an ES module, the user can see the old layout first and then the new layout. That is a regression even if the final state is technically correct.

### C. Who owns the behavior?

Search for:

- the visible control markup,
- its data attributes,
- delegated listeners,
- direct listeners,
- state variables,
- storage keys,
- shared modules,
- page-local modules,
- generator templates.

Do not stop at the first event listener you find.

### D. Does user state persist?

The nav magnets, physics, customizer, inventory, journal, and other features use local/session storage. A layout that looks clean in a fresh browser may interact differently with a returning user’s saved state.

Never silently erase saved positions/settings as a cosmetic fix unless a migration or explicit reset behavior has been designed.

---

## 3. Lesson: late CSS injection causes visible layout flash

### What happened

The first Inventory UX pass used `scripts/inventory-bluesky.js` to dynamically append a `<link>` for `styles/inventory.css`.

Functionally, the stylesheet loaded. Visually, it loaded too late. On every page load the user briefly saw the old Inventory layout and then the cleaned-up layout snapped into place.

### Why this was a mistake

The site already has deliberate first-paint protections. By adding page-critical styling from a deferred/module path, we bypassed those protections.

The regression was especially noticeable because the Inventory changes affected layout dimensions, button hierarchy, and spacing—not just a small decorative color.

### Corrective pattern

The Inventory stylesheet is now requested from the synchronous prepaint path in `assets/js/ui/contrast.js` for `/inventory/` while the document is still loading. The parser-time path uses `document.write()` to make the stylesheet parser-inserted/render-blocking before body paint, with a render-blocking fallback.

This is intentionally old-fashioned. In this architecture, it is preferable to a clean-looking deferred implementation that visibly flashes.

### Rule moving forward

**Any CSS that materially changes the first visible layout must be available before first paint.**

Do not dynamically inject page-critical styles from a module unless the unstyled/base state is intentionally acceptable to show.

### Regression check

`tests/inventory-prepaint-style.test.mjs` exists specifically to make sure Inventory styles remain in the prepaint path and are not moved back into the late module loader.

---

## 4. Lesson: generated HTML and hand-maintained HTML can drift

### What happened

The Support Lane appeared to open a different broken Journal than the nav Journal.

At first glance it looked like the final Support button was launching a second journal implementation. The deeper trace showed something more subtle:

- both controls already used the same `data-support-journal-open` trigger contract;
- the global Journal markup existed on the Support page;
- `inventory.js` already knew how to bind every shared Journal trigger;
- **but `scripts/alexithymia-support.js` still contained its own old page-local Journal overlay controller.**

The Support page therefore had overlapping ownership even though the controls looked like they were using the same API.

### Fix

The obsolete Support-local overlay controller was deleted. Approximately 132 lines of duplicate overlay state/open/close/focus/escape code were removed.

`inventory.js` is now the sole owner of the global Journal overlay behavior.

### Rule moving forward

When a hand-maintained page includes a copy of a shared component, periodically compare:

1. markup,
2. CSS,
3. event ownership,
4. accessibility attributes,
5. lifecycle logic,
6. current generator output.

**Shared data attributes are not proof that there is only one implementation.**

### Journal invariants

For pages that support the global Journal overlay:

- there should be exactly one `[data-journal-overlay]` container;
- the overlay should contain the single `#global-support-journal-layer`;
- Journal open controls should use `data-support-journal-open`;
- `inventory.js` should own the shared overlay state and event lifecycle;
- page-local scripts should not reimplement open/close/focus/escape handling for the same layer.

If the Support Lane needs to prefill journal data, it should do that through the shared journal/form interfaces—not by owning another overlay.

---

## 5. Lesson: iOS viewport units are not interchangeable

### Symptom

The Journal looked full-screen when opened in some contexts, but when opened after scrolling deep into the Support Lane on iPhone, the Journal stopped above the bottom of the visible screen. A blurred/dark strip remained underneath.

### Root cause

The shared Journal CSS correctly used `100dvh`, but a later `@supports (height: 100svh)` rule overrode the dialog height with `100svh`.

On iOS Safari:

- `svh` represents the **small viewport** associated with expanded browser chrome;
- `dvh` tracks the **dynamic viewport** as Safari’s browser chrome expands/collapses while scrolling.

After scrolling, the visible viewport could become taller while the Journal remained locked to the smaller `svh` value.

### Fix

Remove the `100svh` dialog overrides and keep `100dvh` authoritative. Retain the older `--vh`-based fallback only for browsers that do not support `dvh`.

### Rule moving forward

For truly full-screen overlays on modern mobile Safari:

- prefer `100dvh` for the live dialog height;
- do not later override that height with `100svh`;
- test the overlay both at the top of the page and after scrolling enough for Safari chrome to change state;
- treat width/height viewport units separately—an `svh` width fallback used for landscape calculations may have a different purpose than an `svh` height on the dialog.

Do not declare an iOS full-screen issue fixed based only on a fresh page load.

---

## 6. Lesson: Chrome responsive mode can miss the real breakpoint/browser problem

### Observations-page example

A horizontal-overflow issue was visible on the actual iPhone but did not reproduce in the runner/browser diagnostic. The Chrome diagnostic effectively saw a wider client width, while the real device entered the site’s `<=460px` branch.

The actual problem was a mobile Quick Check rule that switched controls into a `nowrap` / non-shrinking horizontal layout.

### Wrong direction to avoid

A global document overflow reset can hide the symptom, but it does not fix the component that is wider than the viewport. It can also break intentionally scrollable areas or mask later regressions.

### Correct direction

Find the element that exceeds the viewport and remove the layout constraint causing it. In that case, let the existing wrapping layout remain active instead of forcing the horizontal-scroller behavior.

### Rule moving forward

For mobile overflow bugs:

1. identify the exact overflowing element;
2. inspect every breakpoint affecting it, especially `<=460px`;
3. test Safari-specific behavior;
4. fix the component’s sizing/wrapping;
5. avoid global `overflow-x: hidden` unless horizontal clipping is genuinely the intended design.

---

## 7. Lesson: step-based flows need explicit progression semantics

### What the Support Lane taught us

The Support Lane had steps, but the controls at the bottom of a step were labeled things like “Emotions” and “Compass.” That did not communicate whether they were destinations, tools, current state, or the way to continue.

A step label at the top is not enough. The bottom of the current viewport needs to answer:

- What can I do now?
- What takes me to the next step?
- Can I go back?
- What if I cannot answer this step?

### Better pattern

Use explicit progression language:

- **Back**
- **Continue**
- **Not sure** / skip fallback
- **Finish** when the flow actually ends

Symbols can reinforce those meanings (`←`, `→`, reset glyph, etc.), but ambiguous symbols should not replace essential navigation language.

### Rule moving forward

For a guided multi-step flow, the primary CTA should describe the progression action, not the conceptual content of the next page.

“Continue” is clearer than “Emotions” when the user is deciding how to proceed.

---

## 8. Lesson: fewer words is good only when symbols are genuinely intuitive

### User feedback

The Support Lane originally had text stacked on text stacked on buttons. Replacing repeated text with symbols helped reduce visual overload, but the first symbolic pass also showed that iconification can become another kind of ambiguity.

### Practical distinction

Good candidates for compact symbolic controls:

- add/open a repeated body-region detail (`+`) when the region title provides context;
- reset/restart (`↻`) when accessible labeling is present;
- back/forward arrows used alongside or in a clearly established navigation pattern;
- close (`×`).

Poor candidates for symbol-only treatment:

- “Continue” when the flow state matters;
- “Not sure”;
- Journal unless the journal/book icon is extremely clear and has an accessible label;
- any action whose icon could plausibly mean multiple things in the same screen.

### Rule moving forward

Use icons to **remove redundant words**, not to remove meaning.

Every symbol-only button must still have an accurate accessible name (`aria-label`, visually hidden text, or equivalent), and its meaning should be obvious without needing the tooltip/label.

---

## 9. Lesson: disabled controls must look intentionally disabled, not broken

### Compass example

The compass step starts at neutral/steady. The Continue button is intentionally disabled until the user actually touches the compass, because the initial center position is a default—not yet a confirmed response.

In the screenshot, the faded Continue control looked like a broken button because the interface did not make that dependency obvious.

### Current behavior

The underlying validation rule remains: touching/moving the compass enables Continue; “Not sure” allows progression without a compass selection.

### Open UX question

The behavior may still need clearer feedback. Possibilities include:

- a short hint near the compass: “Move the dot to continue, or choose Not sure”;
- a more deliberate disabled appearance;
- treating the center as a valid explicit choice only after the user taps it;
- changing the initial center marker so it does not visually look preselected.

### Rule moving forward

When disabling a primary CTA, make the reason discoverable in the same viewport. Do not rely on users inferring state rules from opacity alone.

---

## 10. Lesson: mobile footer controls need hierarchy, not equal competition

### Compass footer problem

Back, Not sure, and Continue were all squeezed into one horizontal row on a narrow phone. The resulting buttons looked cramped, labels collided, and the disabled Continue became especially hard to parse.

### Current pattern

For the compass step on narrow screens:

- Back and Continue form the primary navigation row;
- Not sure is a quieter fallback below them.

This reflects hierarchy rather than giving three different actions equal visual weight.

### Rule moving forward

On narrow screens, do not force three medium/large text controls into one row merely to preserve desktop symmetry.

Prioritize:

1. primary progression,
2. backward navigation,
3. alternate/skip action.

Use a second row when needed.

---

## 11. Lesson: remove redundant actions rather than repairing every button

### Body-step Compass action

A previous Support Lane version exposed a body-step “Compass” action that either did nothing useful or duplicated the guided progression. Repairing that button would have preserved conceptual clutter.

The better fix was to remove the redundant action and make the body step’s single primary action **Continue**, which processes the body selections and advances to the next step.

### Rule moving forward

When a button is broken, first ask whether it should exist at all.

Do not equate “button does not work” with “button needs another event handler.” Sometimes the correct repair is deleting an obsolete pathway.

---

## 12. Lesson: Body Cues should update data without rebuilding the world

### Original performance/UX issue

Body Cues rebuilt a large number of magnet/result elements on every slider `input` event. While dragging, this could happen continuously and cause visible bouncing/jank.

### Fix pattern

- debounce updates while dragging (roughly 140 ms);
- update immediately on release/commit;
- reuse/reorder existing result DOM instead of recreating everything;
- show only the strongest five results by default with an explicit expansion option;
- maintain a stable result footprint;
- let the mobile page use normal document scroll instead of adding another nested scrolling region.

### Rule moving forward

For continuous controls such as sliders:

- separate “live preview” frequency from “final committed” frequency;
- reuse DOM nodes where possible;
- do not reconstruct large interactive collections for every pointer movement;
- avoid nested scrolling unless it solves a real containment problem.

---

## 13. Lesson: the site’s visual problem is hierarchy, not personality

The goal of this audit is not to make allneeds.app look like a generic flat corporate dashboard.

The tactile borders, shadows, colorful magnets, playful physicality, and strong shapes are part of the site’s identity. The problem is that those treatments have been applied to too many things at once, so static information can visually compete with primary actions.

### Useful hierarchy

Think in three levels:

1. **Primary interactive:** tactile, obvious, strong affordance.
2. **Secondary interactive:** quieter but still clearly actionable.
3. **Structural/content:** flatter, lower shadow/border weight, supports reading rather than demanding attention.

### Rule moving forward

Do not solve “too busy” by stripping the site of its character. Solve it by deciding what deserves the strongest treatment.

---

## 14. Lesson: Inventory actions need priority, not equal button weight

The Inventory header originally placed Journal, Add Personal Strategy, Review Saved Strategies, Shared Feed, description, and Bluesky sync in a crowded cluster. On mobile, full-width quick-action rules made every action look equally important.

The successful direction was presentation-only:

- Add Personal Strategy = primary;
- Review Saved / Shared Feed = secondary;
- Journal = smaller shortcut rather than another giant CTA;
- Bluesky sync = optional/supporting panel rather than the dominant content.

### Rule moving forward

When a page has several valid actions, do not make them all primary buttons. Preserve every function, but give the most common/current task the clearest visual path.

---

## 15. Lesson: magnet pages have two different problems—layout and play

Magnet hubs (Needs, Feelings, Faux Feelings, and the nav board) mix two goals:

1. an organized, readable resting layout;
2. a playful physics/draggable interaction.

Saved arbitrary positions can create sparse rows or odd whitespace even when a good measured packing algorithm exists. Physics can also make the default state feel unstable when the user mainly wants to read/select.

### Safe future direction

- preserve the existing drag/physics engine;
- preserve legitimate saved user layouts;
- favor a well-packed organized resting state for new/reset layouts;
- make “Play magnets” an explicit mode rather than requiring motion to make the page feel alive;
- offer a clear Tidy/Arrange action;
- do not silently discard saved positions as part of a CSS cleanup.

### Rule moving forward

Treat persisted magnet positions and physics state as user data, not disposable layout cache.

---

## 16. Lesson: one-shot GitHub Actions patching must be robust or not used

Because multi-file edits are sometimes applied through a temporary one-shot workflow, the patch script itself becomes a source of risk.

### Failure we hit

A temporary Support Journal patcher relied on a long, exact CSS string anchor. The source had already shifted slightly, so the workflow failed with “Missing anchor: desktop compass footer styles.”

Nothing durable was committed from the failed run, but it created unnecessary red Actions history and required another trigger.

### Better pattern

If a one-shot patcher is necessary:

- operate from an exact known base branch/ref;
- use narrowly bounded structural selectors/regex rather than huge exact text blocks;
- validate all required anchors before writing any file when possible;
- fail before committing if assumptions are wrong;
- assert the final invariants, not just that a replacement occurred;
- run focused checks;
- verify only intended durable files changed;
- delete the temporary workflow/script before the durable commit;
- close any trigger PR without merging;
- do not leave one-shot machinery in the product branch.

### Rule moving forward

A temporary transformation workflow is scaffolding, not architecture. It should disappear after use.

---

## 17. Lesson: excessive tiny pushes create Actions noise and obscure signal

During the early Inventory work, several small commits each triggered full Site Quality Checks. The Actions page filled with orange queued runs and red history from an abandoned temporary approach.

This made it harder to distinguish actual product failures from integration noise.

### Better pattern

- inspect first;
- group one coherent fix;
- commit once when practical;
- use focused local/temporary checks before triggering the full suite;
- reserve separate commits for meaningful rollback boundaries, not every micro-edit.

### Rule moving forward

Optimize for understandable history, not the maximum possible number of checkpoints.

---

## 18. Testing strategy learned so far

### Automated checks already relevant

The quality workflow has been expanded to cover the production/working branches and includes checks such as:

- build;
- data integrity;
- customizer preload;
- Inventory prepaint styling;
- flicker/jitter;
- nav magnets.

Support work has also used focused checks for syntax, evidence, nav behavior, structural assumptions, and intended-file diffs.

### But automated checks cannot prove

- iOS Safari viewport behavior after browser chrome changes;
- whether a disabled button *looks* broken;
- whether visual hierarchy is understandable;
- whether touch targets feel cramped;
- whether a loading flash is perceptible on a real connection/device;
- whether saved local user state produces a weird layout.

### Minimum test matrix for meaningful UX changes

**Real iPhone Safari**

- fresh page load;
- reload from cache;
- scroll before opening overlays;
- portrait;
- keyboard open if forms are involved;
- repeated navigation back/forward;
- returning/saved-state behavior where relevant.

**Desktop**

- normal width;
- narrower responsive width;
- mouse/focus states;
- keyboard navigation.

**Automation**

- focused feature tests;
- shared/nav/flicker checks if shared CSS/JS changed;
- build if generated assets/templates may be affected.

---

## 19. Known current invariants by area

### Production safety

- `backend` remains the production branch and should not receive audit changes until explicit approval.
- `pre-ux-audit-2026-08-17` is the preservation reference for the pre-audit state.
- `ux-audit` is the deployed experimental working branch.

### Inventory

- Inventory has a dedicated `styles/inventory.css` presentation layer.
- That CSS must be available before first visible paint.
- `inventory-bluesky.js` must not be used as a late layout-stylesheet loader.
- Bluesky/auth/storage behavior should remain independent of cosmetic hierarchy changes.

### Journal

- one global overlay per page;
- `data-support-journal-open` is the shared trigger contract;
- `inventory.js` is the shared overlay behavior owner;
- full-screen dialog height should remain dynamic (`100dvh`) on supporting mobile browsers;
- page-local scripts should not recreate shared overlay lifecycle logic.

### Support Lane

- one guided step visible at a time;
- explicit Back / Continue / Not sure / Finish semantics;
- body-region repeated controls may be compact/iconic but need accessible names;
- redundant Compass shortcut from the body step has been removed;
- compass Continue waits for actual compass interaction, while Not sure provides an alternate path;
- mobile footers must not compress three competing controls into an unreadable row.

### Body Cues

- avoid rebuilding all results/magnets on every slider movement;
- preserve normal mobile page scroll;
- prefer stable result dimensions and restrained default result count.

### Observations

- do not restore the narrow-screen nowrap horizontal-scroller rule that caused document overflow;
- do not mask component overflow with a global document clipping hack.

### Magnets/nav

- inspect saved positions and physics before changing layout behavior;
- do not clear persisted user layouts casually;
- prepaint/flicker behavior is part of the nav architecture, not optional polish.

---

## 20. Known unresolved UX questions

These should not be accidentally treated as finished just because the current code passes checks.

1. **Support Lane overall polish is still in progress.** The recent changes fixed architecture and progression, but the user has explicitly said parts still do not feel/look good.
2. **Compass disabled state may still look broken.** The rule is deliberate; the communication of the rule may not be.
3. **Journal must be re-tested on the real iPhone after the `100dvh` root fix is deployed.** Automated checks cannot validate the visible Safari chrome interaction.
4. **Icon choices should continue to be evaluated for intuitive meaning.** “Less text” is not automatically “better UX.”
5. **Shared vs hand-maintained markup remains a drift risk.** Support is the clearest example, but other manual pages may have similar duplicate shared sections.
6. **Magnet default/resting-state work is high-risk because of persistence and physics.** Always inspect existing state handling before changing it.

---

## 21. Preferred workflow for the next UX task

Use this sequence instead of jumping directly into CSS.

### Step 1 — Reproduce from the user’s exact context

Use the screenshot/device/context given. Note whether the page was scrolled, whether an overlay was opened from a secondary control, whether Safari chrome was collapsed, and whether the user had existing local state.

### Step 2 — Trace the feature end to end

Find:

- rendered control;
- source/template that created it;
- CSS controlling it;
- event listener(s);
- behavior owner;
- storage/state dependencies;
- prepaint involvement;
- related shared component.

### Step 3 — State the root cause before editing

Do not make speculative style changes until the failure mechanism is understood well enough to explain in one or two sentences.

### Step 4 — Choose the smallest durable fix

Prefer:

- deleting duplication;
- removing one conflicting rule;
- changing one component’s layout;
- reusing the shared implementation;
- adding a narrowly scoped style.

Avoid:

- global clipping;
- duplicate event handlers;
- second overlays;
- arbitrary fixed viewport heights;
- late critical CSS;
- clearing persistent state.

### Step 5 — Protect first paint

If the change affects initial layout, verify whether its CSS/JS runs before the user can see the old state.

### Step 6 — Run focused checks

Test the behavior that was changed plus any shared systems touched by the fix.

### Step 7 — Inspect the diff

Make sure only intended durable files changed. Pay special attention to generated HTML and temporary workflow/scripts.

### Step 8 — Deploy `ux-audit` and test on the real device

Do not merge to `backend` based solely on CI.

### Step 9 — Record new architectural lessons

If a task reveals another hidden dependency or browser quirk, update this playbook before moving to the next area.

---

## 22. “Do not repeat these mistakes” checklist

Before declaring a UX fix complete, confirm all of the following:

- [ ] I did not edit `backend`.
- [ ] I know whether the page is generated or hand-maintained.
- [ ] I traced the actual event/state owner instead of assuming from the button markup.
- [ ] I did not add a second implementation of an existing shared feature.
- [ ] I did not move page-critical CSS into a late module path.
- [ ] I checked for a visible first-paint flash/jump.
- [ ] I did not hide overflow globally instead of finding the overflowing component.
- [ ] I considered `<=460px` behavior and real iOS Safari, not just desktop emulation.
- [ ] I used `dvh` appropriately for a live full-screen mobile overlay.
- [ ] I did not let a later `svh` rule override a dynamic full-screen height.
- [ ] I preserved localStorage/sessionStorage contracts and saved user layout/state.
- [ ] I did not silently erase magnet positions/settings.
- [ ] I reduced duplicate behavior rather than adding more listeners/controllers.
- [ ] I kept step progression language explicit.
- [ ] I used symbols only where they are genuinely intuitive and accessible.
- [ ] A disabled primary control communicates why it is disabled.
- [ ] Mobile action hierarchy fits without cramped competing buttons.
- [ ] I grouped the change coherently instead of generating needless Actions noise.
- [ ] Any temporary workflow/patch script was removed after use.
- [ ] The final diff contains only intended product files.
- [ ] Focused automated checks passed.
- [ ] The user can test the deployed `ux-audit` branch on the actual phone before production merge.

---

## 23. Core principle

The legacy site often achieves a polished experience through code that is not architecturally elegant by modern standards. The audit should improve the experience **without destroying the accumulated knowledge encoded in those workarounds**.

When something looks unnecessarily complicated, assume first that it may be defending against a historical bug. Trace it, test it, and only then simplify it.

The safest improvements so far have shared a pattern:

> understand ownership → remove duplication/conflict → preserve prepaint and persistence → make hierarchy clearer → verify on the real device.

Use that pattern for the rest of the audit.
