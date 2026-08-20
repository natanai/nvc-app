import {
  EMOTION_LIBRARY,
  FEELING_PAGE_SLUGS,
  FEELING_SLUG_ALIASES,
} from './alexithymia-support-data.js';

const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const MAX_MAGNETS = 18;
const COLLAPSED_MAGNETS = 5;
const MATCH_UPDATE_DELAY = 140;

const sliderStates = new Map();
let reverseIndex = null;
let canonicalSlugMap = null;
const feelingSlugSet = new Set(FEELING_PAGE_SLUGS);

const state = {
  values: new Map(),
  controlsRoot: null,
  magnetContainer: null,
  emptyState: null,
  headingLiveRegion: null,
  resultToggle: null,
  pinToggle: null,
  activeCueCount: null,
  lastResults: [],
  resultsExpanded: false,
  resultsPinned: true,
  matchUpdateTimer: null,
  magnetNodes: new Map(),
};

function getBasePath() {
  return document.body?.dataset?.basePath || '';
}

function getCanonicalSlugMap() {
  if (canonicalSlugMap) {
    return canonicalSlugMap;
  }
  const map = new Map();
  const sources = [];
  if (reverseIndex?._meta?.slugMap) {
    sources.push(reverseIndex._meta.slugMap);
  }
  sources.push(FEELING_SLUG_ALIASES);
  sources.forEach((source) => {
    Object.entries(source).forEach(([slug, key]) => {
      if (!map.has(key)) {
        map.set(key, slug);
      }
    });
  });
  canonicalSlugMap = map;
  return map;
}

async function loadReverseIndex() {
  if (reverseIndex) {
    return reverseIndex;
  }
  const basePath = getBasePath();
  const url = `${basePath}data/reverse-inference.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to load reverse inference data (${response.status})`);
    }
    const data = await response.json();
    reverseIndex = data;
    return data;
  } catch (error) {
    console.warn('[body-cues-tool] Failed to load reverse inference data', error);
    return null;
  }
}

function ready(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function describeSliderValue(value) {
  if (value <= 0) {
    return 'Off';
  }
  if (value < 35) {
    return `Hint · ${value}%`;
  }
  if (value < 70) {
    return `Noticeable · ${value}%`;
  }
  return `Strong · ${value}%`;
}

function createEl(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (typeof text === 'string') {
    element.textContent = text;
  }
  return element;
}

function updateActiveCueCount() {
  if (!state.activeCueCount) {
    return;
  }
  const count = state.values.size;
  state.activeCueCount.textContent = `${count} ${count === 1 ? 'cue' : 'cues'} selected`;
}

function updateSliderLabel(optionId, value) {
  const sliderState = sliderStates.get(optionId);
  if (!sliderState) {
    return;
  }
  const description = describeSliderValue(value);
  sliderState.label.textContent = description;
  sliderState.slider.setAttribute('aria-valuetext', description);
  sliderState.slider.style.setProperty('--cue-progress', `${value}%`);
  sliderState.container.toggleAttribute('data-active', value > 0);
}

function flushMatchUpdate() {
  if (state.matchUpdateTimer !== null) {
    window.clearTimeout(state.matchUpdateTimer);
    state.matchUpdateTimer = null;
  }
  updateMatches();
}

function scheduleMatchUpdate() {
  if (state.matchUpdateTimer !== null) {
    window.clearTimeout(state.matchUpdateTimer);
  }
  state.matchUpdateTimer = window.setTimeout(() => {
    state.matchUpdateTimer = null;
    updateMatches();
  }, MATCH_UPDATE_DELAY);
}

function onSliderInput(optionId, rawValue, { commit = false } = {}) {
  const numeric = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, Number(rawValue)));
  if (Number.isNaN(numeric)) {
    return;
  }
  if (numeric <= 0) {
    state.values.delete(optionId);
  } else {
    state.values.set(optionId, numeric / SLIDER_MAX);
  }
  updateSliderLabel(optionId, numeric);
  updateActiveCueCount();
  if (commit) {
    flushMatchUpdate();
  } else {
    scheduleMatchUpdate();
  }
}

