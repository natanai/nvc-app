import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value);
const lines = (...items) => items.join('\n');
const replaceOnce = (source, search, replacement, label) => {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(search, replacement);
};
const replaceRegexOnce = (source, regex, replacement, label) => {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const matches = source.match(new RegExp(regex.source, flags)) || [];
  if (matches.length !== 1) throw new Error(`${label}: expected 1 match, found ${matches.length}`);
  return source.replace(regex, replacement);
};

let build = read('scripts/build-pages.mjs');
build = replaceOnce(
  build,
  "import { updateObservationGuidePage } from './observation-guide.mjs';",
  "import { updateObservationGuidePage } from './observation-guide.mjs';\nimport { renderCatalogMultiselectMarkup } from '../assets/js/catalog-multiselect.js';",
  'build shared selector import',
);

const strategyNeedReplacement = lines(
  '  const needOptions = data.needs.map((need) => ({',
  '    label: need.title,',
  '    value: need.slug,',
  '    slug: need.slug,',
  '  }));',
  '',
  '  const needField = includeNeedSelect',
  '    ? `',
  '        <div class="strategy-form__field strategy-form__field--needs">',
  '          <label for="${idPrefix}-need-trigger">Needs</label>',
  '          ${renderCatalogMultiselectMarkup({',
  '            inputId: `${idPrefix}-need`,',
  "            name: 'need',",
  "            kind: 'needs',",
  "            placeholder: 'Choose needs',",
  "            ariaLabel: 'Choose one or more needs',",
  "            transport: 'select',",
  "            delimiter: '|',",
  '            options: needOptions,',
  '            selectedValues: defaultNeedSlug ? [defaultNeedSlug] : [],',
  "            classes: ['strategy-card', 'strategy-card--input', 'strategy-need-catalog'],",
  "            attributes: { 'data-strategy-need-catalog': '' },",
  '          })}',
  '        </div>`',
  "    : '';",
  '',
);
build = replaceRegexOnce(
  build,
  /  const needOptions = data\.needs[\s\S]*?  const needField = includeNeedSelect[\s\S]*?    : '';\n/,
  strategyNeedReplacement,
  'strategy need selector generation',
);

const oldPrefill = lines(
  "          var STORAGE_KEY = 'magnetPositions:${storageKey}';",
  '          var raw;',
  '          try {',
  "            if (!('localStorage' in window)) {",
  '              return;',
  '            }',
  '            raw = window.localStorage.getItem(STORAGE_KEY);',
  '          } catch (error) {',
  '            return;',
  '          }',
);
const newPrefill = lines(
  "          var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';",
  "          var bucket = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';",
  "          var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;",
  "          var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';",
  '          var raw;',
  '          try {',
  "            if (!('localStorage' in window)) {",
  '              return;',
  '            }',
  '            raw = window.localStorage.getItem(STORAGE_KEY);',
  '            if (!raw && !window.localStorage.getItem(MIGRATION_KEY)) {',
  '              var legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);',
  '              if (legacyRaw) {',
  '                window.localStorage.setItem(STORAGE_KEY, legacyRaw);',
  '                raw = legacyRaw;',
  '              }',
  '              window.localStorage.setItem(MIGRATION_KEY, bucket);',
  '            }',
  '          } catch (error) {',
  '            return;',
  '          }',
);
build = replaceOnce(build, oldPrefill, newPrefill, 'nav prepaint responsive storage');

const oldDesktopJournal = lines(
  '    @media (min-width: 760px) {',
  "      main[data-page-id='inventory-journal'] .journal-overview-grid {",
  '        grid-template-columns: repeat(2, minmax(0, 1fr));',
  '      }',
  '',
  "      main[data-page-id='inventory-journal'] .journal-history-controls__filters {",
);
const newDesktopJournal = lines(
  '    @media (min-width: 760px) {',
  "      main[data-page-id='inventory-journal'] .journal-history-controls__filters {",
);
build = replaceOnce(build, oldDesktopJournal, newDesktopJournal, 'Journal desktop overview hierarchy');
write('scripts/build-pages.mjs', build);

