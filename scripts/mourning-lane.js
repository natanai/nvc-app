import store from '../assets/js/journal/store.js';
import { loadCatalogData } from '../assets/js/journal/module.js';
import { lintObservation } from '../lib/nvcLint.js';

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
  observationHighlight: '[data-mourning-observation-highlight]',
  observationGuidance: '[data-mourning-observation-guidance]',
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
  catalog: null,
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

const isWordBoundary = (text, start, end) => {
  const before = start > 0 ? text[start - 1] : ' ';
  const after = end < text.length ? text[end] : ' ';
  return /[^\p{L}\p{N}]/u.test(before) && /[^\p{L}\p{N}]/u.test(after);
};

const buildHighlightRanges = (text, tokens, tone) => {
  if (!text || !Array.isArray(tokens) || !tokens.length) {
    return [];
  }
  const lower = text.toLowerCase();
  const ranges = [];
  tokens.forEach((token) => {
    const value = typeof token === 'string' ? token : token?.value;
    if (!value) {
      return;
    }
    const target = value.toLowerCase();
    let searchIndex = 0;
    while (searchIndex < lower.length) {
      const found = lower.indexOf(target, searchIndex);
      if (found === -1) break;
      const end = found + target.length;
      if (isWordBoundary(text, found, end)) {
        ranges.push({ start: found, end, tone });
      }
      searchIndex = end;
    }
  });
  return ranges;
};

const mergeRanges = (ranges) => {
  if (!Array.isArray(ranges) || !ranges.length) {
    return [];
  }
  const sorted = ranges
    .map((range) => ({ start: Number(range.start), end: Number(range.end), tone: range.tone }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));

  const merged = [];
  sorted.forEach((range) => {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      return;
    }
    last.end = Math.max(last.end, range.end);
    if (range.tone === 'warn') {
      last.tone = 'warn';
    }
  });
  return merged;
};

const buildHighlightMarkup = (text, ranges) => {
  if (!text) {
    return '';
  }
  if (!Array.isArray(ranges) || !ranges.length) {
    return text.replace(/\n/g, '<br />');
  }
  const breakpoints = new Set([0, text.length]);
  ranges.forEach((range) => {
    breakpoints.add(range.start);
    breakpoints.add(range.end);
  });
  const points = Array.from(breakpoints).sort((a, b) => a - b);
  let output = '';
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (start === end) continue;
    const tone = ranges.find((range) => start >= range.start && end <= range.end)?.tone;
    const segment = text.slice(start, end).replace(/\n/g, '<br />');
    output += tone
      ? `<mark data-tone="${tone}">${segment}</mark>`
      : segment;
  }
  return output || '&nbsp;';
};

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

const syncObservationHighlightScroll = (elements) => {
  if (!elements?.observation || !elements?.observationHighlight) {
    return;
  }
  elements.observationHighlight.scrollTop = elements.observation.scrollTop;
  elements.observationHighlight.scrollLeft = elements.observation.scrollLeft;
};

const renderObservationHighlight = (elements, catalog) => {
  if (!elements?.observationHighlight) {
    return;
  }
  const lint = lintObservation(state.observation, catalog);
  const warnRanges = buildHighlightRanges(state.observation, lint?.hits || [], 'warn');
  const okRanges = buildHighlightRanges(
    state.observation,
    (lint?.observationHighlights || []).map((item) => item.token),
    'ok',
  );
  const markup = buildHighlightMarkup(state.observation, mergeRanges([...okRanges, ...warnRanges]));
  elements.observationHighlight.innerHTML = markup;

  if (elements.observationGuidance) {
    if (!state.observation) {
      elements.observationGuidance.hidden = true;
      elements.observationGuidance.textContent = '';
    } else {
      elements.observationGuidance.hidden = false;
      elements.observationGuidance.textContent = lint?.ok
        ? 'Looks observational.'
        : 'Edit highlighted phrases to keep this observational.';
    }
  }

  syncObservationHighlightScroll(elements);
};

const searchCatalog = (items, term) => {
  if (!Array.isArray(items)) {
    return [];
  }
  const normalized = typeof term === 'string' ? term.trim().toLowerCase() : '';
  if (!normalized) {
    return items;
  }

  const exactMatches = items.filter((item) => {
    const label = normalizeLabel(item).toLowerCase();
    const slug = normalizeSlug(item).toLowerCase();
    return label === normalized || slug === normalized;
  });
  if (exactMatches.length) {
    return exactMatches.sort((a, b) => normalizeLabel(a).localeCompare(normalizeLabel(b)));
  }

  const nearby = items
    .map((item) => {
      const label = normalizeLabel(item).toLowerCase();
      const slug = normalizeSlug(item).toLowerCase();
      const index = label.indexOf(normalized);
      const slugIndex = slug.indexOf(normalized);
      const distance = index !== -1 ? index : slugIndex !== -1 ? slugIndex + 1 : Number.MAX_SAFE_INTEGER;
      return { item, distance };
    })
    .filter((entry) => entry.distance !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => (a.distance === b.distance
      ? normalizeLabel(a.item).localeCompare(normalizeLabel(b.item))
      : a.distance - b.distance))
    .slice(0, 4)
    .map((entry) => entry.item);

  return nearby.length ? nearby : [];
};

const renderOptions = (options, container, type, searchTerm = '', elements) => {
  if (!container) {
    return;
  }
  const filtered = searchCatalog(options, searchTerm);

  container.innerHTML = '';
  filtered
    .sort((a, b) => normalizeLabel(a).localeCompare(normalizeLabel(b)))
    .forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip mourning-chip';
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
  renderObservationHighlight(elements, state.catalog);
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

  const catalog = await loadCatalogData({ basePath: getBasePath() });
  if (!catalog) {
    setStatus(elements, 'Unable to load needs and feelings right now.');
    return;
  }

  state.catalog = catalog;
  state.needs = Array.isArray(catalog.needs) ? catalog.needs : [];
  state.feelings = resolveFeelings(catalog);

  renderOptions(state.needs, elements.needOptions, 'need', '', elements);
  renderOptions(state.feelings, elements.feelingOptions, 'feeling', '', elements);
  updateNeedPlaceholder(elements);
  renderObservationHighlight(elements, catalog);
  updateAck(elements);

  elements.observation.addEventListener('input', (event) => {
    setObservation(elements, event.target.value);
  });

  elements.observation.addEventListener('scroll', () => {
    syncObservationHighlightScroll(elements);
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
