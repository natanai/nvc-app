import store, { loadDraft, saveDraft, clearDraft } from './store.js';
import { getSuggestions as getTagSuggestions } from './tags.js';

const DEFAULT_INTENSITY = 5;
const DEFAULT_TAG_LIMIT = 8;
const MESSAGE_CLASSES = ['journal-message--success', 'journal-message--warning', 'journal-message--error'];
const DRAFT_DELAY_MS = 900;
const LOCAL_STORAGE_NOTE_TEXT =
  'Reminder: This static site saves data in your browser; clearing local storage removes it, so export backups.';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeNumber = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return undefined;
  }
  return clamp(Math.round(number), min, max);
};

const normalizeList = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : String(item))).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeTags = (value) => {
  const base = normalizeList(value);
  const seen = new Set();
  const result = [];
  base.forEach((tag) => {
    const trimmed = tag.replace(/^#/, '').trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(trimmed);
  });
  return result;
};

const joinTags = (tags, { trailing = false } = {}) => {
  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (!list.length) {
    return '';
  }
  const joined = list.join(', ');
  return trailing ? `${joined}, ` : joined;
};

const getTagFragment = (value) => {
  if (!value) {
    return '';
  }
  const segments = value.split(',');
  const fragment = segments[segments.length - 1] || '';
  return fragment.replace(/^#/, '').trim();
};

const normalizeNeedOption = (need) => {
  if (!need) {
    return null;
  }
  if (typeof need === 'string') {
    const label = need.trim();
    if (!label) {
      return null;
    }
    return { slug: '', label, value: label };
  }
  if (typeof need !== 'object') {
    return null;
  }
  const rawSlug = typeof need.slug === 'string' ? need.slug : need.value;
  const slug = typeof rawSlug === 'string' ? rawSlug.trim() : '';
  const rawLabel = need.title || need.label || '';
  const label = rawLabel ? rawLabel.toString().trim() : slug;
  if (!label) {
    return null;
  }
  const value = slug || label;
  return { slug, label, value };
};

const joinListValues = (values, { trailing = false } = {}) => {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!list.length) {
    return '';
  }
  const joined = list.join(', ');
  return trailing ? `${joined}, ` : joined;
};

let uniqueIdCounter = 0;
const createUniqueId = (prefix) => {
  uniqueIdCounter += 1;
  return `${prefix}-${uniqueIdCounter}`;
};

function resolveStore() {
  if (store) {
    return store;
  }
  if (typeof window !== 'undefined') {
    return window.NVCJournalStore || window.NVCJournal?.store || null;
  }
  return null;
}

function parseJsonScript(selector) {
  const script = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!script) {
    return null;
  }
  try {
    const text = script.textContent || script.innerText || '';
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.warn('Journal module: unable to parse JSON script', error);
    return null;
  }
}

const isPlainObject = (value) => Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';

const deepMerge = (...sources) => {
  const result = {};
  sources.forEach((source) => {
    if (!source) {
      return;
    }
    Object.entries(source).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      if (Array.isArray(value)) {
        result[key] = value.slice();
      } else if (isPlainObject(value)) {
        const base = isPlainObject(result[key]) ? result[key] : {};
        result[key] = deepMerge(base, value);
      } else {
        result[key] = value;
      }
    });
  });
  return result;
};

const JOURNAL_BASE_CONFIG = {
  variant: 'inventory',
  idPrefix: 'journal',
  needsMode: 'catalog-multiselect',
  intensityRange: { min: 0, max: 10, defaultValue: DEFAULT_INTENSITY },
  notes: { rows: 12 },
  labels: {
    emotion: 'Feeling',
    intensity: 'Intensity',
    needs: 'Needs',
    tags: 'Tags',
    notes: 'Reflection',
  },
  hints: {
    emotion: '',
    intensity: '',
    needs: '',
    tags: '',
    notes: '',
  },
  placeholders: {
    emotion: 'Choose feelings',
    needs: 'Choose needs',
    tags: 'work, weekend, boundaries',
    notes: '',
  },
  prompts: {
    heading: 'Need a nudge?',
    items: [
      'What sensations stood out in your body?',
      'What need might be shining through or feeling tender?',
      'What support, boundary, or self-care step sounds kind?',
    ],
  },
  aria: {
    needSuggestions: 'Suggested needs',
    tagSuggestions: 'Suggested tags',
  },
  actions: {
    layout: 'inline',
    statusPlacement: 'inline',
    submitLabel: 'Save',
    clearLabel: 'Clear',
    noteClasses: ['journal-actions__note'],
    statusAttributes: { 'aria-live': 'polite' },
    classes: {
      container: ['journal-form__actions', 'inventory-journal-form__actions'],
      status: ['journal-status'],
      submit: ['app-action', 'app-action--primary'],
      clear: ['app-action', 'app-action--quiet'],
    },
  },
  classes: {
    container: ['journal-module'],
    form: ['journal-form', 'inventory-journal-form'],
    grid: ['journal-form__grid', 'inventory-journal-form__grid'],
    field: ['journal-form__field', 'inventory-journal-form__field'],
    notesField: [
      'journal-form__field',
      'journal-form__field--notes',
      'inventory-journal-form__field',
      'inventory-journal-form__field--notes',
    ],
    layout: ['journal-form__layout'],
    pages: ['journal-form__pages'],
    page: ['journal-form__page'],
    primaryPage: ['journal-form__page', 'journal-form__page--primary'],
    sheet: ['journal-form__sheet'],
    sidebar: ['journal-form__sidebar'],
    sidebarInner: ['journal-form__sidebar-inner'],
    sidebarSection: ['journal-form__sidebar-section'],
    notesInput: ['journal-form__notes'],
    intensityField: [
      'journal-form__field',
      'journal-form__field--intensity',
      'inventory-journal-form__field',
      'inventory-journal-form__field--intensity',
    ],
    wideField: [
      'journal-form__field',
      'journal-form__field--wide',
      'inventory-journal-form__field',
      'inventory-journal-form__field--wide',
    ],
    intensityWrap: ['journal-form__intensity', 'inventory-journal-form__intensity'],
    intensityOutput: ['journal-form__intensity-display'],
    hint: ['journal-field-hint'],
    prompts: ['journal-prompts'],
  },
};

const JOURNAL_VARIANT_CONFIG = {
  inventory: {},
  support: {
    variant: 'support',
    idPrefix: 'support-journal',
    needsMode: 'catalog-multiselect',
    hints: {
      emotion: '',
      needs: '',
      tags: 'Separate tags with commas to group related reflections.',
    },
    placeholders: {
      needs: 'Choose needs',
      notes: 'Let your reflection spill across the page…',
    },
    notes: { rows: 12 },
    labels: {
      notes: 'Reflection (saved only on this device)',
    },
    prompts: {
      heading: 'Need a gentle prompt?',
      items: [
        'What was happening right before you noticed this feeling?',
        'Does the emotion you chose fit? What signals line up or feel different?',
        'How strong is it right now on a scale from 1 (just there) to 10 (all-consuming)?',
        'What do you need or long for in this moment?',
      ],
    },
    footnote: {
      text: 'Saved reflections now appear in the Inventory journal tab so you can review or export them later.',
      classes: ['support-note', 'support-note--subtle'],
    },
  },
};

