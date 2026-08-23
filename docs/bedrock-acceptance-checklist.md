6. Close and reopen Feeling and confirm the independent ratings are preserved. Opening the selector should not automatically summon the iPhone keyboard; use search only when wanted.
7. Open Needs. Confirm a popup/dropout list appears containing valid Needs from the site's needs catalog, that more than one Need can be selected, and that closing the popup collapses the catalog again.
8. Confirm Tags remains a free-form field and shows useful examples such as `work, weekend, boundaries` when empty.
9. Save a temporary entry with at least two Feelings at different non-zero intensities, multiple Needs, and multiple Tags. Confirm Journal History displays each Feeling with its own intensity rather than one intensity for the whole entry.
10. Edit that entry and confirm every Feeling/intensity pair, Need, and Tag is restored correctly, then save the edit.
11. In Journal History, exercise Search and the Feeling, Need, Tag, Date, and Sort controls. For a multi-feeling entry, confirm filtering by either individual Feeling finds the entry. Confirm **Clear filters** returns to the unfiltered history and disappears again afterward.
12. Delete the temporary entry.
13. Open the Journal overlay from one ordinary non-Journal page and confirm it opens on the first tap and uses the same per-Feeling intensity selector and Needs popup.
14. Repeat the editor check once with Safari's on-screen keyboard visible from another field and once after the browser chrome has collapsed/expanded.

Pass condition: each selected Feeling owns an independent 1–10 rating and setting it to 0 removes that Feeling; Needs exposes only valid site vocabulary through a collapsed-by-default multi-select popup; Tags remains lightweight/free-form with examples; Feeling/intensity pairs round-trip through save/edit/history correctly; touch targets remain comfortable; and dedicated/overlay paths both initialize correctly.

### 7. Final hierarchy acceptance

These are the screenshot-derived surfaces that were rebuilt at their canonical owners rather than patched after paint.

#### Dedicated Journal / History

1. Open the dedicated Journal page. The top of the page should be a compact **Journal** title with one **New entry** action, not a large Journal hero card with explanatory copy.
2. With no saved entries, **History** should show a purposeful empty state explaining that history, filters, and patterns grow after the first entry; Search and filter controls should not be shown because there is nothing to search or filter. On a full reload, this correct empty state must be present on the first painted frame—there should be no flash of the populated filter controls while JavaScript initializes.
3. After at least one entry exists, fully reload or reopen Journal. The saved entry and its relevant filter dimensions must appear immediately without touching Sort, Search, or another control, and the page must not first paint the no-entry state before reconciling browser storage. Search and the relevant filter dimensions should appear with contextual neutral values—**Any feeling**, **Any need**, **Any tag**, **Any time**—rather than a row of ambiguous **All** values. A filter dimension with no available values should stay out of the UI, and **Clear filters** should appear only when a filter is active.
4. Saved entries should scan like a dense native log/list: Feeling/intensity first, quiet date metadata, a concise note body when present, small Need/Tag facets, and secondary Edit/Delete actions. Entries should be separated without each becoming another heavy shadowed card. Reflections longer than 80 words should collapse to a short preview with **Read full entry** / **Show less** disclosure controls so one entry cannot dominate History. With filters, entries, and Patterns populated, the entire Journal must remain locked to the phone viewport width; the filter controls themselves must also fit in bounded grid rows rather than creating any horizontal pan surface.
5. **Patterns** is a core Journal surface: its collapsed row should identify it as trends across entries, and opening it with no entries should explain that recurring feelings, needs, tags, and intensity trends will appear as entries accumulate. **Backup & restore** remains available below it but visually quieter.
6. Confirm the full-screen Journal editor still opens from **New entry** and that the accepted per-Feeling intensity, Needs popup, and Tags interactions from section 6 are unchanged.
7. Confirm the fallback editor presents the same Feeling / Needs / Tags / Reflection form semantics and the same reflection prompts as **New entry**. It may be denser because it is a recovery container, but it must not introduce alternate Journal labels, prompts, fields, or save behavior.
8. Open **Alexithymia Support**, advance to **Step 4: Reflect and journal**, and open Journal there. It must open the same global Journal form used elsewhere, not a support-specific form. The Alexithymia page may explain why the Journal is being offered, but the Journal itself must retain the same labels, prompts, fields, actions, storage, and history semantics.

Pass condition: History and Patterns read as the two core dedicated-Journal surfaces; empty history does not expose meaningless controls or flash them during first paint; populated history does not flash an empty state; populated filters use self-explanatory neutral labels and remain bounded to the viewport; entries are easy to scan within one phone viewport, with long reflections collapsed by default and fully available on demand; Clear filters only appears when there is something to clear; Backup remains secondary; the fallback editor is visually pushed back and differs only in container/density; and every Journal entry point uses the one canonical Journal form definition.

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
- Journal creation/editing and Journal History filtering, including one long-entry expand/collapse check;
- Alexithymia Support Step 4 opening the same canonical Journal;
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