import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');

test('manual magnet drag completion immediately persists the final layout', () => {
  const physics = read('scripts/magnets/magnetPhysics.js');
  const magnets = read('scripts/magnets.js');

  assert.ok(physics.includes('onDragEnd: options.onDragEnd'), 'physics state must own a drag-end callback');
  assert.ok(
    (physics.match(/typeof state\.onDragEnd === 'function'/g) || []).length >= 2,
    'pointer up and pointer cancel must both notify drag completion',
  );
  assert.match(
    magnets,
    /onDragEnd:\s*\(\) => \{[\s\S]*?updateLayout\(state\);[\s\S]*?persistLayout\(state, true\);[\s\S]*?\}/,
    'drag completion must flush the canonical layout immediately',
  );
  assert.match(
    magnets,
    /if \(immediate\) \{[\s\S]*?clearTimeout\(state\.saveTimer\)[\s\S]*?flush\(\);/,
    'an immediate drag save must cancel any stale throttled save first',
  );
});

test('journal save reset preserves confirmation and does not refocus an empty draft', () => {
  const moduleSource = read('assets/js/journal/module.js');
  const inventory = read('scripts/inventory.js');

  assert.ok(
    moduleSource.includes('resetForm({ keepStatus = false, focusNotes = true } = {})'),
    'shared Journal form reset must expose save-safe status/focus options',
  );
  assert.ok(
    moduleSource.includes('if (this.statusEl && !keepStatus)'),
    'save-safe reset must preserve an existing confirmation',
  );
  assert.match(
    moduleSource,
    /if \(focusNotes\) \{[\s\S]*?this\.notesInput\.focus\(\);[\s\S]*?\} else \{[\s\S]*?this\.notesInput\.blur\(\);/,
    'successful save may dismiss the blank editor instead of refocusing it',
  );
  assert.ok(
    inventory.includes("Saved. Your entry is in Journal History below. The form is ready for a new entry."),
    'new-entry save must leave an explicit visible explanation of what happened',
  );
  assert.ok(
    inventory.includes('resetJournalForm({ keepStatus: true, focusNotes: false });'),
    'new-entry save must use the save-safe reset contract',
  );
  assert.match(
    inventory,
    /state\.journalOverlayOpen[\s\S]*?state\.journalOverlayHistoryEl[\s\S]*?state\.journalHistoryEl/,
    'saved-entry focus must prefer the visible overlay history when the overlay is open',
  );
});


test('restored category hub layouts keep manual overlap instead of reseeding the board', () => {
  const magnets = read('scripts/magnets.js');

  assert.ok(
    magnets.includes('const resolveFixedObstacleOverlaps = (state, { allowReseed = true } = {}) => {'),
    'fixed-obstacle repair must be able to preserve a restored user layout without global reseeding',
  );
  assert.ok(
    magnets.includes('if (allowReseed && (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state)))'),
    'global repacking must be explicitly opt-in at the obstacle resolver',
  );
  assert.ok(
    !magnets.includes("if (!isNavBoardState(state) && (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state))) {\n      shouldSeed = true;"),
    'a restored category hub must not discard all saved coordinates just because magnets overlap',
  );
  assert.match(
    magnets,
    /state\.lastLayoutType = 'restored';[\s\S]*?layoutHasFixedObstacleOverlap\(state\)[\s\S]*?resolveFixedObstacleOverlaps\(state, \{ allowReseed: false \}\)/,
    'restored category hubs may repair the fixed toggle locally without repacking every magnet',
  );
});


test('strategy Needs multiselect remains visible and preserves page defaults', () => {
  const css = read('styles.css');
  const runtime = read('scripts/inventory.js');
  const needPage = read('needs/acceptance/index.html');
  const inventoryPage = read('inventory/index.html');

  assert.ok(
    css.includes('.strategy-card--input:not(.strategy-need-catalog) {\n  overflow: hidden;\n}'),
    'ordinary tactile input shells may keep their clipping contract',
  );
  assert.ok(
    css.includes('.strategy-card--input.strategy-need-catalog {\n  overflow: visible;\n}'),
    'the shared Needs catalog shell must not clip its absolutely positioned selector popover',
  );
  assert.ok(
    runtime.includes("document.querySelectorAll('[data-strategy-need-catalog]')"),
    'Inventory runtime must hydrate every strategy Needs selector from the shared controller',
  );
  assert.ok(
    needPage.includes('<option value="acceptance" selected>Acceptance</option>'),
    'a Need page must arrive with that page Need selected',
  );
  assert.ok(needPage.includes('aria-multiselectable="true"'), 'Need-page selector must allow additional Needs');

  const inventorySelect = inventoryPage.match(/<select id="inventory-need"[\s\S]*?<\/select>/)?.[0] || '';
  assert.ok(inventorySelect, 'Inventory must render the shared Needs transport select');
  assert.equal(inventorySelect.includes(' selected'), false, 'Inventory add form must start without an arbitrary Need selected');
});


test('strategy editor uses desktop width without clipping the Needs catalog', () => {
  const css = read('styles.css');
  const densityCss = read('styles/shared-density.css');
  const needPage = read('needs/acceptance/index.html');

  assert.equal(css.includes('/* Desktop strategy editor: use the available width'), false, 'responsive strategy density must stay out of the global stylesheet budget');
  assert.ok(densityCss.includes("body .strategy-card--form .strategy-form:has(.strategy-form__field--needs) {\n    grid-template-columns: repeat(2, minmax(0, 1fr));"), 'desktop strategy editor must use two bounded columns at the shared density owner');
  assert.ok(densityCss.includes("body .strategy-card--form .strategy-form__field:has(input[name='title']) {\n    grid-column: 1;\n    grid-row: 1;"), 'strategy name must occupy the first desktop column');
  assert.ok(densityCss.includes('body .strategy-card--form .strategy-form__field--needs {\n    grid-column: 2;\n    grid-row: 1;'), 'Needs must share the first desktop row');
  assert.ok(densityCss.includes("body .strategy-card--form .strategy-form__field:has(textarea[name='description']) {\n    grid-column: 1 / -1;\n    grid-row: 2;"), 'strategy details must keep the full desktop width');
  assert.ok(densityCss.includes('body .strategy-card--form .strategy-need-catalog .journal-catalog-select__trigger {\n  width: 100%;\n  padding-inline: 0.62rem 0.76rem;'), 'Needs trigger must keep its chevron inside the field border');
  assert.ok(densityCss.includes('body .strategy-card--form .strategy-need-catalog .journal-catalog-popover {\n  left: 0;\n  right: auto;\n  width: 100%;\n  max-width: 100%;'), 'Needs popup must be bounded by its strategy field');
  assert.ok(css.includes('@media (max-width: 600px) {\n  .strategy-form__row {\n    grid-template-columns: 1fr;'), 'mobile strategy contact fields must remain single-column');
  assert.equal(needPage.includes('journal-feeling-rating'), false, 'Needs selector must not acquire Feeling intensity controls');
});