const parseDatasetOptions = (dataset = {}) => {
  const options = {};
  if (dataset.journalVariant) {
    options.variant = dataset.journalVariant;
  }
  if (dataset.journalIdPrefix) {
    options.idPrefix = dataset.journalIdPrefix;
  }
  if (dataset.journalNeedsMode) {
    options.needsMode = dataset.journalNeedsMode;
  }
  if (dataset.journalSubmitLabel) {
    options.actions = options.actions || {};
    options.actions.submitLabel = dataset.journalSubmitLabel;
  }
  if (dataset.journalClearLabel) {
    options.actions = options.actions || {};
    options.actions.clearLabel = dataset.journalClearLabel;
  }
  if (dataset.journalOpenLabel) {
    options.actions = options.actions || {};
    options.actions.openLink = options.actions.openLink || {};
    options.actions.openLink.label = dataset.journalOpenLabel;
  }
  if (dataset.journalFootnote) {
    options.footnote = options.footnote || {};
    options.footnote.text = dataset.journalFootnote;
  }
  if (dataset.journalPromptsHeading) {
    options.prompts = options.prompts || {};
    options.prompts.heading = dataset.journalPromptsHeading;
  }
  if (dataset.journalPrompts) {
    options.prompts = options.prompts || {};
    options.prompts.items = dataset.journalPrompts
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (dataset.journalNotesPlaceholder) {
    options.placeholders = options.placeholders || {};
    options.placeholders.notes = dataset.journalNotesPlaceholder;
  }
  if (dataset.journalNotesLabel) {
    options.labels = options.labels || {};
    options.labels.notes = dataset.journalNotesLabel;
  }
  if (dataset.journalTagsPlaceholder) {
    options.placeholders = options.placeholders || {};
    options.placeholders.tags = dataset.journalTagsPlaceholder;
  }
  if (dataset.journalNeedsPlaceholder) {
    options.placeholders = options.placeholders || {};
    options.placeholders.needs = dataset.journalNeedsPlaceholder;
  }
  return options;
};

const createElement = (tag, { classes = [], attrs = {}, dataset = {}, text, html } = {}) => {
  const element = document.createElement(tag);
  classes
    .filter((item) => typeof item === 'string' && item)
    .forEach((className) => element.classList.add(className));
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) {
      return;
    }
    if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, value);
    }
  });
  Object.entries(dataset || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    element.dataset[key] = value;
  });
  if (text !== undefined) {
    element.textContent = text;
  }
  if (html !== undefined) {
    element.innerHTML = html;
  }
  return element;
};

const createLocalStorageNote = (additionalClasses = []) =>
  createElement('p', {
    classes: ['local-storage-note', ...additionalClasses.filter((item) => typeof item === 'string' && item)],
    text: LOCAL_STORAGE_NOTE_TEXT,
  });

const buildJournalField = ({
  config,
  label,
  id,
  input,
  hint,
  fieldClasses,
}) => {
  const field = createElement('div', { classes: fieldClasses || config.classes.field });
  const labelEl = createElement('label', { attrs: { for: id }, text: label });
  field.append(labelEl, input);
  if (hint) {
    field.append(createElement('p', { classes: config.classes.hint, text: hint }));
  }
  return field;
};

const buildJournalMetaRow = ({ label, id, input, modifier = '', suggestions = null }) => {
  const classes = ['journal-meta-row'];
  if (modifier) classes.push(`journal-meta-row--${modifier}`);
  const row = createElement('div', { classes });
  row.append(createElement('label', { attrs: { for: id }, text: label }));
  const control = createElement('div', { classes: ['journal-meta-row__control'] });
  control.append(input);
  if (suggestions) control.append(suggestions);
  row.append(control);
  return row;
};

const buildCatalogSelectorField = (config, {
  kind,
  name,
  label,
  placeholder,
  dataAttribute,
  ariaLabel,
}) => {
  const inputId = `${config.idPrefix}-${kind}`;
  const triggerId = `${inputId}-trigger`;
  const popoverId = `${inputId}-popover`;

  const hiddenInput = createElement('input', {
    attrs: { id: inputId, name, type: 'hidden', value: '' },
  });
  hiddenInput.setAttribute(dataAttribute, '');

  const selector = createElement('div', {
    classes: ['journal-catalog-select'],
    attrs: { 'data-journal-catalog-select': kind },
  });

  const trigger = createElement('button', {
    classes: ['journal-catalog-select__trigger'],
    attrs: {
      id: triggerId,
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': popoverId,
      'aria-haspopup': 'dialog',
    },
  });
  trigger.setAttribute('data-journal-catalog-trigger', '');
  trigger.dataset.catalogKind = kind;
  const value = createElement('span', {
    classes: ['journal-catalog-select__value'],
    text: placeholder,
  });
  value.setAttribute('data-journal-catalog-value', '');
  const chevron = createElement('span', {
    classes: ['journal-catalog-select__chevron'],
    attrs: { 'aria-hidden': 'true' },
  });
  trigger.append(value, chevron);

  const popover = createElement('div', {
    classes: ['journal-catalog-popover'],
    attrs: { id: popoverId, hidden: true, role: 'dialog', 'aria-label': ariaLabel },
  });
  popover.setAttribute('data-journal-catalog-popover', '');
  popover.dataset.catalogKind = kind;

  const toolbar = createElement('div', { classes: ['journal-catalog-popover__toolbar'] });
  const search = createElement('input', {
    classes: ['journal-catalog-popover__search'],
    attrs: { type: 'search', autocomplete: 'off', placeholder: `Search ${kind === 'feeling' ? 'feelings' : 'needs'}` },
  });
  search.setAttribute('data-journal-catalog-search', '');
  search.dataset.catalogKind = kind;
  toolbar.append(search);

  const options = createElement('div', {
    classes: ['journal-catalog-popover__options'],
    attrs: { role: 'listbox', 'aria-multiselectable': 'true' },
  });
  options.setAttribute('data-journal-catalog-options', '');
  options.dataset.catalogKind = kind;

  const footer = createElement('div', { classes: ['journal-catalog-popover__footer'] });
  const clear = createElement('button', {
    classes: ['journal-catalog-popover__action'],
    attrs: { type: 'button' },
    text: 'Clear',
  });
  clear.setAttribute('data-journal-catalog-clear', '');
  clear.dataset.catalogKind = kind;
  const done = createElement('button', {
    classes: ['journal-catalog-popover__action', 'journal-catalog-popover__action--done'],
    attrs: { type: 'button' },
    text: 'Done',
  });
  done.setAttribute('data-journal-catalog-done', '');
  done.dataset.catalogKind = kind;
  footer.append(clear, done);

  popover.append(toolbar, options, footer);
  selector.append(hiddenInput, trigger, popover);
  return buildJournalMetaRow({ label, id: triggerId, input: selector, modifier: kind });
};

