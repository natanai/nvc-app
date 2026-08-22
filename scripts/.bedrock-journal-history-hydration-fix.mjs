import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Non-unique ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

{
  const path = 'scripts/inventory.js';
  let source = read(path);

  source = replaceOnce(
    source,
`function updateJournalEntriesFromStore() {
  const store = ensureJournalStore();
  state.journalEntries = store ? store.list() : [];
  updateJournalTagSource();
  renderJournalOverlayHistory();
  renderJournalHistory();
}`,
`function updateJournalEntriesFromStore() {
  const store = ensureJournalStore();
  state.journalEntries = store && typeof store.list === 'function' ? store.list() : [];
  updateJournalTagSource();
  renderJournalViews();
}`,
    'Journal store hydration owner',
  );

  source = replaceOnce(
    source,
`  const finalizeJournalSetup = () => {
    setupJournalOverlay();
    registerJournalStoreListeners();
  };`,
`  const finalizeJournalSetup = () => {
    setupJournalOverlay();
    state.journalStore = resolveJournalStore() || state.journalStore;
    registerJournalStoreListeners();
    updateJournalEntriesFromStore();
  };`,
    'Journal setup finalizer',
  );

  source = source.replace(
    /updateJournalEntriesFromStore\(\);\n(\s*)renderJournalViews\(\);/g,
    'updateJournalEntriesFromStore();',
  );

  write(path, source);
}

{
  const path = 'tests/journal-initial-history-hydration.test.mjs';
  const testSource = [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { promises as fs } from 'node:fs';",
    "import path from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    '',
    "const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');",
    "const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');",
    '',
    "test('Journal history hydrates persisted entries after async Journal setup without user interaction', async () => {",
    "  const runtime = await load('scripts/inventory.js');",
    "  assert.ok(runtime.includes(\"state.journalEntries = store && typeof store.list === 'function' ? store.list() : [];\"));",
    "  const updateStart = runtime.indexOf('function updateJournalEntriesFromStore() {');",
    "  const finalizerStart = runtime.indexOf('const finalizeJournalSetup = () => {');",
    "  assert.ok(updateStart >= 0);",
    "  assert.ok(finalizerStart > updateStart);",
    "  const updateBlock = runtime.slice(updateStart, finalizerStart);",
    "  assert.ok(updateBlock.includes('renderJournalViews();'));",
    "  assert.equal(updateBlock.includes('renderJournalHistory();'), false);",
    '',
    "  const overlayIndex = runtime.indexOf('setupJournalOverlay();', finalizerStart);",
    "  const reconcileIndex = runtime.indexOf('state.journalStore = resolveJournalStore() || state.journalStore;', finalizerStart);",
    "  const listenerIndex = runtime.indexOf('registerJournalStoreListeners();', finalizerStart);",
    "  const hydrateIndex = runtime.indexOf('updateJournalEntriesFromStore();', finalizerStart);",
    "  assert.ok(overlayIndex > finalizerStart);",
    "  assert.ok(reconcileIndex > overlayIndex);",
    "  assert.ok(listenerIndex > reconcileIndex);",
    "  assert.ok(hydrateIndex > listenerIndex);",
    "  assert.equal(/updateJournalEntriesFromStore\\(\\);\\s*renderJournalViews\\(\\);/.test(runtime), false);",
    '});',
    '',
  ].join('\n');
  write(path, testSource);

  const packagePath = 'package.json';
  const pkg = JSON.parse(read(packagePath));
  if (!pkg.scripts['test:flicker-jitter'].includes('tests/journal-initial-history-hydration.test.mjs')) {
    pkg.scripts['test:flicker-jitter'] += ' tests/journal-initial-history-hydration.test.mjs';
  }
  write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

{
  const path = 'docs/bedrock-acceptance-checklist.md';
  let source = read(path);
  source = replaceOnce(
    source,
    '3. After at least one entry exists, Search and the relevant filter dimensions should appear. Neutral picker values must be contextual—**Any feeling**, **Any need**, **Any tag**, **Any time**—rather than a row of ambiguous **All** values. A filter dimension with no available values should stay out of the UI, and **Clear filters** should appear only when a filter is active.',
    '3. After at least one entry exists, fully reload or reopen Journal. The saved entry and its relevant filter dimensions must appear immediately without touching Sort, Search, or another control. Search and the relevant filter dimensions should appear with contextual neutral values—**Any feeling**, **Any need**, **Any tag**, **Any time**—rather than a row of ambiguous **All** values. A filter dimension with no available values should stay out of the UI, and **Clear filters** should appear only when a filter is active.',
    'Journal reload acceptance step',
  );
  write(path, source);
}

console.log('Journal initial-history hydration repair applied.');
