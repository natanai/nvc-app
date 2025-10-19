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
  const currentPattern = patterns.find(p => p.id === state.patternId) || patterns[0];
  state.patternId = currentPattern?.id || null;
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
    host.appendChild(h('div', 'hint', msg));
    return;
  }
  families.forEach(f => {
    const btn = h('button', 'chip', f.label);
    btn.type = 'button';
    if (state.familyId === f.id) {
      btn.classList.add('chip--active');
    }
    btn.setAttribute('aria-pressed', state.familyId === f.id ? 'true' : 'false');
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
    const btn = h('button', 'list-item', p.label);
    btn.type = 'button';
    if (state.patternId === p.id) {
      btn.classList.add('list-item--active');
    }
    btn.setAttribute('aria-pressed', state.patternId === p.id ? 'true' : 'false');
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

  if (!obs || !fHost || !nHost || !why) return;

  if (!pat) {
    obs.textContent = 'Your observation will preview here…';
    renderChipSet(fHost, []);
    renderChipSet(nHost, []);
    why.textContent = 'Pick a pattern to see suggestions.';
    return;
  }

  obs.textContent = pat.example || 'Your observation will preview here…';
  renderChipSet(fHost, pat.feelings || [], '/feelings/');
  renderChipSet(nHost, pat.needs || [], '/needs/');
  const family = getFamily();
  if (family) {
    why.textContent = `Why these: ${family.label} → ${pat.label}`;
  } else {
    why.textContent = 'Pick a pattern to see suggestions.';
  }
}

function renderChipSet(host, items, baseHref) {
  host.innerHTML = '';
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    const ghost = h('span', 'chip chip--ghost', '—');
    host.appendChild(ghost);
    return;
  }
  list.forEach(label => {
    const a = document.createElement('a');
    a.className = 'chip';
    const slug = slugify(label);
    if (baseHref) {
      a.href = `${baseHref}${encodeURIComponent(slug)}/`;
    }
    a.textContent = label;
    a.setAttribute('data-slug', slug);
    host.appendChild(a);
  });
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
