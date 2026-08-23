import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

test('Bedrock preserves persisted presentation-state namespaces and responsive first-paint hydration', async () => {
  const [inventory, magnetPhysics, magnetRuntime, buildPages, navPrepaint, inventoryHtml, needsHtml, observationsHtml] = await Promise.all([
    read('scripts/inventory.js'),
    read('scripts/magnets/magnetPhysics.js'),
    read('scripts/magnets.js'),
    read('scripts/build-pages.mjs'),
    read('scripts/nav-prepaint.mjs'),
    read('inventory/index.html'),
    read('needs/index.html'),
    read('observations/index.html'),
  ]);

  assert.ok(inventory.includes("const THEME_STORAGE_KEY = 'nvcApp.theme';"));
  assert.ok(inventory.includes("const NAV_SETTINGS_STORAGE_KEY = 'nvcApp.navSettings';"));
  assert.ok(magnetPhysics.includes("const STORAGE_PREFIX = 'magnetPositions:';"));
  assert.ok(magnetPhysics.includes('export function loadPositions('));
  assert.ok(magnetPhysics.includes('export function savePositions('));

  assert.ok(buildPages.includes("from './nav-prepaint.mjs';"));
  assert.ok(buildPages.includes('navVisibilityBootstrapScript'));
  assert.ok(navPrepaint.includes("export const NAV_MAGNET_STORAGE_KEY = 'site-nav';"));
  assert.ok(navPrepaint.includes('export const magnetPrefillScript = (storageKey) => String.raw`'));
  assert.ok(navPrepaint.includes("var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';"));
  assert.ok(navPrepaint.includes("var bucket = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';"));
  assert.ok(navPrepaint.includes("var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;"));
  assert.ok(navPrepaint.includes("var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';"));
  assert.equal(
    navPrepaint.includes('parsed.boardHeight'),
    false,
    'responsive navigation prepaint must not restore a route-specific historical board height',
  );
  assert.ok(buildPages.includes('const prefill = magnetPrefillScript(NAV_MAGNET_STORAGE_KEY);'));
  assert.ok(!buildPages.includes("magnetPrefillScript(type + '-hub-v4'"));
  assert.ok(navPrepaint.includes("var storageKey = 'nvcApp.navSettings';"));

  assert.ok(magnetRuntime.includes("const NAV_MOBILE_ORDER_QUERY = '(max-width: 640px)';"));
  assert.ok(magnetRuntime.includes("const RESPONSIVE_LAYOUT_MIGRATION_SUFFIX = '@responsive-v1';"));
  assert.ok(magnetRuntime.includes('persistenceKey: resolveResponsiveStorageKey(resolvedStorageKey)'));
  assert.ok(magnetRuntime.includes('loadPositions(\n    state.persistenceKey,'));
  assert.ok(magnetRuntime.includes('savePositions(\n      state.persistenceKey,') || magnetRuntime.includes('savePositions(\n        state.persistenceKey,'));

  for (const html of [inventoryHtml, needsHtml, observationsHtml]) {
    assert.ok(html.includes("var LEGACY_STORAGE_KEY = 'magnetPositions:site-nav';"));
    assert.ok(html.includes("var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;"));
    assert.ok(html.includes("var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';"));
    assert.ok(html.includes("var storageKey = 'nvcApp.navSettings';"));
  }
  assert.ok(!needsHtml.includes("var LEGACY_STORAGE_KEY = 'magnetPositions:needs-hub-v4';"));
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
