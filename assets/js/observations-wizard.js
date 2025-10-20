import { slugify } from '/lib/slugify.js';

const FAMILY_PLACEHOLDER = 'Browse categories';
const PREVIEW_DEFAULT_GUIDED = 'Select a pattern below to start building your observation.';
let TAXO = { families: [] };
let SEARCH = '';
let FAUX_FEELINGS = [];
let familyMenuOpen = false;
const state = {
  familyId: null,
  patternId: null,
};

const previewState = {
  text: '',
  fallback: PREVIEW_DEFAULT_GUIDED,
  source: 'guided',
};

function $(selector) {
  return document.querySelector(selector);
}

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

function applyPreviewState() {
  const obs = $('#obs-example');
  if (!obs) return;
  const message = previewState.text?.trim()
    ? previewState.text
    : previewState.fallback || '';
  obs.textContent = message;
  if (previewState.source) {
    obs.dataset.previewSource = previewState.source;
  } else if (obs.dataset && 'previewSource' in obs.dataset) {
    delete obs.dataset.previewSource;
  }
}

function updateSharedPreview(options = {}) {
  if (typeof options.source === 'string') {
    previewState.source = options.source;
  }
  if (options.fallback !== undefined) {
    previewState.fallback = typeof options.fallback === 'string' ? options.fallback : '';
  }
  if (options.text !== undefined) {
    previewState.text = typeof options.text === 'string' ? options.text : '';
  }
  applyPreviewState();
}

window.setObservationPreview = updateSharedPreview;
window.getObservationPreviewSource = function getObservationPreviewSource() {
  return previewState.source;
};

async function init() {
  await Promise.all([loadTaxonomy(), loadFauxFeelings()]);
  ensureSelection();
  render();
}