function hydrateControls(root) {
  const containers = Array.from(root.querySelectorAll('.body-cues-tool__option[data-option-id]'));
  containers.forEach((container) => {
    const optionId = container.dataset.optionId;
    const slider = container.querySelector('.body-cues-tool__slider');
    const valueLabel = container.querySelector('.body-cues-tool__option-value');
    if (!optionId || !(slider instanceof HTMLInputElement) || !valueLabel) {
      return;
    }

    slider.addEventListener('input', (event) => {
      onSliderInput(optionId, event?.target?.value || '0');
    });
    slider.addEventListener('change', (event) => {
      onSliderInput(optionId, event?.target?.value || '0', { commit: true });
    });

    sliderStates.set(optionId, { slider, label: valueLabel, container });
  });
}

function getFeelingLabel(feelingKey) {
  const entry = EMOTION_LIBRARY[feelingKey];
  if (entry?.name) {
    return entry.name;
  }
  return feelingKey.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFeelingHref(feelingKey) {
  const map = getCanonicalSlugMap();
  const slug = map.get(feelingKey);
  if (!slug || !feelingSlugSet.has(slug)) {
    return null;
  }
  return `${getBasePath()}feelings/${slug}/`;
}

function formatPercent(value) {
  const rounded = Math.round(value);
  return `${rounded}%`;
}

function isMobileResultsLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
}

function getVisibleResultLimit() {
  if (isMobileResultsLayout()) {
    return MAX_MAGNETS;
  }
  return state.resultsExpanded ? MAX_MAGNETS : COLLAPSED_MAGNETS;
}

function resetMobileResultsScroll() {
  if (!isMobileResultsLayout() || !state.resultsPinned || !state.magnetContainer) {
    return;
  }
  window.requestAnimationFrame(() => {
    if (state.magnetContainer) {
      state.magnetContainer.scrollLeft = 0;
    }
  });
}

function createMagnetNode(result) {
  const href = getFeelingHref(result.key);
  const magnet = createEl(href ? 'a' : 'span', 'body-cues-tool__magnet');
  magnet.dataset.feelingKey = result.key;

  if (href) {
    magnet.href = href;
    magnet.title = `Open the ${result.label} page`;
  } else {
    magnet.classList.add('body-cues-tool__magnet--inactive');
    magnet.setAttribute('aria-disabled', 'true');
  }

  const label = createEl('span', 'body-cues-tool__magnet-text');
  const percent = createEl('span', 'body-cues-tool__magnet-percent');
  magnet.appendChild(label);
  magnet.appendChild(percent);
  magnet._bodyCueLabel = label;
  magnet._bodyCuePercent = percent;
  return magnet;
}

function updateResultToggle(totalResults) {
  if (!state.resultToggle) {
    return;
  }

  if (isMobileResultsLayout()) {
    state.resultToggle.hidden = true;
    state.resultToggle.setAttribute('aria-expanded', 'true');
    return;
  }

  const cappedTotal = Math.min(totalResults, MAX_MAGNETS);
  const hiddenCount = Math.max(0, cappedTotal - COLLAPSED_MAGNETS);
  state.resultToggle.hidden = hiddenCount === 0;
  state.resultToggle.textContent = state.resultsExpanded
    ? 'Show fewer matches'
    : `Show ${hiddenCount} more ${hiddenCount === 1 ? 'match' : 'matches'}`;
  state.resultToggle.setAttribute('aria-expanded', String(state.resultsExpanded));
}

