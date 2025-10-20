import { lintObservation, scaffoldRewrite } from '/lib/nvcLint.js';
import { loadCueRows, suggestFromObservation } from '/lib/observationSuggest.js';
import { sanitizeObservationText } from '/lib/observationSanitize.js';

const FREE_PREVIEW_FALLBACK = 'Your observation will preview here…';
const FLAG_ADVICE_DEFAULT = 'Try swapping in a time/place anchor, a quote, a count or measure, or a link to an artifact.';

const OBSERVATION_CELEBRATION_WORDS = [
  { token: 'said', reason: 'Direct speech verbs keep the focus on what was heard.' },
  { token: 'asked', reason: 'Questions are observable actions — nice work capturing them.' },
  { token: 'wrote', reason: 'Documenting what was written keeps things observational.' },
  { token: 'emailed', reason: 'Referencing the email itself keeps the focus on the artifact.' },
  { token: 'texted', reason: 'Specific communication channels are observable — great detail.' },
  { token: 'messaged', reason: 'Mentioning the message itself keeps it in observation territory.' },
  { token: 'posted', reason: 'Pointing to the post is a concrete, observable detail.' },
  { token: 'showed', reason: 'Sharing what was shown is observational — thanks for the clarity.' },
  { token: 'displayed', reason: 'Calling out what was displayed keeps to observable facts.' },
  { token: 'handed', reason: 'Physical actions like this help paint an observational picture.' },
  { token: 'walked', reason: 'Movement descriptions tend to be purely observational — well done.' },
  { token: 'arrived', reason: 'Arrival times and actions stick to what happened — nice specificity.' },
  { token: 'left', reason: 'Noting who left is a simple, observational fact.' },
  { token: 'opened', reason: '“Opened” is a concrete action that cameras capture — great choice.' },
  { token: 'closed', reason: 'Noting something closing is observational — thanks for that clarity.' },
  { token: 'recorded', reason: 'Referencing a recording keeps it grounded in evidence.' },
  { token: 'counted', reason: 'Counting is measurable and observational — awesome detail.' },
  { token: 'measured', reason: 'Measurements keep things objective — great use of the word.' },
  { token: 'noted', reason: 'Calling out what was noted keeps the focus on observable artifacts.' },
];

const OBSERVATION_DEFAULT_HINT = 'Tap highlights for coaching. Aim for: when/where + what a camera or mic captured + optional expectation gap.';
const OBSERVATION_EMPTY_HINT = 'Observation recipe: start with when/where, describe what was seen or heard, then add what you hoped for if relevant.';
const OBSERVATION_RECIPE_STEPS = [
  'Start with when and where the moment happened.',
  'Describe exactly what a camera or microphone would capture (quotes, actions, artifacts, counts).',
  'Optionally add what you hoped for or didn’t see to mark the expectation gap.',
];

const FLAG_SUPPLEMENTAL_TIPS = {
  traitLabels: 'Name the observable behavior or quote instead of the character label.',
  comparisonStories: 'Anchor in one concrete moment — when, where, and what happened.',
  moralizingLanguage: 'Swap the “should/shouldn’t” for the specific action you witnessed.',
  mindReadingClaims: 'Stick with what you saw or heard rather than guessing motives.',
  globalLanguage: 'Point to the single instance you observed, not the whole pattern.',
  vagueQuantifiers: 'Replace vague amounts with counts, durations, or direct quotes.',
  fauxFeelingStoryWords: 'Translate the story word into the action that led you to feel that way.',
  idiomEvaluations: 'Describe the literal behavior instead of the idiom.',
  pathologizingLabels: 'Describe the behavior you saw instead of using the diagnostic label.',
  speculationLanguage: 'Share what was directly observable, not what might be true.',
  predictionLanguage: 'Focus on what already happened; future worries belong in requests.',
  thinkingLanguage: 'Keep the observation to what happened; thoughts fit better in reflection.',
  blameLanguage: 'Name the concrete action without assigning fault or intent.',
  absenceLanguage: 'Describe what you did see or hear that suggested a gap.',
  thoughtsAsFeelings: 'Separate the observation from the interpretation — capture the quote or action.',
};

