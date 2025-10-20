import { lintObservation } from '/lib/nvcLint.js';
import { loadCueRows, suggestFromObservation } from '/lib/observationSuggest.js';

const SUBMIT_DELAY_MS = 900;

const state = {
  text: '',
  catalog: createEmptyCatalog(),
  cues: [],
  analysis: null,
  mode: 'editing',
  suggestions: null,
  lastSubmitted: '',
};

let completionTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  bind();
  renderPanels();
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
      analyze(state.text, { suppressAutoSubmit: true });
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
      analyze(state.text);
    });
  }

  const submit = document.getElementById('observation-submit');
  if (submit) {
    submit.addEventListener('click', () => {
      if (state.analysis?.ok) {
        finalizeObservation();
      }
    });
  }

  const editAgain = document.getElementById('edit-again');
  if (editAgain) {
    editAgain.addEventListener('click', () => {
      state.mode = 'editing';
      renderPanels();
      cancelCompletion();
      analyze(state.text, {
        suppressAutoSubmit: true,
        message: state.analysis?.ok
          ? 'Observation saved. Edit the text to surface different suggestions.'
          : state.analysis?.message,
      });
      const field = document.getElementById('observation-text');
      if (field) {
        field.focus();
      }
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
      analysis.message = 'Looks observational! We’ll show suggestions in a moment.';
    } else if (issues.length) {
      analysis.message = 'Edit the highlighted language to keep it purely observational.';
    } else {
      analysis.message = 'Try naming when and where the moment happened.';
    }
  }

  state.analysis = analysis;
  renderAnalysis();

  if (analysis.ok && state.mode === 'editing' && !options.suppressAutoSubmit) {
    scheduleCompletion();
  } else {
    cancelCompletion();
  }
}

function renderAnalysis() {
  const feedback = document.getElementById('observation-feedback');
  const issuesList = document.getElementById('observation-issues');
  const submitButton = document.getElementById('observation-submit');
  const status = document.getElementById('observation-status');
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

  if (status) {
    if (analysis?.ok) {
      status.setAttribute('data-state', 'ready');
      status.textContent = '✓';
    } else {
      status.removeAttribute('data-state');
      status.textContent = '';
    }
  }

  if (editor) {
    editor.dataset.ready = analysis?.ok ? '1' : '0';
  }
}

function scheduleCompletion() {
  cancelCompletion();
  completionTimer = window.setTimeout(() => {
    completionTimer = null;
    if (state.analysis?.ok && state.mode === 'editing') {
      finalizeObservation();
    }
  }, SUBMIT_DELAY_MS);
}

function cancelCompletion() {
  if (completionTimer) {
    window.clearTimeout(completionTimer);
    completionTimer = null;
  }
}

function finalizeObservation() {
  cancelCompletion();
  const trimmed = state.analysis?.trimmed || state.text.trim();
  if (!trimmed) {
    return;
  }
  state.mode = 'results';
  state.lastSubmitted = trimmed;
  state.suggestions = buildSuggestions(trimmed);
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

  if (!feelingsHost || !needsHost || !whyHost || !preview) {
    return;
  }

  preview.textContent = state.lastSubmitted ? `“${state.lastSubmitted}”` : '';

  populateChipList(feelingsHost, feelingsEmpty, state.suggestions?.feelings || []);
  populateChipList(needsHost, needsEmpty, state.suggestions?.needs || []);

  const cueLabels = (state.suggestions?.cues || []).map(formatCueLabel).filter(Boolean);
  if (cueLabels.length) {
    whyHost.textContent = `${cueLabels.length > 1 ? 'Matched cues' : 'Matched cue'}: ${cueLabels.join(', ')}`;
  } else {
    whyHost.textContent = 'Suggestions are based on common observation patterns.';
  }
}

function populateChipList(container, emptyNode, items) {
  container.innerHTML = '';
  if (Array.isArray(items) && items.length) {
    items.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'chip';
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