function updateMagnets(results) {
  if (!state.magnetContainer) {
    return;
  }

  state.lastResults = results;
  const instructions = state.emptyState;

  if (!results.length) {
    state.resultsExpanded = false;
    state.magnetContainer.dataset.empty = 'true';
    state.magnetContainer.dataset.expanded = 'false';
    if (instructions) {
      instructions.hidden = false;
    }
    state.magnetNodes.forEach((node) => {
      node.hidden = true;
    });
    updateResultToggle(0);
    resetMobileResultsScroll();
    return;
  }

  state.magnetContainer.dataset.empty = 'false';
  state.magnetContainer.dataset.expanded = String(
    isMobileResultsLayout() ? true : state.resultsExpanded,
  );
  if (instructions) {
    instructions.hidden = true;
  }

  const limit = getVisibleResultLimit();
  const visibleResults = results.slice(0, limit);
  const visibleKeys = new Set(visibleResults.map((result) => result.key));

  state.magnetNodes.forEach((node, key) => {
    node.hidden = !visibleKeys.has(key);
    node.classList.remove('is-top-match');
  });

  visibleResults.forEach((result, index) => {
    let magnet = state.magnetNodes.get(result.key);
    if (!magnet) {
      magnet = createMagnetNode(result);
      state.magnetNodes.set(result.key, magnet);
    }

    magnet.hidden = false;
    magnet.classList.toggle('is-top-match', index === 0);
    magnet._bodyCueLabel.textContent = result.label;
    magnet._bodyCuePercent.textContent = formatPercent(result.percent);
    magnet.setAttribute(
      'aria-label',
      `${result.label}, ${formatPercent(result.percent)} of the current match weight${
        getFeelingHref(result.key) ? '. Open feeling page.' : ''
      }`,
    );

    state.magnetContainer.appendChild(magnet);
  });

  updateResultToggle(results.length);
  resetMobileResultsScroll();
}

function computeMatches() {
  const data = reverseIndex;
  if (!data) {
    return [];
  }
  const matches = [];
  const keys = Object.keys(data);
  const sliderCount = state.values.size;
  if (!sliderCount) {
    return [];
  }
  let totalScore = 0;

  keys.forEach((key) => {
    if (key === '_meta') {
      return;
    }
    const entry = data[key];
    if (!entry?.bodyCues?.length) {
      return;
    }
    let score = 0;
    entry.bodyCues.forEach((cue) => {
      const value = state.values.get(cue.optionId) || 0;
      if (value <= 0) {
        return;
      }
      const weight = Number(cue.relativeWeight);
      if (!Number.isFinite(weight) || weight <= 0) {
        return;
      }
      score += weight * value;
    });
    if (score <= 0) {
      return;
    }
    totalScore += score;
    matches.push({
      key,
      entry,
      score,
    });
  });

  if (!matches.length || totalScore <= 0) {
    return [];
  }

  matches.forEach((match) => {
    match.percent = (match.score / totalScore) * 100;
    match.label = getFeelingLabel(match.key);
  });

  matches.sort((a, b) => {
    if (b.percent === a.percent) {
      return a.label.localeCompare(b.label);
    }
    return b.percent - a.percent;
  });

  return matches;
}

function updateMatches() {
  const matches = computeMatches();
  updateMagnets(matches);
  if (state.headingLiveRegion) {
    if (!matches.length) {
      state.headingLiveRegion.textContent = 'Adjust a cue below to see possible feelings.';
    } else {
      const shown = Math.min(getVisibleResultLimit(), matches.length);
      state.headingLiveRegion.textContent = `${shown} strongest ${shown === 1 ? 'match' : 'matches'} shown`;
    }
  }
}

function resetAllSliders() {
  sliderStates.forEach(({ slider }, optionId) => {
    slider.value = String(SLIDER_MIN);
    updateSliderLabel(optionId, SLIDER_MIN);
  });
  state.values.clear();
  state.resultsExpanded = false;
  updateActiveCueCount();
  flushMatchUpdate();
}

