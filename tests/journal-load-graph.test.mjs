import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

test('ordinary pages keep the Journal store out of the parser graph', async () => {
  const home = await read('index.html');
  const need = await read('needs/acceptance/index.html');
  const feeling = await read('feelings/anxious/index.html');
  const feed = await read('feed/index.html');

  for (const [name, html] of Object.entries({ home, need, feeling, feed })) {
    assert.ok(
      !html.includes('assets/js/journal/store.js'),
      `${name} should not parser-load the Journal store`,
    );
  }
});

test('the dedicated Journal surface remains eager and self-contained', async () => {
  const journal = await read('inventory/journal/index.html');
  const module = await read('assets/js/journal/module.js');
  const store = await read('assets/js/journal/store.js');

  assert.ok(journal.includes('assets/js/journal/store.js'));
  assert.ok(journal.includes('assets/js/journal/module.js'));
  assert.ok(module.startsWith("import store, { loadDraft, saveDraft, clearDraft } from './store.js';"));
  assert.ok(store.includes('window.NVCJournalStore = store;'));
  assert.ok(store.includes("window.dispatchEvent(new CustomEvent('nvc-journal-store-ready'"));
});

test('shared generator no longer assigns the Journal store to every page', async () => {
  const buildPages = await read('scripts/build-pages.mjs');

  const baseScriptsStart = buildPages.indexOf('function normalizeScripts(scripts)');
  const baseScriptsEnd = buildPages.indexOf('function htmlPage(', baseScriptsStart);
  const baseScripts = buildPages.slice(baseScriptsStart, baseScriptsEnd);
  assert.ok(baseScriptsStart >= 0 && baseScriptsEnd > baseScriptsStart);
  assert.ok(!baseScripts.includes("{ src: 'assets/js/journal/store.js', module: true }"));
  assert.ok(baseScripts.includes('const beforeBaseScripts = scripts.filter'));
  assert.ok(baseScripts.includes('const entries = [...beforeBaseScripts, ...baseScripts, ...regularScripts];'));

  const journalPageStart = buildPages.indexOf("mainAttributes: 'data-page-id=\"inventory-journal\"'");
  const journalPageBlock = buildPages.slice(journalPageStart, journalPageStart + 900);
  assert.ok(journalPageStart >= 0);
  assert.ok(journalPageBlock.includes("{ src: 'assets/js/journal/store.js', type: 'module', beforeBase: true }"));
  assert.ok(journalPageBlock.includes("{ src: 'assets/js/journal/module.js', type: 'module' }"));
});

test('ordinary Journal overlay binds cheaply and initializes its module only on activation', async () => {
  const inventory = await read('scripts/inventory.js');

  assert.ok(inventory.includes(
    "if (!panel) {\n    setupJournalOverlay();\n    registerJournalStoreListeners();\n    return;\n  }",
  ));
  assert.ok(!inventory.includes(
    "if (!panel) {\n    setupStandaloneJournalOverlay();\n    registerJournalStoreListeners();\n    return;\n  }",
  ));

  const lazyActivation =
    "if (!state.journalFormSectionEl) {\n    setupStandaloneJournalOverlay();\n    loadJournalReferenceData();\n  }";
  assert.ok(inventory.includes(lazyActivation), 'Journal activation should build the form lazily');

  assert.ok(inventory.includes(
    "if (document.querySelector('[data-inventory-section=\"journal\"]')) {\n    loadJournalReferenceData();\n  }",
  ));
});