let styles = read('styles.css');
const obsoleteJournalGrid = lines(
  '',
  '@media (min-width: 960px) {',
  '  .journal-overview-grid {',
  '    grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);',
  '    grid-template-areas:',
  '      "fullscreen storage"',
  '      "summary summary";',
  '  }',
  '}',
  '',
  '@media (min-width: 960px) {',
  '  .journal-overview-grid .journal-storage-panel {',
  '    grid-area: storage;',
  '    align-self: start;',
  '  }',
  '',
  '  .journal-overview-grid .journal-summary-section {',
  '    grid-area: summary;',
  '  }',
  '',
  '  .journal-overview-grid .journal-fullscreen-slot {',
  '    grid-area: fullscreen;',
  '    align-self: center;',
  '  }',
  '}',
  '',
);
styles = replaceOnce(styles, obsoleteJournalGrid, '\n', 'retire obsolete Journal desktop grid areas');
write('styles.css', styles);

let bodyCss = read('styles/body-cues.css');
const actionsRule = lines(
  '.body-cues-page .body-cues-tool__actions {',
  '  display: flex;',
  '  justify-content: flex-start;',
  '  margin: 0;',
  '}',
);
bodyCss = replaceOnce(
  bodyCss,
  actionsRule,
  lines(
    actionsRule,
    '',
    '/* Pinning changes the compact sticky result shelf and is therefore a phone-only action. */',
    '.body-cues-page .body-cues-tool__pin-toggle {',
    '  display: none;',
    '}',
  ),
  'Body Cues base pin visibility',
);
bodyCss = bodyCss.replace(
  '/* Body Cues explorer — page-specific UX refinements.\n   Loaded by scripts/body-cues-tool.js so generated pages can remain unchanged. */',
  '/* Body Cues explorer — page-specific deterministic presentation.\n   Parser-loaded by the generated Body Cues route before the interaction module runs. */',
);
write('styles/body-cues.css', bodyCss);

let bodyMobile = read('styles/body-cues-mobile.css');
bodyMobile = replaceOnce(
  bodyMobile,
  lines(
    '',
    '/* The pin control is created by the Body Cues runtime but is a mobile-only affordance. */',
    '.body-cues-page .body-cues-tool__pin-toggle {',
    '  display: none;',
    '}',
  ),
  '',
  'remove unreachable desktop pin rule from mobile-only stylesheet',
);
write('styles/body-cues-mobile.css', bodyMobile);

let magnets = read('scripts/magnets.js');
magnets = replaceOnce(
  magnets,
  "const NAV_MOBILE_ORDER_QUERY = '(max-width: 640px)';",
  lines(
    "const NAV_MOBILE_ORDER_QUERY = '(max-width: 640px)';",
    "const RESPONSIVE_LAYOUT_MIGRATION_SUFFIX = '@responsive-v1';",
    '',
    'const getResponsiveLayoutBucket = () =>',
    "  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NAV_MOBILE_ORDER_QUERY).matches",
    "    ? 'mobile'",
    "    : 'desktop';",
    '',
    'const resolveResponsiveStorageKey = (storageKey) => {',
    '  const bucket = getResponsiveLayoutBucket();',
    '  const scopedKey = `${storageKey}@${bucket}`;',
    "  if (typeof window === 'undefined' || !window.localStorage) return scopedKey;",
    '  const legacyKey = `magnetPositions:${storageKey}`;',
    '  const scopedRawKey = `magnetPositions:${scopedKey}`;',
    '  const migrationKey = `${legacyKey}${RESPONSIVE_LAYOUT_MIGRATION_SUFFIX}`;',
    '  try {',
    '    if (!window.localStorage.getItem(scopedRawKey) && !window.localStorage.getItem(migrationKey)) {',
    '      const legacy = window.localStorage.getItem(legacyKey);',
    '      if (legacy) window.localStorage.setItem(scopedRawKey, legacy);',
    '      window.localStorage.setItem(migrationKey, bucket);',
    '    }',
    '  } catch {',
    '    // Storage availability is handled again by magnetPhysics.',
    '  }',
    '  return scopedKey;',
    '};',
  ),
  'responsive magnet storage helpers',
);
magnets = replaceOnce(
  magnets,
  lines('    storageKey: resolvedStorageKey,', '    magnets: measured,'),
  lines(
    '    storageKey: resolvedStorageKey,',
    '    persistenceKey: resolveResponsiveStorageKey(resolvedStorageKey),',
    '    layoutBucket: getResponsiveLayoutBucket(),',
    '    magnets: measured,',
  ),
  'magnet persistence state',
);
magnets = replaceOnce(
  magnets,
  lines('  const storedResult = loadPositions(', '    state.storageKey,'),
  lines('  const storedResult = loadPositions(', '    state.persistenceKey,'),
  'responsive magnet load',
);
const beforeSaveReplacement = magnets;
magnets = magnets.replaceAll(lines('savePositions(', '        state.storageKey,'), lines('savePositions(', '        state.persistenceKey,'));
magnets = magnets.replaceAll(lines('savePositions(', '      state.storageKey,'), lines('savePositions(', '      state.persistenceKey,'));
if (magnets === beforeSaveReplacement || !magnets.includes('state.persistenceKey')) throw new Error('responsive magnet save replacement failed');
write('scripts/magnets.js', magnets);

