import { lintObservation } from '/lib/nvcLint.js';
import { loadCueRows, suggestFromObservation } from '/lib/observationSuggest.js';

const state = {
  text: '',
  catalog: createEmptyCatalog(),
  cues: [],
  analysis: null,
  mode: 'editing',
  lastSubmitted: '',
  directSuggestions: createEmptySuggestionSet(),
  detectionStatus: 'loading',
  detectionMatches: 0,
  validityStatus: 'idle',
  validityMessage: 'Matches not requested yet.',
  fallback: createFallbackState(),
};

document.addEventListener('DOMContentLoaded', () => {
  bind();
  renderPanels();
  renderValidityStatus();
  renderDetectionStatus();
  analyze(state.text);

  Promise.all([
    loadCatalog('/data/index.json'),
    loadCueRows('/data/observation_cues.sanitized.csv').catch(error => {
      console.warn('Unable to load observation cue map', error);
      return [];
    }),
  ])
    .then(([catalog, cues]) => {
      state.catalog = catalog;
      state.cues = cues;
      if (!state.text.trim()) {
        state.detectionStatus = 'idle';
        state.detectionMatches = 0;
        renderDetectionStatus();
      }
      analyze(state.text);
    })
    .catch(error => {
      console.warn('Unable to load observation helpers', error);
    });
});

function bind() {
  const textarea = document.getElementById('observation-text');
  if (textarea) {
    textarea.addEventListener('input', event => {
      state.text = event.target.value || '';
      if (state.mode !== 'editing') {
        state.mode = 'editing';
        renderPanels();
      }
      if (state.validityStatus === 'valid' || state.validityStatus === 'invalid' || state.validityStatus === 'error') {
        setValidityStatus('pending', 'Observation updated. See matches again when you’re ready.');
      }
      state.fallback = createFallbackState();
      analyze(state.text);
    });
  }

  const submit = document.getElementById('observation-submit');
  if (submit) {
    submit.addEventListener('click', handleSubmit);
  }

  const editAgain = document.getElementById('edit-again');
  if (editAgain) {
    editAgain.addEventListener('click', () => {
      state.mode = 'editing';
      renderPanels();
      analyze(state.text, {
        message: state.analysis?.ok
          ? 'Observation saved. Edit the text to explore other possibilities.'
          : state.analysis?.message,
      });
      state.fallback = createFallbackState();
      if (state.analysis?.ok) {
        setValidityStatus('pending', 'Edit the observation and see matches again when ready.');
      } else {
        renderValidityStatus();
      }
      const field = document.getElementById('observation-text');
      if (field) {
        field.focus();
      }
    });
  }

  const fallbackStart = document.getElementById('observation-fallback-start');
  if (fallbackStart) {
    fallbackStart.addEventListener('click', () => {
      startFallbackSearch();
    });
  }

  const fallbackNext = document.getElementById('observation-fallback-next');
  if (fallbackNext) {
    fallbackNext.addEventListener('click', () => {
      advanceFallback();
    });
  }
}

function analyze(raw, options = {}) {
  const source = typeof raw === 'string' ? raw : '';
  const trimmed = source.trim();
  const lint = trimmed ? lintObservation(trimmed, state.catalog) : null;
  const issues = lint ? buildIssueList(lint) : [];

  const analysis = {
    ok: Boolean(trimmed && lint?.ok),
    issues,
    trimmed,
    message: options.message,
    lint,
  };

  if (!trimmed) {
    analysis.ok = false;
    analysis.message = options.message || 'Start by anchoring your observation in time and place.';
  } else if (!analysis.message) {
    if (analysis.ok) {
      analysis.message = 'Looks observational! See matches to explore feelings and needs.';
    } else if (issues.length) {
      analysis.message = 'Edit the highlighted language to keep it purely observational.';
    } else {
      analysis.message = 'Try naming when and where the moment happened.';
    }
  }

  state.analysis = analysis;
  renderAnalysis();
  renderHighlight();
  updateDetectionStatus(trimmed);
  renderDetectionStatus();
}

