import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('Journal Feeling intensity is selected inside the Feeling popup and Needs remains a catalog popup', async () => {
  const moduleSource = await load('assets/js/journal/module.js');
  const css = await load('styles/shared-density.css');
  assert.ok(moduleSource.includes("needsMode: 'catalog-multiselect'"));
  assert.ok(moduleSource.includes("kind: 'feeling'"));
  assert.ok(moduleSource.includes("kind: 'needs'"));
  assert.ok(moduleSource.includes("'data-journal-catalog-popover': kind") || moduleSource.includes("setAttribute('data-journal-catalog-popover'"));
  assert.ok(moduleSource.includes("type: 'hidden', value: ''"));
  assert.ok(moduleSource.includes("tags: 'work, weekend, boundaries'"));
  assert.ok(!moduleSource.includes("text: 'Selected needs'"));
  assert.ok(!moduleSource.includes('emotionDatalist'));
  assert.ok(!moduleSource.includes('updateNeedsSuggestions()'));
  assert.ok(css.includes('.journal-catalog-popover[hidden] { display:none !important; }'));
  assert.ok(css.includes('.journal-catalog-option.is-selected'));
  assert.ok(moduleSource.includes("data-journal-feeling-intensity"));
  assert.ok(moduleSource.includes("min: 0"));
  assert.ok(moduleSource.includes("const feelings = this.getFeelingRatings()"));
  assert.ok(!moduleSource.includes("'journal-meta-row--intensity'"));
  assert.ok(css.includes('.journal-feeling-rating {'));
});

test('Journal History filters individual feelings from multi-feeling entries', async () => {
  const runtime = await load('scripts/inventory.js');
  assert.ok(runtime.includes('function parseJournalFeelings(value)'));
  assert.ok(runtime.includes('function parseJournalFeelingRatings(entry)'));
  assert.ok(runtime.includes('parseJournalFeelingRatings(entry).map((item) => item.feeling)'));
  assert.ok(runtime.includes('parseJournalFeelingRatings(entry).some(({ feeling }) => normalize(feeling) === emotionFilter)'));
  assert.ok(runtime.includes("need: (formData.get('need') || '')"));
});
