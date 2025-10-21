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
  detectionFallbacks: 0,
  detectionFallbackQueue: [],
  detectionSource: '',
  cueHighlightRanges: [],
  detectionMatchLimit: 1,
  detectionNearLimit: 6,
  validityStatus: 'idle',
  validityMessage: 'Matches not requested yet.',
  fallback: createFallbackState(),
  scrolledToSuggestions: false,
};

let guideNavigationBound = false;

const SUGGESTION_BASE_PATHS = {
  feeling: '../feelings/',
  need: '../needs/',
};

const SUGGESTION_SLUG_PATTERN = /^[a-z0-9-]+$/i;

const DETECTION_BASE_PATHS = {
  feeling: '../feelings/',
  need: '../needs/',
  fauxFeeling: '../faux-feelings/',
};

const DETECTION_LABELS = {
  feeling: { singular: 'feeling word', plural: 'feeling words' },
  need: { singular: 'need word', plural: 'need words' },
  fauxFeeling: { singular: 'story word', plural: 'story words' },
};

const DETECTION_MIN_WORDS = 3;
const DETECTION_MATCH_LIMIT = 1;
const DETECTION_NEAR_LIMIT = 6;

const OBSERVATION_GUIDELINE_INTRO = 'Use these anchors to keep your statement observational.';
const OBSERVATION_GUIDELINE_NOTE =
  'Need a refresher? Visit the <a href="#observation-guide-foundations" data-guide-target="observation-guide-foundations">full observation guide</a> below for principles, steps, and examples.';
const OBSERVATION_GUIDELINE_STEPS = [
  { title: 'Name the moment', description: 'Specify when and where it happened, and who was involved.' },
  { title: 'Describe sensory facts', description: 'Report what a camera or microphone would capture.' },
  { title: 'Remove judgments', description: 'Swap labels, motives, and generalisations for concrete actions.' },
  { title: 'Quantify & quote', description: 'Use numbers or direct quotes to keep the scene verifiable.' },
  {
    title: 'Optional gap',
    description: 'Mention what you expected while keeping feelings and needs for the next step.',
  },
];
const OBSERVATION_DETECTION_NOTE =
  'Magnets open the matching entry so you can work with feelings and needs right away.';

document.addEventListener('DOMContentLoaded', () => {
  bind();
  renderPanels();
  renderValidityStatus();
  renderDetectionStatus();
  renderSuggestions();
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
      state.scrolledToSuggestions = false;
      if (state.mode !== 'editing') {
        state.mode = 'editing';
        state.scrolledToSuggestions = false;
        renderPanels();
      }
      if (state.validityStatus === 'valid' || state.validityStatus === 'invalid' || state.validityStatus === 'error') {
        setValidityStatus('pending', 'Observation updated. See matches again when you’re ready.');
      }
      state.fallback = createFallbackState();
      analyze(state.text);
      renderSuggestions();
    });
  }

  const submit = document.getElementById('observation-submit');
  if (submit) {
    submit.addEventListener('click', () => {
      handlePrimaryAction();
    });
  }

  const clearButton = document.getElementById('observation-clear');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      handleClear();
    });
  }

  const fallbackStart = document.getElementById('observation-fallback-start');
  if (fallbackStart) {
    fallbackStart.addEventListener('click', () => {
      startFallbackSearch();
    });
  }

  bindGuideNavigation();
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
  updateDetectionStatus(source, trimmed);
  renderAnalysis();
  renderHighlight();
  renderDetectionStatus();
}

function renderAnalysis() {
  const issuesList = document.getElementById('observation-issues');
  const submitButton = document.getElementById('observation-submit');
  const editor = document.getElementById('observation-editor');

  const analysis = state.analysis;

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

  renderObservationGuidelines();
}

function renderObservationGuidelines() {
  const container = document.getElementById('observation-guidelines-body');
  if (!container) {
    return;
  }

  const host = document.getElementById('observation-guidelines');
  const groups = collectDetectionGroups(state.analysis?.lint);
  container.innerHTML = '';

  if (!groups.length) {
    if (host) {
      host.dataset.state = 'default';
    }
    container.appendChild(buildDefaultGuidelineContent());
    return;
  }

  if (host) {
    host.dataset.state = 'detected';
  }
  container.appendChild(buildDetectionGuidelineContent(groups));
}

