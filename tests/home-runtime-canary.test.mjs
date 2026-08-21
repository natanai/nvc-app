import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

test('Home preserves first-paint shell while leaving Inventory runtime off first load', async () => {
  const [home, need, inventory] = await Promise.all([
    read('index.html'), read('needs/acceptance/index.html'), read('inventory/index.html'),
  ]);
  assert.ok(home.includes('data-shell-customizer-placeholder'));
  assert.ok(home.includes('class="palette-corner__toggle"'));
  assert.ok(home.includes('<span class="palette-corner__glyph">+</span>'));
  assert.ok(home.includes('<span class="visually-hidden">Open customizer</span>'));
  assert.ok(home.includes('<script src="scripts/shell-runtime-loader.js" defer></script>'));
  assert.ok(!home.includes('<script src="scripts/inventory.js" defer></script>'));
  assert.ok(home.indexOf('scripts/shell-runtime-loader.js') < home.indexOf('scripts/inventory-core-shell.js'));
  assert.ok(need.includes('../../scripts/inventory.js'));
  assert.ok(inventory.includes('../scripts/inventory.js'));
});

test('Home loader preserves count and capture/replay readiness for shell-owned actions', async () => {
  const source = await read('scripts/shell-runtime-loader.js');
  assert.ok(source.includes("const INVENTORY_STORAGE_KEY = 'nvcApp.inventory';"));
  assert.ok(source.includes('return Array.isArray(parsed) ? parsed.length : 0;'));
  for (const selector of [
    '[data-palette-toggle]', '[data-support-journal-open]', '[data-menu-drill="account-data"]',
    '[data-menu-action="share-with-nat"]', '#inventory-export', '#inventory-import-trigger',
    '[data-backend-save-button]', '[data-backend-load-button]',
  ]) assert.ok(source.includes(selector), selector);
  assert.ok(source.includes("document.addEventListener('pointerdown', warmInventoryRuntime"));
  assert.ok(source.includes('event.stopImmediatePropagation();'));
  assert.ok(source.includes('window.requestAnimationFrame(() => replayTrigger.click());'));
});

test('Home waits for Inventory DOM initialization before replaying an early interaction', async () => {
  const source = await read('scripts/shell-runtime-loader.js');
  assert.ok(source.includes('let inventoryRuntimeReady = false;'));
  assert.ok(source.includes('function finishAfterInventoryInitialization(resolve)'));
  assert.ok(source.includes("if (document.readyState === 'loading')"));
  assert.ok(source.includes("document.addEventListener('DOMContentLoaded', finish, { once: true });"));
  assert.ok(source.includes('const finish = () => finishAfterInventoryInitialization(resolve);'));
  assert.ok(!source.includes("let inventoryRuntimeReady = typeof window.handleExportInventory === 'function';"));
});

test('Customizer adopts the static Home control instead of replacing it', async () => {
  const controller = await read('scripts/inventory.js');
  assert.ok(controller.includes("document.querySelector('[data-shell-customizer-placeholder]')"));
  assert.ok(controller.includes("staticContainer?.querySelector('.palette-corner__toggle')"));
  assert.ok(controller.includes("container.removeAttribute('data-shell-customizer-placeholder');"));
  assert.ok(controller.includes('staticToggle instanceof HTMLButtonElement ? staticToggle : document.createElement'));
  assert.ok(controller.includes('if (!container.isConnected) {\n    document.body.appendChild(container);\n  }'));
});

test('generator explicitly owns the Home canary', async () => {
  const generator = await read('scripts/build-pages.mjs');
  assert.ok(generator.includes('function normalizeScripts(scripts, options = {})'));
  assert.ok(generator.includes('const includeInventoryRuntime = options.includeInventoryRuntime !== false;'));
  assert.ok(generator.includes("...(includeInventoryRuntime ? [{ src: 'scripts/inventory.js', defer: true }] : [])"));
  assert.ok(generator.includes("bodyExtras = '',"));
  assert.ok(generator.includes('includeInventoryRuntime = true,'));
  assert.ok(generator.includes("scripts: [{ src: 'scripts/shell-runtime-loader.js', defer: true, beforeBase: true }],"));
  assert.ok(generator.includes('bodyExtras: customizerShellPlaceholderHtml,'));
  assert.ok(generator.includes('includeInventoryRuntime: false,'));
});
