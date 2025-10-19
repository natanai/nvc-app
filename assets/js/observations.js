import { lintObservation, scaffoldRewrite } from '/lib/nvcLint.js';
import { loadCueRows, suggestFromObservation } from '/lib/observationSuggest.js';

const state = {
  whenWhere: '',
  whatSawHeard: '',
  gap: '',
  cues: [],
  catalog: createEmptyCatalog(),
};

function $(sel) {
  return document.querySelector(sel);
}

async function init() {
  const [catalog, cueRows] = await Promise.all([
    loadCatalog('/data/index.json'),
    loadCueRows('/data/observation_cues.csv').catch(e => {
      console.error('Failed to load cue map', e);
      return [];
    }),
  ]);

  state.catalog = catalog;
  state.cues = sanitizeCues(cueRows, catalog);

  bind();
  syncInputs();
  render();
}

function bind() {
  $('#obs-when')?.addEventListener('input', e => {
    state.whenWhere = e.target.value;
    render();
  });
  $('#obs-what')?.addEventListener('input', e => {
    state.whatSawHeard = e.target.value;
    render();
  });
  $('#obs-gap')?.addEventListener('input', e => {
    state.gap = e.target.value;
    render();
  });

  $('#rewrite-btn')?.addEventListener('click', () => {
    const when = prompt('When/where? (e.g., "Yesterday at 3:10 pm, in the meeting")', state.whenWhere);
    const what = prompt('What a camera recorded (quotes/actions)?', state.whatSawHeard);
    const gap = prompt('Optional: What you hoped for / didn’t see?', state.gap);
    const rewritten = scaffoldRewrite({ when, what, gap });
    if (rewritten) {
      state.whenWhere = when || '';
      state.whatSawHeard = what || '';
      state.gap = gap || '';
      syncInputs();
      render();
    }
  });
}

function syncInputs() {
  const whenEl = $('#obs-when');
  const whatEl = $('#obs-what');
  const gapEl = $('#obs-gap');
  if (whenEl && whenEl.value !== state.whenWhere) whenEl.value = state.whenWhere;
  if (whatEl && whatEl.value !== state.whatSawHeard) whatEl.value = state.whatSawHeard;
  if (gapEl && gapEl.value !== state.gap) gapEl.value = state.gap;
}

function buildPreview() {
  const parts = [];
  if (state.whenWhere.trim()) parts.push(state.whenWhere.trim());
  if (state.whatSawHeard.trim()) parts.push(state.whatSawHeard.trim());
  let s = parts.filter(Boolean).join(', ');
  if (s && !s.endsWith('.')) s += '.';
  if (state.gap.trim()) s += ' I had hoped ' + state.gap.trim() + '.';
  return s;
}

function render() {
  const preview = buildPreview();
  const previewEl = $('#free-obs-preview');
  if (previewEl) previewEl.textContent = preview || 'Your observation will preview here…';

  const lint = lintObservation([state.whenWhere, state.whatSawHeard, state.gap].join(' '));
  const lintBox = $('#free-lint-box');
  const lintMsg = $('#free-lint-msg');
  if (lintBox && lintMsg) {
    if (!lint.ok) {
      lintBox.classList.remove('hidden');
      lintMsg.textContent = `This reads like an evaluation (${lint.hits.join(', ')}). Want help rewriting as a camera-test observation?`;
    } else {
      lintBox.classList.add('hidden');
    }
  }

  const { feelings, needs, why } = suggestFromObservation(preview, state.cues);
  const feelingSlugs = feelings.filter(slug => state.catalog.feelings.has(slug));
  const needSlugs = needs.filter(slug => state.catalog.needs.has(slug));
  renderChips($('#free-suggest-feelings'), feelingSlugs, '/feelings/', state.catalog.feelings);
  renderChips($('#free-suggest-needs'), needSlugs, '/needs/', state.catalog.needs);
  const whyEl = $('#free-suggest-why');
  if (whyEl) {
    const cueList = [...new Set(why)];
    const reasonText = cueList.length
      ? cueList.map(slug => slug.replace(/-/g, ' ')).join(', ')
      : '';
    whyEl.textContent = reasonText
      ? `Cue matches: ${reasonText}`
      : 'No cues detected yet — add what was seen/heard.';
  }

  const situations = deriveSituations(feelingSlugs, needSlugs);
  renderChips($('#free-suggest-situations'), situations, '/situations/', state.catalog.situations);
  const situationsHint = $('#free-suggest-situations-hint');
  if (situationsHint) {
    situationsHint.textContent = situations.length
      ? 'Linked from the current feeling and need matches.'
      : 'Add more detail to surface related situations.';
  }

  const rewriteBtn = $('#rewrite-btn');
  if (rewriteBtn) rewriteBtn.disabled = false;
}