const CUE_TOKEN_SPLIT_REGEX = (() => {
  try {
    return new RegExp('[^\\p{L}\\p{N}]+', 'u');
  } catch (error) {
    return /[^a-z0-9]+/i;
  }
})();

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
    loadCueRows('/data/observation_cues.sanitized.csv').catch(e => {
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

  document.addEventListener('observations:tab-change', event => {
    if (event?.detail?.id === 'free') {
      render();
    }
  });

  const annotationHost = $('#obs-what-annotated');
  if (annotationHost) {
    annotationHost.addEventListener('click', handleAnnotationActivation);
    annotationHost.addEventListener('keydown', handleAnnotationKeydown);
  }

  $('#obs-cue-suggestions')?.addEventListener('click', handleCueSuggestionClick);
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
  const lint = lintObservation([state.whenWhere, state.whatSawHeard, state.gap].join(' '), state.catalog);
  const sanitizedPreview = sanitizeObservationText(preview, state.catalog);
  updateSharedPreview(sanitizedPreview);
  renderLintFeedback(lint, state.catalog);
  renderObservationAnnotations(state.whatSawHeard, lint);

  const sanitizedTrimmed = sanitizedPreview.trim();
  const cueSearchText = selectCueSearchText(sanitizedPreview);
  const suggestionPayload = suggestFromObservation(cueSearchText, state.cues) || { feelings: [], needs: [], why: [], hits: [] };
  renderCueAutocomplete(state.whatSawHeard, state.cues, suggestionPayload.hits || []);
  const canSuggest = sanitizedTrimmed.length > 0 && lint.ok;
  const directFeelingSlugs = (lint.feelings || []).filter(slug => state.catalog.feelings.has(slug));
  const directNeedSlugs = (lint.needs || []).filter(slug => state.catalog.needs.has(slug));
  const directFauxFeelings = (lint.fauxFeelings || []).filter(slug => state.catalog.fauxFeelings.has(slug));
  const feelingSlugs = canSuggest
    ? mergeUnique(directFeelingSlugs, suggestionPayload.feelings).filter(slug => state.catalog.feelings.has(slug))
    : directFeelingSlugs;
  const needSlugs = canSuggest
    ? mergeUnique(directNeedSlugs, suggestionPayload.needs).filter(slug => state.catalog.needs.has(slug))
    : directNeedSlugs;
  const feelingItems = buildSuggestionLinks(
    feelingSlugs.slice(0, 6),
    '/feelings/',
    state.catalog.feelings,
  );
  const needItems = buildSuggestionLinks(
    needSlugs.slice(0, 6),
    '/needs/',
    state.catalog.needs,
  );
  const cueList = canSuggest ? [...new Set(suggestionPayload.why)] : [];
  const reasons = [];
  if (cueList.length) {
    const cueLabel = cueList.length === 1 ? 'match' : 'matches';
    reasons.push(`Cue ${cueLabel}: ${cueList.length}`);
  }
  const directReasons = [];
  if (directFeelingSlugs.length) directReasons.push(directFeelingSlugs.length === 1 ? 'a feeling word' : 'feeling words');
  if (directNeedSlugs.length) directReasons.push(directNeedSlugs.length === 1 ? 'a need word' : 'need words');
  if (directFauxFeelings.length) directReasons.push(directFauxFeelings.length === 1 ? 'a faux feeling' : 'faux feelings');
  if (directReasons.length) {
    reasons.push(`Direct matches from your wording (${directReasons.join(', ')})`);
  }
  const reasonsText = reasons.length
    ? reasons.join(' · ')
    : canSuggest
      ? 'No cues detected yet — add what was seen/heard.'
      : 'Resolve highlighted language to surface cues.';
  const previewHasContent = sanitizedTrimmed.length > 0;
  const showPanel = canSuggest && (previewHasContent || feelingItems.length > 0 || needItems.length > 0);
  if (typeof window.setObservationSuggestions === 'function') {
    window.setObservationSuggestions('free', {
      showPanel,
      feelings: showPanel ? feelingItems : [],
      needs: showPanel ? needItems : [],
      emptyMessage: lint.ok
        ? 'Add what was seen/heard to surface related feelings and needs.'
        : 'Resolve highlighted language to see suggestions.',
      feelingsEmptyMessage: lint.ok
        ? 'No feelings surfaced yet.'
        : 'Observations only — remove evaluations to see feeling suggestions.',
      needsEmptyMessage: lint.ok
        ? 'No needs surfaced yet.'
        : 'Observations only — remove evaluations to see need suggestions.',
      why: showPanel ? reasonsText : '',
    });
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

function updateSharedPreview(preview) {
  if (typeof window.setObservationPreview !== 'function') return;
  const freePanel = $('#tab-free');
  const freeActive = freePanel && !freePanel.classList.contains('hidden');
  if (!freeActive) return;
  const message = typeof preview === 'string' ? preview.trim() : '';
  window.setObservationPreview({
    source: 'free',
    text: message,
    fallback: FREE_PREVIEW_FALLBACK,
  });
}

function renderChips(host, items, baseHref, labelMap) {
  if (!host) return;
  host.classList.add('chip-group');
  host.setAttribute('role', 'list');
  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }
  const list = items && items.length ? items : [];
  if (!list.length) {
    const ghost = document.createElement('span');
    ghost.className = 'chip chip--ghost';
    ghost.textContent = '—';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('role', 'presentation');
    host.appendChild(ghost);
    return;
  }
  list.forEach(slug => {
    const a = document.createElement('a');
    a.classList.add('chip');
    a.href = baseHref + encodeURIComponent(slug) + '/';
    const info = labelMap && typeof labelMap.get === 'function' ? labelMap.get(slug) : null;
    const label = info && info.title ? info.title : slug.replace(/-/g, ' ');
    a.textContent = label;
    a.setAttribute('data-slug', slug);
    a.setAttribute('role', 'listitem');
    host.appendChild(a);
  });
}

function selectCueSearchText(sanitizedPreview) {
  const previewTrimmed = typeof sanitizedPreview === 'string' ? sanitizedPreview.trim() : '';
  if (previewTrimmed) {
    return sanitizedPreview;
  }
  const sanitizedWhat = sanitizeObservationText(state.whatSawHeard, state.catalog);
  const sanitizedWhatTrimmed = typeof sanitizedWhat === 'string' ? sanitizedWhat.trim() : '';
  if (sanitizedWhatTrimmed) {
    return sanitizedWhat;
  }
  return typeof state.whatSawHeard === 'string' ? state.whatSawHeard : '';
}

function renderCueAutocomplete(text, cues, hits) {
  const host = $('#obs-cue-suggestions');
  const msg = $('#obs-cue-suggestions-msg');
  if (!host || !msg) return;

  host.classList.add('chip-group');
  host.setAttribute('role', 'list');

  const info = deriveCueAutocomplete(text, cues, hits);
  const recognized = info.items.find(item => item.active);
  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }

  if (!recognized && !info.items.length) {
    const ghost = document.createElement('span');
    ghost.className = 'chip chip--ghost';
    ghost.textContent = '—';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('role', 'presentation');
    host.appendChild(ghost);
  } else if (recognized) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip chip--stacked observation-cue-suggestion';
    button.classList.add('observation-cue-suggestion--active');
    button.setAttribute('data-state', 'recognized');
    if (recognized.phrase) {
      button.dataset.phrase = recognized.phrase;
    }
    button.dataset.cue = recognized.cue;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', describeCueSuggestion(recognized));
    button.title = `${recognized.label || recognized.cue} · Recognized from what you typed`;
    const title = document.createElement('span');
    title.className = 'chip__title';
    title.textContent = recognized.label || recognized.cue;
    button.appendChild(title);
    host.appendChild(button);
  } else {
    const ghost = document.createElement('span');
    ghost.className = 'chip chip--ghost';
    ghost.textContent = '—';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('role', 'presentation');
    host.appendChild(ghost);
  }

  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    msg.textContent = 'Start typing to see cue phrases from the wizard catalog. Click a card to paste the cue phrase.';
    delete msg.dataset.variant;
    return;
  }

  if (recognized) {
    msg.textContent = 'Recognized a cue phrase. Click to paste the nearest pattern.';
    msg.dataset.variant = 'match';
    return;
  }

  if (info.items.length) {
    msg.textContent = 'No exact cue phrase match yet. Keep typing to help the wizard find a pattern.';
    msg.dataset.variant = 'flagged';
    return;
  }

  msg.textContent = 'No cue matches yet. Try adding direct quotes, counts, or the communication channel you noticed.';
  msg.dataset.variant = 'flagged';
}