async function loadTaxonomy() {
  try {
    const res = await fetch('/data/observation_taxonomy.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    TAXO = Array.isArray(data?.families) ? data : { families: [] };
  } catch (err) {
    console.error('Failed to load observation taxonomy', err);
    TAXO = { families: [] };
  }
}

async function loadFauxFeelings() {
  try {
    const res = await fetch('/data/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data?.fauxFeelings) ? data.fauxFeelings : [];
    FAUX_FEELINGS = list
      .filter(item => item && item.slug)
      .map(item => {
        const slug = String(item.slug);
        const title = String(item.title || slug);
        const aliases = Array.isArray(item.aliases) ? item.aliases : [];
        const searchTerms = new Set();
        searchTerms.add(title);
        searchTerms.add(slug);
        aliases.forEach(alias => {
          if (alias) searchTerms.add(String(alias));
        });
        const normalized = [...searchTerms]
          .map(term => term.toLowerCase())
          .filter(Boolean);
        return { slug, title, searchTerms: normalized };
      });
  } catch (err) {
    console.error('Failed to load faux feeling index', err);
    FAUX_FEELINGS = [];
  }
}

function matchesSearchPattern(pattern) {
  if (!SEARCH) return true;
  const label = String(pattern?.label || '').toLowerCase();
  const example = String(pattern?.example || '').toLowerCase();
  return label.includes(SEARCH) || example.includes(SEARCH);
}

function matchesSearchFamily(family) {
  if (!SEARCH) return true;
  const label = String(family?.label || '').toLowerCase();
  const id = String(family?.id || '').toLowerCase();
  const inPatterns = (family?.patterns || []).some(matchesSearchPattern);
  return label.includes(SEARCH) || id.includes(SEARCH) || inPatterns;
}

function getVisibleFamilies() {
  return Array.isArray(TAXO.families) ? TAXO.families.filter(matchesSearchFamily) : [];
}

function getVisiblePatterns(family) {
  if (!family) return [];
  return Array.isArray(family.patterns) ? family.patterns.filter(matchesSearchPattern) : [];
}

function ensureSelection() {
  const families = getVisibleFamilies();
  if (!families.length) {
    state.familyId = null;
    state.patternId = null;
    return;
  }
  let family = families.find(f => f.id === state.familyId && getVisiblePatterns(f).length);
  if (!family) {
    family = families.find(f => getVisiblePatterns(f).length) || families[0];
  }
  state.familyId = family?.id || null;
  const patterns = getVisiblePatterns(family);
  if (!patterns.length) {
    state.patternId = null;
    return;
  }
  if (state.patternId && patterns.some(p => p.id === state.patternId)) {
    return;
  }
  state.patternId = null;
}

function getFamily() {
  return (TAXO.families || []).find(f => f.id === state.familyId) || null;
}

function getPattern() {
  const fam = getFamily();
  if (!fam) return null;
  return (fam.patterns || []).find(p => p.id === state.patternId) || null;
}

function renderFamilies() {
  const host = $('#families');
  const emptyMsg = $('#family-empty');
  const toggle = $('#family-toggle');
  if (!host || !emptyMsg || !toggle) return;
  host.innerHTML = '';
  const families = getVisibleFamilies();
  if (!families.length) {
    const msg = SEARCH ? 'No matches. Try a different search.' : 'No categories available.';
    emptyMsg.textContent = msg;
    emptyMsg.hidden = false;
    toggle.disabled = true;
    setFamilyMenuOpen(false);
    return;
  }
  emptyMsg.hidden = true;
  emptyMsg.textContent = '';
  toggle.disabled = false;
  families.forEach(f => {
    const btn = h('button', 'observation-magnet observation-magnet--family', f.label);
    btn.type = 'button';
    btn.dataset.familyId = String(f.id || '');
    btn.setAttribute('role', 'option');
    const isActive = state.familyId === f.id;
    if (isActive) {
      btn.classList.add('observation-magnet--active');
    }
    btn.setAttribute('aria-selected', String(isActive));
    btn.addEventListener('click', event => {
      state.familyId = f.id;
      state.patternId = null;
      render();
      const keyboardActivated = event.detail === 0;
      closeFamilyMenu({ focusToggle: keyboardActivated });
    });
    host.appendChild(btn);
  });
  applyFamilyMenuState();
}

function applyFamilyMenuState() {
  const menu = $('#family-menu');
  const toggle = $('#family-toggle');
  const card = toggle?.closest('.card');
  if (menu) {
    menu.hidden = !familyMenuOpen;
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(familyMenuOpen));
  }
  if (card) {
    card.classList.toggle('observation-family-picker-card--open', familyMenuOpen);
  }
}

function setFamilyMenuOpen(open) {
  familyMenuOpen = Boolean(open);
  applyFamilyMenuState();
}

function openFamilyMenu(options = {}) {
  setFamilyMenuOpen(true);
  if (options.focus) {
    window.requestAnimationFrame(() => focusActiveFamilyOption());
  }
}

function closeFamilyMenu(options = {}) {
  if (!familyMenuOpen) return;
  familyMenuOpen = false;
  applyFamilyMenuState();
  if (options.focusToggle) {
    const toggle = $('#family-toggle');
    toggle?.focus();
  }
}

function focusActiveFamilyOption() {
  if (!familyMenuOpen) return;
  const host = $('#families');
  if (!host) return;
  const active = host.querySelector('.observation-magnet--active');
  const target = active || host.querySelector('.observation-magnet');
  if (target) {
    target.focus();
  }
}

function updateFamilyToggleLabel() {
  const labelEl = $('#family-toggle-label');
  if (!labelEl) return;
  const families = getVisibleFamilies();
  if (!families.length) {
    labelEl.textContent = 'No categories available';
    return;
  }
  const family = getFamily();
  labelEl.textContent = family ? family.label : FAMILY_PLACEHOLDER;
}

function findFauxFeelingMatches(query) {
  if (!query) return [];
  const normalized = query.toLowerCase();
  const matches = [];
  FAUX_FEELINGS.forEach(item => {
    const score = computeFauxFeelingScore(item, normalized);
    if (score > 0) {
      matches.push({ item, score });
    }
  });
  matches.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return matches.map(match => match.item);
}

function computeFauxFeelingScore(item, normalized) {
  if (!item || !Array.isArray(item.searchTerms)) return 0;
  let score = 0;
  item.searchTerms.forEach(term => {
    if (!term) return;
    if (term === normalized) {
      score = Math.max(score, 3);
    } else if (term.startsWith(normalized)) {
      score = Math.max(score, 2);
    } else if (term.includes(normalized)) {
      score = Math.max(score, 1);
    }
  });
  return score;
}

function renderSearchHint() {
  const host = $('#search-faux-feeling-hint');
  if (!host) return;
  const query = SEARCH.trim();
  if (!query) {
    host.hidden = true;
    host.textContent = '';
    return;
  }
  const matches = findFauxFeelingMatches(query);
  if (!matches.length) {
    host.hidden = true;
    host.textContent = '';
    return;
  }
  const best = matches[0];
  const label = best.title || best.slug.replace(/-/g, ' ');
  host.hidden = false;
  host.textContent = '';
  const prefix = document.createElement('span');
  prefix.textContent = 'Looks like ';
  const link = document.createElement('a');
  link.href = `../faux-feelings/${encodeURIComponent(best.slug)}/`;
  link.className = 'observation-search__faux-button';
  link.textContent = `“${label}”`;
  link.setAttribute('aria-label', `Open faux feeling “${label}”`);
  const suffix = document.createElement('span');
  suffix.textContent = ' is a faux feeling—feel free to jump straight there.';
  host.append(prefix, link, suffix);
}

function renderPatterns() {
  const host = $('#patterns');
  if (!host) return;
  host.innerHTML = '';
  const visibleFamilies = getVisibleFamilies();
  if (!visibleFamilies.length) {
    const msg = SEARCH ? 'No matches. Try a different search.' : 'No categories available.';
    host.appendChild(h('div', 'hint', msg));
    return;
  }
  const family = getFamily();
  if (!family) {
    host.appendChild(h('div', 'hint', 'Choose a category to continue.'));
    return;
  }
  const patterns = getVisiblePatterns(family);
  if (!patterns.length) {
    host.appendChild(h('div', 'hint', 'No pattern matches in this category.'));
    return;
  }
  patterns.forEach(p => {
    const btn = h('button', 'observation-magnet observation-magnet--pattern', p.label);
    btn.type = 'button';
    const isActive = state.patternId === p.id;
    if (isActive) {
      btn.classList.add('observation-magnet--active');
    }
    btn.setAttribute('aria-pressed', String(isActive));
    btn.addEventListener('click', () => {
      state.patternId = p.id;
      renderSuggestions();
      renderPatterns();
    });
    host.appendChild(btn);
  });
}

function renderSuggestions() {
  const pat = getPattern();
  const defaultMessage = PREVIEW_DEFAULT_GUIDED;

  if (!pat) {
    updateSharedPreview({
      source: 'guided',
      text: '',
      fallback: defaultMessage,
    });
    setSuggestionState('guided', {
      showPanel: false,
      feelings: [],
      needs: [],
      why: '',
      emptyMessage: DEFAULT_EMPTY_MESSAGES.guided,
      feelingsEmptyMessage: 'No feelings surfaced yet.',
      needsEmptyMessage: 'No needs surfaced yet.',
    });
    return;
  }

  updateSharedPreview({
    source: 'guided',
    text: pat.example || '',
    fallback: defaultMessage,
  });
  const feelings = (pat.feelings || [])
    .map(label => createSuggestionItem(label, '/feelings/'))
    .filter(Boolean);
  const needs = (pat.needs || [])
    .map(label => createSuggestionItem(label, '/needs/'))
    .filter(Boolean);
  const family = getFamily();
  const whyMessage = family
    ? `Why these: ${family.label} → ${pat.label}`
    : 'Pattern magnets highlight related feelings and needs.';

  setSuggestionState('guided', {
    showPanel: true,
    feelings,
    needs,
    why: whyMessage,
    feelingsEmptyMessage: 'No feelings surfaced yet.',
    needsEmptyMessage: 'No needs surfaced yet.',
  });
}

const DEFAULT_EMPTY_MESSAGES = {
  guided: 'Pick a pattern to surface feelings and needs magnets that might support your wording.',
  free: 'Add what was seen/heard to surface related feelings and needs.',
};

const SUGGESTION_TILTS = [-3, -2, -1, 0, 1, 2, 3];
const SUGGESTION_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

function getSuggestionTilt(index) {
  const tilt = SUGGESTION_TILTS[index % SUGGESTION_TILTS.length];
  return Number.isFinite(tilt) ? tilt : 0;
}

function getSuggestionOffset(index) {
  const offset = SUGGESTION_OFFSETS[index % SUGGESTION_OFFSETS.length];
  return Number.isFinite(offset) ? offset : 0;
}

const suggestionState = {
  guided: {
    showPanel: false,
    feelings: [],
    needs: [],
    feelingsEmptyMessage: 'No feelings surfaced yet.',
    needsEmptyMessage: 'No needs surfaced yet.',
    emptyMessage: DEFAULT_EMPTY_MESSAGES.guided,
    why: '',
  },
  free: {
    showPanel: false,
    feelings: [],
    needs: [],
    feelingsEmptyMessage: 'No feelings surfaced yet.',
    needsEmptyMessage: 'No needs surfaced yet.',
    emptyMessage: DEFAULT_EMPTY_MESSAGES.free,
    why: '',
  },
};

function getActiveTabId() {
  const activeButton = document.querySelector('.tab-button.tab-button--active');
  const id = activeButton?.dataset?.tabTarget;
  return id || 'guided';
}

function renderSuggestionList(host, items, emptyMessage) {
  if (!host) return;
  host.innerHTML = '';
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    if (emptyMessage) {
      const placeholder = document.createElement('p');
      placeholder.className = 'observation-panel__placeholder';
      placeholder.textContent = emptyMessage;
      host.appendChild(placeholder);
    }
    return;
  }
  list.forEach((item, index) => {
    if (!item || typeof item.label !== 'string') return;
    const link = document.createElement('a');
    link.className = 'pill observation-panel__magnet';
    if (item.href) {
      link.href = item.href;
    }
    link.textContent = item.label;
    if (item.slug) {
      link.dataset.slug = item.slug;
    }
    link.setAttribute('role', 'listitem');
    link.style.setProperty('--magnet-tilt', `${getSuggestionTilt(index)}deg`);
    link.style.setProperty('--magnet-offset', `${getSuggestionOffset(index)}px`);
    host.appendChild(link);
  });
}