function renderAnalysis() {
  const feedback = document.getElementById('observation-feedback');
  const issuesList = document.getElementById('observation-issues');
  const submitButton = document.getElementById('observation-submit');
  const editor = document.getElementById('observation-editor');

  const analysis = state.analysis;

  if (feedback) {
    feedback.textContent = analysis?.message || 'Start by anchoring your observation in time and place.';
    if (analysis?.ok) {
      feedback.setAttribute('data-state', 'ok');
    } else if (analysis?.issues?.length) {
      feedback.setAttribute('data-state', 'warn');
    } else {
      feedback.removeAttribute('data-state');
    }
  }

  if (issuesList) {
    issuesList.innerHTML = '';
    if (analysis?.issues?.length) {
      issuesList.removeAttribute('hidden');
      analysis.issues.forEach(issue => {
        const li = document.createElement('li');
        li.textContent = issue;
        issuesList.appendChild(li);
      });
    } else {
      issuesList.setAttribute('hidden', 'hidden');
    }
  }

  if (submitButton) {
    submitButton.disabled = !analysis?.ok;
  }

  if (editor) {
    editor.dataset.ready = analysis?.ok ? '1' : '0';
  }
}

function finalizeObservation() {
  const trimmed = state.analysis?.trimmed || state.text.trim();
  if (!trimmed) {
    return;
  }
  state.mode = 'results';
  state.lastSubmitted = trimmed;
  const direct = buildSuggestions(trimmed);
  state.directSuggestions = direct;
  state.fallback = createFallbackState();
  state.fallback.shouldPrompt = !hasSuggestions(direct);
  renderPanels();
  renderSuggestions();
}

function renderPanels() {
  const editorSection = document.getElementById('observation-editor');
  const suggestionSection = document.getElementById('observation-suggestions');
  if (state.mode === 'results') {
    if (editorSection) editorSection.setAttribute('hidden', 'hidden');
    if (suggestionSection) suggestionSection.removeAttribute('hidden');
  } else {
    if (editorSection) editorSection.removeAttribute('hidden');
    if (suggestionSection) suggestionSection.setAttribute('hidden', 'hidden');
  }
}

function renderSuggestions() {
  const feelingsHost = document.getElementById('suggested-feelings');
  const feelingsEmpty = document.getElementById('suggested-feelings-empty');
  const needsHost = document.getElementById('suggested-needs');
  const needsEmpty = document.getElementById('suggested-needs-empty');
  const whyHost = document.getElementById('suggested-why');
  const preview = document.getElementById('observation-preview');
  const fallbackPrompt = document.getElementById('observation-fallback-prompt');
  const fallbackRunning = document.getElementById('observation-fallback-running');
  const fallbackNext = document.getElementById('observation-fallback-next');
  const fallbackStart = document.getElementById('observation-fallback-start');

  if (!feelingsHost || !needsHost || !whyHost || !preview) {
    return;
  }

  preview.textContent = state.lastSubmitted ? `“${state.lastSubmitted}”` : '';
  const direct = state.directSuggestions || createEmptySuggestionSet();
  const hasDirect = hasSuggestions(direct);
  const fallbackActive = state.fallback.active && state.fallback.queue.length;
  const current = fallbackActive
    ? state.fallback.queue[state.fallback.index] || createEmptySuggestionSet()
    : direct;

  populateChipList(feelingsHost, feelingsEmpty, current.feelings || []);
  populateChipList(needsHost, needsEmpty, current.needs || []);

  if (fallbackActive) {
    const message = state.fallback.message ||
      (state.fallback.queue.length > 1
        ? 'Showing the nearest matches our detector can offer. Use Next for another option.'
        : 'Showing the nearest match our detector can offer.');
    whyHost.textContent = message;
  } else {
    const cueLabels = (direct.cues || []).map(formatCueLabel).filter(Boolean);
    if (cueLabels.length) {
      whyHost.textContent = `${cueLabels.length > 1 ? 'Matched cues' : 'Matched cue'} from our detector: ${cueLabels.join(', ')}`;
    } else if (!hasDirect && state.fallback.message && !state.fallback.shouldPrompt && !state.fallback.running) {
      whyHost.textContent = state.fallback.message;
    } else if (hasDirect) {
      whyHost.textContent = 'Suggestions come from our language detector and common observation patterns.';
    } else {
      whyHost.textContent = 'Our detector didn’t find direct matches. Browse every feeling and need or request the nearest match.';
    }
  }

  if (fallbackPrompt) {
    if (!hasDirect && !fallbackActive && !state.fallback.running && state.fallback.shouldPrompt && state.cues.length) {
      fallbackPrompt.removeAttribute('hidden');
    } else {
      fallbackPrompt.setAttribute('hidden', 'hidden');
    }
  }

  if (fallbackRunning) {
    if (state.fallback.running) {
      fallbackRunning.removeAttribute('hidden');
    } else {
      fallbackRunning.setAttribute('hidden', 'hidden');
    }
  }

  if (fallbackStart) {
    fallbackStart.disabled = Boolean(state.fallback.running);
  }

  if (fallbackNext) {
    if (fallbackActive && state.fallback.queue.length > 1) {
      fallbackNext.removeAttribute('hidden');
    } else {
      fallbackNext.setAttribute('hidden', 'hidden');
    }
  }
}

