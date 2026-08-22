import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('Journal Feeling and Needs are catalog-backed popup multi-selectors', async () => {
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
});

test('Journal History filters individual feelings from multi-feeling entries', async () => {
  const runtime = await load('scripts/inventory.js');
  assert.ok(runtime.includes('function parseJournalFeelings(value)'));
  assert.ok(runtime.includes('entries.flatMap((entry) => parseJournalFeelings(entry.emotion))'));
  assert.ok(runtime.includes('parseJournalFeelings(entry.emotion).some((feeling) => normalize(feeling) === emotionFilter)'));
  assert.ok(runtime.includes("need: (formData.get('need') || '')"));
});
