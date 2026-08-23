# Bedrock final acceptance checklist

This checklist defines the remaining acceptance boundary for the original Bedrock production-finalization effort. It is intentionally narrower than "optimize everything forever." Post-Bedrock work such as whole-site background warming, deep offline support, asset hashing/minification, font self-hosting, or speculative controller splitting is not required unless a real acceptance failure points to it.

## Automated acceptance

The current Bedrock branch is expected to keep all of these green in Site Quality:

- canonical data integrity and reviewed reverse-inference overrides;
- Customizer/state preload and profile/backup restore contracts;
- flicker/jitter/runtime-load-graph regressions, including the repaired magnet paint path;
- navigation magnet coverage and saved-layout ownership;
- static layout contracts for shared density, Inventory, Journal, and Body Cues;
- the Journal native-UX contract: Feeling and Needs use catalog-backed popups whose options stay hidden until opened; each Feeling row owns its own 0–10 intensity where 0 means unselected; Tags retain example text and free-form tagging; and Journal History preserves, displays, summarizes, and filters individual Feeling/intensity pairs;
- the final hierarchy contract: Journal History is the primary dedicated-Journal surface, Patterns and Backup are secondary native disclosures, Need-page strategy browsing shares one compact title/action header, and the personal-strategy editor uses light-weight grouped controls rather than nested card-strength controls;
- legacy Journal entries remain readable: when an older entry has multiple Feelings but only one historical intensity value, that value is applied to each old Feeling during normalization because no per-Feeling information existed to recover;
- page-generator ownership and clean scoped generation;
- retired-architecture tombstones: deleted safe-build/finalizer layers stay deleted, temporary migration scaffolding does not remain, and the legacy Journal hash has one compatibility owner;
- first-load JavaScript and shared-asset performance ceilings;
- CSS/font delivery contracts, including direct shared stylesheet discovery and Google Fonts preconnect ownership;
- fact-checking export/import round-trip;
- full canonical authoring build;
- zero-diff generated-artifact verification.

The live delivery stack was separately measured on 2026-08-22: Cloudflare is serving the public site over HTTP/2 with active compression and static edge caching. That production-delivery verification does not need to be repeated for every commit unless hosting configuration changes.

## Phone acceptance pass

Use the published `bedrock/production-finalization-v2` canary. The goal is to catch things static CI cannot: first paint, touch timing, mobile compositing, persistence across real reloads, and first-interaction behavior.

### 1. Home and first interaction

1. Fully reload Home.
2. Confirm the page is styled immediately and the fonts look normal.
3. Confirm there is no obvious page-load flash/jump.
4. Immediately after another reload, tap the Menu or Customizer magnet before waiting around. It should respond normally rather than requiring a second tap.

Pass condition: first paint looks stable and an early first interaction works.

### 2. Feelings and Needs magnet object permanence

1. Open the Feelings hub and scroll up/down several times.
2. Confirm Feeling artwork does not flicker while scrolling.
3. Move one Feeling magnet to an obviously different position.
4. Reload the page and confirm the saved position returns without a distracting load flash.
5. Repeat the move/reload check once on the Needs hub.

Pass condition: no scrolling-art flicker, saved positions survive reload, and restoration does not produce a conspicuous visual regression.

### 3. Navigation persistence and Customizer

1. Move one navigation magnet and reload a page.
2. Confirm the navigation layout remains where you left it.
3. Open Customizer, make a small reversible change such as roundness or a palette value, close it, and reload.
4. Confirm the chosen appearance persists and the page does not briefly settle from a different theme.
5. Restore the setting if desired.

Pass condition: navigation and theme state survive real reloads without a visible incorrect-state flash.

### 4. Menu and Account & data shell

1. Open Menu from a normal content page, not only Inventory.
2. Open Account & data.
3. Confirm the controls render and are tappable.
4. If convenient, trigger **Export localStorage** and confirm a backup file begins downloading. Import/replace is not required for this acceptance pass because the transactional restore path is already covered by automated state tests.

Pass condition: global Menu/Account controls work outside the Inventory page and export remains reachable.

