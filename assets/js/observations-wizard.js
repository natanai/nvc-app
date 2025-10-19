import { slugify } from '/lib/slugify.js';

let TAXO = { families: [] };
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

function ensureSelection() {
  const families = TAXO.families || [];
  if (!families.length) {
    state.familyId = null;
    state.patternId = null;
    return;
  }
  const currentFamily = families.find(f => f.id === state.familyId) || families[0];
  state.familyId = currentFamily?.id || null;
  const patterns = currentFamily?.patterns || [];
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
  if (!Array.isArray(TAXO.families) || !TAXO.families.length) {
    host.appendChild(h('div', 'hint', 'No categories available.'));
    return;
  }
  TAXO.families.forEach(f => {
    const btn = h('button', 'chip', f.label);
    btn.type = 'button';
    if (state.familyId === f.id) {
      btn.classList.add('chip--active');
    }
    btn.addEventListener('click', () => {
      state.familyId = f.id;
      state.patternId = null;
      ensureSelection();
      render();
    });
    host.appendChild(btn);
  });
}

function renderPatterns() {
  const host = $('#patterns');
  if (!host) return;
  host.innerHTML = '';
  const family = getFamily();
  if (!family) {
    host.appendChild(h('div', 'hint', 'Choose a category to continue.'));
    return;
  }
  if (!Array.isArray(family.patterns) || !family.patterns.length) {
    host.appendChild(h('div', 'hint', 'No patterns available for this category.'));
    return;
  }
  family.patterns.forEach(p => {
    const btn = h('button', 'list-item', p.label);
    btn.type = 'button';
    if (state.patternId === p.id) {
      btn.classList.add('list-item--active');
    }
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