const buildFeelingField = (config) => buildCatalogSelectorField(config, {
  kind: 'feeling',
  name: 'emotion',
  label: config.labels.emotion,
  placeholder: config.placeholders.emotion || 'Choose feelings',
  dataAttribute: 'data-journal-emotion',
  ariaLabel: 'Choose one or more feelings',
});

const buildNeedsField = (config) => buildCatalogSelectorField(config, {
  kind: 'needs',
  name: 'needs',
  label: config.labels.needs,
  placeholder: config.placeholders.needs || 'Choose needs',
  dataAttribute: 'data-journal-needs',
  ariaLabel: 'Choose one or more needs',
});

const buildTagsField = (config) => {
  const id = `${config.idPrefix}-tags`;
  const input = createElement('input', {
    attrs: { id, name: 'tags', type: 'text', autocomplete: 'off', placeholder: config.placeholders.tags || '' },
  });
  input.setAttribute('data-journal-tags', '');
  const suggestions = createElement('div', {
    classes: ['journal-tag-suggestions'],
    attrs: { 'data-journal-tag-suggestions': '', hidden: true, role: 'listbox', 'aria-label': config.aria.tagSuggestions },
  });
  return buildJournalMetaRow({ label: config.labels.tags, id, input, modifier: 'tags', suggestions });
};

const buildPrompts = (config) => {
  const prompts = config.prompts || {};
  const items = Array.isArray(prompts.items) ? prompts.items.filter(Boolean) : [];
  if (!prompts.heading && !items.length) {
    return null;
  }
  const aside = createElement('aside', { classes: config.classes.prompts });
  if (prompts.heading) {
    aside.append(createElement('p', { text: prompts.heading }));
  }
  if (items.length) {
    const list = createElement('ul');
    items.forEach((item) => {
      list.append(createElement('li', { text: item }));
    });
    aside.append(list);
  }
  return aside;
};

const buildActions = (config) => {
  const actions = config.actions || {};
  const classes = actions.classes || {};
  let statusEl = null;
  let openLink = null;

  if (actions.layout === 'split') {
    const container = createElement('div', { classes: classes.container || [] });
    const primary = createElement('div', { classes: classes.primaryGroup || [] });
    const submit = createElement('button', {
      classes: classes.submit || [],
      attrs: { type: 'submit' },
      text: actions.submitLabel || 'Save',
    });
    submit.setAttribute('data-journal-submit', '');
    submit.dataset.appIcon = 'save';
    primary.append(submit);
    if (actions.openLink) {
      const linkConfig = actions.openLink;
      openLink = createElement('a', {
        classes: classes.open || [],
        attrs: {
          href: linkConfig.attributes?.href || '#',
          target: linkConfig.attributes?.target || '_blank',
          rel: linkConfig.attributes?.rel || 'noopener',
        },
        text: linkConfig.label || 'Open in Journal',
      });
      openLink.setAttribute('data-journal-open-link', '');
      openLink.hidden = true;
      primary.append(openLink);
    }
    container.append(primary);
    if (actions.clearLabel) {
      const clear = createElement('button', {
        classes: classes.clear || [],
        attrs: { type: 'button' },
        text: actions.clearLabel,
      });
      clear.setAttribute('data-journal-clear', '');
      clear.dataset.appIcon = 'clear';
      container.append(clear);
    }
    if (classes.status || actions.statusPlacement === 'inline') {
      statusEl = createElement('p', { classes: classes.status || [] });
      Object.entries(actions.statusAttributes || {}).forEach(([key, value]) => {
        if (value === undefined) {
          return;
        }
        if (value === true) {
          statusEl.setAttribute(key, '');
        } else {
          statusEl.setAttribute(key, value);
        }
      });
      statusEl.setAttribute('data-journal-status', '');
      if (actions.statusPlacement === 'inline') {
        container.prepend(statusEl);
      }
    }
    return { container, statusEl, openLink };
  }

  const container = createElement('div', { classes: classes.container || [] });
  statusEl = createElement('p', { classes: classes.status || [] });
  Object.entries(actions.statusAttributes || {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (value === true) {
      statusEl.setAttribute(key, '');
    } else {
      statusEl.setAttribute(key, value);
    }
  });
  statusEl.setAttribute('data-journal-status', '');
  container.append(statusEl);
  const buttonBar = createElement('div', {
    classes: ['journal-form__action-buttons', 'app-action-bar'],
  });
  if (actions.clearLabel) {
    const clear = createElement('button', {
      classes: classes.clear || [],
      attrs: { type: 'button' },
      text: actions.clearLabel,
    });
    clear.setAttribute('data-journal-clear', '');
    clear.dataset.appIcon = 'clear';
    buttonBar.append(clear);
  }
  const submit = createElement('button', {
    classes: classes.submit || [],
    attrs: { type: 'submit' },
    text: actions.submitLabel || 'Save',
  });
  submit.setAttribute('data-journal-submit', '');
  submit.dataset.appIcon = 'save';
  buttonBar.append(submit);
  container.append(buttonBar);
  return { container, statusEl, openLink };
};