function collectDetectionGroups(lint) {
  if (!lint) {
    return [];
  }

  const groups = [];

  const pushGroup = (kind, slugs) => {
    const entries = [];
    const seen = new Set();
    (slugs || []).forEach(slug => {
      const trimmed = typeof slug === 'string' ? slug.trim() : '';
      if (!trimmed) {
        return;
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const entry = createDetectionEntry(kind, trimmed);
      if (entry) {
        entries.push(entry);
      }
    });
    if (entries.length) {
      groups.push({ kind, entries });
    }
  };

  pushGroup('fauxFeeling', lint.fauxFeelings);
  pushGroup('feeling', lint.feelings);
  pushGroup('need', lint.needs);

  return groups;
}

function buildDefaultGuidelineContent() {
  const fragment = document.createDocumentFragment();
  const intro = document.createElement('p');
  intro.className = 'observation-editor__recipe-intro';
  intro.textContent = OBSERVATION_GUIDELINE_INTRO;
  fragment.appendChild(intro);

  const list = document.createElement('ol');
  list.className = 'observation-editor__recipe-list';
  OBSERVATION_GUIDELINE_STEPS.forEach(step => {
    const item = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = `${step.title}:`;
    item.appendChild(strong);
    item.appendChild(document.createTextNode(` ${step.description}`));
    list.appendChild(item);
  });
  fragment.appendChild(list);

  const note = document.createElement('p');
  note.className = 'observation-editor__recipe-note';
  note.innerHTML = OBSERVATION_GUIDELINE_NOTE;
  fragment.appendChild(note);

  return fragment;
}

function buildDetectionGuidelineContent(groups) {
  const fragment = document.createDocumentFragment();
  const summary = formatDetectionSummary(groups);
  const totalEntries = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const pronoun = totalEntries === 1 ? 'it' : 'them';

  const intro = document.createElement('p');
  intro.className = 'observation-editor__recipe-intro observation-editor__recipe-intro--detected';
  intro.textContent = summary
    ? `We spotted ${summary} in your observation. Jump straight to ${pronoun}?`
    : 'We spotted language from outside the observation. Jump straight to them?';
  fragment.appendChild(intro);

  groups.forEach(group => {
    const section = document.createElement('div');
    section.className = 'observation-editor__recipe-detection';

    const label = document.createElement('p');
    label.className = 'observation-editor__recipe-detection-label';
    const meta = DETECTION_LABELS[group.kind] || { singular: 'word', plural: 'words' };
    label.textContent = group.entries.length > 1
      ? `Detected ${meta.plural}:`
      : `Detected ${meta.singular}:`;
    section.appendChild(label);

    const magnets = document.createElement('div');
    magnets.className = 'observation-editor__recipe-magnets';
    group.entries.forEach(entry => {
      const magnet = createGuidelineMagnet(entry);
      if (magnet) {
        magnets.appendChild(magnet);
      }
    });
    section.appendChild(magnets);

    fragment.appendChild(section);
  });

  const note = document.createElement('p');
  note.className = 'observation-editor__recipe-note observation-editor__recipe-note--detected';
  note.textContent = OBSERVATION_DETECTION_NOTE;
  fragment.appendChild(note);

  return fragment;
}

function createGuidelineMagnet(entry) {
  if (!entry?.href) {
    return null;
  }

  const link = document.createElement('a');
  link.className = 'observation-editor__recipe-magnet';
  link.href = entry.href;
  if (entry.slug) {
    link.dataset.slug = entry.slug;
  }
  if (entry.kind) {
    link.dataset.kind = entry.kind;
  }

  const icon = document.createElement('span');
  icon.className = 'observation-editor__recipe-magnet-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🧲';
  link.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'observation-editor__recipe-magnet-label';
  label.textContent = entry.title || formatTitle(entry.slug || '');
  link.appendChild(label);

  return link;
}

function createDetectionEntry(kind, slug) {
  const normalized = typeof slug === 'string' ? slug.trim() : '';
  if (!normalized) {
    return null;
  }

  const title = resolveDetectionTitle(kind, normalized) || formatTitle(normalized);
  const base = DETECTION_BASE_PATHS[kind];
  if (!base || !title) {
    return null;
  }

  return {
    kind,
    slug: normalized,
    title,
    href: `${base}${encodeURIComponent(normalized)}/`,
  };
}

function resolveDetectionTitle(kind, slug) {
  switch (kind) {
    case 'feeling':
      return resolveFeelingTitle(slug);
    case 'need':
      return resolveNeedTitle(slug);
    case 'fauxFeeling':
      return resolveFauxFeelingTitle(slug);
    default:
      return formatTitle(slug);
  }
}

function formatDetectionSummary(groups) {
  const parts = (groups || []).map(group => {
    const meta = DETECTION_LABELS[group.kind] || { singular: 'word', plural: 'words' };
    if (group.entries.length > 1) {
      return meta.plural;
    }
    const singular = meta.singular || 'word';
    return singular.startsWith('a ') ? singular : `a ${singular}`;
  }).filter(Boolean);
  return formatNaturalList(parts);
}

function finalizeObservation() {
  const trimmed = state.analysis?.trimmed || state.text.trim();
  if (!trimmed) {
    return;
  }
  state.mode = 'results';
  state.scrolledToSuggestions = false;
  state.lastSubmitted = trimmed;
  const direct = buildSuggestions(trimmed);
  state.directSuggestions = direct;
  const hasDirect = hasSuggestions(direct);
  state.fallback = createFallbackState();
  state.fallback.shouldPrompt = !hasDirect;
  if (!hasDirect && state.detectionStatus === 'near') {
    const fallbackQueue = state.detectionSource === trimmed
      ? (state.detectionFallbackQueue || [])
      : computeFallbackQueue(trimmed);
    if (state.detectionSource !== trimmed) {
      state.detectionFallbackQueue = fallbackQueue;
      state.detectionFallbacks = fallbackQueue.length;
      state.detectionSource = trimmed;
      renderDetectionStatus();
    }
    if (fallbackQueue.length) {
      applyFallbackQueue(fallbackQueue, {
        message: fallbackQueue.length > 1
          ? 'No exact cue matches detected. Showing the nearest matches we could find.'
          : 'No exact cue matches detected. Showing the nearest match we could find.',
      });
    }
  }
  renderPanels();
  renderSuggestions();
}

function renderPanels() {
  const editorSection = document.getElementById('observation-editor');
  const suggestionSection = document.getElementById('observation-suggestions');
  if (editorSection) {
    editorSection.dataset.mode = state.mode || 'editing';
  }
  if (!suggestionSection) {
    return;
  }
  suggestionSection.dataset.mode = state.mode || 'editing';
  suggestionSection.removeAttribute('hidden');
  if (state.mode === 'results') {
    if (!state.scrolledToSuggestions) {
      state.scrolledToSuggestions = true;
      const scrollTarget = () => {
        suggestionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scrollTarget);
      } else {
        scrollTarget();
      }
    }
  } else {
    state.scrolledToSuggestions = false;
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
  const actionButton = document.getElementById('observation-submit');
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
        ? 'Showing the nearest matches our detector can offer.'
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
      whyHost.textContent = 'Our detector didn’t find direct matches. Browse every feeling and need or ask for the closest match.';
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

  if (actionButton) {
    const hasNextFallback = fallbackActive && state.fallback.queue.length > 1;
    if (hasNextFallback) {
      actionButton.textContent = 'Next match';
      actionButton.dataset.action = 'next';
      actionButton.disabled = false;
    } else {
      actionButton.textContent = 'See matches';
      actionButton.dataset.action = 'submit';
      actionButton.disabled = !state.analysis?.ok;
    }
  }
}

function populateChipList(container, emptyNode, items) {
  container.innerHTML = '';
  const entries = Array.isArray(items) ? items.map(normalizeSuggestionItem).filter(Boolean) : [];
  if (entries.length) {
    entries.forEach(entry => {
      const element = entry.href ? document.createElement('a') : document.createElement('span');
      element.className = 'observation-chip';
      element.setAttribute('role', 'listitem');
      element.textContent = entry.title;
      if (entry.href) {
        element.href = entry.href;
      }
      if (entry.slug) {
        element.dataset.suggestionSlug = entry.slug;
      }
      if (entry.kind) {
        element.dataset.suggestionKind = entry.kind;
      }
      container.appendChild(element);
    });
    if (emptyNode) {
      emptyNode.setAttribute('hidden', 'hidden');
    }
  } else if (emptyNode) {
    emptyNode.removeAttribute('hidden');
  }
}

function normalizeSuggestionItem(item) {
  if (!item) {
    return null;
  }
  if (typeof item === 'string') {
    const title = item.trim();
    return title ? { title, href: '', slug: '', kind: '' } : null;
  }
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) {
    return null;
  }
  const href = typeof item.href === 'string' ? item.href : '';
  const slug = typeof item.slug === 'string' ? item.slug : '';
  const kind = typeof item.kind === 'string' ? item.kind : '';
  return { title, href, slug, kind };
}