function setupResultToggle(root) {
  const toggle = root.querySelector('[data-body-cues-result-toggle]');
  if (!toggle || !state.magnetContainer) {
    return;
  }

  toggle.addEventListener('click', () => {
    if (isMobileResultsLayout()) {
      return;
    }
    state.resultsExpanded = !state.resultsExpanded;
    updateMagnets(state.lastResults);
    if (state.headingLiveRegion && state.lastResults.length) {
      const shown = Math.min(getVisibleResultLimit(), state.lastResults.length);
      state.headingLiveRegion.textContent = `${shown} strongest ${shown === 1 ? 'match' : 'matches'} shown`;
    }
  });
  state.resultToggle = toggle;
}

function setupPinToggle(root) {
  const summaryPanel = root.querySelector('.body-cues-tool__summary-panel');
  const toggle = root.querySelector('[data-body-cues-pin-toggle]');
  if (!summaryPanel || !toggle) {
    return;
  }

  state.resultsPinned = summaryPanel.dataset.pinned !== 'false';
  const syncToggle = () => {
    summaryPanel.dataset.pinned = String(state.resultsPinned);
    toggle.setAttribute('aria-pressed', String(state.resultsPinned));
    const label = state.resultsPinned ? 'Unpin possible feelings' : 'Pin possible feelings';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  };

  syncToggle();
  toggle.addEventListener('click', () => {
    state.resultsPinned = !state.resultsPinned;
    syncToggle();
    if (state.resultsPinned) {
      resetMobileResultsScroll();
    }
  });

  state.pinToggle = toggle;
}

function setupControlsScrollAffordance(root) {
  const controls = root.querySelector('[data-body-cues-controls]');
  const shell = root.querySelector('[data-body-cues-controls-shell]') || controls;
  if (!controls || !shell) {
    return;
  }

  const threshold = 4;
  let frame = null;

  const updateScrollState = () => {
    frame = null;
    const isScrollable = controls.scrollHeight > controls.clientHeight + threshold;
    shell.dataset.scrollable = isScrollable ? 'true' : 'false';

    if (!isScrollable) {
      shell.dataset.scrollPosition = 'none';
      return;
    }

    const atTop = controls.scrollTop <= threshold;
    const atBottom =
      controls.scrollTop + controls.clientHeight >= controls.scrollHeight - threshold;

    if (atTop) {
      shell.dataset.scrollPosition = 'top';
    } else if (atBottom) {
      shell.dataset.scrollPosition = 'bottom';
    } else {
      shell.dataset.scrollPosition = 'middle';
    }
  };

  const scheduleUpdate = () => {
    if (frame !== null) {
      return;
    }
    frame = window.requestAnimationFrame(updateScrollState);
  };

  controls.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(controls);
    observer.observe(shell);
    shell._bodyCuesScrollAffordanceObserver = observer;
  }

  scheduleUpdate();
}

function initTool(root) {
  state.controlsRoot = root.querySelector('[data-body-cues-controls]');
  state.magnetContainer = root.querySelector('[data-body-cues-magnets]');
  state.emptyState = root.querySelector('[data-body-cues-empty]');
  state.headingLiveRegion = root.querySelector('[data-body-cues-live]');
  const resetButton = root.querySelector('[data-body-cues-reset]');
  state.activeCueCount = root.querySelector('[data-body-cues-active-count]');

  if (!state.controlsRoot || !state.magnetContainer) {
    return;
  }

  setupPinToggle(root);
  setupResultToggle(root);

  if (resetButton) {
    resetButton.addEventListener('click', resetAllSliders);
  }

  hydrateControls(state.controlsRoot);
  updateActiveCueCount();
  setupControlsScrollAffordance(root);
}

ready(async () => {
  const root = document.querySelector('[data-body-cues-root]');
  if (!root) {
    return;
  }

  initTool(root);
  const data = await loadReverseIndex();
  if (!data) {
    const error = root.querySelector('[data-body-cues-error]');
    if (error) {
      error.hidden = false;
    }
    if (state.emptyState) {
      state.emptyState.hidden = true;
    }
    return;
  }
  updateMatches();
});