function populateChipList(container, emptyNode, items) {
  container.innerHTML = '';
  if (Array.isArray(items) && items.length) {
    items.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'observation-chip';
      chip.setAttribute('role', 'listitem');
      chip.textContent = item;
      container.appendChild(chip);
    });
    if (emptyNode) {
      emptyNode.setAttribute('hidden', 'hidden');
    }
  } else if (emptyNode) {
    emptyNode.removeAttribute('hidden');
  }
}

function buildIssueList(lint) {
  if (!lint) {
    return [];
  }
  const issues = [];
  if (lint.evaluationMarkers?.length) {
    issues.push(formatIssue('Evaluation words', lint.evaluationMarkers));
  }
  if (lint.agentiveMarkers?.length) {
    issues.push(formatIssue('Interpretations to revisit', lint.agentiveMarkers));
  }
  if (Array.isArray(lint.flaggedGroups)) {
    lint.flaggedGroups.forEach(group => {
      if (group?.matches?.length) {
        issues.push(formatIssue(group.label || 'Flagged language', group.matches));
      }
    });
  }
  if (lint.fauxFeelings?.length) {
    issues.push(formatIssue('Story words', lint.fauxFeelings));
  }
  if (lint.feelings?.length) {
    issues.push(formatIssue('Feeling words', lint.feelings));
  }
  if (lint.needs?.length) {
    issues.push(formatIssue('Need words', lint.needs));
  }
  return issues;
}

function formatIssue(label, tokens) {
  const text = formatQuotedList(tokens);
  return text ? `${label}: ${text}` : label;
}

function formatQuotedList(values) {
  if (!Array.isArray(values)) {
    return '';
  }
  const unique = [...new Set(values.map(value => (value || '').trim()).filter(Boolean))];
  return unique.map(value => `“${value}”`).join(', ');
}

function buildSuggestions(text) {
  if (!text) {
    return { feelings: [], needs: [], cues: [] };
  }
  const suggestion = suggestFromObservation(text, state.cues || [], 8);
  const feelings = (suggestion.feelings || []).map(resolveFeelingTitle).filter(Boolean);
  const needs = (suggestion.needs || []).map(resolveNeedTitle).filter(Boolean);
  return {
    feelings,
    needs,
    cues: suggestion.why || [],
  };
}

function resolveFeelingTitle(slug) {
  const entry = state.catalog?.feelings?.get?.(slug);
  return entry?.title || formatTitle(slug);
}

function resolveNeedTitle(slug) {
  const entry = state.catalog?.needs?.get?.(slug);
  return entry?.title || formatTitle(slug);
}