### 5. Inventory and Shared Strategies

1. Open Inventory and switch between the Needs and saved-strategy views/controls you normally use.
2. Open Shared Strategies from the site navigation or Inventory.
3. Confirm the feed renders normally and its first interaction does not appear dead while the heavier controller is lazy-loaded.

Pass condition: the primary Inventory surface and lazy Shared Strategies route remain usable on first interaction.

### 6. Journal creation, editing, and history

1. Open the dedicated Journal page and then open the Journal editor.
2. Confirm the resting metadata group is compact: **Feeling**, **Needs**, and **Tags**. There should be no standalone Intensity row because intensity now belongs to each Feeling.
3. Before tapping either selector, confirm **no Feeling or Need words are already displayed as an option list**. The rows should simply offer **Choose feelings** and **Choose needs**.
4. Open Feeling. Confirm a popup/dropout list appears containing valid Feelings from the site's feelings catalog. Each row should place the Feeling word on the left and its own **0–10 intensity scale** on the right.
5. Confirm all Feeling scales begin at **0** when unselected. Move one Feeling above 0 and confirm it becomes selected; choose a different intensity for a second Feeling; return one scale to 0 and confirm that Feeling is removed from the selection.
6. Close and reopen Feeling and confirm the independent ratings are preserved. Opening the selector should not automatically summon the iPhone keyboard; use search only when wanted.
7. Open Needs. Confirm a popup/dropout list appears containing valid Needs from the site's needs catalog, that more than one Need can be selected, and that closing the popup collapses the catalog again.
8. Confirm Tags remains a free-form field and shows useful examples such as `work, weekend, boundaries` when empty.
9. Save a temporary entry with at least two Feelings at different non-zero intensities, multiple Needs, and multiple Tags. Confirm Journal History displays each Feeling with its own intensity rather than one intensity for the whole entry.
10. Fully reload or reopen Journal without touching Search, Date, Sort, or a filter. Confirm the saved entry and every applicable filter appear immediately; History must not first present a false **No entries yet** state that only corrects after another control changes.
11. Confirm the History filters stay fully inside the History card. On phone they should form compact grid rows rather than a horizontally scrolling rail. Swipe left/right on the History card, an entry, Patterns, and the page background: the **document must not pan sideways** or reveal blank space to the right. Opening Patterns must not change the document width.
12. Exercise Search and the Feeling, Need, Tag, Date, and Sort controls. Neutral choices should read **Any feeling**, **Any need**, **Any tag**, and **Any time** rather than generic “All.” Filters for dimensions with no saved values should stay hidden. For a multi-feeling entry, confirm filtering by either individual Feeling finds the entry. Confirm **Clear filters** appears only while a filter is active and returns to the unfiltered history.
13. Delete the temporary entry and confirm History switches to the purposeful empty state explaining that entries build History and Patterns; filters should disappear because there is nothing to filter.
14. Open the Journal overlay from one ordinary non-Journal page and confirm it opens on the first tap and uses the same per-Feeling intensity selector and Needs popup.
15. Repeat the editor check once with Safari's on-screen keyboard visible from another field and once after the browser chrome has collapsed/expanded.

Pass condition: each selected Feeling owns an independent 1–10 rating and setting it to 0 removes that Feeling; Needs exposes only valid site vocabulary through a collapsed-by-default multi-select popup; Tags remains lightweight/free-form with examples; Feeling/intensity pairs round-trip through save/edit/history correctly; populated History hydrates without user intervention; History filters fit the viewport without horizontal page or filter-rail panning; touch targets remain comfortable; and dedicated/overlay paths both initialize correctly.

### 7. Final hierarchy acceptance

These are the screenshot-derived surfaces that were rebuilt at their canonical owners rather than patched after paint.

#### Dedicated Journal / History