function deriveCueAutocomplete(text, cues, hits, maxItems = 6) {
  const items = [];
  const seen = new Set();
  const activeRows = Array.isArray(hits) ? hits : [];
  activeRows.forEach(row => {
    const suggestion = createCueSuggestion(row, true);
    if (!suggestion) return;
    const cueKey = suggestion.cue;
    if (seen.has(cueKey)) return;
    items.push(suggestion);
    seen.add(cueKey);
  });
  const activeCount = items.length;
  if (!Array.isArray(cues) || items.length >= maxItems) {
    return { items, activeCount };
  }

  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return { items, activeCount };
  }

  const fragments = buildCueFragments(trimmed);
  if (fragments.length) {
    for (const row of cues) {
      if (items.length >= maxItems) break;
      const suggestion = createCueSuggestion(row);
      if (!suggestion) continue;
      const cue = suggestion.cue;
      if (seen.has(cue)) continue;
      const cueLower = cue.toLowerCase();
      const phraseLower = suggestion.phrase.toLowerCase();
      const matchesFragment = fragments.some(fragment => cueLower.includes(fragment) || phraseLower.includes(fragment));
      if (matchesFragment) {
        items.push({ ...suggestion, active: false });
        seen.add(cue);
      }
    }
  }

  if (items.length < maxItems) {
    const tokenSet = collectCueTokens(trimmed);
    if (tokenSet.size) {
      for (const row of cues) {
        if (items.length >= maxItems) break;
        const suggestion = createCueSuggestion(row);
        if (!suggestion) continue;
        const cue = suggestion.cue;
        if (seen.has(cue)) continue;
        const candidateTokens = [
          ...collectCueTokens(cue),
          ...collectCueTokens(suggestion.phrase),
        ];
        const hasOverlap = candidateTokens.some(token => tokenSet.has(token));
        if (hasOverlap) {
          items.push({ ...suggestion, active: false });
          seen.add(cue);
        }
      }
    }
  }

  return { items: items.slice(0, maxItems), activeCount };
}