function formatCueLabel(value) {
  return formatTitle(value);
}

function formatTitle(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(token => (token ? token[0].toUpperCase() + token.slice(1) : ''))
    .join(' ');
}

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
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return buildCatalog(data);
  } catch (error) {
    console.warn('Failed to load site catalog', error);
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
          title: item.title || formatTitle(item.slug),
          slug: item.slug,
          aliases: item.aliases || [],
          fauxFeelings: Array.isArray(item.fauxFeelings) ? item.fauxFeelings.map(entry => entry.slug).filter(Boolean) : [],
        });
      }
    });
  }

  if (Array.isArray(data?.needs)) {
    data.needs.forEach(item => {
      if (item?.slug) {
        needs.set(item.slug, {
          title: item.title || formatTitle(item.slug),
          slug: item.slug,
          aliases: item.aliases || [],
        });
      }
    });
  }

  if (Array.isArray(data?.fauxFeelings)) {
    data.fauxFeelings.forEach(item => {
      if (item?.slug) {
        fauxFeelings.set(item.slug, {
          title: item.title || formatTitle(item.slug),
          slug: item.slug,
          aliases: item.aliases || [],
          feelings: Array.isArray(item.feelings) ? item.feelings.map(entry => entry.slug).filter(Boolean) : [],
          needs: Array.isArray(item.needs) ? item.needs.map(entry => entry.slug).filter(Boolean) : [],
        });
      }
    });
  }

  return { feelings, needs, fauxFeelings };
}

function createEmptySuggestionSet() {
  return { feelings: [], needs: [], cues: [] };
}

function createFallbackState() {
  return {
    queue: [],
    index: 0,
    active: false,
    running: false,
    shouldPrompt: false,
    message: '',
  };
}

function hasSuggestions(set) {
  if (!set) {
    return false;
  }
  const feelingCount = Array.isArray(set.feelings) ? set.feelings.length : 0;
  const needCount = Array.isArray(set.needs) ? set.needs.length : 0;
  return feelingCount + needCount > 0;
}

function handleSubmit() {
  const trimmed = state.text.trim();
  if (!trimmed) {
    setValidityStatus('error', 'Add concrete details before seeing matches.');
    analyze(state.text, { message: 'Start by anchoring your observation in time and place.' });
    return;
  }

  if (!state.analysis?.ok) {
    setValidityStatus('invalid', 'Keep editing until the observation is purely descriptive.');
    renderHighlight();
    return;
  }

  setValidityStatus('valid', 'Observation recorded. Review the suggestions below.');
  finalizeObservation();
}

function startFallbackSearch() {
  if (state.fallback.running || state.fallback.active) {
    return;
  }
  if (!state.lastSubmitted) {
    setValidityStatus('pending', 'Add a valid observation before requesting the nearest match.');
    return;
  }
  state.fallback.running = true;
  state.fallback.shouldPrompt = false;
  renderSuggestions();
  window.setTimeout(() => {
    const queue = computeFallbackQueue(state.lastSubmitted);
    state.fallback.queue = queue;
    state.fallback.index = 0;
    state.fallback.active = queue.length > 0;
    state.fallback.running = false;
    if (queue.length) {
      state.fallback.message = queue.length > 1
        ? 'Showing the nearest matches our detector can offer. Use Next for another option.'
        : 'Showing the nearest match our detector can offer.';
    } else {
      state.fallback.message = 'We couldn’t find a close match yet. Browse all feelings and needs below while we keep learning.';
    }
    renderSuggestions();
  }, 120);
}

function advanceFallback() {
  if (!state.fallback.active || state.fallback.queue.length <= 1) {
    return;
  }
  state.fallback.index = (state.fallback.index + 1) % state.fallback.queue.length;
  renderSuggestions();
}