function renderChips(host, items, baseHref, labelMap) {
  if (!host) return;
  host.innerHTML = '';
  const list = items && items.length ? items : [];
  if (!list.length) {
    host.innerHTML = '<span class="chip chip--ghost">—</span>';
    return;
  }
  list.forEach(slug => {
    const a = document.createElement('a');
    a.className = 'chip';
    a.href = baseHref + encodeURIComponent(slug) + '/';
    const info = labelMap && typeof labelMap.get === 'function' ? labelMap.get(slug) : null;
    const label = info && info.title ? info.title : slug.replace(/-/g, ' ');
    a.textContent = label;
    a.setAttribute('data-slug', slug);
    host.appendChild(a);
  });
}

function setObservationExample(when, what, gap = '') {
  state.whenWhere = when || '';
  state.whatSawHeard = what || '';
  state.gap = gap || '';
  syncInputs();
  render();
  if (typeof window.activateObservationTab === 'function') {
    window.activateObservationTab('free');
  }
}

window.setObservationExample = setObservationExample;

function createEmptyCatalog() {
  return {
    feelings: new Map(),
    needs: new Map(),
    situations: new Map(),
  };
}

async function loadCatalog(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return buildCatalog(data);
  } catch (e) {
    console.error('Failed to load site index', e);
    return createEmptyCatalog();
  }
}

function buildCatalog(data) {
  const feelings = new Map();
  const needs = new Map();
  const situations = new Map();

  if (Array.isArray(data?.feelings)) {
    data.feelings.forEach(item => {
      if (item?.slug) {
        feelings.set(item.slug, {
          title: item.title || item.slug,
          slug: item.slug,
          situations: Array.isArray(item.situations) ? item.situations.map(s => s.slug).filter(Boolean) : [],
        });
      }
    });
  }

  if (Array.isArray(data?.needs)) {
    data.needs.forEach(item => {
      if (item?.slug) {
        needs.set(item.slug, {
          title: item.title || item.slug,
          slug: item.slug,
        });
      }
    });
  }

  if (Array.isArray(data?.situations)) {
    data.situations.forEach(item => {
      if (item?.slug) {
        situations.set(item.slug, {
          title: item.title || item.slug,
          slug: item.slug,
          feelings: Array.isArray(item.feelings) ? item.feelings.map(f => f.slug).filter(Boolean) : [],
          needs: Array.isArray(item.needs) ? item.needs.map(n => n.slug).filter(Boolean) : [],
        });
      }
    });
  }

  return { feelings, needs, situations };
}

function sanitizeCues(cues, catalog) {
  if (!Array.isArray(cues)) return [];
  return cues.map(row => ({
    ...row,
    feelings: Array.isArray(row.feelings) ? row.feelings.filter(slug => catalog.feelings.has(slug)) : [],
    needs: Array.isArray(row.needs) ? row.needs.filter(slug => catalog.needs.has(slug)) : [],
  }));
}

function deriveSituations(feelingSlugs, needSlugs) {
  if (!state.catalog) return [];
  const fSet = new Set(feelingSlugs || []);
  const nSet = new Set(needSlugs || []);
  if (!fSet.size && !nSet.size) return [];

  const matches = [];
  state.catalog.situations.forEach((value, slug) => {
    const hasFeeling = value.feelings?.some(f => fSet.has(f));
    const hasNeed = value.needs?.some(n => nSet.has(n));
    if (hasFeeling || hasNeed) {
      matches.push(slug);
    }
  });
  return matches.slice(0, 6);
}

document.addEventListener('DOMContentLoaded', init);
