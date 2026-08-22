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
});