function computeFallbackQueue(text) {
  if (!text || !state.cues.length) {
    return [];
  }

  const tokens = tokenizeForScore(text);
  const tokenSet = new Set(tokens);
  const normalized = text.toLowerCase();

  const candidates = state.cues
    .map(cue => {
      const feelings = (cue.feelings || []).map(resolveFeelingTitle).filter(Boolean);
      const needs = (cue.needs || []).map(resolveNeedTitle).filter(Boolean);
      if (!feelings.length && !needs.length) {
        return null;
      }
      const score = scoreCueMatch(tokenSet, normalized, cue);
      return { cue, feelings, needs, score };
    })
    .filter(Boolean);

  if (!candidates.length) {
    return [];
  }

  const positive = candidates.filter(item => item.score > 0);
  const pool = positive.length ? positive : candidates;

  pool.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aCount = a.feelings.length + a.needs.length;
    const bCount = b.feelings.length + b.needs.length;
    if (bCount !== aCount) {
      return bCount - aCount;
    }
    const aLabel = a.cue?.label || a.cue?.cue || '';
    const bLabel = b.cue?.label || b.cue?.cue || '';
    return aLabel.localeCompare(bLabel);
  });

  const seen = new Set();
  const results = [];
  for (const entry of pool) {
    const key = `${entry.feelings.join('|')}|${entry.needs.join('|')}`;
    if (!key.trim()) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push({ feelings: entry.feelings, needs: entry.needs });
    if (results.length >= 6) {
      break;
    }
  }

  return results;
}

