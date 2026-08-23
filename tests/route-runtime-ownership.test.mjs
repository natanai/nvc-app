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
  assert.ok(need.includes('data-save-to-device-button="true"'), 'Need fixture must continue proving compiler-authored visible strategy-save controls exist');
  assert.ok(need.includes('data-save-to-profile-button="true"'), 'Need fixture must continue proving the Profile save control exists before runtime binding');

  assert.ok(hasInventoryScript(inventory, '../scripts/inventory.js'), 'Inventory workspace must keep its canonical controller eager');
  assert.ok(inventory.includes('id="inventory-list"'), 'Inventory fixture should remain the actual workspace');

  assert.ok(hasInventoryScript(journal, '../../scripts/inventory.js'), 'Dedicated Journal remains an explicit eager shell owner');
  assert.ok(journal.includes('assets/js/journal/store.js'), 'Dedicated Journal store must remain eager');
  assert.ok(journal.includes('assets/js/journal/module.js'), 'Dedicated Journal module must remain eager');
});

test('post-Bedrock content canaries keep route features eager while intent-loading the shared controller', async () => {
  const [feelingsIndex, needsIndex, fauxIndex, feeling, fauxFeeling, bodyCues] = await Promise.all([
    read('feelings/index.html'),
    read('needs/index.html'),
    read('faux-feelings/index.html'),
    read('feelings/afraid/index.html'),
    read('faux-feelings/abandoned/index.html'),
    read('feelings/body-cues/index.html'),
  ]);

  const lazyFixtures = [
    ['Feelings index', feelingsIndex, '../scripts/inventory.js', '../scripts/shell-runtime-loader.js'],
    ['Needs index', needsIndex, '../scripts/inventory.js', '../scripts/shell-runtime-loader.js'],
    ['Faux-feelings index', fauxIndex, '../scripts/inventory.js', '../scripts/shell-runtime-loader.js'],
    ['Feeling detail', feeling, '../../scripts/inventory.js', '../../scripts/shell-runtime-loader.js'],
    ['Faux-feeling detail', fauxFeeling, '../../scripts/inventory.js', '../../scripts/shell-runtime-loader.js'],
    ['Body Cues', bodyCues, '../../scripts/inventory.js', '../../scripts/shell-runtime-loader.js'],
  ];

  for (const [label, html, inventorySrc, loaderSrc] of lazyFixtures) {
    assert.ok(!hasInventoryScript(html, inventorySrc), label + ' must keep the large shared controller off parser first load');
    assert.ok(hasInventoryScript(html, loaderSrc), label + ' must retain the shell intent loader');
    assert.ok(html.includes('scripts/inventory-core-shell.js'), label + ' must keep the shared Menu/navigation shell eager');
    assert.ok(html.includes('scripts/magnets.js'), label + ' must keep magnet interaction eager');
  }

  assert.ok(feeling.includes('scripts/feeling-reverse-inference.js'), 'Feeling reverse inference must remain an eager route-owned feature');
  assert.ok(bodyCues.includes('scripts/body-cues-tool.js'), 'Body Cues interaction must remain an eager route-owned feature');
});
