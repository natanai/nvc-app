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

  const lint = lintObservation([state.whenWhere, state.whatSawHeard, state.gap].join(' '), state.catalog);
  renderLintFeedback(lint, state.catalog);

  const { feelings, needs, why } = suggestFromObservation(preview, state.cues);
  const directFeelingSlugs = (lint.feelings || []).filter(slug => state.catalog.feelings.has(slug));
  const directNeedSlugs = (lint.needs || []).filter(slug => state.catalog.needs.has(slug));
  const directFauxFeelings = (lint.fauxFeelings || []).filter(slug => state.catalog.fauxFeelings.has(slug));
  const feelingSlugs = mergeUnique(directFeelingSlugs, feelings).filter(slug => state.catalog.feelings.has(slug));
  const needSlugs = mergeUnique(directNeedSlugs, needs).filter(slug => state.catalog.needs.has(slug));
  renderChips($('#free-suggest-feelings'), feelingSlugs.slice(0, 6), '/feelings/', state.catalog.feelings);
  renderChips($('#free-suggest-needs'), needSlugs.slice(0, 6), '/needs/', state.catalog.needs);
  const whyEl = $('#free-suggest-why');
  if (whyEl) {
    const cueList = [...new Set(why)];
    const reasons = [];
    if (cueList.length) {
      reasons.push(`Cue matches: ${cueList.map(slug => slug.replace(/-/g, ' ')).join(', ')}`);
    }
    const directReasons = [];
    if (directFeelingSlugs.length) directReasons.push(directFeelingSlugs.length === 1 ? 'a feeling word' : 'feeling words');
    if (directNeedSlugs.length) directReasons.push(directNeedSlugs.length === 1 ? 'a need word' : 'need words');
    if (directFauxFeelings.length) directReasons.push(directFauxFeelings.length === 1 ? 'a faux feeling' : 'faux feelings');
    if (directReasons.length) {
      reasons.push(`Direct matches from your wording (${directReasons.join(', ')})`);
    }
    whyEl.textContent = reasons.length
      ? reasons.join(' · ')
      : 'No cues detected yet — add what was seen/heard.';
  }

  const fauxFeelings = mergeUnique(directFauxFeelings, deriveFauxFeelings(feelingSlugs, needSlugs));
  renderChips(
    $('#free-suggest-faux-feelings'),
    fauxFeelings.slice(0, 6),
    '/faux-feelings/',
    state.catalog.fauxFeelings,
  );
  const fauxFeelingsHint = $('#free-suggest-faux-feelings-hint');
  if (fauxFeelingsHint) {
    if (directFauxFeelings.length) {
      fauxFeelingsHint.textContent = 'These surfaced directly from what you typed.';
    } else {
      fauxFeelingsHint.textContent = fauxFeelings.length
        ? 'Linked from the current feeling and need matches.'
        : 'Add more detail to surface related faux feelings.';
    }
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
    fauxFeelings: new Map(),
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
  const fauxFeelings = new Map();

  if (Array.isArray(data?.feelings)) {
    data.feelings.forEach(item => {
      if (item?.slug) {
        feelings.set(item.slug, {
          title: item.title || item.slug,
          slug: item.slug,
          fauxFeelings: Array.isArray(item.fauxFeelings) ? item.fauxFeelings.map(s => s.slug).filter(Boolean) : [],
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

  if (Array.isArray(data?.fauxFeelings)) {
    data.fauxFeelings.forEach(item => {
      if (item?.slug) {
        fauxFeelings.set(item.slug, {
          title: item.title || item.slug,
          slug: item.slug,
          feelings: Array.isArray(item.feelings) ? item.feelings.map(f => f.slug).filter(Boolean) : [],
          needs: Array.isArray(item.needs) ? item.needs.map(n => n.slug).filter(Boolean) : [],
        });
      }
    });
  }

  return { feelings, needs, fauxFeelings };
}

function sanitizeCues(cues, catalog) {
  if (!Array.isArray(cues)) return [];
  return cues.map(row => ({
    ...row,
    feelings: Array.isArray(row.feelings) ? row.feelings.filter(slug => catalog.feelings.has(slug)) : [],
    needs: Array.isArray(row.needs) ? row.needs.filter(slug => catalog.needs.has(slug)) : [],
  }));
}

function deriveFauxFeelings(feelingSlugs, needSlugs) {
  if (!state.catalog) return [];
  const fSet = new Set(feelingSlugs || []);
  const nSet = new Set(needSlugs || []);
  if (!fSet.size && !nSet.size) return [];

  const matches = [];
  state.catalog.fauxFeelings.forEach((value, slug) => {
    const hasFeeling = value.feelings?.some(f => fSet.has(f));
    const hasNeed = value.needs?.some(n => nSet.has(n));
    if (hasFeeling || hasNeed) {
      matches.push(slug);
    }
  });
  return matches.slice(0, 6);
}

function renderLintFeedback(lint, catalog) {
  const lintBox = $('#free-lint-box');
  const lintMsg = $('#free-lint-msg');
  const rewriteBtn = $('#rewrite-btn');
  if (!lintBox || !lintMsg || !rewriteBtn) {
    return;
  }

  const paragraphs = [];
  const evaluationTokens = uniqueStrings([
    ...(lint.evaluationMarkers || []),
    ...(lint.agentiveMarkers || []),
  ]);
  if (evaluationTokens.length) {
    const p = document.createElement('p');
    p.textContent = `This reads like an evaluation (${formatList(evaluationTokens)}). Want help rewriting as a camera-test observation?`;
    paragraphs.push(p);
  }

  if (lint.fauxFeelings && lint.fauxFeelings.length) {
    paragraphs.push(
      createCatalogParagraph({
        slugs: lint.fauxFeelings,
        catalogMap: catalog?.fauxFeelings,
        baseHref: '/faux-feelings/',
        singular: 'Noticed faux feeling',
        plural: 'Noticed faux feelings',
        cta: 'Jump straight to the faux feelings library?'
      }),
    );
  }

  if (lint.feelings && lint.feelings.length) {
    paragraphs.push(
      createCatalogParagraph({
        slugs: lint.feelings,
        catalogMap: catalog?.feelings,
        baseHref: '/feelings/',
        singular: 'Spotted feeling word',
        plural: 'Spotted feeling words',
        cta: 'Explore them on the feelings page.'
      }),
    );
  }

  if (lint.needs && lint.needs.length) {
    paragraphs.push(
      createCatalogParagraph({
        slugs: lint.needs,
        catalogMap: catalog?.needs,
        baseHref: '/needs/',
        singular: 'Spotted need word',
        plural: 'Spotted need words',
        cta: 'Would the needs inventory serve better right now?'
      }),
    );
  }

  if (!paragraphs.length) {
    lintBox.classList.add('hidden');
    lintMsg.replaceChildren();
    rewriteBtn.hidden = true;
    return;
  }

  lintBox.classList.remove('hidden');
  lintMsg.replaceChildren(...paragraphs);
  const showRewrite = evaluationTokens.length || (lint.feelings && lint.feelings.length) || (lint.needs && lint.needs.length);
  rewriteBtn.hidden = !showRewrite;
}

function createCatalogParagraph({ slugs, catalogMap, baseHref, singular, plural, cta }) {
  const p = document.createElement('p');
  const label = slugs.length === 1 ? singular : plural;
  p.appendChild(document.createTextNode(`${label}: `));
  const links = (slugs || []).map(slug => createCatalogLink(slug, baseHref, catalogMap));
  appendLinkList(p, links.filter(Boolean));
  if (cta) {
    p.appendChild(document.createTextNode(` ${cta}`));
  }
  return p;
}

function createCatalogLink(slug, baseHref, catalogMap) {
  if (!slug) return null;
  const a = document.createElement('a');
  a.href = baseHref + encodeURIComponent(slug) + '/';
  const info = catalogMap && typeof catalogMap.get === 'function' ? catalogMap.get(slug) : null;
  const label = info?.title || slug.replace(/-/g, ' ');
  a.textContent = label;
  return a;
}

function appendLinkList(parent, nodes) {
  const list = nodes.filter(Boolean);
  list.forEach((node, index) => {
    if (index > 0) {
      const connector = index === list.length - 1 ? ' and ' : ', ';
      parent.appendChild(document.createTextNode(connector));
    }
    parent.appendChild(node);
  });
}

function mergeUnique(primary = [], secondary = []) {
  const out = [];
  const seen = new Set();
  [primary, secondary].forEach(list => {
    (list || []).forEach(item => {
      if (!item || seen.has(item)) return;
      seen.add(item);
      out.push(item);
    });
  });
  return out;
}

function formatList(items) {
  if (!items || !items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function uniqueStrings(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  const seen = new Set();
  items.forEach(item => {
    if (!item) return;
    const key = String(item).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

document.addEventListener('DOMContentLoaded', init);
