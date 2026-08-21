import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

function hasInventoryScript(html, relativeSrc) {
  return html.includes(`src="${relativeSrc}"`);
}

test('validated lazy routes keep the shared Inventory controller off parser first load', async () => {
  const [home, feed, feedRuntime] = await Promise.all([
    read('index.html'),
    read('feed/index.html'),
    read('scripts/strategy-feed.js'),
  ]);

  assert.ok(!hasInventoryScript(home, 'scripts/inventory.js'), 'Home is the ordinary-page lazy canary');
  assert.ok(home.includes('src="scripts/shell-runtime-loader.js"'), 'Home should retain its small intent loader');
  assert.ok(home.includes('data-shell-customizer-placeholder'), 'Home must preserve the desktop Customizer shell before runtime');

  assert.ok(!hasInventoryScript(feed, '../scripts/inventory.js'), 'Shared Strategies should not parser-load the shared controller');
  assert.ok(feedRuntime.includes("const INVENTORY_RUNTIME_URL = new URL('./inventory.js"), 'Feed should retain interaction-owned controller loading');
  assert.ok(feedRuntime.includes('function finishAfterInventoryInitialization(resolve)'), 'Feed lazy loading must wait for DOM initialization');
});

test('routes with immediately visible controller-owned features remain eager', async () => {
  const [need, inventory, journal] = await Promise.all([
    read('needs/acceptance/index.html'),
    read('inventory/index.html'),
    read('inventory/journal/index.html'),
  ]);

  assert.ok(hasInventoryScript(need, '../../scripts/inventory.js'), 'Need detail pages expose an immediately usable strategy form');
  assert.ok(need.includes('data-strategy-form'), 'Need fixture must continue proving the visible strategy feature exists');
  assert.ok(need.includes('class="strategy-card__save"'), 'Need fixture must continue proving visible strategy-save controls exist');

  assert.ok(hasInventoryScript(inventory, '../scripts/inventory.js'), 'Inventory workspace must keep its canonical controller eager');
  assert.ok(inventory.includes('id="inventory-list"'), 'Inventory fixture should remain the actual workspace');

  assert.ok(hasInventoryScript(journal, '../../scripts/inventory.js'), 'Dedicated Journal remains an explicit eager shell owner');
  assert.ok(journal.includes('assets/js/journal/store.js'), 'Dedicated Journal store must remain eager');
  assert.ok(journal.includes('assets/js/journal/module.js'), 'Dedicated Journal module must remain eager');
});

test('candidate content classes stay unchanged until their explicit browser-audited migration', async () => {
  const [feeling, fauxFeeling] = await Promise.all([
    read('feelings/afraid/index.html'),
    read('faux-feelings/abandoned/index.html'),
  ]);

  assert.ok(hasInventoryScript(feeling, '../../scripts/inventory.js'), 'Feeling details must not be bulk-deferred before Home acceptance');
  assert.ok(hasInventoryScript(fauxFeeling, '../../scripts/inventory.js'), 'Faux-feeling details must not be bulk-deferred before Home acceptance');
});
