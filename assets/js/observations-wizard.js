import { slugify } from '/lib/slugify.js';

let TAXO = { families: [] };
let SEARCH = '';
const state = {
  familyId: null,
  patternId: null,
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

async function init() {
  await loadTaxonomy();
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
  if (!host) return;
  host.innerHTML = '';
  const families = getVisibleFamilies();
  if (!families.length) {
    const msg = SEARCH ? 'No matches. Try a different search.' : 'No categories available.';
    host.appendChild(h('p', 'hint', msg));
    return;
  }
  families.forEach(f => {
    const btn = h('button', 'observation-magnet observation-magnet--family', f.label);
    btn.type = 'button';
    const isActive = state.familyId === f.id;
    if (isActive) {
      btn.classList.add('observation-magnet--active');
    }
    btn.setAttribute('aria-pressed', String(isActive));
    btn.addEventListener('click', () => {
      state.familyId = f.id;
      state.patternId = null;
      render();
    });
    host.appendChild(btn);
  });
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
  const obs = $('#obs-example');
  const fHost = $('#suggest-feelings');
  const nHost = $('#suggest-needs');
  const why = $('#why');
  const panelEmpty = $('#observation-panel-empty');
  const panelContent = $('#observation-panel-content');

  if (!obs || !fHost || !nHost || !why || !panelEmpty || !panelContent) return;

  const defaultMessage = 'Select a pattern below to start building your observation.';

  if (!pat) {
    obs.textContent = defaultMessage;
    fHost.innerHTML = '';
    nHost.innerHTML = '';
    panelContent.hidden = true;
    panelEmpty.hidden = false;
    why.textContent = '';
    why.hidden = true;
    return;
  }

  panelEmpty.hidden = true;
  panelContent.hidden = false;

  obs.textContent = pat.example || defaultMessage;
  renderChipSet(fHost, pat.feelings || [], '/feelings/', 'No feelings surfaced yet.');
  renderChipSet(nHost, pat.needs || [], '/needs/', 'No needs surfaced yet.');
  const family = getFamily();
  why.hidden = false;
  if (family) {
    why.textContent = `Why these: ${family.label} → ${pat.label}`;
  } else {
    why.textContent = 'Pattern magnets highlight related feelings and needs.';
  }
}

function renderChipSet(host, items, baseHref, emptyLabel) {
  host.innerHTML = '';
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    if (emptyLabel) {
      host.appendChild(h('p', 'observation-panel__placeholder', emptyLabel));
    }
    return false;
  }
  list.forEach(label => {
    const el = baseHref ? document.createElement('a') : document.createElement('span');
    el.className = 'observation-magnet observation-magnet--suggestion';
    const slug = slugify(label);
    if (baseHref) {
      el.href = `${baseHref}${encodeURIComponent(slug)}/`;
    }
    el.textContent = label;
    el.setAttribute('data-slug', slug);
    host.appendChild(el);
  });
  return true;
}

function render() {
  ensureSelection();
  renderFamilies();
  renderPatterns();
  renderSuggestions();
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
  init();
});

document.addEventListener('input', event => {
  if (event.target && event.target.id === 'search') {
    SEARCH = String(event.target.value || '').toLowerCase().trim();
    render();
  }
});
