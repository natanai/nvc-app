import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

test('Bedrock preserves persisted presentation-state namespaces and first-paint hydration', async () => {
  const [inventory, magnets, buildPages, inventoryHtml, needsHtml] = await Promise.all([
    read('scripts/inventory.js'),
    read('scripts/magnets/magnetPhysics.js'),
    read('scripts/build-pages.mjs'),
    read('inventory/index.html'),
    read('needs/index.html'),
  ]);

  assert.ok(inventory.includes("const THEME_STORAGE_KEY = 'nvcApp.theme';"));
  assert.ok(inventory.includes("const NAV_SETTINGS_STORAGE_KEY = 'nvcApp.navSettings';"));
  assert.ok(magnets.includes("const STORAGE_PREFIX = 'magnetPositions:';"));
  assert.ok(magnets.includes('export function loadPositions('));
  assert.ok(magnets.includes('export function savePositions('));

  assert.ok(buildPages.includes("const NAV_MAGNET_STORAGE_KEY = 'site-nav';"));
  assert.ok(buildPages.includes('const magnetPrefillScript = (storageKey) => String.raw`'));
  assert.ok(buildPages.includes("var STORAGE_KEY = 'magnetPositions:${storageKey}';"));
  assert.ok(buildPages.includes('const prefill = magnetPrefillScript(NAV_MAGNET_STORAGE_KEY);'));
  assert.ok(!buildPages.includes("magnetPrefillScript(type + '-hub-v4'"));
  assert.ok(buildPages.includes("var storageKey = 'nvcApp.navSettings';"));
  assert.ok(inventoryHtml.includes("var STORAGE_KEY = 'magnetPositions:site-nav';"));
  assert.ok(inventoryHtml.includes("var storageKey = 'nvcApp.navSettings';"));
  assert.ok(needsHtml.includes("var STORAGE_KEY = 'magnetPositions:site-nav';"));
  assert.ok(!needsHtml.includes("var STORAGE_KEY = 'magnetPositions:needs-hub-v4';"));
  assert.ok(needsHtml.includes("var storageKey = 'nvcApp.navSettings';"));
});

test('Bedrock keeps the Customizer and conditional navigation capabilities wired', async () => {
  const inventory = await read('scripts/inventory.js');

  assert.ok(inventory.includes('async function initCustomizer()'));
  assert.ok(inventory.includes('initCustomizer().catch('));
  assert.ok(inventory.includes("id: 'customizer'"));
  assert.ok(inventory.includes("id: 'fauxFeelings'"));
  assert.ok(inventory.includes("id: 'bodyCues'"));
  assert.ok(inventory.includes("id: 'journalDashboard'"));
  assert.ok(inventory.includes('tiltToggle'));
  assert.ok(inventory.includes('fetchColorPresets'));
});

test('Bedrock keeps restore, Journal, account sync, and magnet-play integration present', async () => {
  const [restore, magnets] = await Promise.all([
    read('scripts/profile-restore-rehydration.js'),
    read('scripts/magnets.js'),
  ]);

  assert.ok(restore.includes("const MIRRORED_CUSTOMIZER_KEYS = ['nvcApp.theme', 'nvcApp.navSettings'];"));
  assert.ok(restore.includes('Magnet positions and play state live inside the running magnet engine.'));
  assert.ok(restore.includes('pauseActiveMagnetBoards()'));
  assert.ok(magnets.includes("const NAV_STORAGE_KEY = 'site-nav';"));
  assert.ok(magnets.includes('loadPositions'));
  assert.ok(magnets.includes('savePositions'));

  await fs.access(path.join(root, 'assets/js/journal/store.js'));
  await fs.access(path.join(root, 'scripts/inventory-bluesky.js'));
  await fs.access(path.join(root, 'scripts/inventory-store.js'));
});