let journal = read('assets/js/journal/module.js');
journal = replaceOnce(
  journal,
  "import { getSuggestions as getTagSuggestions } from './tags.js';",
  "import { getSuggestions as getTagSuggestions } from './tags.js';\nimport { createCatalogMultiselectElement, hydrateCatalogMultiselect } from '../catalog-multiselect.js';",
  'Journal shared catalog import',
);
const needsBuilder = lines(
  'const buildNeedsField = (config) => {',
  '  const inputId = `${config.idPrefix}-needs`;',
  '  const selector = createCatalogMultiselectElement({',
  '    inputId,',
  "    name: 'needs',",
  "    kind: 'needs',",
  "    placeholder: config.placeholders.needs || 'Choose needs',",
  "    ariaLabel: 'Choose one or more needs',",
  "    transport: 'input',",
  "    delimiter: ', ',",
  "    transportAttributes: { 'data-journal-needs': '' },",
  '  });',
  '  return buildJournalMetaRow({',
  '    label: config.labels.needs,',
  '    id: `${inputId}-trigger`,',
  '    input: selector,',
  "    modifier: 'needs',",
  '  });',
  '};',
);
journal = replaceRegexOnce(
  journal,
  /const buildNeedsField = \(config\) => buildCatalogSelectorField\(config, \{[\s\S]*?\n\}\);/,
  needsBuilder,
  'Journal needs shared markup',
);
journal = replaceOnce(
  journal,
  lines("    this.needsSelectRoot = this.root.querySelector('[data-journal-catalog-select=\"needs\"]');", '    this.notesBaseHeight = null;'),
  lines(
    "    this.needsSelectRoot = this.root.querySelector('[data-journal-catalog-select=\"needs\"]');",
    '    this.needsCatalogController = this.needsSelectRoot',
    "      ? hydrateCatalogMultiselect(this.needsSelectRoot, { placeholder: 'Choose needs', delimiter: ', ' })",
    '      : null;',
    '    this.notesBaseHeight = null;',
  ),
  'Journal needs shared controller',
);
journal = replaceOnce(
  journal,
  lines("    ['feeling', 'needs'].forEach((kind) => {", '      const root = this.getCatalogRoot(kind);'),
  lines("    ['feeling', 'needs'].forEach((kind) => {", "      if (kind === 'needs' && this.needsCatalogController) return;", '      const root = this.getCatalogRoot(kind);'),
  'Journal shared needs event ownership',
);
journal = replaceOnce(
  journal,
  lines('  getCatalogValues(kind) {', "    if (kind === 'feeling') return this.getFeelingRatings().map((item) => item.feeling);", '    const input = this.getCatalogInput(kind);'),
  lines('  getCatalogValues(kind) {', "    if (kind === 'feeling') return this.getFeelingRatings().map((item) => item.feeling);", "    if (kind === 'needs' && this.needsCatalogController) return this.needsCatalogController.getValues();", '    const input = this.getCatalogInput(kind);'),
  'Journal shared needs get values',
);
journal = replaceOnce(
  journal,
  lines('    const input = this.getCatalogInput(kind);', '    if (!input) return;', '    const normalized = this.normalizeCatalogValues(kind, values);', '    input.value = joinListValues(normalized);'),
  lines("    if (kind === 'needs' && this.needsCatalogController) {", '      const normalized = this.normalizeCatalogValues(kind, values);', '      this.needsCatalogController.setValues(normalized, { dispatch: false });', '      return;', '    }', '    const input = this.getCatalogInput(kind);', '    if (!input) return;', '    const normalized = this.normalizeCatalogValues(kind, values);', '    input.value = joinListValues(normalized);'),
  'Journal shared needs set values',
);
journal = replaceOnce(journal, '  updateCatalogSummary(kind) {\n    const root = this.getCatalogRoot(kind);', lines('  updateCatalogSummary(kind) {', "    if (kind === 'needs' && this.needsCatalogController) {", '      this.needsCatalogController.updateSummary();', '      return;', '    }', '    const root = this.getCatalogRoot(kind);'), 'Journal shared needs summary');
journal = replaceOnce(journal, "  openCatalogSelect(kind) {\n    ['feeling', 'needs'].forEach((other) => { if (other !== kind) this.closeCatalogSelect(other); });", lines('  openCatalogSelect(kind) {', "    if (kind === 'needs' && this.needsCatalogController) {", "      this.closeCatalogSelect('feeling');", '      this.needsCatalogController.open();', '      return;', '    }', "    ['feeling', 'needs'].forEach((other) => { if (other !== kind) this.closeCatalogSelect(other); });"), 'Journal shared needs open');
journal = replaceOnce(journal, '  closeCatalogSelect(kind) {\n    const root = this.getCatalogRoot(kind);', lines('  closeCatalogSelect(kind) {', "    if (kind === 'needs' && this.needsCatalogController) {", '      this.needsCatalogController.close();', '      return;', '    }', '    const root = this.getCatalogRoot(kind);'), 'Journal shared needs close');
journal = replaceOnce(journal, '  renderCatalogOptions(kind) {\n    const root = this.getCatalogRoot(kind);', lines('  renderCatalogOptions(kind) {', "    if (kind === 'needs' && this.needsCatalogController) {", '      this.needsCatalogController.renderOptions();', '      return;', '    }', '    const root = this.getCatalogRoot(kind);'), 'Journal shared needs render');
journal = replaceOnce(journal, '  toggleCatalogValue(kind, value) {\n    if (!value) return;', lines('  toggleCatalogValue(kind, value) {', '    if (!value) return;', "    if (kind === 'needs' && this.needsCatalogController) {", '      this.needsCatalogController.toggleValue(value, { dispatch: true });', '      return;', '    }'), 'Journal shared needs toggle');
journal = replaceOnce(
  journal,
  lines('    this.needsOptions = normalizedList;', "    this.setCatalogValues('needs', this.getCatalogValues('needs'));"),
  lines(
    '    this.needsOptions = normalizedList;',
    '    if (this.needsCatalogController) {',
    '      this.needsCatalogController.setOptions(normalizedList.map((option) => ({',
    '        label: option.label,',
    '        value: option.label,',
    "        slug: option.slug || '',",
    '      })));',
    '    }',
    "    this.setCatalogValues('needs', this.getCatalogValues('needs'));",
  ),
  'Journal shared needs options',
);
write('assets/js/journal/module.js', journal);