function createSuggestionItem(label, baseHref) {
  if (!label) {
    return null;
  }
  const text = String(label).trim();
  if (!text) {
    return null;
  }
  const slug = slugify(text);
  const href = baseHref ? `${baseHref}${encodeURIComponent(slug)}/` : '';
  return { label: text, slug, href };
}

function applySuggestionPanel() {
  const activeId = getActiveTabId();
  const data = suggestionState[activeId] || suggestionState.guided;
  const panelEmpty = $('#observation-panel-empty');
  const panelContent = $('#observation-panel-content');
  const feelingsHost = $('#suggest-feelings');
  const needsHost = $('#suggest-needs');
  const whyEl = $('#why');
  if (!panelEmpty || !panelContent || !feelingsHost || !needsHost || !whyEl) {
    return;
  }

  if (data.showPanel) {
    panelContent.hidden = false;
    panelEmpty.hidden = true;
    renderSuggestionList(feelingsHost, data.feelings, data.feelingsEmptyMessage);
    renderSuggestionList(needsHost, data.needs, data.needsEmptyMessage);
  } else {
    panelContent.hidden = true;
    panelEmpty.hidden = false;
    panelEmpty.textContent = data.emptyMessage || DEFAULT_EMPTY_MESSAGES[activeId] || DEFAULT_EMPTY_MESSAGES.guided;
  }

  if (data.why) {
    whyEl.hidden = false;
    whyEl.textContent = data.why;
  } else {
    whyEl.hidden = true;
    whyEl.textContent = '';
  }
}

