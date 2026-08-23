import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCatalogMultiselectMarkup } from '../assets/js/catalog-multiselect.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('desktop Journal preserves core Patterns-before-Backup hierarchy', async () => {
  const [build, css, html] = await Promise.all([load('scripts/build-pages.mjs'), load('styles.css'), load('inventory/journal/index.html')]);
  assert.equal(css.includes('\"fullscreen storage\"'), false);
  assert.equal(build.includes("main[data-page-id='inventory-journal'] .journal-overview-grid {\n        grid-template-columns: repeat(2"), false);
  assert.ok(html.indexOf('journal-summary-section journal-utility-disclosure') < html.indexOf('journal-actions journal-utility-disclosure'));
});

test('magnet persistence separates mobile and desktop profile keys', async () => {
  const [navPrepaint, magnets, inventory] = await Promise.all([load('scripts/nav-prepaint.mjs'), load('scripts/magnets.js'), load('scripts/inventory.js')]);
  assert.ok(magnets.includes("RESPONSIVE_LAYOUT_MIGRATION_SUFFIX = '@responsive-v1'"));
  assert.ok(magnets.includes('persistenceKey: resolveResponsiveStorageKey(resolvedStorageKey)'));
  assert.ok(navPrepaint.includes("var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;"));
  assert.ok(navPrepaint.includes("var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';"));
  assert.ok(inventory.includes("if (key.startsWith('magnetPositions:'))"));
});

test('Body Cues pin is mobile-only at canonical CSS owners', async () => {
  const [baseCss, mobileCss, html] = await Promise.all([load('styles/body-cues.css'), load('styles/body-cues-mobile.css'), load('feelings/body-cues/index.html')]);
  assert.ok(baseCss.includes('.body-cues-page .body-cues-tool__pin-toggle {\n  display: none;'));
  assert.ok(mobileCss.includes('.body-cues-page .body-cues-tool__pin-toggle {\n    position: relative;\n    display: inline-flex;'));
  assert.ok(html.includes('styles/body-cues.css'));
  assert.ok(html.includes('styles/body-cues-mobile.css\" media=\"(max-width: 640px)\"'));
});

test('Journal and strategy forms share one Needs catalog implementation', async () => {
  const [build, journal, inventory, needHtml] = await Promise.all([load('scripts/build-pages.mjs'), load('assets/js/journal/module.js'), load('scripts/inventory.js'), load('needs/acceptance/index.html')]);
  const markup = renderCatalogMultiselectMarkup({ inputId: 'test-need', name: 'need', kind: 'needs', transport: 'select', delimiter: '|', options: [{ label: 'Acceptance', value: 'acceptance', slug: 'acceptance' }], selectedValues: ['acceptance'] });
  assert.ok(markup.includes('journal-catalog-select__trigger'));
  assert.ok(build.includes("import { renderCatalogMultiselectMarkup } from '../assets/js/catalog-multiselect.js';"));
  assert.ok(journal.includes("from '../catalog-multiselect.js';"));
  assert.ok(journal.includes('this.needsCatalogController'));
  assert.ok(inventory.includes("import(resolveAssetPath('assets/js/catalog-multiselect.js'))"));
  assert.ok(needHtml.includes('data-strategy-need-catalog'));
  assert.ok(needHtml.includes('journal-catalog-select__trigger'));
  assert.ok(needHtml.includes('name=\"need\" multiple hidden data-catalog-multiselect-transport'));
  assert.equal(needHtml.includes('hold Ctrl'), false);
});
