from pathlib import Path


def replace_once(path, old, new):
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}')
    file_path.write_text(text.replace(old, new, 1))


# Remove the Inventory-global redirect owner while leaving Journal edit constants intact.
inventory_path = Path('scripts/inventory.js')
inventory = inventory_path.read_text()
replace_once(
    'scripts/inventory.js',
    "const JOURNAL_EDIT_HASH = '#edit';\nconst LEGACY_JOURNAL_HASHES = new Set(['#journal-dashboard']);\n",
    "const JOURNAL_EDIT_HASH = '#edit';\n",
)
inventory = inventory_path.read_text()
start = inventory.find('function redirectLegacyJournalHash() {')
if start < 0:
    raise SystemExit('scripts/inventory.js: redirectLegacyJournalHash owner not found')
end_marker = 'redirectLegacyJournalHash();\n\n'
end = inventory.find(end_marker, start)
if end < 0:
    raise SystemExit('scripts/inventory.js: redirectLegacyJournalHash invocation not found')
end += len(end_marker)
inventory_path.write_text(inventory[:start] + inventory[end:])

# Give the compatibility redirect one tiny route-owned runtime.
redirect_runtime = """(() => {
  const LEGACY_JOURNAL_HASHES = new Set(['#journal-dashboard']);

  if (typeof window === 'undefined') {
    return;
  }

  const { hash = '', pathname = '', href = '' } = window.location || {};
  if (!hash) {
    return;
  }

  const normalizedHash = hash.trim().toLowerCase();
  if (!LEGACY_JOURNAL_HASHES.has(normalizedHash)) {
    return;
  }

  const normalizedPath = (pathname || '').toLowerCase();
  if (!normalizedPath.includes('/inventory') || normalizedPath.includes('/inventory/journal')) {
    return;
  }

  if (typeof document === 'undefined') {
    return;
  }

  const basePath = document.body?.dataset?.basePath || '';
  let target = `${basePath}inventory/journal/`;

  try {
    target = new URL(target, href || window.location.href).href;
  } catch (error) {
    // Ignore resolution errors and rely on the relative URL fallback.
  }

  try {
    window.location.replace(target);
  } catch (error) {
    window.location.href = target;
  }
})();
"""
Path('scripts/inventory-legacy-journal-redirect.js').write_text(redirect_runtime)

# Inventory alone loads the compatibility owner, before the shared Inventory controller.
replace_once(
    'scripts/build-pages.mjs',
    "    scripts: [{ src: 'scripts/inventory-bluesky.js?v=2026-02-12', module: true }],",
    """    scripts: [
      { src: 'scripts/inventory-legacy-journal-redirect.js', defer: true, beforeBase: true },
      { src: 'scripts/inventory-bluesky.js?v=2026-02-12', module: true },
    ],""",
)

# Permanent behavior + ownership contract.
test_file = Path('tests/inventory-legacy-journal-redirect.test.mjs')
test_file.write_text("""import test from 'node:test';
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
""")

# Keep the permanent fast regression suite aware of this route-owned compatibility seam.
package_path = Path('package.json')
package = package_path.read_text()
needle = 'tests/route-runtime-ownership.test.mjs tests/offline-cache.test.mjs'
replacement = 'tests/route-runtime-ownership.test.mjs tests/inventory-legacy-journal-redirect.test.mjs tests/offline-cache.test.mjs'
if package.count(needle) != 1:
    raise SystemExit(f'package.json: expected one flicker-jitter insertion point, found {package.count(needle)}')
package_path.write_text(package.replace(needle, replacement, 1))
