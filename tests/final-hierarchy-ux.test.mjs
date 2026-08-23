import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('Journal history is the primary surface and utilities are native disclosures', async () => {
  const build = await load('scripts/build-pages.mjs');
  const runtime = await load('scripts/inventory.js');
  const moduleSource = await load('assets/js/journal/module.js');
  const css = await load('styles.css');
  const html = await load('inventory/journal/index.html');
  for (const source of [build, html]) {
    assert.ok(source.includes('journal-fullscreen-button--compact'));
    assert.ok(source.includes('>New entry<'));
    assert.ok(source.includes('class="journal-history-controls__filters"'));
    assert.ok(source.includes('journal-utility-disclosure'));
    assert.ok(source !== html || source.indexOf('<section class="journal-history-section journal-panel') < source.indexOf('<div class="journal-overview-grid"'));
    assert.equal(source.includes('data-journal-summary-toggle'), false);
    assert.equal(source.includes('journal-page-description'), false);
    assert.equal((source.match(/data-journal-history/g) || []).length, 1);
  }
  assert.equal(runtime.includes('journalSummaryToggle'), false);
  assert.equal(runtime.includes('updateJournalSummaryVisibility'), false);
  assert.ok(build.includes(".journal-utility-disclosure:not([open]) > .journal-utility-disclosure__body"), 'closed Journal utility disclosures must hide their bodies explicitly for Safari');
  assert.ok(html.includes(".journal-utility-disclosure:not([open]) > .journal-utility-disclosure__body"), 'generated Journal must ship the Safari closed-details rule');
  assert.ok(css.includes('.journal-inline-fallback:not([open]) > .journal-inline-fallback__body'), 'closed inline fallback must not render its body');
  assert.ok(build.includes('data-journal-notes-rows="5"'), 'fallback Journal editor must request a compact reflection field');
  assert.ok(html.includes('data-journal-notes-rows="5"'), 'generated Journal must ship the compact fallback reflection density');
  assert.ok(moduleSource.includes('dataset.journalNotesRows'), 'Journal module must support per-instance reflection row density');
  assert.ok(css.includes('.journal-inline-fallback[open] .journal-form__sheet'), 'fallback editor must neutralize the full-screen sheet minimum height');
  assert.ok(build.includes('data-journal-filters-reset hidden>Clear filters</button>'), 'filter reset must stay outside the horizontal filter strip until needed');
  assert.ok(runtime.includes('updateJournalFiltersResetVisibility'), 'filter reset visibility must be state-driven');
  assert.ok(build.includes('journal-utility-disclosure__hint">Trends across entries'), 'Patterns must explain its role before it is opened');
  assert.ok(runtime.includes('Patterns grow with your journal.'), 'empty Patterns must explain what will appear later');
  assert.ok(build.includes('journal-inline-fallback__summary-text">Fallback editor'), 'fallback editor must be labeled as secondary recovery UI');
  assert.ok(css.includes('border-top: 1px solid color-mix(in srgb, var(--outline) 14%, transparent);'), 'fallback editor must use pushed-back separator styling');
  assert.ok(css.includes('.journal-inline-fallback[open] .journal-form,'), 'fallback form must use the full available inline width');
  assert.ok(build.includes('>Any feeling</option>'), 'Feeling filter neutral state must be contextual');
  assert.ok(build.includes('>Any need</option>'), 'Need filter neutral state must be contextual');
  assert.ok(build.includes('>Any tag</option>'), 'Tag filter neutral state must be contextual');
  assert.ok(build.includes('journal-empty--history'), 'Journal History must ship a purposeful empty state');
  assert.ok(runtime.includes("state.journalFiltersForm.hidden = !hasJournalEntries"), 'filters must disappear when there is nothing to filter');
  assert.ok(runtime.includes("control.hidden = entries.length === 0"), 'empty filter dimensions must stay out of the UI');
  assert.ok(runtime.includes("'No matches'"), 'filtered-empty history must distinguish no matches from no entries');
  assert.ok(build.includes('function journalHistoryPrepaintScript()'), 'Journal must classify local entry state before first paint');
  assert.ok(build.includes("prepaintExtras: journalHistoryPrepaintScript()"), 'Journal must use the prepaint hook rather than a post-paint normalizer');
  assert.ok(html.includes('data-journal-prepaint'), 'generated Journal must ship the tiny state bootstrap');
  const prepaintStart = build.indexOf('function journalHistoryPrepaintScript()');
  const prepaintEnd = build.indexOf('function renderInventoryJournalPage', prepaintStart);
  const prepaintOwner = build.slice(prepaintStart, prepaintEnd);
  assert.ok(prepaintOwner.includes('</script>'), 'Journal prepaint bootstrap must emit a real HTML closing script tag');
  assert.equal(/<\\+\/script>/.test(prepaintOwner), false, 'escaped script closers must never leak into generated HTML');
  assert.equal(html.includes('<\\/script>'), false, 'generated Journal must not ship an escaped script closing tag');
  assert.ok(html.indexOf('data-journal-prepaint') < html.indexOf('styles/shared-density.css'), 'Journal state bootstrap must run before render-blocking page styles');
  assert.ok(html.includes("html[data-journal-state='empty'] main[data-page-id='inventory-journal'] .journal-history-controls"), 'empty Journal filters must be hidden by first-paint CSS');
  assert.ok(runtime.includes("document.documentElement.setAttribute('data-journal-state'"), 'runtime must keep the prepaint state attribute synchronized after saves/deletes');

  // Regression target: populated Journal filters must fit the viewport by
  // construction. A wide horizontal select rail proved capable of exporting
  // intrinsic width to mobile Safari's document even when ancestors had
  // min-width:0. Use a bounded grid instead; no document or filter-rail pan is
  // part of the final mobile interaction contract.
  for (const source of [build, html]) {
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-history-controls__filters {"), 'Journal must own its populated filters at the generator layer');
    assert.ok(source.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'mobile Journal filters must use bounded tracks');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-history-control select {\n        width: 100%;\n        min-width: 0;\n        max-width: 100%;"), 'native selects must shrink inside their grid tracks');
    assert.equal(source.includes('overflow-x: auto;\n        overflow-y: hidden;\n        overscroll-behavior-inline: contain;'), false, 'the retired horizontal filter rail must not return');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-summary__stat,"), 'Patterns cards must participate in the Journal shrink-to-viewport contract');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-entry__title-row {"), 'populated entries must participate in the Journal shrink-to-viewport contract');
    assert.ok(source.includes('grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));'), 'Patterns grid minimums must never exceed their available inline size');
    assert.ok(source.includes('overflow-wrap: anywhere;'), 'user Journal content must not export long-token width to the document');
  }

  assert.ok(runtime.includes('const JOURNAL_HISTORY_COLLAPSE_AFTER_WORDS = 80;'), 'long Journal entries must have a stable collapse threshold');
  assert.ok(runtime.includes("details.className = 'journal-entry__notes-disclosure'"), 'long entries must use a native disclosure rather than overpowering History');
  assert.ok(runtime.includes("closedLabel.textContent = 'Read full entry'"), 'collapsed long entries must have an explicit expansion action');
  assert.ok(runtime.includes("openLabel.textContent = 'Show less'"), 'expanded long entries must be collapsible again');
  assert.ok(css.includes('.journal-entry__notes-disclosure[open] .journal-entry__notes--preview'), 'History disclosure state must be styled at the canonical Journal-entry owner');
  assert.ok(moduleSource.includes("heading: 'Optional reflection prompts'"), 'Journal prompts must use neutral professional labeling');
  assert.equal(moduleSource.includes('Need a nudge?'), false, 'retired conversational Journal prompt heading must not return');
  assert.equal(moduleSource.includes('shining through or feeling tender'), false, 'retired anthropomorphic Journal prompt copy must not return');
});

