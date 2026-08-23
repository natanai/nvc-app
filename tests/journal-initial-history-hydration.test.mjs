import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('Journal history hydrates persisted entries on initial load before any sort or filter interaction', async () => {
  const runtime = await load('scripts/inventory.js');
  assert.ok(runtime.includes("state.journalEntries = store && typeof store.list === 'function' ? store.list() : [];"));
  const updateStart = runtime.indexOf('function updateJournalEntriesFromStore() {');
  const finalizerStart = runtime.indexOf('const finalizeJournalSetup = () => {');
  assert.ok(updateStart >= 0);
  assert.ok(finalizerStart > updateStart);
  const updateBlock = runtime.slice(updateStart, finalizerStart);
  assert.ok(updateBlock.includes('renderJournalViews();'));
  assert.equal(updateBlock.includes('renderJournalHistory();'), false);

  // Async Journal setup must reconcile the current store after the DOM/controller
  // exists; a later user change to Sort/Search must never be the hydration trigger.
  const overlayIndex = runtime.indexOf('setupJournalOverlay();', finalizerStart);
  const reconcileIndex = runtime.indexOf('state.journalStore = resolveJournalStore() || state.journalStore;', finalizerStart);
  const listenerIndex = runtime.indexOf('registerJournalStoreListeners();', finalizerStart);
  const hydrateIndex = runtime.indexOf('updateJournalEntriesFromStore();', finalizerStart);
  assert.ok(overlayIndex > finalizerStart);
  assert.ok(reconcileIndex > overlayIndex);
  assert.ok(listenerIndex > reconcileIndex);
  assert.ok(hydrateIndex > listenerIndex);
  assert.equal(/updateJournalEntriesFromStore\(\);\s*renderJournalViews\(\);/.test(runtime), false);
});
