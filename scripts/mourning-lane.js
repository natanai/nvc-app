import store from '../assets/js/journal/store.js';

const FEELING_SLUGS = [
  'sad',
  'disappointment',
  'upset',
  'hurt',
  'lonely',
  'powerless',
  'helpless',
  'tired',
  'frustrated',
  'distressed',
  'bewildered',
];

const selectors = {
  observation: '[data-mourning-observation]',
  needOptions: '[data-mourning-need-options]',
  needSummary: '[data-mourning-need-summary]',
  needLabel: '[data-mourning-need-label]',
  needPlaceholder: '[data-mourning-need-placeholder]',
  needSearch: '[data-mourning-need-search]',
  feelingOptions: '[data-mourning-feeling-options]',
  feelingSummary: '[data-mourning-feeling-summary]',
  feelingLabel: '[data-mourning-feeling-label]',
  feelingSearch: '[data-mourning-feeling-search]',
  ack: '[data-mourning-ack]',
  ackQuote: '[data-mourning-acknowledgement]',
  status: '[data-mourning-status]',
  save: '[data-mourning-save]',
};

const state = {
  observation: '',
  need: null,
  feeling: null,
  needs: [],
  feelings: [],
  saving: false,
};

const normalizeLabel = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return value.title || value.label || '';
};

const normalizeSlug = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return value.slug || '';
};

const selectElements = () => {
  const entries = {};
  Object.entries(selectors).forEach(([key, selector]) => {
    entries[key] = document.querySelector(selector);
  });
  return entries;
};

const getBasePath = () => document.body?.dataset?.basePath || '';

const buildAckText = () => {
  const observation = state.observation || '[observation]';
  const feeling = normalizeLabel(state.feeling) || '[feeling]';
  const need = normalizeLabel(state.need) || '[need]';
  return `"I observed: ${observation}. I feel ${feeling} because my need for ${need} was not met."`;
};

const setStatus = (elements, message) => {
  if (!elements.status) {
    return;
  }
  elements.status.textContent = message || '';
};

const toggleSelectionStyles = (container, slug) => {
  if (!container) {
    return;
  }
  const buttons = Array.from(container.querySelectorAll('button[data-mourning-option]'));
  buttons.forEach((button) => {
    const isSelected = button.dataset.mourningSlug === slug;
    if (isSelected) {
      button.classList.add('is-selected');
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.classList.remove('is-selected');
      button.setAttribute('aria-pressed', 'false');
    }
  });
};

const updateNeedPlaceholder = (elements) => {
  if (elements.needPlaceholder) {
    elements.needPlaceholder.textContent = normalizeLabel(state.need) || '[Value]';
  }
};

const updateSummaries = (elements) => {
  if (elements.needSummary) {
    const hasNeed = Boolean(state.need);
    elements.needSummary.hidden = !hasNeed;
    if (hasNeed && elements.needLabel) {
      elements.needLabel.textContent = normalizeLabel(state.need);
    }
  }

  if (elements.feelingSummary) {
    const hasFeeling = Boolean(state.feeling);
    elements.feelingSummary.hidden = !hasFeeling;
    if (hasFeeling && elements.feelingLabel) {
      elements.feelingLabel.textContent = normalizeLabel(state.feeling);
    }
  }
};

const updateAck = (elements) => {
  const ready = Boolean(state.observation && state.need && state.feeling);
  if (elements.ack) {
    elements.ack.hidden = !ready;
  }
  if (elements.save) {
    elements.save.disabled = !ready || state.saving;
  }
  if (ready && elements.ackQuote) {
    elements.ackQuote.textContent = buildAckText();
  } else if (elements.ackQuote) {
    elements.ackQuote.textContent = '';
  }
};

const renderOptions = (options, container, type, searchTerm = '', elements) => {
  if (!container) {
    return;
  }
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = options.filter((item) => {
    if (!normalizedSearch) {
      return true;
    }
    const label = normalizeLabel(item).toLowerCase();
    const slug = normalizeSlug(item).toLowerCase();
    return label.includes(normalizedSearch) || slug.includes(normalizedSearch);
  });

  container.innerHTML = '';
  filtered
    .sort((a, b) => normalizeLabel(a).localeCompare(normalizeLabel(b)))
    .forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pill magnet mourning-chip';
      button.textContent = normalizeLabel(item);
      button.dataset.mourningOption = type;
      button.dataset.mourningSlug = normalizeSlug(item);
      button.addEventListener('click', () => {
        if (type === 'need') {
          state.need = item;
        } else {
          state.feeling = item;
        }
        toggleSelectionStyles(container, normalizeSlug(item));
        updateNeedPlaceholder(elements);
        updateSummaries(elements);
        updateAck(elements);
      });
      container.appendChild(button);
    });

  toggleSelectionStyles(container, normalizeSlug(type === 'need' ? state.need : state.feeling));
};

const setObservation = (elements, value) => {
  state.observation = value?.trim() || '';
  updateAck(elements);
};

const loadCatalog = async () => {
  const basePath = getBasePath();
  const dataUrl = new URL(`${basePath}data/index.json`, window.location.href);
  try {
    const res = await fetch(dataUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.warn('Mourning lane: unable to load catalog', error);
    return null;
  }
};

const resolveFeelings = (catalog) => {
  if (!catalog?.feelings) {
    return [];
  }
  const map = new Map(catalog.feelings.map((item) => [normalizeSlug(item), item]));
  const prioritized = FEELING_SLUGS.map((slug) => map.get(slug)).filter(Boolean);
  if (prioritized.length) {
    return prioritized;
  }
  return catalog.feelings;
};

const init = async () => {
  const elements = selectElements();
  if (!elements.observation) {
    return;
  }

  const catalog = await loadCatalog();
  if (!catalog) {
    setStatus(elements, 'Unable to load needs and feelings right now.');
    return;
  }

  state.needs = Array.isArray(catalog.needs) ? catalog.needs : [];
  state.feelings = resolveFeelings(catalog);

  renderOptions(state.needs, elements.needOptions, 'need', '', elements);
  renderOptions(state.feelings, elements.feelingOptions, 'feeling', '', elements);
  updateNeedPlaceholder(elements);
  updateAck(elements);

  elements.observation.addEventListener('input', (event) => {
    setObservation(elements, event.target.value);
  });

  elements.needSearch?.addEventListener('input', (event) => {
    renderOptions(state.needs, elements.needOptions, 'need', event.target.value, elements);
  });

  elements.feelingSearch?.addEventListener('input', (event) => {
    renderOptions(state.feelings, elements.feelingOptions, 'feeling', event.target.value, elements);
  });

  elements.save?.addEventListener('click', () => {
    if (!state.need || !state.feeling || !state.observation || state.saving) {
      return;
    }
    state.saving = true;
    updateAck(elements);

    const summary = buildAckText();
    const entry = {
      emotion: normalizeLabel(state.feeling),
      needs: [normalizeLabel(state.need)],
      notes: `${summary}\n\nObservation: ${state.observation}`,
      tags: ['mourning-lane'],
      source: 'lane',
    };

    try {
      store.create(entry);
      setStatus(elements, 'Saved. Redirecting to your journal...');
      const target = new URL(`${getBasePath()}inventory/journal/`, window.location.href);
      window.location.assign(target.toString());
    } catch (error) {
      console.warn('Mourning lane: unable to save entry', error);
      setStatus(elements, 'Unable to save right now. Your entry stays on this page.');
      state.saving = false;
      updateAck(elements);
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
