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
