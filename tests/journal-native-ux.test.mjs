import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('Journal metadata uses one compact Feeling Intensity Needs Tags grammar', async () => {
  const moduleSource = await load('assets/js/journal/module.js');
  const css = await load('styles/shared-density.css');
  assert.ok(moduleSource.includes("needsMode: 'combobox'"));
  assert.ok(moduleSource.includes("emotion: 'Feeling'"));
  assert.ok(moduleSource.includes("needs: 'Needs'"));
  assert.ok(moduleSource.includes("tags: 'Tags'"));
  assert.ok(moduleSource.includes("classes: ['journal-meta-group']"));
  assert.ok(moduleSource.includes("'journal-meta-row--intensity'"));
  assert.ok(!moduleSource.includes("text: 'Selected needs'"));
  assert.ok(css.includes('.journal-meta-group {'));
});

test('Journal history shares Feeling Need Tag vocabulary and no prototype instructions', async () => {
  const builder = await load('scripts/build-pages.mjs');
  const runtime = await load('scripts/inventory.js');
  const html = await load('inventory/journal/index.html');
  for (const source of [builder, html]) {
    assert.ok(source.includes('class="journal-history-controls" data-journal-filters'));
    assert.ok(source.includes('name="emotion"'));
    assert.ok(source.includes('name="need"'));
    assert.ok(source.includes('name="tag"'));
    assert.ok(!source.includes('Search entries, focus on a tag, or sort by intensity to notice patterns.'));
    assert.ok(!source.includes('Tag what’s present now. Feeling optional—notes are enough.'));
  }
  assert.ok(runtime.includes('syncJournalHistoryFilterOptions'));
  assert.ok(runtime.includes("emotion: (formData.get('emotion') || '')"));
  assert.ok(runtime.includes("need: (formData.get('need') || '')"));
  assert.ok(runtime.includes('journal-value-token journal-value-token--need'));
});
