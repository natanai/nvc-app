import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value);
const replaceOnce = (source, search, replacement, label) => {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(search, replacement);
};
const replaceRegexOnce = (source, regex, replacement, label) => {
  const matches = source.match(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`)) || [];
  if (matches.length !== 1) throw new Error(`${label}: expected 1 match, found ${matches.length}`);
  return source.replace(regex, replacement);
};

const catalogModule = String.raw`const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeOption = (option) => {
  if (!option) return null;
  if (typeof option === 'string') {
    const label = option.trim();
    return label ? { label, value: label, slug: '' } : null;
  }
  if (typeof option !== 'object') return null;
  const label = String(option.label ?? option.title ?? option.name ?? option.value ?? option.slug ?? '').trim();
  const value = String(option.value ?? option.slug ?? label).trim();
  const slug = String(option.slug ?? '').trim();
  if (!label || !value) return null;
  return { label, value, slug };
};

export const normalizeCatalogMultiselectOptions = (options = []) => {
  const seen = new Set();
  return (Array.isArray(options) ? options : [])
    .map(normalizeOption)
    .filter(Boolean)
    .filter((option) => {
      const key = option.value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
};

const normalizeValues = (value, delimiter = ', ') => {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  const splitPattern = delimiter === '|' ? /\|/ : /[,|]/;
  return text.split(splitPattern).map((item) => item.trim()).filter(Boolean);
};

const renderTransport = ({ inputId, name, transport, delimiter, options, selectedValues, transportAttributes }) => {
  const attrs = Object.entries(transportAttributes || {})
    .map(([key, value]) => value === '' || value === true ? ` ${key}` : value == null || value === false ? '' : ` ${key}="${escapeHtml(value)}"`)
    .join('');
  const selected = new Set(normalizeValues(selectedValues, delimiter).map((value) => value.toLocaleLowerCase()));
  if (transport === 'select') {
    const optionMarkup = normalizeCatalogMultiselectOptions(options).map((option) => {
      const aliases = [option.value, option.slug, option.label].filter(Boolean).map((value) => value.toLocaleLowerCase());
      const isSelected = aliases.some((value) => selected.has(value));
      return `<option value="${escapeHtml(option.value)}"${isSelected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`;
    }).join('');
    return `<select id="${escapeHtml(inputId)}" name="${escapeHtml(name)}" multiple hidden data-catalog-multiselect-transport${attrs}>${optionMarkup}</select>`;
  }
  const value = normalizeValues(selectedValues, delimiter).join(delimiter);
  return `<input id="${escapeHtml(inputId)}" name="${escapeHtml(name)}" type="hidden" value="${escapeHtml(value)}" data-catalog-multiselect-transport${attrs}>`;
};

export function renderCatalogMultiselectMarkup({
  inputId,
  name,
  kind = 'needs',
  placeholder = 'Choose needs',
  ariaLabel = 'Choose one or more needs',
  transport = 'input',
  delimiter = ', ',
  options = [],
  selectedValues = [],
  classes = [],
  attributes = {},
  transportAttributes = {},
} = {}) {
  if (!inputId || !name) throw new Error('Catalog multi-select requires inputId and name');
  const triggerId = `${inputId}-trigger`;
  const popoverId = `${inputId}-popover`;
  const className = ['journal-catalog-select', ...classes].filter(Boolean).join(' ');
  const rootAttrs = Object.entries(attributes || {})
    .map(([key, value]) => value === '' || value === true ? ` ${key}` : value == null || value === false ? '' : ` ${key}="${escapeHtml(value)}"`)
    .join('');
  const normalizedOptions = normalizeCatalogMultiselectOptions(options);
  const selected = new Set(normalizeValues(selectedValues, delimiter).map((value) => value.toLocaleLowerCase()));
  const selectedLabels = normalizedOptions
    .filter((option) => [option.value, option.slug, option.label].filter(Boolean).some((value) => selected.has(value.toLocaleLowerCase())))
    .map((option) => option.label);
  const summary = selectedLabels.length
    ? selectedLabels.length <= 2 ? selectedLabels.join(', ') : `${selectedLabels[0]}, ${selectedLabels[1]} +${selectedLabels.length - 2}`
    : placeholder;
  return `<div class="${escapeHtml(className)}" data-catalog-multiselect="${escapeHtml(kind)}" data-catalog-delimiter="${escapeHtml(delimiter)}" data-journal-catalog-select="${escapeHtml(kind)}"${rootAttrs}>
  ${renderTransport({ inputId, name, transport, delimiter, options: normalizedOptions, selectedValues, transportAttributes })}
  <button class="journal-catalog-select__trigger" id="${escapeHtml(triggerId)}" type="button" aria-expanded="false" aria-controls="${escapeHtml(popoverId)}" aria-haspopup="dialog" data-journal-catalog-trigger data-catalog-kind="${escapeHtml(kind)}">
    <span class="journal-catalog-select__value${selectedLabels.length ? '' : ' is-placeholder'}" data-journal-catalog-value>${escapeHtml(summary)}</span>
    <span class="journal-catalog-select__chevron" aria-hidden="true"></span>
  </button>
  <div class="journal-catalog-popover" id="${escapeHtml(popoverId)}" hidden role="dialog" aria-label="${escapeHtml(ariaLabel)}" data-journal-catalog-popover data-catalog-kind="${escapeHtml(kind)}">
    <div class="journal-catalog-popover__toolbar"><input class="journal-catalog-popover__search" type="search" autocomplete="off" placeholder="Search needs" data-journal-catalog-search></div>
    <div class="journal-catalog-popover__options" role="listbox" aria-multiselectable="true" data-journal-catalog-options></div>
    <div class="journal-catalog-popover__footer">
      <button class="journal-catalog-popover__action" type="button" data-journal-catalog-clear>Clear</button>
      <button class="journal-catalog-popover__action journal-catalog-popover__action--done" type="button" data-journal-catalog-done>Done</button>
    </div>
  </div>
</div>`;
}

export function createCatalogMultiselectElement(config = {}) {
  if (typeof document === 'undefined') throw new Error('Catalog multi-select DOM creation requires document');
  const template = document.createElement('template');
  template.innerHTML = renderCatalogMultiselectMarkup(config).trim();
  return template.content.firstElementChild;
}

export class CatalogMultiselectController {
  constructor(root, options = {}) {
    this.root = root instanceof HTMLElement ? root : document.querySelector(root);
    if (!this.root) throw new Error('CatalogMultiselectController requires a valid root');
    this.transport = this.root.querySelector('[data-catalog-multiselect-transport]');
    if (!this.transport) throw new Error('Catalog multi-select requires a transport control');
    this.kind = this.root.dataset.catalogMultiselect || options.kind || 'needs';
    this.placeholder = options.placeholder || 'Choose needs';
    this.delimiter = options.delimiter || this.root.dataset.catalogDelimiter || ', ';
    this.options = normalizeCatalogMultiselectOptions(options.options || this.readTransportOptions());
    this.trigger = this.root.querySelector('[data-journal-catalog-trigger]');
    this.popover = this.root.querySelector('[data-journal-catalog-popover]');
    this.search = this.root.querySelector('[data-journal-catalog-search]');
    this.list = this.root.querySelector('[data-journal-catalog-options]');
    this.clearButton = this.root.querySelector('[data-journal-catalog-clear]');
    this.doneButton = this.root.querySelector('[data-journal-catalog-done]');
    this.valueEl = this.root.querySelector('[data-journal-catalog-value]');
    this.attachEvents();
    this.updateSummary();
    this.root.__catalogMultiselectController = this;
  }

  readTransportOptions() {
    if (!(this.transport instanceof HTMLSelectElement)) return [];
    return Array.from(this.transport.options).filter((option) => option.value).map((option) => ({
      label: option.textContent?.trim() || option.value,
      value: option.value,
      slug: option.value,
    }));
  }

  setOptions(options = []) {
    const before = this.getValues();
    this.options = normalizeCatalogMultiselectOptions(options);
    this.setValues(before, { dispatch: false });
  }

  resolveOption(value) {
    const key = String(value ?? '').trim().toLocaleLowerCase();
    if (!key) return null;
    return this.options.find((option) => [option.value, option.slug, option.label]
      .filter(Boolean)
      .some((candidate) => candidate.toLocaleLowerCase() === key)) || null;
  }

  getValues() {
    if (this.transport instanceof HTMLSelectElement) {
      return Array.from(this.transport.selectedOptions).map((option) => option.value).filter(Boolean);
    }
    return normalizeValues(this.transport.value, this.delimiter);
  }

  getSelectedOptions() {
    return this.getValues().map((value) => this.resolveOption(value)).filter(Boolean);
  }

  setValues(values = [], { dispatch = false } = {}) {
    const resolved = [];
    const seen = new Set();
    normalizeValues(values, this.delimiter).forEach((value) => {
      const option = this.resolveOption(value);
      const canonical = option?.value || String(value ?? '').trim();
      const key = canonical.toLocaleLowerCase();
      if (!canonical || seen.has(key)) return;
      seen.add(key);
      resolved.push(canonical);
    });
    if (this.transport instanceof HTMLSelectElement) {
      const selected = new Set(resolved.map((value) => value.toLocaleLowerCase()));
      Array.from(this.transport.options).forEach((option) => {
        option.selected = selected.has(option.value.toLocaleLowerCase());
      });
    } else {
      this.transport.value = resolved.join(this.delimiter);
    }
    this.updateSummary();
    if (!this.popover?.hidden) this.renderOptions();
    if (dispatch) this.dispatchChange();
  }

  toggleValue(value, { dispatch = true } = {}) {
    const option = this.resolveOption(value);
    if (!option) return;
    const values = this.getValues();
    const key = option.value.toLocaleLowerCase();
    const index = values.findIndex((item) => item.toLocaleLowerCase() === key);
    if (index >= 0) values.splice(index, 1);
    else values.push(option.value);
    this.setValues(values, { dispatch });
  }

  dispatchChange() {
    this.transport.dispatchEvent(new Event('change', { bubbles: true }));
  }

  updateSummary() {
    if (!this.valueEl) return;
    const labels = this.getSelectedOptions().map((option) => option.label);
    if (!labels.length) {
      this.valueEl.textContent = this.placeholder;
      this.valueEl.classList.add('is-placeholder');
      return;
    }
    this.valueEl.classList.remove('is-placeholder');
    this.valueEl.textContent = labels.length <= 2 ? labels.join(', ') : `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }

  renderOptions() {
    if (!this.list) return;
    const query = (this.search?.value || '').trim().toLocaleLowerCase();
    const selected = new Set(this.getValues().map((value) => value.toLocaleLowerCase()));
    const options = this.options.filter((option) => !query || option.label.toLocaleLowerCase().includes(query));
    this.list.innerHTML = '';
    if (!options.length) {
      const empty = document.createElement('p');
      empty.className = 'journal-catalog-popover__empty';
      empty.textContent = 'No matches';
      this.list.append(empty);
      return;
    }
    options.forEach((option) => {
      const button = document.createElement('button');
      const isSelected = selected.has(option.value.toLocaleLowerCase());
      button.type = 'button';
      button.className = `journal-catalog-option${isSelected ? ' is-selected' : ''}`;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      button.setAttribute('data-journal-catalog-option', '');
      button.dataset.value = option.value;
      const label = document.createElement('span');
      label.textContent = option.label;
      const check = document.createElement('span');
      check.className = 'journal-catalog-option__check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = isSelected ? '✓' : '';
      button.append(label, check);
      this.list.append(button);
    });
  }

  open() {
    if (!this.popover || !this.trigger) return;
    if (this.search) this.search.value = '';
    this.renderOptions();
    this.popover.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
  }

  close() {
    if (this.popover) this.popover.hidden = true;
    if (this.trigger) this.trigger.setAttribute('aria-expanded', 'false');
  }

  attachEvents() {
    this.trigger?.addEventListener('click', () => {
      if (this.trigger.getAttribute('aria-expanded') === 'true') this.close();
      else this.open();
    });
    this.search?.addEventListener('input', () => this.renderOptions());
    this.list?.addEventListener('click', (event) => {
      const option = event.target.closest('[data-journal-catalog-option]');
      if (!option) return;
      this.toggleValue(option.dataset.value || '');
    });
    this.clearButton?.addEventListener('click', () => this.setValues([], { dispatch: true }));
    this.doneButton?.addEventListener('click', () => {
      this.close();
      this.trigger?.focus();
    });
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.close();
        this.trigger?.focus();
      }
    });
    this.transport.addEventListener('change', () => {
      this.updateSummary();
      if (!this.popover?.hidden) this.renderOptions();
    });
    const form = this.root.closest('form');
    form?.addEventListener('reset', () => window.setTimeout(() => this.updateSummary(), 0));
    this.outsidePointerHandler = (event) => {
      if (!this.root.contains(event.target)) this.close();
    };
    document.addEventListener('pointerdown', this.outsidePointerHandler);
  }
}

export function hydrateCatalogMultiselect(root, options = {}) {
  const element = root instanceof HTMLElement ? root : document.querySelector(root);
  if (!element) return null;
  if (element.__catalogMultiselectController) return element.__catalogMultiselectController;
  return new CatalogMultiselectController(element, options);
}
`;
write('assets/js/catalog-multiselect.js', catalogModule);

let build = read('scripts/build-pages.mjs');
build = replaceOnce(
  build,
  "import { updateObservationGuidePage } from './observation-guide.mjs';",
  "import { updateObservationGuidePage } from './observation-guide.mjs';\nimport { renderCatalogMultiselectMarkup } from '../assets/js/catalog-multiselect.js';",
  'build shared selector import',
);

build = replaceRegexOnce(
  build,
  /  const needOptions = data\.needs[\s\S]*?  const needField = includeNeedSelect[\s\S]*?    : '';\n/,
  `  const needOptions = data.needs.map((need) => ({\n    label: need.title,\n    value: need.slug,\n    slug: need.slug,\n  }));\n\n  const needField = includeNeedSelect\n    ? \`\n        <div class="strategy-form__field strategy-form__field--needs">\n          <label for="\${idPrefix}-need-trigger">Needs</label>\n          \${renderCatalogMultiselectMarkup({\n            inputId: \`\${idPrefix}-need\`,\n            name: 'need',\n            kind: 'needs',\n            placeholder: 'Choose needs',\n            ariaLabel: 'Choose one or more needs',\n            transport: 'select',\n            delimiter: '|',\n            options: needOptions,\n            selectedValues: defaultNeedSlug ? [defaultNeedSlug] : [],\n            classes: ['strategy-card', 'strategy-card--input', 'strategy-need-catalog'],\n            attributes: { 'data-strategy-need-catalog': '' },\n          })}\n        </div>\`\n    : '';\n`,
  'strategy need selector generation',
);

build = replaceOnce(
  build,
  "          var STORAGE_KEY = 'magnetPositions:${storageKey}';\n          var raw;\n          try {\n            if (!('localStorage' in window)) {\n              return;\n            }\n            raw = window.localStorage.getItem(STORAGE_KEY);\n          } catch (error) {\n            return;\n          }",
  "          var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';\n          var bucket = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';\n          var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;\n          var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';\n          var raw;\n          try {\n            if (!('localStorage' in window)) {\n              return;\n            }\n            raw = window.localStorage.getItem(STORAGE_KEY);\n            if (!raw && !window.localStorage.getItem(MIGRATION_KEY)) {\n              var legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);\n              if (legacyRaw) {\n                window.localStorage.setItem(STORAGE_KEY, legacyRaw);\n                raw = legacyRaw;\n              }\n              window.localStorage.setItem(MIGRATION_KEY, bucket);\n            }\n          } catch (error) {\n            return;\n          }",
  'nav prepaint responsive storage',
);

build = replaceOnce(
  build,
  `    @media (min-width: 760px) {\n      main[data-page-id='inventory-journal'] .journal-overview-grid {\n        grid-template-columns: repeat(2, minmax(0, 1fr));\n      }\n\n      main[data-page-id='inventory-journal'] .journal-history-controls__filters {`,
  `    @media (min-width: 760px) {\n      main[data-page-id='inventory-journal'] .journal-history-controls__filters {`,
  'Journal desktop overview hierarchy',
);
write('scripts/build-pages.mjs', build);

let styles = read('styles.css');
styles = replaceOnce(
  styles,
  `\n@media (min-width: 960px) {\n  .journal-overview-grid {\n    grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);\n    grid-template-areas:\n      "fullscreen storage"\n      "summary summary";\n  }\n}\n\n@media (min-width: 960px) {\n  .journal-overview-grid .journal-storage-panel {\n    grid-area: storage;\n    align-self: start;\n  }\n\n  .journal-overview-grid .journal-summary-section {\n    grid-area: summary;\n  }\n\n  .journal-overview-grid .journal-fullscreen-slot {\n    grid-area: fullscreen;\n    align-self: center;\n  }\n}\n`,
  '\n',
  'retire obsolete Journal desktop grid areas',
);
write('styles.css', styles);

let bodyCss = read('styles/body-cues.css');
bodyCss = replaceOnce(
  bodyCss,
  `.body-cues-page .body-cues-tool__actions {\n  display: flex;\n  justify-content: flex-start;\n  margin: 0;\n}\n`,
  `.body-cues-page .body-cues-tool__actions {\n  display: flex;\n  justify-content: flex-start;\n  margin: 0;\n}\n\n/* Pinning changes the compact sticky result shelf and is therefore a phone-only action. */\n.body-cues-page .body-cues-tool__pin-toggle {\n  display: none;\n}\n`,
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
  `\n/* The pin control is created by the Body Cues runtime but is a mobile-only affordance. */\n.body-cues-page .body-cues-tool__pin-toggle {\n  display: none;\n}\n`,
  '\n',
  'remove unreachable desktop pin rule from mobile-only stylesheet',
);
write('styles/body-cues-mobile.css', bodyMobile);

let magnets = read('scripts/magnets.js');
magnets = replaceOnce(
  magnets,
  `const NAV_MOBILE_ORDER_QUERY = '(max-width: 640px)';`,
  `const NAV_MOBILE_ORDER_QUERY = '(max-width: 640px)';\nconst RESPONSIVE_LAYOUT_MIGRATION_SUFFIX = '@responsive-v1';\n\nconst getResponsiveLayoutBucket = () =>\n  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NAV_MOBILE_ORDER_QUERY).matches\n    ? 'mobile'\n    : 'desktop';\n\nconst resolveResponsiveStorageKey = (storageKey) => {\n  const bucket = getResponsiveLayoutBucket();\n  const scopedKey = \`\${storageKey}@\${bucket}\`;\n  if (typeof window === 'undefined' || !window.localStorage) return scopedKey;\n  const legacyKey = \`magnetPositions:\${storageKey}\`;\n  const scopedRawKey = \`magnetPositions:\${scopedKey}\`;\n  const migrationKey = \`\${legacyKey}\${RESPONSIVE_LAYOUT_MIGRATION_SUFFIX}\`;\n  try {\n    if (!window.localStorage.getItem(scopedRawKey) && !window.localStorage.getItem(migrationKey)) {\n      const legacy = window.localStorage.getItem(legacyKey);\n      if (legacy) window.localStorage.setItem(scopedRawKey, legacy);\n      window.localStorage.setItem(migrationKey, bucket);\n    }\n  } catch {\n    // Storage availability is handled again by magnetPhysics.\n  }\n  return scopedKey;\n};`,
  'responsive magnet storage helpers',
);
magnets = replaceOnce(
  magnets,
  `    storageKey: resolvedStorageKey,\n    magnets: measured,`,
  `    storageKey: resolvedStorageKey,\n    persistenceKey: resolveResponsiveStorageKey(resolvedStorageKey),\n    layoutBucket: getResponsiveLayoutBucket(),\n    magnets: measured,`,
  'magnet persistence state',
);
magnets = replaceOnce(
  magnets,
  `  const storedResult = loadPositions(\n    state.storageKey,`,
  `  const storedResult = loadPositions(\n    state.persistenceKey,`,
  'responsive magnet load',
);
magnets = magnets.replaceAll('savePositions(\n        state.storageKey,', 'savePositions(\n        state.persistenceKey,');
magnets = magnets.replaceAll('savePositions(\n      state.storageKey,', 'savePositions(\n      state.persistenceKey,');
if (!magnets.includes('state.persistenceKey')) throw new Error('responsive magnet save replacement failed');
write('scripts/magnets.js', magnets);

let journal = read('assets/js/journal/module.js');
journal = replaceOnce(
  journal,
  `import { getSuggestions as getTagSuggestions } from './tags.js';`,
  `import { getSuggestions as getTagSuggestions } from './tags.js';\nimport { createCatalogMultiselectElement, hydrateCatalogMultiselect } from '../catalog-multiselect.js';`,
  'Journal shared catalog import',
);
journal = replaceRegexOnce(
  journal,
  /const buildNeedsField = \(config\) => buildCatalogSelectorField\(config, \{[\s\S]*?\n\}\);/,
  `const buildNeedsField = (config) => {\n  const inputId = \`\${config.idPrefix}-needs\`;\n  const selector = createCatalogMultiselectElement({\n    inputId,\n    name: 'needs',\n    kind: 'needs',\n    placeholder: config.placeholders.needs || 'Choose needs',\n    ariaLabel: 'Choose one or more needs',\n    transport: 'input',\n    delimiter: ', ',\n    transportAttributes: { 'data-journal-needs': '' },\n  });\n  return buildJournalMetaRow({\n    label: config.labels.needs,\n    id: \`\${inputId}-trigger\`,\n    input: selector,\n    modifier: 'needs',\n  });\n};`,
  'Journal needs shared markup',
);
journal = replaceOnce(
  journal,
  `    this.needsSelectRoot = this.root.querySelector('[data-journal-catalog-select="needs"]');\n    this.notesBaseHeight = null;`,
  `    this.needsSelectRoot = this.root.querySelector('[data-journal-catalog-select="needs"]');\n    this.needsCatalogController = this.needsSelectRoot\n      ? hydrateCatalogMultiselect(this.needsSelectRoot, { placeholder: 'Choose needs', delimiter: ', ' })\n      : null;\n    this.notesBaseHeight = null;`,
  'Journal needs shared controller',
);
journal = replaceOnce(
  journal,
  `    ['feeling', 'needs'].forEach((kind) => {\n      const root = this.getCatalogRoot(kind);`,
  `    ['feeling', 'needs'].forEach((kind) => {\n      if (kind === 'needs' && this.needsCatalogController) return;\n      const root = this.getCatalogRoot(kind);`,
  'Journal shared needs event ownership',
);
journal = replaceOnce(
  journal,
  `  getCatalogValues(kind) {\n    if (kind === 'feeling') return this.getFeelingRatings().map((item) => item.feeling);\n    const input = this.getCatalogInput(kind);`,
  `  getCatalogValues(kind) {\n    if (kind === 'feeling') return this.getFeelingRatings().map((item) => item.feeling);\n    if (kind === 'needs' && this.needsCatalogController) return this.needsCatalogController.getValues();\n    const input = this.getCatalogInput(kind);`,
  'Journal shared needs get values',
);
journal = replaceOnce(
  journal,
  `    const input = this.getCatalogInput(kind);\n    if (!input) return;\n    const normalized = this.normalizeCatalogValues(kind, values);\n    input.value = joinListValues(normalized);`,
  `    if (kind === 'needs' && this.needsCatalogController) {\n      const normalized = this.normalizeCatalogValues(kind, values);\n      this.needsCatalogController.setValues(normalized, { dispatch: false });\n      return;\n    }\n    const input = this.getCatalogInput(kind);\n    if (!input) return;\n    const normalized = this.normalizeCatalogValues(kind, values);\n    input.value = joinListValues(normalized);`,
  'Journal shared needs set values',
);
journal = replaceOnce(
  journal,
  `  updateCatalogSummary(kind) {\n    const root = this.getCatalogRoot(kind);`,
  `  updateCatalogSummary(kind) {\n    if (kind === 'needs' && this.needsCatalogController) {\n      this.needsCatalogController.updateSummary();\n      return;\n    }\n    const root = this.getCatalogRoot(kind);`,
  'Journal shared needs summary',
);
journal = replaceOnce(
  journal,
  `  openCatalogSelect(kind) {\n    ['feeling', 'needs'].forEach((other) => { if (other !== kind) this.closeCatalogSelect(other); });`,
  `  openCatalogSelect(kind) {\n    if (kind === 'needs' && this.needsCatalogController) {\n      this.closeCatalogSelect('feeling');\n      this.needsCatalogController.open();\n      return;\n    }\n    ['feeling', 'needs'].forEach((other) => { if (other !== kind) this.closeCatalogSelect(other); });`,
  'Journal shared needs open',
);
journal = replaceOnce(
  journal,
  `  closeCatalogSelect(kind) {\n    const root = this.getCatalogRoot(kind);`,
  `  closeCatalogSelect(kind) {\n    if (kind === 'needs' && this.needsCatalogController) {\n      this.needsCatalogController.close();\n      return;\n    }\n    const root = this.getCatalogRoot(kind);`,
  'Journal shared needs close',
);
journal = replaceOnce(
  journal,
  `  renderCatalogOptions(kind) {\n    const root = this.getCatalogRoot(kind);`,
  `  renderCatalogOptions(kind) {\n    if (kind === 'needs' && this.needsCatalogController) {\n      this.needsCatalogController.renderOptions();\n      return;\n    }\n    const root = this.getCatalogRoot(kind);`,
  'Journal shared needs render',
);
journal = replaceOnce(
  journal,
  `  toggleCatalogValue(kind, value) {\n    if (!value) return;`,
  `  toggleCatalogValue(kind, value) {\n    if (!value) return;\n    if (kind === 'needs' && this.needsCatalogController) {\n      this.needsCatalogController.toggleValue(value, { dispatch: true });\n      return;\n    }`,
  'Journal shared needs toggle',
);
journal = replaceOnce(
  journal,
  `    this.needsOptions = normalizedList;\n    this.setCatalogValues('needs', this.getCatalogValues('needs'));`,
  `    this.needsOptions = normalizedList;\n    if (this.needsCatalogController) {\n      this.needsCatalogController.setOptions(normalizedList.map((option) => ({\n        label: option.label,\n        value: option.label,\n        slug: option.slug || '',\n      })));\n    }\n    this.setCatalogValues('needs', this.getCatalogValues('needs'));`,
  'Journal shared needs options',
);
write('assets/js/journal/module.js', journal);

let inventory = read('scripts/inventory.js');
inventory = replaceOnce(
  inventory,
  `let inventoryRuntimeInitialized = false;`,
  `let catalogMultiselectModulePromise = null;\n\nfunction ensureCatalogMultiselectModule() {\n  if (!catalogMultiselectModulePromise) {\n    catalogMultiselectModulePromise = import(resolveAssetPath('assets/js/catalog-multiselect.js'));\n  }\n  return catalogMultiselectModulePromise;\n}\n\nasync function hydrateStrategyNeedSelectors() {\n  const roots = Array.from(document.querySelectorAll('[data-strategy-need-catalog]'));\n  if (!roots.length) return;\n  const module = await ensureCatalogMultiselectModule();\n  roots.forEach((root) => module.hydrateCatalogMultiselect(root, { placeholder: 'Choose needs', delimiter: '|' }));\n}\n\nlet inventoryRuntimeInitialized = false;`,
  'strategy shared selector loader',
);
inventory = replaceOnce(
  inventory,
  `  state.basePath = document.body?.dataset?.basePath || '';\n  state.journalDraftPath = typeof window !== 'undefined' ? window.location.pathname : '';`,
  `  state.basePath = document.body?.dataset?.basePath || '';\n  state.journalDraftPath = typeof window !== 'undefined' ? window.location.pathname : '';\n  hydrateStrategyNeedSelectors().catch((error) => {\n    console.warn('Unable to initialize shared Needs selector', error);\n  });`,
  'hydrate strategy Needs selectors',
);
write('scripts/inventory.js', inventory);

const test = String.raw`import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCatalogMultiselectMarkup } from '../assets/js/catalog-multiselect.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('desktop Journal preserves core Patterns-before-Backup hierarchy', async () => {
  const [build, css, html] = await Promise.all([
    load('scripts/build-pages.mjs'),
    load('styles.css'),
    load('inventory/journal/index.html'),
  ]);
  assert.equal(css.includes('"fullscreen storage"'), false, 'obsolete Journal desktop grid areas must stay retired');
  assert.equal(build.includes("main[data-page-id='inventory-journal'] .journal-overview-grid {\n        grid-template-columns: repeat(2"), false, 'dedicated Journal utilities must not become a two-column desktop reorder surface');
  assert.ok(html.indexOf('journal-summary-section journal-utility-disclosure') < html.indexOf('journal-actions journal-utility-disclosure'), 'Patterns must precede Backup & restore in generated Journal markup');
});

test('magnet persistence uses separate mobile and desktop profile keys', async () => {
  const [build, magnets, inventory] = await Promise.all([
    load('scripts/build-pages.mjs'),
    load('scripts/magnets.js'),
    load('scripts/inventory.js'),
  ]);
  assert.ok(magnets.includes("? 'mobile'\n    : 'desktop'"));
  assert.ok(magnets.includes('persistenceKey: resolveResponsiveStorageKey(resolvedStorageKey)'));
  assert.ok(magnets.includes('state.persistenceKey'));
  assert.ok(magnets.includes("RESPONSIVE_LAYOUT_MIGRATION_SUFFIX = '@responsive-v1'"));
  assert.ok(build.includes("var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;"), 'prepaint must use the same responsive key before first paint');
  assert.ok(build.includes("var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';"));
  assert.ok(inventory.includes("if (key.startsWith('magnetPositions:'))"), 'profile/backup snapshot must continue collecting both responsive magnet keys');
});

test('Body Cues pin is mobile-only at canonical CSS owners', async () => {
  const [baseCss, mobileCss, html] = await Promise.all([
    load('styles/body-cues.css'),
    load('styles/body-cues-mobile.css'),
    load('feelings/body-cues/index.html'),
  ]);
  assert.ok(baseCss.includes('.body-cues-page .body-cues-tool__pin-toggle {\n  display: none;'));
  assert.ok(mobileCss.includes('.body-cues-page .body-cues-tool__pin-toggle {\n    position: relative;\n    display: inline-flex;'));
  assert.ok(html.includes('styles/body-cues.css'));
  assert.ok(html.includes('styles/body-cues-mobile.css\" media=\"(max-width: 640px)\"'));
});

test('Journal and strategy forms share one Needs catalog multi-select implementation', async () => {
  const [build, journal, inventory, needHtml] = await Promise.all([
    load('scripts/build-pages.mjs'),
    load('assets/js/journal/module.js'),
    load('scripts/inventory.js'),
    load('needs/acceptance/index.html'),
  ]);
  const markup = renderCatalogMultiselectMarkup({
    inputId: 'test-need',
    name: 'need',
    kind: 'needs',
    transport: 'select',
    delimiter: '|',
    options: [{ label: 'Acceptance', value: 'acceptance', slug: 'acceptance' }],
    selectedValues: ['acceptance'],
  });
  assert.ok(markup.includes('journal-catalog-select__trigger'));
  assert.ok(markup.includes('data-catalog-multiselect-transport'));
  assert.ok(build.includes("import { renderCatalogMultiselectMarkup } from '../assets/js/catalog-multiselect.js';"));
  assert.ok(journal.includes("from '../catalog-multiselect.js';"));
  assert.ok(journal.includes('this.needsCatalogController'));
  assert.ok(inventory.includes("import(resolveAssetPath('assets/js/catalog-multiselect.js'))"));
  assert.ok(needHtml.includes('data-strategy-need-catalog'));
  assert.ok(needHtml.includes('journal-catalog-select__trigger'));
  assert.ok(needHtml.includes('select id=\"strategy-acceptance-need\" name=\"need\" multiple hidden data-catalog-multiselect-transport'));
  assert.equal(needHtml.includes('hold Ctrl'), false, 'native multi-select instructions must stay retired');
});
`;
write('tests/desktop-bedrock-finalization.test.mjs', test);

console.log('Applied desktop Bedrock finalization migration.');