export function renderJournalForm(root, overrides = {}) {
  if (typeof document === 'undefined') {
    return null;
  }
  const container = root instanceof HTMLElement ? root : document.querySelector(root);
  if (!container) {
    throw new Error('renderJournalForm requires a valid root element');
  }
  const datasetOptions = parseDatasetOptions(container.dataset || {});
  const variantKey = overrides.variant || datasetOptions.variant || container.dataset?.journalVariant || 'inventory';
  const variantConfig = JOURNAL_VARIANT_CONFIG[variantKey] || {};
  const config = deepMerge(JOURNAL_BASE_CONFIG, variantConfig, datasetOptions, overrides || {});

  container.classList.add(...(config.classes.container || []));
  container.dataset.journalVariant = config.variant;
  container.innerHTML = '';

  const form = createElement('form', {
    classes: config.classes.form || [],
    attrs: { 'data-journal-form': '', novalidate: true },
  });
  form.dataset.journalVariant = config.variant;

  const grid = createElement('div', { classes: ['journal-meta-group'] });

  grid.append(buildFeelingField(config), buildNeedsField(config), buildTagsField(config));

  const notesId = `${config.idPrefix}-notes`;
  const notesTextarea = createElement('textarea', {
    classes: config.classes.notesInput || [],
    attrs: {
      id: notesId,
      name: 'notes',
      rows: config.notes?.rows || 5,
      placeholder: config.placeholders.notes || '',
    },
  });
  notesTextarea.setAttribute('data-journal-notes', '');
  const notesField = buildJournalField({
    config,
    label: config.labels.notes,
    id: notesId,
    input: notesTextarea,
    hint: config.hints.notes,
    fieldClasses: config.classes.notesField || config.classes.wideField || config.classes.field,
  });

  const prompts = buildPrompts(config);
  const { container: actionsContainer, statusEl, openLink } = buildActions(config);

  const layout = createElement('div', { classes: config.classes.layout || [] });
  const pages = createElement('div', { classes: config.classes.pages || [] });
  const primaryPage = createElement('section', { classes: config.classes.primaryPage || config.classes.page || [] });
  const sheet = createElement('div', { classes: config.classes.sheet || [] });
  sheet.append(notesField);
  primaryPage.append(sheet);
  pages.append(primaryPage);

  const sidebarInner = createElement('div', { classes: config.classes.sidebarInner || [] });
  if (grid.childElementCount > 0) {
    const fieldsSection = config.classes.sidebarSection?.length
      ? createElement('div', { classes: config.classes.sidebarSection })
      : null;
    if (fieldsSection) {
      fieldsSection.append(grid);
      sidebarInner.append(fieldsSection);
    } else {
      sidebarInner.append(grid);
    }
  }
  if (prompts) {
    sidebarInner.append(prompts);
  }
  if (actionsContainer) {
    sidebarInner.append(actionsContainer);
  }

  const noteClasses = Array.isArray(config.actions?.noteClasses)
    ? config.actions.noteClasses
    : [];
  sidebarInner.append(createLocalStorageNote(noteClasses));

  if (sidebarInner.childElementCount > 0) {
    const sidebar = createElement('aside', { classes: config.classes.sidebar || [] });
    sidebar.append(sidebarInner);
    pages.append(sidebar);
  }

  layout.append(pages);
  form.append(layout);

  if (statusEl && config.actions.statusPlacement === 'after') {
    form.append(statusEl);
  }

  container.append(form);

  if (config.footnote?.text) {
    container.append(
      createElement('p', {
        classes: config.footnote.classes || [],
        text: config.footnote.text,
      }),
    );
  }

  return { root: container, form, statusEl, openLink, config };
}