let inventory = read('scripts/inventory.js');
inventory = replaceOnce(
  inventory,
  'let inventoryRuntimeInitialized = false;',
  lines(
    'let catalogMultiselectModulePromise = null;',
    '',
    'function ensureCatalogMultiselectModule() {',
    '  if (!catalogMultiselectModulePromise) {',
    "    catalogMultiselectModulePromise = import(resolveAssetPath('assets/js/catalog-multiselect.js'));",
    '  }',
    '  return catalogMultiselectModulePromise;',
    '}',
    '',
    'async function hydrateStrategyNeedSelectors() {',
    "  const roots = Array.from(document.querySelectorAll('[data-strategy-need-catalog]'));",
    '  if (!roots.length) return;',
    '  const module = await ensureCatalogMultiselectModule();',
    "  roots.forEach((root) => module.hydrateCatalogMultiselect(root, { placeholder: 'Choose needs', delimiter: '|' }));",
    '}',
    '',
    'let inventoryRuntimeInitialized = false;',
  ),
  'strategy shared selector loader',
);
inventory = replaceOnce(
  inventory,
  lines("  state.basePath = document.body?.dataset?.basePath || '';", "  state.journalDraftPath = typeof window !== 'undefined' ? window.location.pathname : '';"),
  lines(
    "  state.basePath = document.body?.dataset?.basePath || '';",
    "  state.journalDraftPath = typeof window !== 'undefined' ? window.location.pathname : '';",
    '  hydrateStrategyNeedSelectors().catch((error) => {',
    "    console.warn('Unable to initialize shared Needs selector', error);",
    '  });',
  ),
  'hydrate strategy Needs selectors',
);
write('scripts/inventory.js', inventory);

