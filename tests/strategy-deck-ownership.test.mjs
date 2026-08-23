import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

test('Need strategy deck has one route-owned runtime instead of living in the shared Inventory controller', async () => {
  const [inventory, deck, compiler, need, feeling, fauxFeeling, inventoryPage] = await Promise.all([
    read('scripts/inventory.js'),
    read('scripts/strategy-deck.js'),
    read('scripts/build-pages.mjs'),
    read('needs/acceptance/index.html'),
    read('feelings/afraid/index.html'),
    read('faux-feelings/abandoned/index.html'),
    read('inventory/index.html'),
  ]);

  assert.ok(!inventory.includes("document.querySelector('[data-strategy-stack]')"), 'shared Inventory controller must not own the Need deck');
  assert.ok(deck.includes("document.querySelector('[data-strategy-stack]')"), 'route runtime should own the strategy deck root');
  assert.ok(deck.includes("document.querySelector('[data-strategy-next]')"));
  assert.ok(deck.includes("document.querySelector('[data-strategy-prev]')"));
  assert.ok(deck.includes("document.querySelector('[data-strategy-shuffle]')"));
  assert.ok(deck.includes("document.querySelector('[data-strategy-toggle]')"));

  assert.ok(compiler.includes("{ src: 'scripts/strategy-deck.js', defer: true }"), 'Need generation should explicitly declare its deck runtime');
  assert.ok(need.includes('src="../../scripts/strategy-deck.js"'), 'Need detail pages should load the route-owned deck runtime');
  assert.ok(!feeling.includes('strategy-deck.js'), 'Feeling details should not load Need deck behavior');
  assert.ok(!fauxFeeling.includes('strategy-deck.js'), 'Faux Feeling details should not load Need deck behavior');
  assert.ok(!inventoryPage.includes('strategy-deck.js'), 'Inventory workspace should not load Need deck behavior');
});

test('strategy deck extraction preserves the established touch and control interaction guards', async () => {
  const deck = await read('scripts/strategy-deck.js');

  assert.ok(deck.includes("target.closest('button, a, input, textarea, select, label')"), 'swipes must not steal interactive-control gestures');
  assert.ok(deck.includes('startedOnActiveCard = true;'));
  assert.ok(deck.includes("deck.style.touchAction = 'pan-x';"));
  assert.ok(deck.includes('const threshold = 40;'));
  assert.ok(deck.includes('window.requestAnimationFrame(refreshBodyShadows)'));
  assert.ok(deck.trimEnd().endsWith('})();'), 'extracted owner should remain the same self-contained IIFE');
});