function buildCueFragments(text) {
  const source = typeof text === 'string' ? text.toLowerCase() : '';
  if (!source.trim()) return [];
  const normalized = source.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const tokens = normalized.split(' ');
  const fragments = [];
  const pushFragment = fragment => {
    const trimmed = fragment.trim();
    if (!trimmed || trimmed.length < 3) return;
    const bounded = trimmed.length > 60 ? trimmed.slice(-60) : trimmed;
    fragments.push(bounded);
  };

  if (tokens.length) pushFragment(tokens[tokens.length - 1]);
  if (tokens.length >= 2) pushFragment(tokens.slice(-2).join(' '));
  if (tokens.length >= 3) pushFragment(tokens.slice(-3).join(' '));

  const lastClause = normalized.split(/[,;.!?]/).pop();
  if (lastClause) pushFragment(lastClause);

  return [...new Set(fragments)];
}

function collectCueTokens(text, minLength = 4, limit = 12) {
  const set = new Set();
  if (typeof text !== 'string') return set;
  const tokens = text
    .toLowerCase()
    .split(CUE_TOKEN_SPLIT_REGEX)
    .filter(Boolean);
  for (let i = Math.max(tokens.length - limit, 0); i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.length >= minLength) {
      set.add(token);
    }
  }
  return set;
}

function formatCuePhrase(phrase) {
  const text = typeof phrase === 'string' ? phrase.trim() : '';
  if (!text) {
    return '—';
  }
  return `“${text}”`;
}

