import { BODY_REGIONS, EMOTION_LIBRARY, FEELING_SLUG_ALIASES } from './alexithymia-support-data.js';

const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const MAX_MAGNETS = 18;

const sliderStates = new Map();
let reverseIndex = null;
let canonicalSlugMap = null;

const state = {
  values: new Map(),
  controlsRoot: null,
  magnetContainer: null,
  emptyState: null,
  headingLiveRegion: null,
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

function updateSliderLabel(optionId, value) {
  const sliderState = sliderStates.get(optionId);
  if (!sliderState) {
    return;
  }
  sliderState.label.textContent = describeSliderValue(value);
}

function onSliderInput(optionId, rawValue) {
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
  updateMatches();
}

function createSlider(option) {
  const container = createEl('div', 'body-cues-tool__option');
  container.dataset.optionId = option.id;

  const header = createEl('div', 'body-cues-tool__option-header');
  const title = createEl('h4', 'body-cues-tool__option-title', option.title);
  const valueLabel = createEl('span', 'body-cues-tool__option-value', 'Off');
  header.appendChild(title);
  header.appendChild(valueLabel);
  container.appendChild(header);

  if (option.note) {
    container.appendChild(createEl('p', 'body-cues-tool__option-note', option.note));
  }

  const inputWrapper = createEl('div', 'body-cues-tool__slider-wrapper');
  const slider = createEl('input', 'body-cues-tool__slider');
  slider.type = 'range';
  slider.min = String(SLIDER_MIN);
  slider.max = String(SLIDER_MAX);
  slider.step = '5';
  slider.value = String(SLIDER_MIN);
  slider.setAttribute('aria-label', `${option.title} intensity`);
  slider.addEventListener('input', (event) => {
    onSliderInput(option.id, event?.target?.value || '0');
  });
  inputWrapper.appendChild(slider);

  const scale = createEl('div', 'body-cues-tool__slider-scale');
  scale.appendChild(createEl('span', null, 'Off'));
  scale.appendChild(createEl('span', null, 'Strong'));
  inputWrapper.appendChild(scale);

  container.appendChild(inputWrapper);

  sliderStates.set(option.id, { slider, label: valueLabel });

  return container;
}

function buildControls(root) {
  const fragment = document.createDocumentFragment();

  BODY_REGIONS.forEach((region) => {
    const section = createEl('section', 'body-cues-tool__region');
    section.dataset.regionId = region.id;

    const heading = createEl('header', 'body-cues-tool__region-header');
    heading.appendChild(createEl('h3', 'body-cues-tool__region-title', region.label));
    if (region.prompt) {
      heading.appendChild(createEl('p', 'body-cues-tool__region-prompt', region.prompt));
    }
    section.appendChild(heading);

    const optionsList = createEl('div', 'body-cues-tool__options');
    region.options.forEach((option) => {
      optionsList.appendChild(createSlider(option));
    });
    section.appendChild(optionsList);
    fragment.appendChild(section);
  });

  root.appendChild(fragment);
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
  if (!slug) {
    return null;
  }
  return `${getBasePath()}feelings/${slug}/`;
}

function formatPercent(value) {
  const rounded = Math.round(value);
  return `${rounded}%`;
}

function updateMagnets(results) {
  if (!state.magnetContainer) {
    return;
  }
  const instructions = state.emptyState;
  Array.from(state.magnetContainer.children).forEach((child) => {
    if (!instructions || child !== instructions) {
      state.magnetContainer.removeChild(child);
    }
  });

  if (!results.length) {
    state.magnetContainer.setAttribute('data-empty', 'true');
    if (instructions) {
      instructions.hidden = false;
    }
    return;
  }

  state.magnetContainer.removeAttribute('data-empty');
  if (instructions) {
    instructions.hidden = true;
  }

  const fragment = document.createDocumentFragment();

  results.slice(0, MAX_MAGNETS).forEach((result) => {
    const magnet = createEl('span', 'pill body-cues-tool__magnet');
    const label = createEl(
      'span',
      'body-cues-tool__magnet-text',
      `${result.label} · ${formatPercent(result.percent)}`,
    );
    magnet.appendChild(label);
    const href = getFeelingHref(result.key);
    if (href) {
      magnet.setAttribute('data-href', href);
      magnet.tabIndex = 0;
      magnet.setAttribute('role', 'link');
      magnet.title = `Open the ${result.label} page`;
      magnet.addEventListener('click', () => {
        window.location.assign(href);
      });
      magnet.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.assign(href);
        }
      });
    } else {
      magnet.classList.add('body-cues-tool__magnet--inactive');
      magnet.setAttribute('aria-disabled', 'true');
      magnet.title = `${result.label} page unavailable`;
    }
    fragment.appendChild(magnet);
  });

  state.magnetContainer.appendChild(fragment);
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
      state.headingLiveRegion.textContent = '';
    } else {
      const top = matches[0];
      state.headingLiveRegion.textContent = `Top match: ${top.label} at ${formatPercent(top.percent)}`;
    }
  }
}

function resetAllSliders() {
  sliderStates.forEach(({ slider }, optionId) => {
    slider.value = String(SLIDER_MIN);
    updateSliderLabel(optionId, SLIDER_MIN);
  });
  state.values.clear();
  updateMatches();
}

function initTool(root) {
  state.controlsRoot = root.querySelector('[data-body-cues-controls]');
  state.magnetContainer = root.querySelector('[data-body-cues-magnets]');
  state.emptyState = root.querySelector('[data-body-cues-empty]');
  state.headingLiveRegion = root.querySelector('[data-body-cues-live]');
  const resetButton = root.querySelector('[data-body-cues-reset]');

  if (!state.controlsRoot || !state.magnetContainer) {
    return;
  }

  if (resetButton) {
    resetButton.addEventListener('click', resetAllSliders);
  }

  buildControls(state.controlsRoot);
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
