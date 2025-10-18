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

const getNeedFragment = (value) => {
  if (!value) {
    return '';
  }
  const segments = value.split(',');
  const fragment = segments[segments.length - 1] || '';
  return fragment.trim();
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
  needsMode: 'select',
  intensityRange: { min: 1, max: 10, defaultValue: DEFAULT_INTENSITY },
  notes: { rows: 12 },
  labels: {
    emotion: 'Emotion (optional)',
    intensity: 'Intensity',
    needs: 'Related needs',
    tags: 'Tags (optional)',
    notes: 'Reflection',
  },
  hints: {
    emotion: 'Use any word that fits. Unsure? Leave it blank for now.',
    intensity: 'Slide to note how strong the feeling is.',
    needs: 'Pick one or more needs that connect. Selected needs appear below so you can double-check them. Leave blank if you are not sure yet.',
    tags: 'Separate tags with commas so you can filter later.',
    notes: '',
  },
  placeholders: {
    emotion: '',
    needs: '',
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
    submitLabel: 'Save entry',
    clearLabel: 'Clear form',
    noteClasses: ['journal-actions__note'],
    statusAttributes: { 'aria-live': 'polite' },
    classes: {
      container: ['journal-form__actions', 'inventory-journal-form__actions'],
      status: ['journal-status'],
      submit: ['inventory-button'],
      clear: ['inventory-button', 'inventory-button--ghost'],
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
    needsMode: 'combobox',
    hints: {
      emotion: "Begin typing to autocomplete from the feelings library, or leave it blank if you're unsure.",
      needs: 'Begin typing to autocomplete needs from the library. Separate multiple needs with commas.',
      tags: 'Separate tags with commas to group related reflections.',
    },
    placeholders: {
      needs: 'Start typing a need',
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

const buildNeedsField = (config) => {
  const id = `${config.idPrefix}-needs`;
  if (config.needsMode === 'combobox') {
    const input = createElement('input', {
      attrs: {
        id,
        name: 'needs',
        type: 'text',
        autocomplete: 'off',
        placeholder: config.placeholders.needs || '',
      },
    });
    input.setAttribute('data-journal-needs', '');
    const field = buildJournalField({
      config,
      label: config.labels.needs,
      id,
      input,
      hint: config.hints.needs,
    });
    const suggestions = createElement('div', {
      classes: ['journal-tag-suggestions'],
      attrs: {
        'data-journal-need-suggestions': '',
        hidden: true,
        role: 'listbox',
        'aria-label': config.aria.needSuggestions,
      },
    });
    field.append(suggestions);
    return field;
  }

  const select = createElement('select', {
    attrs: {
      id,
      name: 'needs',
      multiple: true,
    },
  });
  select.setAttribute('data-journal-needs', '');
  const hintText = config.hints.needs;
  const field = buildJournalField({
    config,
    label: config.labels.needs,
    id,
    input: select,
    hint: null,
  });

  const summary = createElement('div', {
    classes: ['journal-needs-summary'],
    attrs: {
      'data-journal-needs-summary': '',
      'aria-live': 'polite',
    },
  });
  const summaryLabel = createElement('div', {
    classes: ['journal-needs-summary__label'],
    text: 'Selected needs',
  });
  summaryLabel.id = createUniqueId(`${config.idPrefix}-needs-summary-label`);
  const summaryStatus = createElement('span', {
    classes: ['visually-hidden'],
    attrs: { 'data-journal-needs-summary-status': '' },
  });
  const summaryEmpty = createElement('p', {
    classes: ['journal-needs-summary__empty'],
    attrs: { 'data-journal-needs-summary-empty': '' },
    text: 'No needs selected yet.',
  });
  const summaryList = createElement('ul', {
    classes: ['journal-needs-summary__list'],
    attrs: { 'data-journal-needs-summary-list': '', role: 'list' },
  });
  summary.append(summaryLabel, summaryStatus, summaryEmpty, summaryList);
  const describedBy = [select.getAttribute('aria-describedby'), summaryLabel.id]
    .filter(Boolean)
    .join(' ');
  if (describedBy) {
    select.setAttribute('aria-describedby', describedBy);
  }
  field.append(summary);
  if (hintText) {
    field.append(createElement('p', { classes: config.classes.hint, text: hintText }));
  }
  return field;
};

const buildTagsField = (config) => {
  const id = `${config.idPrefix}-tags`;
  const input = createElement('input', {
    attrs: {
      id,
      name: 'tags',
      type: 'text',
      autocomplete: 'off',
      placeholder: config.placeholders.tags || '',
    },
  });
  input.setAttribute('data-journal-tags', '');
  const field = buildJournalField({
    config,
    label: config.labels.tags,
    id,
    input,
    hint: config.hints.tags,
  });
  const suggestions = createElement('div', {
    classes: ['journal-tag-suggestions'],
    attrs: {
      'data-journal-tag-suggestions': '',
      hidden: true,
      role: 'listbox',
      'aria-label': config.aria.tagSuggestions,
    },
  });
  field.append(suggestions);
  return field;
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
      text: actions.submitLabel || 'Save entry',
    });
    submit.setAttribute('data-journal-submit', '');
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
  if (actions.clearLabel) {
    const clear = createElement('button', {
      classes: classes.clear || [],
      attrs: { type: 'button' },
      text: actions.clearLabel,
    });
    clear.setAttribute('data-journal-clear', '');
    container.append(clear);
  }
  const submit = createElement('button', {
    classes: classes.submit || [],
    attrs: { type: 'submit' },
    text: actions.submitLabel || 'Save entry',
  });
  submit.setAttribute('data-journal-submit', '');
  container.append(submit);
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

  const grid = createElement('div', { classes: config.classes.grid || [] });

  const emotionId = `${config.idPrefix}-emotion`;
  const emotionInput = createElement('input', {
    attrs: {
      id: emotionId,
      name: 'emotion',
      type: 'text',
      autocomplete: 'off',
      placeholder: config.placeholders.emotion || '',
    },
  });
  emotionInput.setAttribute('data-journal-emotion', '');
  grid.append(
    buildJournalField({
      config,
      label: config.labels.emotion,
      id: emotionId,
      input: emotionInput,
      hint: config.hints.emotion,
    }),
  );

  const intensityId = `${config.idPrefix}-intensity`;
  const intensityField = createElement('div', { classes: config.classes.intensityField || config.classes.field || [] });
  const intensityLabel = createElement('label', { attrs: { for: intensityId }, text: config.labels.intensity });
  const intensityWrapper = createElement('div', { classes: config.classes.intensityWrap || [] });
  const intensityInput = createElement('input', {
    attrs: {
      id: intensityId,
      name: 'intensity',
      type: 'range',
      min: config.intensityRange.min,
      max: config.intensityRange.max,
      value: config.intensityRange.defaultValue,
    },
  });
  intensityInput.setAttribute('data-journal-intensity', '');
  const intensityOutput = createElement('output', {
    classes: config.classes.intensityOutput || [],
    attrs: { for: intensityId },
    text: `${config.intensityRange.defaultValue}/${config.intensityRange.max}`,
  });
  intensityOutput.setAttribute('data-journal-intensity-display', '');
  intensityWrapper.append(intensityInput, intensityOutput);
  intensityField.append(intensityLabel, intensityWrapper);
  if (config.hints.intensity) {
    intensityField.append(createElement('p', { classes: config.classes.hint, text: config.hints.intensity }));
  }
  grid.append(intensityField);

  const needsField = buildNeedsField(config);
  grid.append(needsField);

  const tagsField = buildTagsField(config);
  grid.append(tagsField);

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
    this.needsSuggestionsEl = this.root.querySelector('[data-journal-need-suggestions]');
    this.needsSummaryEl = this.root.querySelector('[data-journal-needs-summary]');
    this.needsSummaryList = this.root.querySelector('[data-journal-needs-summary-list]');
    this.needsSummaryStatus = this.root.querySelector('[data-journal-needs-summary-status]');
    this.needsSummaryEmpty = this.root.querySelector('[data-journal-needs-summary-empty]');
    this.emotionInput = this.root.querySelector('[data-journal-emotion]');
    this.intensityInput = this.root.querySelector('[data-journal-intensity]');
    this.intensityDisplay = this.root.querySelector('[data-journal-intensity-display]');
    this.tagsInput = this.root.querySelector('[data-journal-tags]');
    this.tagSuggestionsEl = this.root.querySelector('[data-journal-tag-suggestions]');
    this.notesInput = this.root.querySelector('[data-journal-notes]');
    this.clearButton = this.root.querySelector('[data-journal-clear]');
    this.saveButton = this.root.querySelector('[data-journal-submit]');
    this.notesBaseHeight = null;

    this.emotionDatalist = null;
    this.emotionOptions = [];
    this.needsOptions = [];
    this.needsActiveIndex = -1;

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

    this.defaultSaveLabel = this.saveButton?.textContent?.trim() || 'Save entry';
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
        if (value !== undefined) {
          this.updateIntensityDisplay(value);
        }
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
      this.tagsInput.addEventListener('focus', () => {
        this.updateTagSuggestions();
      });
      this.tagsInput.addEventListener('blur', () => {
        this.hideTagSuggestions();
      });
      this.tagsInput.addEventListener('keydown', (event) => {
        this.handleTagKeydown(event);
      });
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
      this.emotionInput.addEventListener('input', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
      });
    }

    if (this.needsSelect instanceof HTMLSelectElement) {
      this.needsSelect.addEventListener('change', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
        this.updateNeedsSummary();
      });
      this.needsSelect.addEventListener('mousedown', (event) => this.handleNeedPointerToggle(event));
    } else if (this.needsSelect) {
      this.needsSelect.setAttribute('role', 'combobox');
      this.needsSelect.setAttribute('aria-autocomplete', 'list');
      this.needsSelect.setAttribute('aria-expanded', 'false');
      this.needsSelect.addEventListener('input', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
        this.updateNeedsSuggestions();
      });
      this.needsSelect.addEventListener('keydown', (event) => this.handleNeedKeydown(event));
      this.needsSelect.addEventListener('focus', () => {
        this.updateNeedsSuggestions();
      });
    }

    if (this.needsSuggestionsEl) {
      this.needsSuggestionsEl.addEventListener('mousedown', (event) => event.preventDefault());
      this.needsSuggestionsEl.addEventListener('mousemove', (event) => this.handleNeedSuggestionMouseOver(event));
      this.needsSuggestionsEl.addEventListener('click', (event) => this.handleNeedSuggestionClick(event));
    }

    if (this.clearButton) {
      this.clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.resetForm();
      });
    }
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

  updateNeedsSummary() {
    if (!this.needsSummaryEl || !this.needsSummaryList) {
      return;
    }
    if (!(this.needsSelect instanceof HTMLSelectElement)) {
      this.needsSummaryList.innerHTML = '';
      if (this.needsSummaryEmpty) {
        this.needsSummaryEmpty.hidden = true;
      }
      if (this.needsSummaryStatus) {
        this.needsSummaryStatus.textContent = '';
      }
      delete this.needsSummaryEl.dataset.count;
      return;
    }
    const selectedOptions = Array.from(this.needsSelect.selectedOptions || []).filter((option) => option.value);
    this.needsSummaryList.innerHTML = '';
    const labels = [];
    selectedOptions.forEach((option) => {
      const label = option.textContent?.trim() || option.value;
      if (!label) {
        return;
      }
      labels.push(label);
      const item = document.createElement('li');
      item.className = 'journal-needs-summary__item';
      item.textContent = label;
      this.needsSummaryList.append(item);
    });
    const hasSelection = labels.length > 0;
    if (this.needsSummaryEmpty) {
      this.needsSummaryEmpty.hidden = hasSelection;
    }
    this.needsSummaryEl.dataset.count = String(labels.length);
    if (this.needsSummaryStatus) {
      this.needsSummaryStatus.textContent = hasSelection
        ? `Selected needs: ${labels.join(', ')}.`
        : 'No needs selected.';
    }
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
    const emotion = this.emotionInput?.value?.trim() || '';
    const intensityValue = normalizeNumber(
      this.intensityInput?.value,
      this.options.intensityRange.min,
      this.options.intensityRange.max,
    );
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
    return { emotion, intensity: intensityValue, needs, tags, notes };
  }

  setValues(values = {}, { trailingTags = false } = {}) {
    const data = values && typeof values === 'object' ? values : {};
    if (this.emotionInput) {
      this.emotionInput.value = data.emotion || '';
    }
    if (this.notesInput) {
      this.notesInput.value = data.notes || '';
      this.autoResizeNotes();
    }
    if (this.intensityInput) {
      const intensityValue = normalizeNumber(
        data.intensity,
        this.options.intensityRange.min,
        this.options.intensityRange.max,
      );
      this.intensityInput.value = intensityValue !== undefined ? String(intensityValue) : String(this.defaultIntensity);
      this.updateIntensityDisplay(intensityValue ?? this.defaultIntensity);
    }
    if (this.needsSelect instanceof HTMLSelectElement) {
      const needs = normalizeList(data.needs);
      Array.from(this.needsSelect.options).forEach((option) => {
        option.selected = needs.includes(option.value);
      });
    } else if (this.needsSelect) {
      const needs = normalizeList(data.needs).map((need) => this.resolveNeedValue(need)).filter(Boolean);
      this.needsSelect.value = joinListValues(needs);
      this.updateNeedsSuggestions();
    }
    this.updateNeedsSummary();
    if (this.tagsInput) {
      const tags = normalizeTags(data.tags);
      this.tagsInput.value = joinTags(tags, { trailing: trailingTags });
      this.updateTagSuggestions();
    }
  }

  resetForm() {
    if (this.formEl) {
      this.formEl.reset();
    }
    if (this.intensityInput) {
      this.intensityInput.value = String(this.defaultIntensity);
    }
    this.updateIntensityDisplay(this.defaultIntensity);
    if (this.tagsInput) {
      this.tagsInput.value = '';
    }
    if (this.needsSelect instanceof HTMLSelectElement) {
      Array.from(this.needsSelect.options).forEach((option) => {
        option.selected = false;
      });
    } else if (this.needsSelect) {
      this.needsSelect.value = '';
    }
    this.updateNeedsSummary();
    this.hideNeedSuggestions();
    this.resetSaveButton();
    this.hideTagSuggestions();
    if (this.statusEl) {
      this.statusEl.textContent = '';
    }
    this.showMessage('');
    if (this.options.autoDraft) {
      this.clearDraft();
    }
    if (this.notesInput) {
      this.autoResizeNotes();
      this.notesInput.focus();
    }
  }

  setNeedsOptions(needs = []) {
    if (!this.needsSelect) {
      return;
    }
    const normalizedList = Array.isArray(needs)
      ? needs
          .map((item) => normalizeNeedOption(item))
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
      : [];
    this.needsOptions = normalizedList;
    if (this.needsSelect instanceof HTMLSelectElement) {
      const currentValues = new Set(Array.from(this.needsSelect.selectedOptions || []).map((option) => option.value));
      this.needsSelect.innerHTML = '';
      normalizedList.forEach((need) => {
        const option = document.createElement('option');
        option.value = need.value;
        option.textContent = need.label;
        if (currentValues.has(option.value)) {
          option.selected = true;
        }
        this.needsSelect.append(option);
      });
    } else {
      const trailing = /,\s*$/.test(this.needsSelect.value || '');
      const needsValues = normalizeList(this.needsSelect.value).map((need) => this.resolveNeedValue(need)).filter(Boolean);
      this.needsSelect.value = needsValues.length
        ? joinListValues(needsValues, { trailing })
        : '';
      this.updateNeedsSuggestions();
    }
    this.updateNeedsSummary();
  }

  setEmotionOptions(feelings = []) {
    if (!this.emotionInput) {
      return;
    }
    const options = Array.isArray(feelings)
      ? feelings
          .map((item) => {
            if (typeof item === 'string') {
              return item.trim();
            }
            if (item && typeof item === 'object') {
              const label = item.title || item.label || item.name || item.slug || '';
              return label ? label.toString().trim() : '';
            }
            return '';
          })
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      : [];
    this.emotionOptions = options;
    if (!options.length) {
      if (this.emotionDatalist) {
        this.emotionDatalist.remove();
        this.emotionDatalist = null;
      }
      this.emotionInput.removeAttribute('list');
      return;
    }
    if (!this.emotionDatalist) {
      this.emotionDatalist = document.createElement('datalist');
      this.emotionDatalist.id = createUniqueId('journal-emotion-options');
      document.body.appendChild(this.emotionDatalist);
      this.emotionInput.setAttribute('list', this.emotionDatalist.id);
      this.emotionInput.setAttribute('aria-autocomplete', 'list');
    }
    this.emotionDatalist.innerHTML = '';
    options.forEach((label) => {
      const option = document.createElement('option');
      option.value = label;
      this.emotionDatalist.append(option);
    });
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
    const label = this.defaultSaveLabel || this.saveButton.dataset.defaultLabel || this.saveButton.textContent || 'Save entry';
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

  updateNeedsSuggestions() {
    if (!this.needsSuggestionsEl || !this.needsSelect || this.needsSelect instanceof HTMLSelectElement) {
      return;
    }
    const fragment = getNeedFragment(this.needsSelect.value || '');
    const limit = Math.max(this.options.tagLimit, DEFAULT_TAG_LIMIT);
    const normalizedFragment = fragment.trim().toLowerCase();
    const matches = [];
    const seen = new Set();
    const source = Array.isArray(this.needsOptions) ? this.needsOptions : [];
    source.forEach((option) => {
      if (!option || !option.label) {
        return;
      }
      const labelKey = option.label.trim().toLowerCase();
      if (seen.has(labelKey)) {
        return;
      }
      const slugKey = option.slug ? option.slug.toLowerCase() : '';
      if (!normalizedFragment || labelKey.includes(normalizedFragment) || (slugKey && slugKey.includes(normalizedFragment))) {
        seen.add(labelKey);
        matches.push(option);
      }
    });
    const suggestions = matches.slice(0, limit);
    if (!suggestions.length) {
      this.hideNeedSuggestions();
      return;
    }
    this.needsSuggestionsEl.innerHTML = '';
    suggestions.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'journal-tag-suggestions__option';
      button.textContent = option.label;
      button.dataset.journalNeedSuggestion = option.label;
      if (option.slug) {
        button.dataset.needSlug = option.slug;
      }
      button.setAttribute('role', 'option');
      button.setAttribute('data-index', String(index));
      this.needsSuggestionsEl.append(button);
    });
    this.needsSuggestionsEl.hidden = false;
    this.needsSelect.setAttribute('aria-expanded', 'true');
    this.needsActiveIndex = -1;
  }

  hideNeedSuggestions() {
    if (!this.needsSuggestionsEl || !this.needsSelect) {
      return;
    }
    this.needsSuggestionsEl.hidden = true;
    this.needsSuggestionsEl.innerHTML = '';
    this.needsSelect.setAttribute('aria-expanded', 'false');
    this.needsActiveIndex = -1;
  }

  handleNeedSuggestionMouseOver(event) {
    if (!this.needsSuggestionsEl) {
      return;
    }
    const button = event.target.closest('[data-journal-need-suggestion]');
    if (!button) {
      return;
    }
    const index = Number(button.dataset.index);
    if (Number.isFinite(index)) {
      this.needsActiveIndex = index;
      this.highlightActiveNeed();
    }
  }

  highlightActiveNeed() {
    if (!this.needsSuggestionsEl) {
      return;
    }
    const buttons = this.needsSuggestionsEl.querySelectorAll('[data-journal-need-suggestion]');
    buttons.forEach((button, index) => {
      if (index === this.needsActiveIndex) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
  }

  handleNeedSuggestionClick(event) {
    const button = event.target.closest('[data-journal-need-suggestion]');
    if (!button) {
      return;
    }
    const label = button.dataset.journalNeedSuggestion || '';
    if (label) {
      const slug = button.dataset.needSlug || '';
      this.applyNeedSuggestion({ label, slug });
    }
  }

  handleNeedPointerToggle(event) {
    if (!(this.needsSelect instanceof HTMLSelectElement)) {
      return;
    }
    const option = event.target;
    if (!(option instanceof HTMLOptionElement)) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    option.selected = !option.selected;
    this.needsSelect.dispatchEvent(new Event('change', { bubbles: true }));
    requestAnimationFrame(() => {
      this.needsSelect?.focus();
    });
  }

  handleNeedKeydown(event) {
    if (!this.needsSuggestionsEl || this.needsSuggestionsEl.hidden) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.updateNeedsSuggestions();
      }
      return;
    }
    const buttons = this.needsSuggestionsEl.querySelectorAll('[data-journal-need-suggestion]');
    if (!buttons.length) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      this.needsActiveIndex = (this.needsActiveIndex + direction + buttons.length) % buttons.length;
      this.highlightActiveNeed();
    } else if ((event.key === 'Enter' || event.key === 'Tab') && this.needsActiveIndex >= 0) {
      event.preventDefault();
      const button = buttons[this.needsActiveIndex];
      if (button) {
        this.applyNeedSuggestion({
          label: button.dataset.journalNeedSuggestion || '',
          slug: button.dataset.needSlug || '',
        });
      }
    } else if (event.key === 'Escape') {
      this.hideNeedSuggestions();
    }
  }

  applyNeedSuggestion(option) {
    if (!this.needsSelect || this.needsSelect instanceof HTMLSelectElement) {
      return;
    }
    const label = typeof option === 'string' ? option : option?.label;
    if (!label) {
      return;
    }
    const current = this.needsSelect.value || '';
    const segments = current.split(',');
    segments[segments.length - 1] = ` ${label}`;
    const normalized = segments.join(',').replace(/^\s+/, '');
    this.needsSelect.value = `${normalized.trim()}, `;
    this.hideNeedSuggestions();
    this.needsSelect.focus();
    this.resetSaveButton();
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