function setSuggestionState(source, payload = {}) {
  if (!suggestionState[source]) {
    return;
  }
  const next = {
    ...suggestionState[source],
    ...payload,
    feelings: Array.isArray(payload.feelings) ? payload.feelings : [],
    needs: Array.isArray(payload.needs) ? payload.needs : [],
    feelingsEmptyMessage:
      typeof payload.feelingsEmptyMessage === 'string'
        ? payload.feelingsEmptyMessage
        : suggestionState[source].feelingsEmptyMessage,
    needsEmptyMessage:
      typeof payload.needsEmptyMessage === 'string'
        ? payload.needsEmptyMessage
        : suggestionState[source].needsEmptyMessage,
    emptyMessage:
      typeof payload.emptyMessage === 'string'
        ? payload.emptyMessage
        : suggestionState[source].emptyMessage,
    why: typeof payload.why === 'string' ? payload.why : '',
    showPanel:
      typeof payload.showPanel === 'boolean' ? payload.showPanel : suggestionState[source].showPanel,
  };
  suggestionState[source] = next;
  if (getActiveTabId() === source) {
    applySuggestionPanel();
  }
}

window.setObservationSuggestions = function setObservationSuggestions(source, payload) {
  if (source !== 'guided' && source !== 'free') {
    return;
  }
  setSuggestionState(source, payload);
};