1. Open the dedicated Journal page. The top of the page should be a compact **Journal** title with one **New entry** action, not a large Journal hero card with explanatory copy.
2. With no saved entries, **History** should show a purposeful empty state explaining that history, filters, and patterns grow after the first entry; Search and filter controls should not be shown because there is nothing to search or filter.
3. After at least one entry exists, fully reload or reopen Journal. The saved entry and its relevant filter dimensions must appear immediately without touching Sort, Search, or another control. Search and the relevant filter dimensions should appear with contextual neutral values—**Any feeling**, **Any need**, **Any tag**, **Any time**—rather than a row of ambiguous **All** values. A filter dimension with no available values should stay out of the UI, and **Clear filters** should appear only when a filter is active.
4. Saved entries should scan like a dense native log/list: Feeling/intensity first, quiet date metadata, a concise note body when present, small Need/Tag facets, and secondary Edit/Delete actions. Entries should be separated without each becoming another heavy shadowed card. With filters, entries, and Patterns populated, the entire Journal must remain locked to the phone viewport width; the filter controls themselves must also fit in bounded grid rows rather than creating any horizontal pan surface.
5. **Patterns** is a core Journal surface: its collapsed row should identify it as trends across entries, and opening it with no entries should explain that recurring feelings, needs, tags, and intensity trends will appear as entries accumulate. **Backup & restore** remains available below it but visually quieter.
6. Confirm the full-screen Journal editor still opens from **New entry** and that the accepted per-Feeling intensity, Needs popup, and Tags interactions from section 6 are unchanged.

Pass condition: History and Patterns read as the two core dedicated-Journal surfaces; empty history does not expose meaningless controls; populated filters use self-explanatory neutral labels; entries are easy to scan within one phone viewport; neither the document nor filters can pan sideways; Clear filters only appears when there is something to clear; Backup remains secondary; and the fallback editor is visually pushed back, compact when closed, and uses the available width when deliberately opened.

#### Need-page Strategies

1. Open any Need page with built-in strategies.
2. **Strategies**, **Shuffle**, and **View all** should share one compact header row. The old local-storage reminder must not appear above the deck.
3. The first strategy card should begin substantially closer to the section title than in the earlier screenshot, with Shuffle/View all clearly functioning as secondary browsing utilities rather than giant primary buttons.
4. Shuffle and View all must remain at least 44px tall and work on first interaction.

Pass condition: strategy content is visually primary and the browsing utilities consume only the space their function requires.

#### Add a personal strategy

1. Open **Add a personal strategy** on a Need page.
2. The mint outer editor should remain recognizable as one allneeds.app object, but its individual fields should read as light-weight controls inside that object: thin outlines, no independent heavy shadows, compact labels, and tighter vertical gaps.
3. The strategy-name field should use the same restrained focus treatment as the rest of the form rather than a large dashed inner-card effect.
4. **How do you put it into practice?** should begin at a compact editable height and remain vertically resizable where the platform permits.
5. Paired fields should use available width sensibly; Device/Profile must remain comfortable touch targets. The save-target helper text should be visually quiet and should not become another block competing with the form.

Pass condition: the eye immediately reads one editor containing controls, not a giant green card containing several equally strong cards, while all fields and save destinations remain comfortably usable.

### 8. Explicit nonstandard page owners

Spot-check these because their HTML/CSS ownership differs from the main generated-page path:

- Observations;
- Alexithymia Support;
- Shared Strategies/Feed.

Pass condition: each page looks normally styled, navigation works, and there is no obvious first-paint flash or missing UI.

## Desktop spot check

A short desktop pass is enough after the phone pass unless a change was desktop-specific:

- Home/Menu/Customizer;
- Inventory desktop layout;
- Journal creation/editing and Journal History filtering;
- one Feeling and one Need page, including the personal-strategy form;
- Observations.

The purpose is to catch viewport-specific layout regressions, not to duplicate every phone interaction.

## Completion rule

Bedrock can be called 100% when:

1. the permanent Site Quality suite is green on the final clean head;
2. the phone acceptance pass above has no unresolved Bedrock regression;
3. the short desktop spot check has no unresolved Bedrock regression;
4. documentation and PR status describe the architecture that actually shipped;
5. no temporary migration/audit scaffolding remains.

If an acceptance step exposes a defect, fix that defect and repeat the affected section. Do not add unrelated performance/PWA work to the Bedrock finish line merely because further optimization is possible.