class JournalFormController {
  constructor(root, options = {}) {
    this.root = root instanceof HTMLElement ? root : document.querySelector(root);
    if (!this.root) {
      throw new Error('JournalFormController requires a valid root element');
    }
    this.options = {
      needs: [],
      feelings: [],
      draftPath: typeof window !== 'undefined' ? window.location.pathname : '',
      draftDelay: DRAFT_DELAY_MS,
      tagLimit: DEFAULT_TAG_LIMIT,
      autoDraft: true,
      intensityRange: { min: 0, max: 10 },
      ...options,
    };

    this.store = this.options.store || resolveStore();

    this.formEl = this.root.querySelector('[data-journal-form]');
    this.statusEl = this.root.querySelector('[data-journal-status]');
    this.messageEl = this.root.querySelector('[data-journal-message]');
    this.needsSelect = this.root.querySelector('[data-journal-needs]');
    this.emotionInput = this.root.querySelector('[data-journal-emotion]');
    this.intensityInput = this.root.querySelector('[data-journal-intensity]');
    this.intensityDisplay = this.root.querySelector('[data-journal-intensity-display]');
    this.tagsInput = this.root.querySelector('[data-journal-tags]');
    this.tagSuggestionsEl = this.root.querySelector('[data-journal-tag-suggestions]');
    this.notesInput = this.root.querySelector('[data-journal-notes]');
    this.clearButton = this.root.querySelector('[data-journal-clear]');
    this.saveButton = this.root.querySelector('[data-journal-submit]');
    this.feelingSelectRoot = this.root.querySelector('[data-journal-catalog-select="feeling"]');
    this.needsSelectRoot = this.root.querySelector('[data-journal-catalog-select="needs"]');
    this.notesBaseHeight = null;

    this.emotionOptions = [];
    this.feelingIntensities = new Map();
    this.needsOptions = [];

    this.draftPath = this.options.draftPath;
    this.draftTimer = null;
    this.tagSuggestions = [];
    this.tagActiveIndex = -1;
    this.defaultIntensity = normalizeNumber(
      this.intensityInput?.value,
      this.options.intensityRange.min,
      this.options.intensityRange.max,
    );
    if (this.defaultIntensity === undefined) {
      this.defaultIntensity = DEFAULT_INTENSITY;
    }

    this.defaultSaveLabel = this.saveButton?.textContent?.trim() || 'Save';
    if (this.saveButton) {
      this.saveButton.dataset.defaultLabel = this.defaultSaveLabel;
    }

    this.attachEvents();
    this.autoResizeNotes();
    this.setNeedsOptions(this.options.needs);
    this.setEmotionOptions(this.options.feelings);
    this.refreshTagSource();
    this.updateIntensityDisplay(
      normalizeNumber(this.intensityInput?.value, this.options.intensityRange.min, this.options.intensityRange.max) ??
        this.defaultIntensity,
    );
    if (this.options.autoDraft) {
      this.applyDraft();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'nvc-journal-store-ready',
        (event) => {
          if (event?.detail) {
            this.store = event.detail;
            this.refreshTagSource();
            if (this.options.autoDraft) {
              this.applyDraft();
            }
          }
        },
        { once: true },
      );
    }
  }

  get form() {
    return this.formEl;
  }

  attachEvents() {
    if (this.intensityInput) {
      this.intensityInput.addEventListener('input', (event) => {
        const value = normalizeNumber(
          event.target.value,
          this.options.intensityRange.min,
          this.options.intensityRange.max,
        );
        if (value !== undefined) this.updateIntensityDisplay(value);
        this.scheduleDraftSave();
      });
    }

    if (this.tagsInput) {
      this.tagsInput.setAttribute('role', 'combobox');
      this.tagsInput.setAttribute('aria-autocomplete', 'list');
      this.tagsInput.setAttribute('aria-expanded', 'false');
      this.tagsInput.addEventListener('input', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
        this.updateTagSuggestions();
      });
      this.tagsInput.addEventListener('focus', () => this.updateTagSuggestions());
      this.tagsInput.addEventListener('blur', () => this.hideTagSuggestions());
      this.tagsInput.addEventListener('keydown', (event) => this.handleTagKeydown(event));
    }

    if (this.tagSuggestionsEl) {
      this.tagSuggestionsEl.addEventListener('mousedown', (event) => event.preventDefault());
      this.tagSuggestionsEl.addEventListener('mousemove', (event) => this.handleTagSuggestionMouseOver(event));
      this.tagSuggestionsEl.addEventListener('click', (event) => this.handleTagSuggestionClick(event));
    }

    if (this.notesInput) {
      this.notesInput.addEventListener('input', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
        this.autoResizeNotes();
      });
    }

    if (this.emotionInput) {
      this.emotionInput.addEventListener('change', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
      });
    }
    if (this.needsSelect) {
      this.needsSelect.addEventListener('change', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
      });
    }

    this.attachCatalogSelectEvents();

    if (this.clearButton) {
      this.clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.resetForm();
      });
    }
  }

  attachCatalogSelectEvents() {
    ['feeling', 'needs'].forEach((kind) => {
      const root = this.getCatalogRoot(kind);
      if (!root) return;
      const trigger = root.querySelector('[data-journal-catalog-trigger]');
      const search = root.querySelector('[data-journal-catalog-search]');
      const options = root.querySelector('[data-journal-catalog-options]');
      const clear = root.querySelector('[data-journal-catalog-clear]');
      const done = root.querySelector('[data-journal-catalog-done]');

      trigger?.addEventListener('click', () => {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        if (expanded) this.closeCatalogSelect(kind);
        else this.openCatalogSelect(kind);
      });
      search?.addEventListener('input', () => this.renderCatalogOptions(kind));
      options?.addEventListener('click', (event) => {
        if (kind === 'feeling') return;
        const option = event.target.closest('[data-journal-catalog-option]');
        if (!option) return;
        this.toggleCatalogValue(kind, option.dataset.value || '');
      });
      options?.addEventListener('input', (event) => {
        if (kind !== 'feeling') return;
        const slider = event.target.closest('[data-journal-feeling-intensity]');
        if (!slider) return;
        const feeling = slider.dataset.value || '';
        const intensity = normalizeNumber(slider.value, 0, this.options.intensityRange.max) ?? 0;
        this.setFeelingIntensity(feeling, intensity, { render: false });
        const row = slider.closest('[data-journal-feeling-row]');
        const output = row?.querySelector('[data-journal-feeling-intensity-output]');
        if (output) output.textContent = String(intensity);
        row?.classList.toggle('is-selected', intensity > 0);
      });
      options?.addEventListener('change', (event) => {
        if (kind !== 'feeling') return;
        const slider = event.target.closest('[data-journal-feeling-intensity]');
        if (!slider) return;
        this.dispatchCatalogChange('feeling');
      });
      clear?.addEventListener('click', () => {
        this.setCatalogValues(kind, []);
        this.dispatchCatalogChange(kind);
        this.renderCatalogOptions(kind);
      });
      done?.addEventListener('click', () => {
        this.closeCatalogSelect(kind);
        trigger?.focus();
      });
      root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          this.closeCatalogSelect(kind);
          trigger?.focus();
        }
      });
    });

    this.catalogOutsidePointerHandler = (event) => {
      ['feeling', 'needs'].forEach((kind) => {
        const root = this.getCatalogRoot(kind);
        if (root && !root.contains(event.target)) this.closeCatalogSelect(kind);
      });
    };
    document.addEventListener('pointerdown', this.catalogOutsidePointerHandler);
  }

  getCatalogRoot(kind) {
    return kind === 'feeling' ? this.feelingSelectRoot : this.needsSelectRoot;
  }

  getCatalogInput(kind) {
    return kind === 'feeling' ? this.emotionInput : this.needsSelect;
  }

  getCatalogOptions(kind) {
    if (kind === 'feeling') return this.emotionOptions.map((label) => ({ label, value: label }));
    return this.needsOptions.map((option) => ({ label: option.label, value: option.label, slug: option.slug || '' }));
  }

  getCatalogPlaceholder(kind) {
    return kind === 'feeling' ? 'Choose feelings' : 'Choose needs';
  }

  getCatalogValues(kind) {
    if (kind === 'feeling') return this.getFeelingRatings().map((item) => item.feeling);
    const input = this.getCatalogInput(kind);
    return normalizeList(input?.value || '');
  }

  getFeelingRatings() {
    return Array.from(this.feelingIntensities.entries())
      .filter(([, intensity]) => Number.isFinite(intensity) && intensity > 0)
      .map(([feeling, intensity]) => ({ feeling, intensity }));
  }

  setFeelingIntensity(feeling, intensity, { render = true } = {}) {
    const normalized = this.normalizeCatalogValues('feeling', [feeling])[0] || '';
    if (!normalized) return;
    const value = normalizeNumber(intensity, 0, this.options.intensityRange.max) ?? 0;
    if (value > 0) this.feelingIntensities.set(normalized, value);
    else this.feelingIntensities.delete(normalized);
    if (this.emotionInput) this.emotionInput.value = joinListValues(this.getFeelingRatings().map((item) => item.feeling));
    this.updateCatalogSummary('feeling');
    if (render) {
      const popover = this.feelingSelectRoot?.querySelector('[data-journal-catalog-popover]');
      if (popover && !popover.hidden) this.renderCatalogOptions('feeling');
    }
  }

  setFeelingRatings(values = []) {
    const items = Array.isArray(values) ? values : [];
    const next = new Map();
    items.forEach((item) => {
      const rawFeeling = typeof item === 'string' ? item : item?.feeling ?? item?.emotion ?? item?.label ?? '';
      const feeling = this.normalizeCatalogValues('feeling', [rawFeeling])[0] || (!this.emotionOptions.length ? String(rawFeeling || '').trim() : '');
      const rawIntensity = typeof item === 'string' ? this.defaultIntensity : item?.intensity;
      const intensity = normalizeNumber(rawIntensity, 0, this.options.intensityRange.max) ?? this.defaultIntensity;
      if (feeling && intensity > 0) next.set(feeling, intensity);
    });
    this.feelingIntensities = next;
    if (this.emotionInput) this.emotionInput.value = joinListValues(this.getFeelingRatings().map((item) => item.feeling));
    this.updateCatalogSummary('feeling');
    const popover = this.feelingSelectRoot?.querySelector('[data-journal-catalog-popover]');
    if (popover && !popover.hidden) this.renderCatalogOptions('feeling');
  }

  normalizeCatalogValues(kind, values) {
    const incoming = normalizeList(values);
    const catalog = this.getCatalogOptions(kind);
    if (!catalog.length) {
      const seen = new Set();
      return incoming.filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const normalized = [];
    const seen = new Set();
    incoming.forEach((value) => {
      const key = value.toLowerCase();
      const match = catalog.find((option) => {
        if (option.label.toLowerCase() === key || option.value.toLowerCase() === key) return true;
        return option.slug && option.slug.toLowerCase() === key;
      });
      if (!match) return;
      const matchKey = match.label.toLowerCase();
      if (seen.has(matchKey)) return;
      seen.add(matchKey);
      normalized.push(match.label);
    });
    return normalized;
  }

  setCatalogValues(kind, values) {
    if (kind === 'feeling') {
      const normalized = this.normalizeCatalogValues(kind, values);
      this.setFeelingRatings(normalized.map((feeling) => ({
        feeling,
        intensity: this.feelingIntensities.get(feeling) || this.defaultIntensity,
      })));
      return;
    }
    const input = this.getCatalogInput(kind);
    if (!input) return;
    const normalized = this.normalizeCatalogValues(kind, values);
    input.value = joinListValues(normalized);
    this.updateCatalogSummary(kind);
    const root = this.getCatalogRoot(kind);
    const popover = root?.querySelector('[data-journal-catalog-popover]');
    if (popover && !popover.hidden) this.renderCatalogOptions(kind);
  }

  dispatchCatalogChange(kind) {
    const input = this.getCatalogInput(kind);
    input?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  updateCatalogSummary(kind) {
    const root = this.getCatalogRoot(kind);
    const valueEl = root?.querySelector('[data-journal-catalog-value]');
    if (!valueEl) return;
    const values = this.getCatalogValues(kind);
    if (!values.length) {
      valueEl.textContent = this.getCatalogPlaceholder(kind);
      valueEl.classList.add('is-placeholder');
      return;
    }
    valueEl.classList.remove('is-placeholder');
    if (kind === 'feeling') {
      const ratings = this.getFeelingRatings();
      const labels = ratings.map(({ feeling, intensity }) => `${feeling} ${intensity}`);
      valueEl.textContent = labels.length <= 2 ? labels.join(', ') : `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
      return;
    }
    valueEl.textContent = values.length <= 2 ? values.join(', ') : `${values[0]}, ${values[1]} +${values.length - 2}`;
  }

  openCatalogSelect(kind) {
    ['feeling', 'needs'].forEach((other) => { if (other !== kind) this.closeCatalogSelect(other); });
    const root = this.getCatalogRoot(kind);
    const trigger = root?.querySelector('[data-journal-catalog-trigger]');
    const popover = root?.querySelector('[data-journal-catalog-popover]');
    if (!root || !trigger || !popover) return;
    const search = root.querySelector('[data-journal-catalog-search]');
    if (search) search.value = '';
    this.renderCatalogOptions(kind);
    popover.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  }

  closeCatalogSelect(kind) {
    const root = this.getCatalogRoot(kind);
    const trigger = root?.querySelector('[data-journal-catalog-trigger]');
    const popover = root?.querySelector('[data-journal-catalog-popover]');
    if (popover) popover.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  renderCatalogOptions(kind) {
    const root = this.getCatalogRoot(kind);
    const list = root?.querySelector('[data-journal-catalog-options]');
    const search = root?.querySelector('[data-journal-catalog-search]');
    if (!list) return;
    const query = (search?.value || '').trim().toLowerCase();
    const selected = new Set(this.getCatalogValues(kind).map((value) => value.toLowerCase()));
    const options = this.getCatalogOptions(kind).filter((option) => !query || option.label.toLowerCase().includes(query));
    list.innerHTML = '';
    if (!options.length) {
      const empty = createElement('p', { classes: ['journal-catalog-popover__empty'], text: 'No matches' });
      list.append(empty);
      return;
    }
    if (kind === 'feeling') {
      const ratings = new Map(this.getFeelingRatings().map(({ feeling, intensity }) => [feeling.toLowerCase(), intensity]));
      options.forEach((option) => {
        const intensity = ratings.get(option.label.toLowerCase()) || 0;
        const row = createElement('div', {
          classes: ['journal-feeling-rating', ...(intensity > 0 ? ['is-selected'] : [])],
          attrs: { role: 'group', 'aria-label': option.label },
        });
        row.setAttribute('data-journal-feeling-row', '');
        const label = createElement('span', { classes: ['journal-feeling-rating__label'], text: option.label });
        const control = createElement('div', { classes: ['journal-feeling-rating__control'] });
        const slider = createElement('input', {
          classes: ['journal-feeling-rating__slider'],
          attrs: {
            type: 'range',
            min: 0,
            max: this.options.intensityRange.max,
            step: 1,
            value: intensity,
            'aria-label': `${option.label} intensity; 0 means not selected`,
          },
        });
        slider.setAttribute('data-journal-feeling-intensity', '');
        slider.dataset.value = option.label;
        const output = createElement('output', { classes: ['journal-feeling-rating__value'], text: String(intensity) });
        output.setAttribute('data-journal-feeling-intensity-output', '');
        control.append(slider, output);
        row.append(label, control);
        list.append(row);
      });
      return;
    }
    options.forEach((option) => {
      const isSelected = selected.has(option.label.toLowerCase());
      const button = createElement('button', {
        classes: ['journal-catalog-option', ...(isSelected ? ['is-selected'] : [])],
        attrs: { type: 'button', role: 'option', 'aria-selected': isSelected ? 'true' : 'false' },
      });
      button.setAttribute('data-journal-catalog-option', '');
      button.dataset.value = option.label;
      const label = createElement('span', { text: option.label });
      const check = createElement('span', { classes: ['journal-catalog-option__check'], attrs: { 'aria-hidden': 'true' }, text: isSelected ? '✓' : '' });
      button.append(label, check);
      list.append(button);
    });
  }

  toggleCatalogValue(kind, value) {
    if (!value) return;
    const values = this.getCatalogValues(kind);
    const key = value.toLowerCase();
    const index = values.findIndex((item) => item.toLowerCase() === key);
    if (index >= 0) values.splice(index, 1);
    else values.push(value);
    this.setCatalogValues(kind, values);
    this.dispatchCatalogChange(kind);
  }

  autoResizeNotes() {
    if (!this.notesInput) {
      return;
    }
    const textarea = this.notesInput;
    if (this.notesBaseHeight === null) {
      textarea.style.height = 'auto';
      this.notesBaseHeight = Math.max(textarea.scrollHeight, textarea.clientHeight);
    }
    textarea.style.height = 'auto';
    const minHeight = this.notesBaseHeight || Math.max(textarea.scrollHeight, textarea.clientHeight);
    const targetHeight = Math.max(textarea.scrollHeight, minHeight);
    textarea.style.height = `${targetHeight}px`;
  }

  refreshTagSource() {
    const storeInstance = this.store || resolveStore();
    if (!storeInstance) {
      this.tagSuggestions = [];
      return;
    }
    if (typeof storeInstance.allTagsRecent === 'function') {
      this.tagSuggestions = storeInstance.allTagsRecent(Math.max(this.options.tagLimit * 3, this.options.tagLimit));
    } else {
      this.tagSuggestions = [];
    }
  }

  updateIntensityDisplay(value) {
    if (!this.intensityDisplay) {
      return;
    }
    const clamped = clamp(value ?? this.defaultIntensity, this.options.intensityRange.min, this.options.intensityRange.max);
    this.intensityDisplay.textContent = `${clamped}/10`;
  }

  resolveNeedValue(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
      return '';
    }
    const options = Array.isArray(this.needsOptions) ? this.needsOptions : [];
    const normalized = raw.toLowerCase();
    const withoutPrefix = normalized.replace(/^need for\s+/, '');
    const labelMatch = options.find((option) =>
      option.label && option.label.toLowerCase().replace(/^need for\s+/, '') === withoutPrefix
    );
    if (labelMatch) {
      return labelMatch.label;
    }
    const slugMatch = options.find((option) => option.slug && option.slug.toLowerCase() === normalized);
    if (slugMatch) {
      return slugMatch.label;
    }
    return raw;
  }

  collectData() {
    const feelings = this.getFeelingRatings();
    const emotion = feelings.map((item) => item.feeling).join(', ');
    const intensityValue = feelings.length ? Math.max(...feelings.map((item) => item.intensity)) : undefined;
    let needs = [];
    if (this.needsSelect instanceof HTMLSelectElement) {
      needs = Array.from(this.needsSelect.selectedOptions || [])
        .map((option) => option.value)
        .filter(Boolean);
    } else if (this.needsSelect) {
      const list = normalizeList(this.needsSelect.value);
      needs = list.map((need) => this.resolveNeedValue(need)).filter(Boolean);
    }
    const tags = this.tagsInput ? normalizeTags(this.tagsInput.value) : [];
    const notes = this.notesInput?.value?.trim() || '';
    return { feelings, emotion, intensity: intensityValue, needs, tags, notes };
  }

  setValues(values = {}, { trailingTags = false } = {}) {
    const data = values && typeof values === 'object' ? values : {};
    const legacyFeelings = normalizeList(data.emotion);
    const legacyIntensity = normalizeNumber(data.intensity, 0, this.options.intensityRange.max) ?? this.defaultIntensity;
    const feelingRatings = Array.isArray(data.feelings) && data.feelings.length
      ? data.feelings
      : legacyFeelings.map((feeling) => ({ feeling, intensity: legacyIntensity }));
    this.setFeelingRatings(feelingRatings);
    if (this.notesInput) {
      this.notesInput.value = data.notes || '';
      this.autoResizeNotes();
    }
    this.setCatalogValues('needs', normalizeList(data.needs));
    if (this.tagsInput) {
      const tags = normalizeTags(data.tags);
      this.tagsInput.value = joinTags(tags, { trailing: trailingTags });
      this.updateTagSuggestions();
    }
  }

  resetForm({ keepStatus = false, focusNotes = true } = {}) {
    if (this.formEl) this.formEl.reset();
    if (this.intensityInput) this.intensityInput.value = String(this.defaultIntensity);
    this.updateIntensityDisplay(this.defaultIntensity);
    if (this.tagsInput) this.tagsInput.value = '';
    this.setCatalogValues('feeling', []);
    this.setCatalogValues('needs', []);
    this.closeCatalogSelect('feeling');
    this.closeCatalogSelect('needs');
    this.resetSaveButton();
    this.hideTagSuggestions();
    if (this.statusEl && !keepStatus) this.statusEl.textContent = '';
    this.showMessage('');
    if (this.options.autoDraft) this.clearDraft();
    if (this.notesInput) {
      this.autoResizeNotes();
      if (focusNotes) {
        this.notesInput.focus();
      } else {
        this.notesInput.blur();
      }
    }
  }

  setNeedsOptions(needs = []) {
    const normalizedList = Array.isArray(needs)
      ? needs
          .map((item) => normalizeNeedOption(item))
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
      : [];
    this.needsOptions = normalizedList;
    this.setCatalogValues('needs', this.getCatalogValues('needs'));
  }

  setEmotionOptions(feelings = []) {
    const options = Array.isArray(feelings)
      ? feelings
          .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
              const label = item.title || item.label || item.name || item.slug || '';
              return label ? label.toString().trim() : '';
            }
            return '';
          })
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      : [];
    const existingRatings = this.getFeelingRatings();
    this.emotionOptions = [...new Map(options.map((label) => [label.toLowerCase(), label])).values()];
    this.setFeelingRatings(existingRatings);
  }

  showStatus(message = '') {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.textContent = message;
  }

  showMessage(message = '', type = '') {
    if (!this.messageEl) {
      return;
    }
    this.messageEl.textContent = message;
    if (!message) {
      this.messageEl.hidden = true;
      MESSAGE_CLASSES.forEach((className) => this.messageEl.classList.remove(className));
      return;
    }
    this.messageEl.hidden = false;
    MESSAGE_CLASSES.forEach((className) => this.messageEl.classList.remove(className));
    if (type && MESSAGE_CLASSES.includes(`journal-message--${type}`)) {
      this.messageEl.classList.add(`journal-message--${type}`);
    } else if (type === 'success' || type === 'warning' || type === 'error') {
      this.messageEl.classList.add(`journal-message--${type}`);
    }
  }

  resetSaveButton() {
    if (!this.saveButton) {
      return;
    }
    const label = this.defaultSaveLabel || this.saveButton.dataset.defaultLabel || this.saveButton.textContent || 'Save';
    this.saveButton.textContent = label;
    this.saveButton.disabled = false;
    this.saveButton.removeAttribute('aria-disabled');
  }

  markSaving(label = 'Saving…') {
    if (!this.saveButton) {
      return;
    }
    this.saveButton.textContent = label;
    this.saveButton.disabled = true;
    this.saveButton.setAttribute('aria-disabled', 'true');
  }

  markSaved(label = 'Saved ✓', resetDelay = 2000) {
    if (!this.saveButton) {
      return;
    }
    this.saveButton.textContent = label;
    this.saveButton.disabled = true;
    this.saveButton.setAttribute('aria-disabled', 'true');
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.resetSaveButton();
    }, resetDelay);
  }

  scheduleDraftSave() {
    if (!this.options.autoDraft) {
      return;
    }
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
    }
    this.draftTimer = setTimeout(() => {
      this.persistDraft();
    }, this.options.draftDelay);
  }

  persistDraft() {
    if (!this.options.autoDraft || !this.draftPath) {
      return;
    }
    const storeInstance = this.store || resolveStore();
    if (!storeInstance) {
      return;
    }
    try {
      const data = this.collectData();
      const meaningful = data.emotion || data.notes || data.tags.length || data.needs.length;
      if (!meaningful) {
        clearDraft(this.draftPath);
        return;
      }
      saveDraft(this.draftPath, data);
    } catch (error) {
      console.warn('Journal module: unable to persist draft', error);
    }
  }

  applyDraft() {
    if (!this.options.autoDraft || !this.draftPath) {
      return;
    }
    try {
      const data = loadDraft(this.draftPath);
      if (data && typeof data === 'object') {
        this.setValues(data, { trailingTags: true });
      }
    } catch (error) {
      console.warn('Journal module: unable to apply draft', error);
    }
  }

  clearDraft() {
    if (!this.draftPath) {
      return;
    }
    try {
      clearDraft(this.draftPath);
    } catch (error) {
      console.warn('Journal module: unable to clear draft', error);
    }
  }

  focusNotes() {
    if (this.notesInput) {
      this.notesInput.focus();
    }
  }

  updateTagSuggestions() {
    if (!this.tagSuggestionsEl || !this.tagsInput) {
      return;
    }
    const fragment = getTagFragment(this.tagsInput.value || '');
    let suggestions = [];
    if (fragment) {
      suggestions = getTagSuggestions(fragment, { limit: this.options.tagLimit });
    } else {
      suggestions = (this.tagSuggestions || []).slice(0, this.options.tagLimit);
    }
    const unique = [];
    const seen = new Set();
    suggestions.forEach((tag) => {
      const normalized = typeof tag === 'string' ? tag.trim() : '';
      if (!normalized) {
        return;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      unique.push(normalized);
    });
    if (!unique.length) {
      this.hideTagSuggestions();
      return;
    }
    this.tagSuggestionsEl.innerHTML = '';
    unique.forEach((tag, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'journal-tag-suggestions__option';
      button.textContent = tag;
      button.dataset.journalTagSuggestion = tag;
      button.setAttribute('role', 'option');
      button.setAttribute('data-index', String(index));
      this.tagSuggestionsEl.append(button);
    });
    this.tagSuggestionsEl.hidden = false;
    this.tagsInput.setAttribute('aria-expanded', 'true');
    this.tagActiveIndex = -1;
  }

  hideTagSuggestions() {
    if (!this.tagSuggestionsEl || !this.tagsInput) {
      return;
    }
    this.tagSuggestionsEl.hidden = true;
    this.tagSuggestionsEl.innerHTML = '';
    this.tagsInput.setAttribute('aria-expanded', 'false');
    this.tagActiveIndex = -1;
  }

  handleTagSuggestionMouseOver(event) {
    const button = event.target.closest('[data-journal-tag-suggestion]');
    if (!button) {
      return;
    }
    const index = Number(button.dataset.index);
    if (Number.isFinite(index)) {
      this.tagActiveIndex = index;
      this.highlightActiveTag();
    }
  }

  highlightActiveTag() {
    if (!this.tagSuggestionsEl) {
      return;
    }
    const buttons = this.tagSuggestionsEl.querySelectorAll('[data-journal-tag-suggestion]');
    buttons.forEach((button, index) => {
      if (index === this.tagActiveIndex) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
  }

  handleTagSuggestionClick(event) {
    const button = event.target.closest('[data-journal-tag-suggestion]');
    if (!button) {
      return;
    }
    const value = button.dataset.journalTagSuggestion;
    if (value) {
      this.applyTagSuggestion(value);
    }
  }

  handleTagKeydown(event) {
    if (!this.tagSuggestionsEl || this.tagSuggestionsEl.hidden) {
      return;
    }
    const buttons = this.tagSuggestionsEl.querySelectorAll('[data-journal-tag-suggestion]');
    if (!buttons.length) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      this.tagActiveIndex = (this.tagActiveIndex + direction + buttons.length) % buttons.length;
      this.highlightActiveTag();
    } else if ((event.key === 'Enter' || event.key === 'Tab') && this.tagActiveIndex >= 0) {
      event.preventDefault();
      const button = buttons[this.tagActiveIndex];
      if (button) {
        this.applyTagSuggestion(button.dataset.journalTagSuggestion || '');
      }
    } else if (event.key === 'Escape') {
      this.hideTagSuggestions();
    }
  }

  applyTagSuggestion(value) {
    if (!this.tagsInput) {
      return;
    }
    const current = this.tagsInput.value || '';
    const segments = current.split(',');
    segments[segments.length - 1] = ` ${value}`;
    const normalized = segments.join(',').replace(/^\s+/, '');
    this.tagsInput.value = `${normalized.trim()}, `;
    this.hideTagSuggestions();
    this.tagsInput.focus();
    this.scheduleDraftSave();
  }

}

export function createJournalForm(root, options = {}) {
  return new JournalFormController(root, options);
}

export function loadNeedsFromScript(selector = '#journal-needs-data') {
  return parseJsonScript(selector) || [];
}

const catalogCache = new Map();

const resolveBasePath = (basePath) => {
  if (typeof basePath === 'string') {
    return basePath;
  }
  if (typeof document !== 'undefined') {
    return document.body?.dataset?.basePath || '';
  }
  return '';
};

const resolveCatalogUrl = (basePath) => {
  if (typeof window === 'undefined') {
    return `${basePath}data/index.json`;
  }
  try {
    return new URL(`${basePath || ''}data/index.json`, window.location.href).toString();
  } catch (error) {
    return `${basePath || ''}data/index.json`;
  }
};

export function loadCatalogData(options = {}) {
  const basePath = resolveBasePath(options.basePath);
  const url = resolveCatalogUrl(basePath);
  if (!catalogCache.has(url)) {
    if (typeof fetch !== 'function') {
      catalogCache.set(url, Promise.resolve(null));
    } else {
      const request = fetch(url, { headers: { Accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : null))
        .catch((error) => {
          console.warn('Journal module: unable to load catalog data', error);
          return null;
        });
      catalogCache.set(url, request);
    }
  }
  return catalogCache.get(url).then((data) => (data && typeof data === 'object' ? data : null));
}

export function loadFeelingsList(options = {}) {
  return loadCatalogData(options).then((data) => {
    if (!data || !Array.isArray(data.feelings)) {
      return [];
    }
    return data.feelings
      .map((item) => ({ title: item?.title || item?.name || '', slug: item?.slug || '' }))
      .filter((item) => item.title);
  });
}

export function loadNeedsList(options = {}) {
  const scriptNeeds = loadNeedsFromScript();
  if (Array.isArray(scriptNeeds) && scriptNeeds.length) {
    return Promise.resolve(scriptNeeds);
  }
  return loadCatalogData(options).then((data) => {
    if (!data || !Array.isArray(data.needs)) {
      return [];
    }
    return data.needs
      .map((item) => ({ slug: item?.slug || item?.value || '', title: item?.title || item?.label || '' }))
      .filter((item) => item.slug && item.title);
  });
}

const attachToGlobal = () => {
  if (typeof window === 'undefined') {
    return;
  }
  if (!window.NVCJournal) {
    window.NVCJournal = {};
  }
  window.NVCJournal.createForm = createJournalForm;
  window.NVCJournal.renderForm = renderJournalForm;
  window.NVCJournal.loadNeedsFromScript = loadNeedsFromScript;
  window.NVCJournal.loadCatalogData = loadCatalogData;
  window.NVCJournal.loadFeelingsList = loadFeelingsList;
  window.NVCJournal.loadNeedsList = loadNeedsList;
  window.NVCJournal.normalizeJournalTags = normalizeTags;
  window.NVCJournal.joinJournalTags = joinTags;
};

attachToGlobal();

export default {
  createForm: createJournalForm,
  renderForm: renderJournalForm,
  loadNeedsFromScript,
  loadCatalogData,
  loadFeelingsList,
  loadNeedsList,
  normalizeJournalTags: normalizeTags,
  joinJournalTags: joinTags,
};
