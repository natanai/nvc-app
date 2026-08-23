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

const catalogShell = `.strategy-card--form .strategy-card--input {\n  border: 1px solid color-mix(in srgb, var(--outline) 22%, transparent);\n  border-radius: var(--radius-md);\n  background: color-mix(in srgb, #ffffff 94%, var(--mint) 6%);\n  box-shadow: none;\n}`;

const catalogShellEnhanced = `${catalogShell}\n\n/* Strategy Needs uses the shared catalog controller, but its form shell owns\n   the local fit/overflow contract. Keep the trigger and popup inside the\n   field rather than clipping the popup or letting the chevron ride the border. */\n.strategy-card--form .strategy-need-catalog {\n  overflow: visible;\n}\n\n.strategy-card--form .strategy-need-catalog .journal-catalog-select__trigger {\n  width: 100%;\n  padding-inline: 0.62rem 0.76rem;\n  text-align: left;\n}\n\n.strategy-card--form .strategy-need-catalog .journal-catalog-select__value {\n  text-align: left;\n}\n\n.strategy-card--form .strategy-need-catalog .journal-catalog-select__chevron {\n  margin-right: 0.08rem;\n}\n\n.strategy-card--form .strategy-need-catalog .journal-catalog-popover {\n  left: 0;\n  right: auto;\n  width: 100%;\n  max-width: 100%;\n  z-index: 80;\n}`;
css = replaceOnce(css, catalogShell, catalogShellEnhanced, 'strategy catalog shell');

const mobileRow = `@media (max-width: 600px) {\n  .strategy-form__row {\n    grid-template-columns: 1fr;\n  }\n}`;

const desktopAndMobile = `/* Desktop strategy editor: use the available width as a deliberate form grid.\n   Mobile remains single-column below. */\n@media (min-width: 760px) {\n  .strategy-card--form {\n    padding: clamp(0.9rem, 1.4vw, 1.15rem);\n    gap: 0.72rem;\n  }\n\n  .strategy-card--form .strategy-form:has(.strategy-form__field--needs) {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    column-gap: 0.9rem;\n    row-gap: 0.72rem;\n    align-items: start;\n  }\n\n  .strategy-card--form .strategy-form__field:has(input[name='title']) {\n    grid-column: 1;\n    grid-row: 1;\n  }\n\n  .strategy-card--form .strategy-form__field--needs {\n    grid-column: 2;\n    grid-row: 1;\n  }\n\n  .strategy-card--form .strategy-form__field:has(textarea[name='description']) {\n    grid-column: 1 / -1;\n    grid-row: 2;\n  }\n\n  .strategy-card--form .strategy-form__row,\n  .strategy-card--form .strategy-form__notice,\n  .strategy-card--form .strategy-form__message,\n  .strategy-card--form .strategy-form__actions,\n  .strategy-card--form .strategy-card__actions {\n    grid-column: 1 / -1;\n  }\n\n  .strategy-card--form .strategy-form__row {\n    gap: 0.9rem;\n  }\n\n  .strategy-card--form .strategy-card--input input[type='text'],\n  .strategy-card--form .strategy-card--input select,\n  .strategy-card--form .strategy-card--input textarea,\n  .strategy-card--form .strategy-need-catalog .journal-catalog-select__trigger {\n    min-height: 48px;\n  }\n\n  .strategy-card--form .strategy-card--input input[type='text'],\n  .strategy-card--form .strategy-card--input select,\n  .strategy-card--form .strategy-card--input textarea {\n    padding: 0.52rem 0.68rem;\n  }\n\n  .strategy-card--form .strategy-card--input textarea {\n    min-height: 6.25rem;\n  }\n}\n\n${mobileRow}`;
css = replaceOnce(css, mobileRow, desktopAndMobile, 'strategy responsive row contract');
write('styles.css', css);

const testPath = 'tests/acceptance-interaction-regressions.test.mjs';
let tests = read(testPath);
const testName = "test('strategy editor uses desktop width without clipping the Needs catalog', () => {";
if (!tests.includes(testName)) {
  tests += `\n\n${testName}\n  const css = read('styles.css');\n  const needPage = read('needs/acceptance/index.html');\n\n  assert.ok(css.includes(".strategy-card--form .strategy-form:has(.strategy-form__field--needs) {\\n    grid-template-columns: repeat(2, minmax(0, 1fr));"), 'desktop strategy editor must use two bounded columns');\n  assert.ok(css.includes(".strategy-card--form .strategy-form__field:has(input[name='title']) {\\n    grid-column: 1;\\n    grid-row: 1;"), 'strategy name must occupy the first desktop column');\n  assert.ok(css.includes('.strategy-card--form .strategy-form__field--needs {\\n    grid-column: 2;\\n    grid-row: 1;'), 'Needs must share the first desktop row');\n  assert.ok(css.includes(".strategy-card--form .strategy-form__field:has(textarea[name='description']) {\\n    grid-column: 1 / -1;\\n    grid-row: 2;"), 'strategy details must keep the full desktop width');\n  assert.ok(css.includes('.strategy-card--form .strategy-need-catalog .journal-catalog-select__trigger {\\n  width: 100%;\\n  padding-inline: 0.62rem 0.76rem;'), 'Needs trigger must keep its chevron inside the field border');\n  assert.ok(css.includes('.strategy-card--form .strategy-need-catalog .journal-catalog-popover {\\n  left: 0;\\n  right: auto;\\n  width: 100%;\\n  max-width: 100%;'), 'Needs popup must be bounded by its strategy field');\n  assert.equal(needPage.includes('journal-feeling-rating'), false, 'Needs selector must not acquire Feeling intensity controls');\n});\n`;
  write(testPath, tests);
}