function buildIssueList(lint) {
  if (!lint) {
    return [];
  }
  const issues = [];
  if (lint.evaluationMarkers?.length) {
    const entry = formatIssue(
      'Evaluation words',
      lint.evaluationMarkers,
      'Swap judgments for what a camera would capture (quotes, actions, counts).',
    );
    if (entry) {
      issues.push(entry);
    }
  }
  if (lint.agentiveMarkers?.length) {
    const entry = formatIssue(
      'Interpretations to revisit',
      lint.agentiveMarkers,
      'Stick with what happened without adding cause-and-effect language.',
    );
    if (entry) {
      issues.push(entry);
    }
  }
  if (Array.isArray(lint.flaggedGroups)) {
    lint.flaggedGroups.forEach(group => {
      if (group?.matches?.length) {
        const entry = formatIssue(group.label || 'Flagged language', group.matches, group.advice);
        if (entry) {
          issues.push(entry);
        }
      }
    });
  }
  if (lint.fauxFeelings?.length) {
    const entry = formatIssue(
      'Story words',
      lint.fauxFeelings,
      'Name the observable action or quote instead of story shorthand.',
    );
    if (entry) {
      issues.push(entry);
    }
  }
  if (lint.feelings?.length) {
    const entry = formatIssue(
      'Feeling words',
      lint.feelings,
      'Save feelings for the next step; the observation just covers what happened.',
    );
    if (entry) {
      issues.push(entry);
    }
  }
  if (lint.needs?.length) {
    const entry = formatIssue(
      'Need words',
      lint.needs,
      'Needs come after the observation—focus on the concrete moment first.',
    );
    if (entry) {
      issues.push(entry);
    }
  }
  return issues;
}