function tokenizeForScore(text) {
  return (text || '').toLowerCase().match(/[a-z0-9'’]+/g) || [];
}

function scoreCueMatch(tokenSet, normalizedText, cue) {
  const sources = [];
  if (Array.isArray(cue?.phrases)) {
    sources.push(...cue.phrases);
  }
  if (cue?.phrase) {
    sources.push(cue.phrase);
  }
  if (cue?.example) {
    sources.push(cue.example);
  }
  if (cue?.label) {
    sources.push(cue.label);
  }
  if (cue?.cue) {
    sources.push(cue.cue);
  }

  let best = 0;
  sources.forEach(source => {
    const value = typeof source === 'string' ? source.trim() : '';
    if (!value) {
      return;
    }
    const sourceTokens = tokenizeForScore(value);
    if (!sourceTokens.length) {
      return;
    }
    let matches = 0;
    sourceTokens.forEach(token => {
      if (tokenSet.has(token)) {
        matches += 1;
      }
    });
    let score = matches;
    if (matches) {
      score += matches / sourceTokens.length;
    }
    const lower = value.toLowerCase();
    if (normalizedText.includes(lower)) {
      score += Math.min(4, lower.length / 12);
    }
    if (score > best) {
      best = score;
    }
  });

  return best;
}

function setValidityStatus(status, message) {
  state.validityStatus = status || 'idle';
  if (typeof message === 'string') {
    state.validityMessage = message;
  } else if (state.validityStatus === 'idle') {
    state.validityMessage = 'Matches not requested yet.';
  } else if (state.validityStatus === 'pending') {
    state.validityMessage = 'Edit the observation and see matches when ready.';
  }
  renderValidityStatus();
}

function renderValidityStatus() {
  const container = document.getElementById('observation-validity-container');
  const label = document.getElementById('observation-validity-label');
  if (!container || !label) {
    return;
  }

  const status = state.validityStatus || 'idle';
  container.setAttribute('data-state', status);
  label.textContent = state.validityMessage || defaultValidityMessage(status);
}

function defaultValidityMessage(status) {
  switch (status) {
    case 'valid':
      return 'Observation captured successfully.';
    case 'invalid':
      return 'Observation still needs adjustments.';
    case 'error':
      return 'Observation was empty. Add details before seeing matches.';
    case 'pending':
      return 'Edit the observation and see matches when ready.';
    default:
      return 'Matches not requested yet.';
  }
}

function updateDetectionStatus(trimmed) {
  if (!state.cues.length) {
    state.detectionStatus = 'loading';
    state.detectionMatches = 0;
    return;
  }
  if (!trimmed) {
    state.detectionStatus = 'idle';
    state.detectionMatches = 0;
    return;
  }

  const suggestion = suggestFromObservation(trimmed, state.cues || [], 4);
  const feelingsCount = Array.isArray(suggestion.feelings) ? suggestion.feelings.length : 0;
  const needsCount = Array.isArray(suggestion.needs) ? suggestion.needs.length : 0;
  state.detectionMatches = feelingsCount + needsCount;
  state.detectionStatus = state.detectionMatches ? 'found' : 'searching';
}

function renderDetectionStatus() {
  const container = document.getElementById('observation-detection');
  const text = document.getElementById('observation-detection-text');
  if (!container || !text) {
    return;
  }

  const status = state.detectionStatus || 'loading';
  container.setAttribute('data-state', status);

  let message = 'Warming up the language detector…';
  if (status === 'idle') {
    message = 'Language detector ready';
  } else if (status === 'searching') {
    message = 'Our detector hasn’t spotted cues yet. Nearest match remains available.';
  } else if (status === 'found') {
    message = state.detectionMatches > 1
      ? `${state.detectionMatches} matches detected`
      : 'Match detected';
  }
  text.textContent = message;
}

function renderHighlight() {
  const host = document.getElementById('observation-highlight');
  if (!host) {
    return;
  }
  const text = state.text || '';
  const tokens = collectHighlightTokens(state.analysis?.lint);
  host.innerHTML = buildHighlightMarkup(text, tokens);
}

function collectHighlightTokens(lint) {
  if (!lint) {
    return [];
  }
  const tokens = new Set();
  (lint.hits || []).forEach(token => {
    if (token) {
      tokens.add(String(token).trim());
    }
  });
  (lint.flaggedGroups || []).forEach(group => {
    (group?.matches || []).forEach(match => {
      if (match) {
        tokens.add(String(match).trim());
      }
    });
  });
  return Array.from(tokens).filter(Boolean);
}

function buildHighlightMarkup(text, tokens) {
  if (!text) {
    return '&nbsp;';
  }
  if (!Array.isArray(tokens) || !tokens.length) {
    return escapeHtml(text).replace(/\n/g, '<br />');
  }
  const ranges = buildHighlightRanges(text, tokens);
  if (!ranges.length) {
    return escapeHtml(text).replace(/\n/g, '<br />');
  }
  let output = '';
  let index = 0;
  ranges.forEach(range => {
    if (range.start > index) {
      output += escapeHtml(text.slice(index, range.start)).replace(/\n/g, '<br />');
    }
    const highlighted = escapeHtml(text.slice(range.start, range.end)).replace(/\n/g, '<br />');
    output += `<mark>${highlighted}</mark>`;
    index = range.end;
  });
  if (index < text.length) {
    output += escapeHtml(text.slice(index)).replace(/\n/g, '<br />');
  }
  return output || '&nbsp;';
}

function buildHighlightRanges(text, tokens) {
  const lower = text.toLowerCase();
  const ranges = [];
  tokens.forEach(token => {
    const value = typeof token === 'string' ? token.trim() : '';
    if (!value) {
      return;
    }
    const target = value.toLowerCase();
    let searchIndex = 0;
    while (searchIndex < lower.length) {
      const found = lower.indexOf(target, searchIndex);
      if (found === -1) {
        break;
      }
      const end = found + target.length;
      if (isWordBoundary(text, found, end)) {
        ranges.push({ start: found, end });
      }
      searchIndex = end;
    }
  });
  return mergeRanges(ranges);
}

function mergeRanges(ranges) {
  if (!Array.isArray(ranges) || !ranges.length) {
    return [];
  }
  const sorted = ranges
    .map(range => ({ start: range.start, end: range.end }))
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const prev = merged[merged.length - 1];
    if (current.start <= prev.end) {
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }
  return merged;
}

function isWordBoundary(text, start, end) {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  const wordChar = /[A-Za-z0-9'’]/;
  const startOk = !before || !wordChar.test(before);
  const endOk = !after || !wordChar.test(after);
  return startOk && endOk;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
