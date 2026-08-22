import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('Journal canonical model stores intensity per feeling with legacy compatibility fields', async () => {
  const model = await load('assets/js/journal/model.js');
  const store = await load('assets/js/journal/store.js');
  const moduleSource = await load('assets/js/journal/module.js');
  assert.ok(model.includes('feelings: []'));
  assert.ok(store.includes('const normalizeFeelingRatings ='));
  assert.ok(store.includes('Math.max(...overrides.feelings.map((item) => item.intensity))'));
  assert.ok(moduleSource.includes('return { feelings, emotion, intensity: intensityValue, needs, tags, notes }'));
  assert.ok(moduleSource.includes("0 means not selected"));
});