function render() {
  ensureSelection();
  renderFamilies();
  renderPatterns();
  renderSuggestions();
  updateFamilyToggleLabel();
  renderSearchHint();
  applyFamilyMenuState();
}

function activateTab(id) {
  const buttons = document.querySelectorAll('[data-tab-target]');
  const panels = document.querySelectorAll('.tab-panel');
  buttons.forEach(btn => {
    const isActive = btn.dataset.tabTarget === id;
    btn.classList.toggle('tab-button--active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  panels.forEach(panel => {
    const match = panel.id === `tab-${id}`;
    panel.classList.toggle('hidden', !match);
  });
  if (id === 'guided') {
    renderSuggestions();
  }
  applySuggestionPanel();
  document.dispatchEvent(
    new CustomEvent('observations:tab-change', {
      detail: { id },
    }),
  );
}

function setupFamilyMenuControls() {
  const toggle = $('#family-toggle');
  const menu = $('#family-menu');
  if (toggle) {
    toggle.addEventListener('click', () => {
      if (familyMenuOpen) {
        closeFamilyMenu();
      } else {
        openFamilyMenu({ focus: true });
      }
    });
    toggle.addEventListener('keydown', event => {
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !familyMenuOpen) {
        event.preventDefault();
        openFamilyMenu({ focus: true });
      }
    });
  }
  if (menu) {
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFamilyMenu({ focusToggle: true });
      }
    });
  }
  document.addEventListener('click', event => {
    if (!familyMenuOpen) return;
    const picker = $('#family-picker');
    if (picker && !picker.contains(event.target)) {
      closeFamilyMenu();
    }
  });
  document.addEventListener('focusin', event => {
    if (!familyMenuOpen) return;
    const picker = $('#family-picker');
    if (picker && !picker.contains(event.target)) {
      closeFamilyMenu();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && familyMenuOpen) {
      const picker = $('#family-picker');
      if (picker && picker.contains(event.target)) {
        event.preventDefault();
        closeFamilyMenu({ focusToggle: true });
      }
    }
  });
}

function setupTabs() {
  const buttons = document.querySelectorAll('[data-tab-target]');
  if (!buttons.length) return;
  buttons.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tabTarget));
  });
  activateTab('guided');
  window.activateObservationTab = activateTab;
}

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupFamilyMenuControls();
  init();
});

document.addEventListener('input', event => {
  if (event.target && event.target.id === 'search') {
    SEARCH = String(event.target.value || '').toLowerCase().trim();
    render();
    if (SEARCH && getVisibleFamilies().length) {
      openFamilyMenu();
    }
  }
});
