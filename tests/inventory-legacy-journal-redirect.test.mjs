import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

function executeRedirect(runtime, options = {}) {
  let hrefValue = options.href || 'https://allneeds.app/inventory/#journal-dashboard';
  let replaced = '';
  const location = {
    hash: options.hash ?? '#journal-dashboard',
    pathname: options.pathname ?? '/inventory/',
    get href() {
      return hrefValue;
    },
    set href(value) {
      hrefValue = value;
    },
    replace(value) {
      replaced = value;
    },
  };

  const context = {
    window: { location },
    document: { body: { dataset: { basePath: options.basePath ?? '../' } } },
    URL,
  };
  vm.runInNewContext(runtime, context);
  return { replaced, href: hrefValue };
}

test('legacy Inventory Journal hash redirects to the canonical Journal route', async () => {
  const runtime = await read('scripts/inventory-legacy-journal-redirect.js');
  const result = executeRedirect(runtime);
  assert.equal(result.replaced, 'https://allneeds.app/inventory/journal/');
});

test('legacy Journal redirect ignores unrelated hashes and routes', async () => {
  const runtime = await read('scripts/inventory-legacy-journal-redirect.js');
  assert.equal(executeRedirect(runtime, { hash: '#something-else' }).replaced, '');
  assert.equal(executeRedirect(runtime, { pathname: '/needs/acceptance/' }).replaced, '');
  assert.equal(executeRedirect(runtime, { pathname: '/inventory/journal/' }).replaced, '');
});

test('Inventory owns the compatibility redirect before the shared controller', async () => {
  const [inventoryHtml, needHtml, inventoryRuntime, compiler] = await Promise.all([
    read('inventory/index.html'),
    read('needs/acceptance/index.html'),
    read('scripts/inventory.js'),
    read('scripts/build-pages.mjs'),
  ]);

  const redirectTag = '<script src="../scripts/inventory-legacy-journal-redirect.js" defer></script>';
  const inventoryTag = '<script src="../scripts/inventory.js" defer></script>';
  assert.ok(inventoryHtml.includes(redirectTag));
  assert.ok(inventoryHtml.indexOf(redirectTag) < inventoryHtml.indexOf(inventoryTag));
  assert.ok(!needHtml.includes('inventory-legacy-journal-redirect.js'));
  assert.ok(!inventoryRuntime.includes('LEGACY_JOURNAL_HASHES'));
  assert.ok(!inventoryRuntime.includes('redirectLegacyJournalHash'));
  assert.ok(compiler.includes("{ src: 'scripts/inventory-legacy-journal-redirect.js', defer: true, beforeBase: true }"));
});
