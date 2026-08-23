import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label} source block`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected one ${label} source block`);
  }
  return source.replace(before, after);
}

let css = read('styles.css');
css = replaceOnce(
  css,
  `.strategy-card--input {\n  display: block;\n  padding: 0;\n  overflow: hidden;\n}`,
  `.strategy-card--input {\n  display: block;\n  padding: 0;\n}\n\n.strategy-card--input:not(.strategy-need-catalog) {\n  overflow: hidden;\n}\n\n.strategy-card--input.strategy-need-catalog {\n  overflow: visible;\n}`,
  'strategy input overflow contract',
);
write('styles.css', css);

const testPath = 'tests/acceptance-interaction-regressions.test.mjs';
let tests = read(testPath);
const testName = "test('strategy Needs multiselect remains visible and preserves page defaults', () => {";
if (!tests.includes(testName)) {
  tests += `\n\n${testName}\n  const css = read('styles.css');\n  const runtime = read('scripts/inventory.js');\n  const needPage = read('needs/acceptance/index.html');\n  const inventoryPage = read('inventory/index.html');\n\n  assert.ok(\n    css.includes('.strategy-card--input:not(.strategy-need-catalog) {\\n  overflow: hidden;\\n}'),\n    'ordinary tactile input shells may keep their clipping contract',\n  );\n  assert.ok(\n    css.includes('.strategy-card--input.strategy-need-catalog {\\n  overflow: visible;\\n}'),\n    'the shared Needs catalog shell must not clip its absolutely positioned selector popover',\n  );\n  assert.ok(\n    runtime.includes("document.querySelectorAll('[data-strategy-need-catalog]')"),\n    'Inventory runtime must hydrate every strategy Needs selector from the shared controller',\n  );\n  assert.ok(\n    needPage.includes('<option value="acceptance" selected>Acceptance</option>'),\n    'a Need page must arrive with that page Need selected',\n  );\n  assert.ok(needPage.includes('aria-multiselectable="true"'), 'Need-page selector must allow additional Needs');\n\n  const inventorySelect = inventoryPage.match(/<select id="inventory-need"[\\s\\S]*?<\\/select>/)?.[0] || '';\n  assert.ok(inventorySelect, 'Inventory must render the shared Needs transport select');\n  assert.equal(inventorySelect.includes(' selected'), false, 'Inventory add form must start without an arbitrary Need selected');\n});\n`;
  write(testPath, tests);
}