test('Need strategy browsing and personal strategy editing use compact final hierarchy', async () => {
  const build = await load('scripts/build-pages.mjs');
  const css = await load('styles.css');
  const need = await load('needs/acceptance/index.html');
  assert.ok(build.includes('class="strategy-section__header"'));
  assert.ok(need.includes('class="strategy-section__header"'));
  assert.equal(need.includes('Shuffle cards'), false);
  assert.ok(need.includes('>Shuffle</button>'));
  assert.ok(css.includes('.strategy-section__header {'));
  assert.ok(css.includes('background: color-mix(in srgb, var(--mint) 30%, #ffffff 70%);'));
  assert.ok(css.includes('min-height: 4.75rem;'));
  assert.ok(css.includes('font-size: 0.68rem;'));
  assert.equal((css.match(/\n\.strategy-section \{/g) || []).length, 1, 'strategy section must have one canonical base rule');
  assert.equal((css.match(/\n\.strategy-deck__shuffle,\n\.strategy-deck__toggle \{/g) || []).length, 1, 'strategy browsing controls must have one canonical base rule');
  assert.equal((css.match(/\n\.strategy-form \{/g) || []).length, 1, 'personal strategy form must have one canonical base rule');
  assert.equal(css.includes('min-height: 6.5rem'), false, 'prototype textarea height must stay retired');
});