function describeCueSuggestion(item) {
  const label = typeof item?.label === 'string' && item.label.trim() ? item.label.trim() : item?.cue || '';
  const phrase = typeof item?.phrase === 'string' ? item.phrase.trim() : '';
  const phraseDescription = phrase ? `the cue phrase “${phrase}”` : 'the cue phrase';
  if (!label) {
    return item?.active
      ? `Recognized cue phrase. Press to paste ${phraseDescription}.`
      : `Press to paste ${phraseDescription}.`;
  }
  if (item?.active) {
    return `${label}. Recognized cue phrase. Press to paste ${phraseDescription}.`;
  }
  return `${label}. Press to paste ${phraseDescription}.`;
}

function createCueSuggestion(row, isActive = false) {
  const cue = typeof row?.cue === 'string' ? row.cue.trim() : '';
  if (!cue) {
    return null;
  }
  const label = typeof row?.label === 'string' && row.label.trim()
    ? row.label.trim()
    : cue.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const phrase = getCuePhrase(row);
  if (!phrase) {
    return null;
  }
  return {
    cue,
    label,
    phrase,
    active: Boolean(isActive),
  };
}

function getCuePhrase(row) {
  const direct = typeof row?.phrase === 'string' ? row.phrase.trim() : '';
  if (direct) {
    return direct;
  }
  if (Array.isArray(row?.phrases)) {
    const candidate = row.phrases.find(phrase => typeof phrase === 'string' && phrase.trim());
    if (candidate) {
      return candidate.trim();
    }
  }
  const label = typeof row?.label === 'string' ? row.label.trim() : '';
  if (label) {
    return label;
  }
  const cue = typeof row?.cue === 'string' ? row.cue.trim() : '';
  return cue.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function handleCueSuggestionClick(event) {
  const button = event.target?.closest('button[data-phrase]');
  if (!button) {
    return;
  }
  event.preventDefault();
  const phrase = button.dataset.phrase || '';
  if (!phrase) {
    return;
  }
  insertCuePhrase(phrase);
  if (typeof button.blur === 'function') {
    button.blur();
  }
}

function insertCuePhrase(phrase) {
  const textarea = $('#obs-what');
  if (!textarea) {
    return;
  }
  const snippet = typeof phrase === 'string' ? phrase.trim() : '';
  if (!snippet) {
    return;
  }
  const value = textarea.value || '';
  const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : value.length;
  const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : value.length;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const needsSpaceBefore = before && !/[\s\n]$/.test(before);
  const needsSpaceAfter = after && !/^[\s\n]/.test(after);
  let insertion = snippet;
  if (needsSpaceBefore) {
    insertion = ` ${insertion}`;
  }
  if (needsSpaceAfter) {
    insertion = `${insertion} `;
  }
  const nextValue = `${before}${insertion}${after}`;
  textarea.value = nextValue;
  const caret = before.length + insertion.length;
  if (typeof textarea.setSelectionRange === 'function') {
    textarea.setSelectionRange(caret, caret);
  }
  textarea.focus();
  state.whatSawHeard = textarea.value;
  render();
}

function buildSuggestionLinks(slugs, baseHref, labelMap) {
  if (!Array.isArray(slugs)) {
    return [];
  }
  return slugs
    .map(slug => {
      if (!slug) {
        return null;
      }
      const info = labelMap && typeof labelMap.get === 'function' ? labelMap.get(slug) : null;
      const label = info && info.title ? info.title : slug.replace(/-/g, ' ');
      return {
        slug,
        label,
        href: `${baseHref}${encodeURIComponent(slug)}/`,
      };
    })
    .filter(Boolean);
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
  return cues.map(row => {
    const cue = typeof row?.cue === 'string' ? row.cue.trim() : '';
    const label = typeof row?.label === 'string' && row.label.trim()
      ? row.label.trim()
      : cue.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    const phrases = Array.isArray(row?.phrases)
      ? row.phrases.map(normalizeCuePhrase).filter(Boolean)
      : [];
    const phrase = normalizeCuePhrase(row?.phrase);
    const snippet = phrase || phrases[0] || label || cue;
    return {
      ...row,
      cue,
      label,
      phrases,
      phrase: snippet,
      feelings: Array.isArray(row.feelings) ? row.feelings.filter(slug => catalog.feelings.has(slug)) : [],
      needs: Array.isArray(row.needs) ? row.needs.filter(slug => catalog.needs.has(slug)) : [],
    };
  });
}

function normalizeCuePhrase(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\s+/g, ' ');
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
  const flaggedGroups = Array.isArray(lint.flaggedGroups) ? lint.flaggedGroups : [];
  const flaggedTokenSet = new Set();
  flaggedGroups.forEach(group => {
    (group.matches || []).forEach(token => {
      if (typeof token === 'string') {
        flaggedTokenSet.add(token.toLowerCase());
      }
    });
  });
  const evaluationTokens = uniqueStrings([
    ...(lint.evaluationMarkers || []),
    ...(lint.agentiveMarkers || []),
  ]);
  const filteredEvaluationTokens = evaluationTokens.filter(token => !flaggedTokenSet.has(token.toLowerCase()));
  const hasObservation = Boolean(
    (state.whenWhere && state.whenWhere.trim()) ||
    (state.whatSawHeard && state.whatSawHeard.trim()) ||
    (state.gap && state.gap.trim()),
  );

  if (!lint.ok && hasObservation) {
    paragraphs.push(createObservationRecipeBlock());
  }

  if (filteredEvaluationTokens.length) {
    const p = document.createElement('p');
    p.textContent = `This reads like an evaluation (${formatList(filteredEvaluationTokens)}). Focus on what you noticed instead of judging it. ${FLAG_ADVICE_DEFAULT} Want help rewriting as a camera-test observation?`;
    paragraphs.push(p);
  }

  flaggedGroups.forEach(group => {
    paragraphs.push(createFlagParagraph(group));
  });

  if (lint.fauxFeelings && lint.fauxFeelings.length) {
    paragraphs.push(
      createCatalogParagraph({
        slugs: lint.fauxFeelings,
        catalogMap: catalog?.fauxFeelings,
        baseHref: '/faux-feelings/',
        singular: 'Noticed faux feeling',
        plural: 'Noticed faux feelings',
        cta: 'Jump straight to the faux feelings library? Try swapping in a time/place anchor, a quote, a count or measure, or a link to an artifact.'
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
    if (lint.ok && hasObservation) {
      lintBox.classList.remove('hidden');
      lintMsg.replaceChildren(createObservationSuccessParagraph());
      rewriteBtn.hidden = true;
      return;
    }
    lintBox.classList.add('hidden');
    lintMsg.replaceChildren();
    rewriteBtn.hidden = true;
    return;
  }

  lintBox.classList.remove('hidden');
  lintMsg.replaceChildren(...paragraphs);
  const showRewrite =
    filteredEvaluationTokens.length ||
    (lint.feelings && lint.feelings.length) ||
    (lint.needs && lint.needs.length) ||
    flaggedGroups.length > 0;
  rewriteBtn.hidden = !showRewrite;
}

function createFlagParagraph(group) {
  const p = document.createElement('p');
  const matches = Array.isArray(group?.matches) ? group.matches : [];
  const label = typeof group?.label === 'string' && group.label ? group.label : 'Flagged language';
  const advice = typeof group?.advice === 'string' && group.advice ? group.advice : FLAG_ADVICE_DEFAULT;
  const supplement = FLAG_SUPPLEMENTAL_TIPS[group?.key];
  if (!matches.length) {
    p.appendChild(document.createTextNode(`${label}: ${advice}`));
  } else {
    p.appendChild(document.createTextNode(`Detected ${label.toLowerCase()} (${formatList(matches)}). ${advice}`));
  }
  if (supplement) {
    p.appendChild(document.createTextNode(` Try this: ${supplement}`));
  }
  return p;
}

function createObservationRecipeBlock() {
  const container = document.createElement('div');
  container.className = 'observation-feedback__recipe';
  const intro = document.createElement('p');
  intro.textContent = 'Observation recipe to try:';
  container.appendChild(intro);
  const list = document.createElement('ol');
  list.className = 'observation-feedback__recipe-list';
  OBSERVATION_RECIPE_STEPS.forEach(step => {
    const item = document.createElement('li');
    item.textContent = step;
    list.appendChild(item);
  });
  container.appendChild(list);
  return container;
}

function createObservationSuccessParagraph() {
  const p = document.createElement('p');
  p.textContent = 'Looks observational — the language reads like camera-test detail. Keep going with feelings, needs, or a request when you’re ready.';
  return p;
}

function createCatalogParagraph({ slugs, catalogMap, baseHref, singular, plural, cta }) {
  const p = document.createElement('p');
  const label = slugs.length === 1 ? singular : plural;
  p.appendChild(document.createTextNode(`${label}: `));
  const chipList = document.createElement('span');
  chipList.className = 'chip-list';
  chipList.setAttribute('role', 'list');
  (slugs || []).forEach(slug => {
    const link = createCatalogLink(slug, baseHref, catalogMap);
    if (link) {
      chipList.appendChild(link);
    }
  });
  if (chipList.childElementCount) {
    p.appendChild(chipList);
  }
  if (cta) {
    p.appendChild(document.createTextNode(` ${cta}`));
  }
  return p;
}

function createCatalogLink(slug, baseHref, catalogMap) {
  if (!slug) return null;
  const a = document.createElement('a');
  a.classList.add('chip');
  a.href = baseHref + encodeURIComponent(slug) + '/';
  const info = catalogMap && typeof catalogMap.get === 'function' ? catalogMap.get(slug) : null;
  const label = info?.title || slug.replace(/-/g, ' ');
  a.textContent = label;
  a.setAttribute('data-slug', slug);
  a.setAttribute('role', 'listitem');
  return a;
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

function renderObservationAnnotations(text, lint) {
  const host = $('#obs-what-annotated');
  const msg = $('#obs-what-annotation-msg');
  if (!host || !msg) return;

  const source = typeof text === 'string' ? text : '';
  const trimmed = source.trim();

  host.replaceChildren();

  if (!trimmed) {
    host.textContent = 'Your words will be annotated here with observation coaching.';
    msg.textContent = OBSERVATION_EMPTY_HINT;
    delete msg.dataset.variant;
    return;
  }

  const definitions = [
    ...buildFlaggedDefinitions(lint),
    ...buildCelebratedDefinitions(source),
  ];

  if (!definitions.length) {
    host.textContent = source;
    msg.textContent = 'No flagged language detected — keep focusing on observable details.';
    delete msg.dataset.variant;
    return;
  }

  const ranges = buildHighlightRanges(source, definitions);

  if (!ranges.length) {
    host.textContent = source;
    msg.textContent = 'No flagged language detected — keep focusing on observable details.';
    delete msg.dataset.variant;
    return;
  }

  let cursor = 0;
  ranges.forEach(range => {
    if (cursor < range.start) {
      host.appendChild(document.createTextNode(source.slice(cursor, range.start)));
    }
    host.appendChild(createAnnotationToken(source.slice(range.start, range.end), range));
    cursor = range.end;
  });

  if (cursor < source.length) {
    host.appendChild(document.createTextNode(source.slice(cursor)));
  }

  msg.textContent = OBSERVATION_DEFAULT_HINT;
  delete msg.dataset.variant;
}

function buildFlaggedDefinitions(lint) {
  if (!lint) return [];
  const defs = [];
  const seen = new Set();

  const groups = Array.isArray(lint.flaggedGroups) ? lint.flaggedGroups : [];
  groups.forEach(group => {
    const matches = Array.isArray(group?.matches) ? group.matches : [];
    const advice = typeof group?.advice === 'string' && group.advice ? group.advice : FLAG_ADVICE_DEFAULT;
    const label = typeof group?.label === 'string' && group.label ? group.label : 'Flagged language';
    const reason = `${label}: ${advice}`;
    matches.forEach(match => {
      const token = typeof match === 'string' ? match.trim() : '';
      if (!token) return;
      const key = token.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      defs.push({ token, reason, className: 'flagged', priority: 2 });
    });
  });

  const evaluations = uniqueStrings([...(lint.evaluationMarkers || []), ...(lint.agentiveMarkers || [])]);
  evaluations.forEach(token => {
    if (!token) return;
    const normalized = token.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    defs.push({
      token,
      reason: `Reads like an evaluation. ${FLAG_ADVICE_DEFAULT}`,
      className: 'flagged',
      priority: 2,
    });
  });

  return defs;
}

function buildCelebratedDefinitions(text) {
  const defs = [];
  const seen = new Set();
  const source = typeof text === 'string' ? text : '';

  OBSERVATION_CELEBRATION_WORDS.forEach(item => {
    const token = typeof item?.token === 'string' ? item.token.trim() : '';
    if (!token) return;
    const key = token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    defs.push({
      token,
      reason: item.reason || 'Solid observational wording — nice choice.',
      className: 'celebrated',
      priority: 1,
    });
  });

  const quoteMatches = source.match(/“[^”]+”|"[^"\n]+"/g);
  if (quoteMatches) {
    quoteMatches.forEach(match => {
      const token = match.trim();
      if (!token || seen.has(token.toLowerCase())) return;
      seen.add(token.toLowerCase());
      defs.push({
        token,
        reason: 'Direct quotes are observational — love seeing them here.',
        className: 'celebrated',
        priority: 1,
      });
    });
  }

  const numberMatches = source.match(/\b\d+(?:[:\/.]\d+)?\b/g);
  if (numberMatches) {
    numberMatches.forEach(match => {
      const token = match.trim();
      if (!token || seen.has(token.toLowerCase())) return;
      seen.add(token.toLowerCase());
      defs.push({
        token,
        reason: 'Specific numbers keep things measurable — great observational detail.',
        className: 'celebrated',
        priority: 1,
      });
    });
  }

  return defs;
}

function buildHighlightRanges(text, definitions) {
  if (!definitions.length) return [];
  const ranges = [];
  const sorted = [...definitions].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aLen = typeof a.token === 'string' ? a.token.length : 0;
    const bLen = typeof b.token === 'string' ? b.token.length : 0;
    return bLen - aLen;
  });

  sorted.forEach(def => {
    const token = typeof def.token === 'string' ? def.token.trim() : '';
    if (!token) return;
    const regex = buildTokenRegex(token);
    if (!regex) return;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (ranges.some(range => start < range.end && end > range.start)) {
        if (regex.lastIndex === match.index) regex.lastIndex += 1;
        continue;
      }
      ranges.push({ start, end, reason: def.reason, className: def.className, token: match[0], priority: def.priority });
      if (regex.lastIndex === match.index) regex.lastIndex += 1;
    }
  });

  return ranges.sort((a, b) => a.start - b.start);
}

function buildTokenRegex(token) {
  const safe = escapeRegExp(token);
  if (!safe) return null;
  const spaceFlexible = safe.replace(/\\\s\+/g, '\\s+');
  const needsLeadingBoundary = /[\w']/.test(token[0]);
  const needsTrailingBoundary = /[\w']/.test(token[token.length - 1]);
  const prefix = needsLeadingBoundary ? '\\b' : '';
  const suffix = needsTrailingBoundary ? '\\b' : '';
  return new RegExp(prefix + spaceFlexible + suffix, 'gi');
}

function escapeRegExp(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function createAnnotationToken(text, meta) {
  const span = document.createElement('span');
  span.className = `observation-annotation__token observation-annotation__token--${meta.className || 'flagged'}`;
  span.setAttribute('tabindex', '0');
  span.setAttribute('role', 'button');
  span.setAttribute('data-reason', meta.reason || '');
  span.setAttribute('data-variant', meta.className || 'flagged');
  span.textContent = text;
  return span;
}

function handleAnnotationActivation(event) {
  const target = event.target?.closest('[data-reason]');
  if (!target) {
    resetAnnotationMessage();
    return;
  }
  event.preventDefault();
  showAnnotationMessage(target.dataset.reason, target.dataset.variant);
}

function handleAnnotationKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }
  const target = event.target?.closest('[data-reason]');
  if (!target) return;
  event.preventDefault();
  showAnnotationMessage(target.dataset.reason, target.dataset.variant);
}

function showAnnotationMessage(message, variant) {
  const msg = $('#obs-what-annotation-msg');
  if (!msg) return;
  msg.textContent = message || OBSERVATION_DEFAULT_HINT;
  msg.dataset.variant = variant || '';
}

function resetAnnotationMessage() {
  const msg = $('#obs-what-annotation-msg');
  if (!msg) return;
  msg.textContent = OBSERVATION_DEFAULT_HINT;
  delete msg.dataset.variant;
}

document.addEventListener('DOMContentLoaded', init);