function formatIssue(label, tokens, advice) {
  const parts = [];
  const trimmedLabel = typeof label === 'string' ? label.trim() : '';
  if (trimmedLabel) {
    parts.push(trimmedLabel);
  }
  const quoted = formatQuotedList(tokens);
  if (quoted) {
    parts.push(quoted);
  }
  const trimmedAdvice = typeof advice === 'string' ? advice.trim() : '';
  if (trimmedAdvice) {
    parts.push(trimmedAdvice);
  }
  return parts.join(' — ') || '';
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
    return createEmptySuggestionSet();
  }
  const suggestion = suggestFromObservation(text, state.cues || [], 8);
  return {
    feelings: buildSuggestionEntries(suggestion.feelings, 'feeling'),
    needs: buildSuggestionEntries(suggestion.needs, 'need'),
    cues: suggestion.why || [],
  };
}

function buildSuggestionEntries(slugs, kind) {
  if (!Array.isArray(slugs)) {
    return [];
  }
  const seen = new Set();
  const entries = [];
  slugs.forEach(slug => {
    const entry = createSuggestionEntry(kind, slug);
    if (!entry) {
      return;
    }
    const dedupeKey = entry.slug || entry.title;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    entries.push(entry);
  });
  return entries;
}

function createSuggestionEntry(kind, slug) {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (!trimmed || !SUGGESTION_SLUG_PATTERN.test(trimmed)) {
    return null;
  }
  const title = kind === 'feeling' ? resolveFeelingTitle(trimmed) : resolveNeedTitle(trimmed);
  if (!title) {
    return null;
  }
  const base = SUGGESTION_BASE_PATHS[kind];
  if (!base) {
    return null;
  }
  const encodedSlug = encodeURIComponent(trimmed);
  return {
    slug: trimmed,
    title,
    href: `${base}${encodedSlug}/`,
    kind,
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

function resolveFauxFeelingTitle(slug) {
  const entry = state.catalog?.fauxFeelings?.get?.(slug);
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

function formatNaturalList(items) {
  const values = (items || [])
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  if (!values.length) {
    return '';
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
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

function applyFallbackQueue(queue, options = {}) {
  const results = Array.isArray(queue) ? queue : [];
  state.fallback.queue = results;
  state.fallback.index = 0;
  state.fallback.active = results.length > 0;
  state.fallback.running = false;
  state.fallback.shouldPrompt = Boolean(options.shouldPrompt);
  if (results.length) {
    const defaultMessage = results.length > 1
      ? 'Showing the nearest matches our detector can offer.'
      : 'Showing the nearest match our detector can offer.';
    state.fallback.message = options.message || defaultMessage;
  } else {
    state.fallback.message = options.emptyMessage ||
      'We couldn’t find a close match yet. Browse all feelings and needs below while we keep learning.';
  }
}

function hasSuggestions(set) {
  if (!set) {
    return false;
  }
  const feelingCount = Array.isArray(set.feelings) ? set.feelings.length : 0;
  const needCount = Array.isArray(set.needs) ? set.needs.length : 0;
  return feelingCount + needCount > 0;
}

function handlePrimaryAction() {
  if (state.mode === 'results' && state.fallback.active && state.fallback.queue.length > 1) {
    advanceFallback();
    return;
  }
  handleSubmit();
}

function handleSubmit() {
  const trimmed = state.text.trim();
  if (!trimmed) {
    setValidityStatus('error', 'Add concrete details before seeing matches.');
    analyze(state.text, { message: 'Start by anchoring your observation in time and place.' });
    return;
  }

  if (!state.analysis?.ok) {
    setValidityStatus('invalid', 'Observation still needs adjustments.');
    renderHighlight();
    return;
  }

  setValidityStatus('valid', 'Observation recorded. Review the suggestions below.');
  finalizeObservation();
}

function handleClear() {
  state.text = '';
  state.mode = 'editing';
  state.analysis = null;
  state.lastSubmitted = '';
  state.directSuggestions = createEmptySuggestionSet();
  state.fallback = createFallbackState();
  state.scrolledToSuggestions = false;
  state.cueHighlightRanges = [];

  const field = document.getElementById('observation-text');
  if (field) {
    field.value = '';
    field.focus();
  }

  analyze('');
  setValidityStatus('idle');
  renderPanels();
  renderSuggestions();
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
    applyFallbackQueue(queue);
    if (state.detectionSource === state.lastSubmitted) {
      state.detectionFallbackQueue = queue;
      state.detectionFallbacks = queue.length;
      if (!state.detectionMatches) {
        state.detectionStatus = queue.length ? 'near' : 'none';
      }
    }
    renderDetectionStatus();
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
      const feelings = buildSuggestionEntries(cue.feelings, 'feeling');
      const needs = buildSuggestionEntries(cue.needs, 'need');
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
    const key = `${entry.feelings.map(item => item.slug || item.title).join('|')}|${entry.needs.map(item => item.slug || item.title).join('|')}`;
    if (!key.trim()) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push({ feelings: entry.feelings, needs: entry.needs, cues: [] });
    if (results.length >= 6) {
      break;
    }
  }

  return results;
}

function countFlaggedTokens(lint) {
  if (!lint?.flaggedGroups?.length) {
    return 0;
  }
  return lint.flaggedGroups.reduce((sum, group) => sum + (group?.matches?.length || 0), 0);
}

function countWords(value) {
  if (!value) {
    return 0;
  }
  const matches = String(value).toLowerCase().match(/[a-z0-9'’]+/g);
  return matches ? matches.length : 0;
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

function updateDetectionStatus(rawInput, trimmedInput) {
  const sourceText = typeof rawInput === 'string' ? rawInput : '';
  const trimmed = typeof trimmedInput === 'string' ? trimmedInput : sourceText.trim();
  const lint = state.analysis?.lint || null;
  const flaggedCount = countFlaggedTokens(lint);
  const wordCount = countWords(trimmed);

  state.detectionMatchLimit = DETECTION_MATCH_LIMIT;
  state.detectionNearLimit = DETECTION_NEAR_LIMIT;
  state.detectionSource = trimmed;

  if (!state.cues.length) {
    state.detectionStatus = 'loading';
    state.detectionMatches = 0;
    state.detectionFallbacks = 0;
    state.detectionFallbackQueue = [];
    state.detectionSource = '';
    state.cueHighlightRanges = [];
    return;
  }
  if (!trimmed) {
    state.detectionStatus = 'idle';
    state.detectionMatches = 0;
    state.detectionFallbacks = 0;
    state.detectionFallbackQueue = [];
    state.detectionSource = '';
    state.cueHighlightRanges = [];
    return;
  }

  if (flaggedCount > 0) {
    state.detectionStatus = 'flagged';
    state.detectionMatches = 0;
    state.detectionFallbacks = 0;
    state.detectionFallbackQueue = [];
    state.cueHighlightRanges = [];
    return;
  }

  if (wordCount < DETECTION_MIN_WORDS) {
    state.detectionStatus = 'short';
    state.detectionMatches = 0;
    state.detectionFallbacks = 0;
    state.detectionFallbackQueue = [];
    state.cueHighlightRanges = [];
    return;
  }

  const suggestion = suggestFromObservation(trimmed, state.cues || [], 4);
  const hits = Array.isArray(suggestion.hits) ? suggestion.hits : [];
  state.cueHighlightRanges = buildCueHighlightRanges(sourceText, hits);
  state.detectionMatches = hits.length;
  if (state.detectionMatches > 0) {
    state.detectionStatus = 'match';
    state.detectionFallbacks = 0;
    state.detectionFallbackQueue = [];
    return;
  }

  if (!hits.length) {
    state.cueHighlightRanges = [];
  }
  const fallbackQueue = computeFallbackQueue(trimmed);
  state.detectionFallbackQueue = fallbackQueue;
  state.detectionFallbacks = fallbackQueue.length;
  state.detectionStatus = fallbackQueue.length ? 'near' : 'none';
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
  switch (status) {
    case 'idle':
      message = 'Language detector ready.';
      break;
    case 'short':
      message = `Add at least ${DETECTION_MIN_WORDS} words to start matching.`;
      break;
    case 'none':
      message = 'No cue matches detected yet.';
      break;
    case 'near': {
      message = 'Near matches detected.';
      break;
    }
    case 'match':
      message = state.detectionMatches > 1
        ? `${state.detectionMatches} exact cue matches detected.`
        : 'Exact cue match detected.';
      break;
    case 'flagged':
      message = 'Flagged language detected. Update your wording before matching.';
      break;
    default:
      break;
  }
  text.textContent = message;
  renderDetectionSummary();
}

function renderDetectionSummary() {
  const summary = document.getElementById('observation-detection-summary');
  const exactValue = document.getElementById('observation-detection-exact');
  const nearValue = document.getElementById('observation-detection-near');
  const note = document.getElementById('observation-detection-note');
  const coverage = document.getElementById('observation-detection-coverage');

  if (!summary) {
    return;
  }

  const status = state.detectionStatus || 'loading';
  const matchLimit = Math.max(Number(state.detectionMatchLimit) || DETECTION_MATCH_LIMIT, 1);
  const nearLimit = Math.max(Number(state.detectionNearLimit) || DETECTION_NEAR_LIMIT, 0);
  const cuesCount = Array.isArray(state.cues) ? state.cues.length : 0;

  let exactCount = 0;
  let nearCount = 0;
  if (status !== 'flagged' && status !== 'short' && status !== 'loading') {
    exactCount = Math.min(Number(state.detectionMatches) || 0, matchLimit);
    nearCount = Math.min(Number(state.detectionFallbacks) || 0, nearLimit || Number(state.detectionFallbacks) || 0);
  }

  if (exactValue) {
    exactValue.textContent = `${exactCount}/${matchLimit}`;
  }

  if (nearValue) {
    const denominator = nearLimit > 0 ? nearLimit : Math.max(nearLimit, nearCount, 0);
    nearValue.textContent = `${nearCount}/${denominator}`;
  }

  summary.setAttribute('data-state', status);

  if (note) {
    const limitMessage = nearLimit
      ? `We review up to ${nearLimit} nearest cues at a time to keep things focused.`
      : '';
    let message = '';
    switch (status) {
      case 'loading':
        message = 'Warming up the detector…';
        break;
      case 'idle':
        message = limitMessage
          ? `We’ll scan for cues as you type. ${limitMessage}`
          : 'We’ll scan for cues as you type.';
        break;
      case 'short':
        message = limitMessage
          ? `Add at least ${DETECTION_MIN_WORDS} words so we can start matching. ${limitMessage}`
          : `Add at least ${DETECTION_MIN_WORDS} words so we can start matching.`;
        break;
      case 'flagged':
        message = limitMessage
          ? 'Remove flagged language so we can search for matches. ' + limitMessage
          : 'Remove flagged language so we can search for matches.';
        break;
      case 'match':
        message = limitMessage
          ? `Exact matches are ready when you are. ${limitMessage}`
          : 'Exact matches are ready when you are.';
        break;
      case 'near':
        message = limitMessage || 'Nearest matches are queued when you need them.';
        break;
      case 'none':
        message = limitMessage
          ? `We didn’t spot an exact match yet. ${limitMessage}`
          : 'We didn’t spot an exact match yet.';
        break;
      default:
        message = limitMessage || 'We’re preparing the detector…';
        break;
    }

    if (status === 'match' && Number(state.detectionMatches) > matchLimit) {
      message = `${message} We surface the strongest exact match first.`;
    } else if (
      matchLimit === 1 &&
      (status === 'match' || status === 'near' || status === 'none')
    ) {
      message = `${message} We surface the strongest exact match first.`;
    }

    note.textContent = message.trim();
  }

  if (coverage) {
    if (cuesCount) {
      coverage.textContent = `Our detector currently covers ${cuesCount.toLocaleString()} cues.`;
      coverage.removeAttribute('hidden');
    } else {
      coverage.textContent = '';
      coverage.setAttribute('hidden', 'hidden');
    }
  }
}

function renderHighlight() {
  const host = document.getElementById('observation-highlight');
  if (!host) {
    return;
  }
  const text = state.text || '';
  const warnTokens = collectWarnHighlightTokens(state.analysis?.lint);
  const okTokens = collectPositiveHighlightTokens(state.analysis?.lint);
  const warnRanges = buildHighlightRanges(text, warnTokens).map(range => ({ ...range, tone: 'warn' }));
  const okRanges = buildHighlightRanges(text, okTokens).map(range => ({ ...range, tone: 'ok' }));
  const cueRanges = Array.isArray(state.cueHighlightRanges) ? state.cueHighlightRanges : [];
  host.innerHTML = buildHighlightMarkupFromRanges(text, [...warnRanges, ...okRanges, ...cueRanges]);
}

function collectWarnHighlightTokens(lint) {
  if (!lint) {
    return [];
  }
  const tokens = new Set();
  const addToken = value => {
    if (value) {
      tokens.add(String(value).trim());
    }
  };
  (lint.hits || []).forEach(addToken);
  (lint.flaggedGroups || []).forEach(group => {
    (group?.matches || []).forEach(match => {
      addToken(match);
    });
  });
  (lint.fauxFeelings || []).forEach(addToken);
  (lint.feelings || []).forEach(addToken);
  (lint.needs || []).forEach(addToken);
  return Array.from(tokens).filter(Boolean);
}

function collectPositiveHighlightTokens(lint) {
  if (!lint) {
    return [];
  }
  const tokens = new Set();
  (lint.observationHighlights || []).forEach(token => {
    if (token) {
      tokens.add(String(token).trim());
    }
  });
  return Array.from(tokens).filter(Boolean);
}

function buildHighlightMarkupFromRanges(text, ranges) {
  if (!text) {
    return '&nbsp;';
  }
  const normalized = normalizeHighlightRanges(ranges, text.length);
  if (!normalized.length) {
    return escapeHtml(text).replace(/\n/g, '<br />');
  }
  const breakpoints = new Set([0, text.length]);
  normalized.forEach(range => {
    breakpoints.add(range.start);
    breakpoints.add(range.end);
  });
  const sortedPoints = Array.from(breakpoints).sort((a, b) => a - b);
  let output = '';
  for (let i = 0; i < sortedPoints.length - 1; i += 1) {
    const start = sortedPoints[i];
    const end = sortedPoints[i + 1];
    if (start === end) {
      continue;
    }
    const segment = text.slice(start, end);
    const tone = resolveHighlightTone(normalized, start, end);
    const html = escapeHtml(segment).replace(/\n/g, '<br />');
    if (tone) {
      output += `<mark data-tone="${tone}">${html}</mark>`;
    } else {
      output += html;
    }
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

function buildCueHighlightRanges(text, hits) {
  if (!text || !Array.isArray(hits) || !hits.length) {
    return [];
  }
  const ranges = [];
  hits.forEach(hit => {
    if (!hit || !Array.isArray(hit.patterns)) {
      return;
    }
    hit.patterns.forEach(pattern => {
      const regex = toGlobalRegex(pattern);
      if (!regex) {
        return;
      }
      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0] || '';
        if (!matchedText) {
          regex.lastIndex += 1;
          continue;
        }
        const start = match.index;
        const end = start + matchedText.length;
        ranges.push({ start, end });
      }
    });
  });
  return mergeRanges(ranges).map(range => ({ ...range, tone: 'ok' }));
}

function toGlobalRegex(pattern) {
  if (!(pattern instanceof RegExp)) {
    return null;
  }
  const flags = pattern.flags && pattern.flags.includes('g') ? pattern.flags : `${pattern.flags || ''}g`;
  try {
    return new RegExp(pattern.source, flags);
  } catch (error) {
    return null;
  }
}

function normalizeHighlightRanges(ranges, length) {
  if (!Array.isArray(ranges) || !ranges.length) {
    return [];
  }
  return ranges
    .map(range => {
      const tone = typeof range.tone === 'string' ? range.tone.trim().toLowerCase() : '';
      let start = typeof range.start === 'number' ? range.start : Number(range.start);
      let end = typeof range.end === 'number' ? range.end : Number(range.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }
      start = Math.max(0, Math.min(length, start));
      end = Math.max(0, Math.min(length, end));
      if (end <= start || !tone) {
        return null;
      }
      return { start, end, tone };
    })
    .filter(Boolean)
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));
}

function resolveHighlightTone(ranges, start, end) {
  const active = ranges.filter(range => range.start < end && range.end > start);
  if (!active.length) {
    return '';
  }
  const priority = ['warn', 'ok'];
  for (let i = 0; i < priority.length; i += 1) {
    const tone = priority[i];
    if (active.some(range => range.tone === tone)) {
      return tone;
    }
  }
  return active[0].tone;
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

function bindGuideNavigation() {
  if (typeof document === 'undefined') {
    return;
  }

  if (guideNavigationBound) {
    return;
  }
  guideNavigationBound = true;

  initializeGuideTabs();
  document.addEventListener('click', handleGuideNavigationClick);

  if (typeof window !== 'undefined') {
    openGuideSectionFromHash();
    window.addEventListener('hashchange', openGuideSectionFromHash);
  }
}

function initializeGuideTabs() {
  if (typeof document === 'undefined') {
    return;
  }

  const host = document.getElementById('observation-guide');
  if (!host) {
    return;
  }

  const sections = Array.from(host.querySelectorAll('[data-guide-section]'));
  const tabs = Array.from(host.querySelectorAll('.observation-guide__tab[data-guide-target]'));
  if (!sections.length || !tabs.length) {
    return;
  }

  let activeSection = sections.find(section => section.classList.contains('is-active')) || sections[0];
  const activeId = activeSection ? activeSection.id : '';

  sections.forEach(section => {
    const isActive = section === activeSection;
    section.classList.toggle('is-active', isActive);
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    section.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) {
      section.removeAttribute('hidden');
    } else {
      section.setAttribute('hidden', 'hidden');
    }
  });

  tabs.forEach(tab => {
    const targetId = tab.getAttribute('data-guide-target');
    if (targetId) {
      tab.setAttribute('aria-controls', targetId);
      const panel = document.getElementById(targetId);
      if (panel) {
        if (!tab.id) {
          tab.id = `observation-guide-tab-${targetId}`;
        }
        panel.setAttribute('aria-labelledby', tab.id);
      }
    }
    const isActive = targetId === activeId;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  host.dataset.tabsReady = 'true';
}

function activateGuideSectionById(id) {
  if (!id || typeof document === 'undefined') {
    return null;
  }

  const host = document.getElementById('observation-guide');
  if (!host) {
    return null;
  }

  const sections = Array.from(host.querySelectorAll('[data-guide-section]'));
  if (!sections.length) {
    return null;
  }

  let activeSection = sections.find(section => section.id === id);
  if (!activeSection) {
    activeSection = sections[0] || null;
    if (activeSection) {
      id = activeSection.id;
    }
  }

  if (!activeSection) {
    return null;
  }

  sections.forEach(section => {
    const isActive = section === activeSection;
    section.classList.toggle('is-active', isActive);
    section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    section.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) {
      section.removeAttribute('hidden');
    } else {
      section.setAttribute('hidden', 'hidden');
    }
  });

  const tabs = Array.from(host.querySelectorAll('.observation-guide__tab[data-guide-target]'));
  tabs.forEach(tab => {
    const targetId = tab.getAttribute('data-guide-target');
    const isActive = targetId === id;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  return activeSection;
}

function handleGuideNavigationClick(event) {
  if (!event || typeof event.target === 'undefined') {
    return;
  }

  const target = typeof event.target.closest === 'function'
    ? event.target.closest('[data-guide-target]')
    : null;
  if (!target) {
    return;
  }

  const sectionId = target.getAttribute('data-guide-target');
  if (sectionId) {
    openGuideSection(sectionId);
  }
}

function openGuideSectionFromHash() {
  if (typeof window === 'undefined') {
    return;
  }
  const hash = window.location.hash || '';
  if (!hash || hash.length <= 1) {
    return;
  }
  openGuideSection(hash.slice(1));
}

function openGuideSection(id) {
  if (!id || typeof document === 'undefined') {
    return;
  }
  const host = document.getElementById('observation-guide');
  if (host && host.tagName && host.tagName.toLowerCase() === 'details' && !host.open) {
    host.open = true;
  }

  const section = activateGuideSectionById(id);
  if (!section) {
    return;
  }

  const tabId = section.getAttribute('aria-labelledby');
  if (tabId) {
    const tab = document.getElementById(tabId);
    if (tab && typeof tab.focus === 'function') {
      tab.focus();
    }
  }
}
