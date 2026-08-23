const escapeHtml = (value) => String(value ?? '')
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

const renderAttributes = (attributes = {}) => Object.entries(attributes)
  .map(([key, value]) => {
    if (value === '' || value === true) return ` ${key}`;
    if (value == null || value === false) return '';
    return ` ${key}="${escapeHtml(value)}"`;
  })
  .join('');

const renderTransport = ({ inputId, name, transport, delimiter, options, selectedValues, transportAttributes }) => {
  const attrs = renderAttributes(transportAttributes);
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
  const rootAttrs = renderAttributes(attributes);
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