const test = lines(
  "import test from 'node:test';",
  "import assert from 'node:assert/strict';",
  "import { promises as fs } from 'node:fs';",
  "import path from 'node:path';",
  "import { fileURLToPath } from 'node:url';",
  "import { renderCatalogMultiselectMarkup } from '../assets/js/catalog-multiselect.js';",
  '',
  "const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');",
  "const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');",
  '',
  "test('desktop Journal preserves core Patterns-before-Backup hierarchy', async () => {",
  "  const [build, css, html] = await Promise.all([load('scripts/build-pages.mjs'), load('styles.css'), load('inventory/journal/index.html')]);",
  "  assert.equal(css.includes('\\\"fullscreen storage\\\"'), false);",
  "  assert.equal(build.includes(\"main[data-page-id='inventory-journal'] .journal-overview-grid {\\n        grid-template-columns: repeat(2\"), false);",
  "  assert.ok(html.indexOf('journal-summary-section journal-utility-disclosure') < html.indexOf('journal-actions journal-utility-disclosure'));",
  '});',
  '',
  "test('magnet persistence separates mobile and desktop profile keys', async () => {",
  "  const [build, magnets, inventory] = await Promise.all([load('scripts/build-pages.mjs'), load('scripts/magnets.js'), load('scripts/inventory.js')]);",
  "  assert.ok(magnets.includes(\"RESPONSIVE_LAYOUT_MIGRATION_SUFFIX = '@responsive-v1'\"));",
  "  assert.ok(magnets.includes('persistenceKey: resolveResponsiveStorageKey(resolvedStorageKey)'));",
  "  assert.ok(build.includes(\"var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;\"));",
  "  assert.ok(build.includes(\"var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';\"));",
  "  assert.ok(inventory.includes(\"if (key.startsWith('magnetPositions:'))\"));",
  '});',
  '',
  "test('Body Cues pin is mobile-only at canonical CSS owners', async () => {",
  "  const [baseCss, mobileCss, html] = await Promise.all([load('styles/body-cues.css'), load('styles/body-cues-mobile.css'), load('feelings/body-cues/index.html')]);",
  "  assert.ok(baseCss.includes('.body-cues-page .body-cues-tool__pin-toggle {\\n  display: none;'));",
  "  assert.ok(mobileCss.includes('.body-cues-page .body-cues-tool__pin-toggle {\\n    position: relative;\\n    display: inline-flex;'));",
  "  assert.ok(html.includes('styles/body-cues.css'));",
  "  assert.ok(html.includes('styles/body-cues-mobile.css\\\" media=\\\"(max-width: 640px)\\\"'));",
  '});',
  '',
  "test('Journal and strategy forms share one Needs catalog implementation', async () => {",
  "  const [build, journal, inventory, needHtml] = await Promise.all([load('scripts/build-pages.mjs'), load('assets/js/journal/module.js'), load('scripts/inventory.js'), load('needs/acceptance/index.html')]);",
  "  const markup = renderCatalogMultiselectMarkup({ inputId: 'test-need', name: 'need', kind: 'needs', transport: 'select', delimiter: '|', options: [{ label: 'Acceptance', value: 'acceptance', slug: 'acceptance' }], selectedValues: ['acceptance'] });",
  "  assert.ok(markup.includes('journal-catalog-select__trigger'));",
  "  assert.ok(build.includes(\"import { renderCatalogMultiselectMarkup } from '../assets/js/catalog-multiselect.js';\"));",
  "  assert.ok(journal.includes(\"from '../catalog-multiselect.js';\"));",
  "  assert.ok(journal.includes('this.needsCatalogController'));",
  "  assert.ok(inventory.includes(\"import(resolveAssetPath('assets/js/catalog-multiselect.js'))\"));",
  "  assert.ok(needHtml.includes('data-strategy-need-catalog'));",
  "  assert.ok(needHtml.includes('journal-catalog-select__trigger'));",
  "  assert.ok(needHtml.includes('name=\\\"need\\\" multiple hidden data-catalog-multiselect-transport'));",
  "  assert.equal(needHtml.includes('hold Ctrl'), false);",
  '});',
  '',
);
write('tests/desktop-bedrock-finalization.test.mjs', test);

console.log('Applied desktop Bedrock finalization migration.');
