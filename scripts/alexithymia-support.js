import {
  EMOTION_CIRCUMPLEX,
  inferZoneFromSensations,
  mergeCompassAndInferredZone,
  calculateRejectionPenalty,
  normalizeScoresWithPenalty,
} from './alexithymia-support-logic.js';
import {
  BODY_OPTION_IDS,
  ZONE_COMBINATIONS,
  BODY_REGIONS as BODY_REGION_DATA,
  QUADRANT_SUGGESTIONS as QUADRANT_SUGGESTION_DATA,
  EMOTION_LIBRARY as EMOTION_LIBRARY_DATA,
} from './alexithymia-support-data.js';
import { REVIEW_DATE, EMOTION_EVIDENCE_MAP, EVIDENCE_REGISTRY } from './evidence-registry.js';

export {
  BODY_OPTION_IDS,
  ZONE_COMBINATIONS,
  BODY_REGIONS,
  QUADRANT_SUGGESTIONS,
  EMOTION_LIBRARY,
  FEELING_SLUG_ALIASES,
} from './alexithymia-support-data.js';
export { REVIEW_DATE, EMOTION_EVIDENCE_MAP, EVIDENCE_REGISTRY } from './evidence-registry.js';

(function () {
  if (typeof document === 'undefined') {
    return;
  }
  const steps = {
    intro: document.querySelector('[data-step="intro"]'),
    breathing: document.querySelector('[data-step="breathing"]'),
    body: document.querySelector('[data-step="body"]'),
    compass: document.querySelector('[data-step="compass"]'),
    library: document.querySelector('[data-step="library"]'),
    journal: document.querySelector('[data-step="journal"]'),
    regulation: document.querySelector('[data-step="regulation"]'),
    communication: document.querySelector('[data-step="communication"]'),
    closing: document.querySelector('[data-step="closing"]'),
  };

  const STEP_SEQUENCE = ['intro', 'breathing', 'body', 'compass', 'library', 'journal', 'regulation', 'communication', 'closing'];

  const basePath = document.body?.dataset?.basePath || '';

  const SENSATION_DEFAULT_INTENSITY = 5;
  const EVIDENCE_MODE_ENABLED = window.NVC_FLAGS?.evidenceMode !== false;
  const EVIDENCE_NOTE_KEY = 'nvc_evidence_note_dismissed';
  const REJECTION_KEY = 'nvc_rejected_emotions';

  const BODY_REGIONS = BODY_REGION_DATA;

  const BODY_SENSATION_OPTIONS = new Map();
  const REGION_OPTION_IDS = new Map();
  const sensationOptionElements = new Map();
  const regionElements = new Map();

  BODY_REGIONS.forEach((region) => {
    const ids = [];
    region.options.forEach((option) => {
      BODY_SENSATION_OPTIONS.set(option.id, {
        ...option,
        regionId: region.id,
        regionLabel: region.label,
      });
      ids.push(option.id);
    });
    REGION_OPTION_IDS.set(region.id, ids);
  });

  const QUADRANT_SUGGESTIONS = QUADRANT_SUGGESTION_DATA;


  const EMOTION_LIBRARY = EMOTION_LIBRARY_DATA;

  let rejectionFeedbackIdCounter = 0;

  const state = {
    selectedEmotion: null,
    quadrant: null,
    inferredQuadrant: null,
    compassQuadrant: null,
    activeTag: null,
    activeStep: STEP_SEQUENCE[0],
    compassTouched: false,
    energyValue: 0,
    valenceValue: 0,
    bodyCandidates: [],
    compassCandidates: [],
    candidateEmotions: [],
    preferredBreathPattern: 'slow_446',
    bodySuggestionMeta: null,
    compassSuggestionMeta: null,
    lastRejectedEmotion: null,
  };

  const startButton = steps.intro?.querySelector('[data-action="start"]');
  const breathingDisplay = document.querySelector('[data-breathing-display]');
  const breathingVisual = document.querySelector('[data-breathing-visual]');
  const bodySuggestions = document.querySelector('[data-body-suggestions]');
  const compassSuggestions = document.querySelector('[data-compass-suggestions]');
  const supportFlow = document.querySelector('.support-flow');
  const sensationRegionList = document.querySelector('[data-sensation-region-list]');
  const compassRoot = document.querySelector('[data-compass]');
  const emotionLibrary = document.querySelector('[data-emotion-library]');

  const regulationCard = document.querySelector('[data-regulation-card]');
  const communicationCard = document.querySelector('[data-communication-card]');
  let evidencePopover = null;
  let evidencePopoverContent = null;
  let evidencePopoverClose = null;
  let evidencePopoverOverlay = null;
  let evidencePopoverFocusReturn = null;

  let breathingTimer = null;

  function showOnlyStep(key) {
    const active = steps[key];
    if (!active) return;
    Object.entries(steps).forEach(([stepKey, node]) => {
      if (!node) return;
      const isActive = stepKey === key;
      node.classList.toggle('is-hidden', !isActive);
      node.classList.toggle('step-current', isActive);
    });
  }

  function focusStep(key) {
    const step = steps[key];
    if (step) {
      step.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function getStepIndex(key) {
    return STEP_SEQUENCE.indexOf(key);
  }

  function setControlButtonState(button, disabled) {
    if (!button) return;
    if (disabled) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }
  }

  function updateStepControls() {
    const index = getStepIndex(state.activeStep);
    const currentStep = steps[state.activeStep];
    if (!currentStep) return;
    const cta = currentStep.querySelector('[data-step-cta]');
    if (!cta) return;
    const backButton = cta.querySelector('[data-step-back]');
    const nextButton = cta.querySelector('[data-step-next]');
    const skipButton = cta.querySelector('[data-step-skip]');
    if (backButton) {
      const hideBack = index <= 0;
      backButton.hidden = hideBack;
      setControlButtonState(backButton, hideBack);
    }
    if (nextButton) {
      const hideNext = index >= STEP_SEQUENCE.length - 1;
      const waitingForCompass = state.activeStep === 'compass' && !state.compassTouched;
      const waitingForEmotion = state.activeStep === 'library' && !state.selectedEmotion;
      nextButton.hidden = hideNext;
      setControlButtonState(nextButton, hideNext || waitingForCompass || waitingForEmotion);
    }
    if (skipButton) {
      const disableSkip = index >= STEP_SEQUENCE.length - 1;
      setControlButtonState(skipButton, disableSkip);
    }
  }

  function goToStep(key, options = {}) {
    const step = steps[key];
    if (!step) return;
    state.activeStep = key;
    showOnlyStep(key);
    updateStepControls();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lane:stepchange', {
          detail: { step: key },
        })
      );
    }
    if (options.focus !== false) {
      focusStep(key);
    }
  }

  function advanceFromStep(current, { skip = false } = {}) {
    switch (current) {
      case 'intro':
        goToStep('breathing');
        break;
      case 'breathing':
        goToStep('body');
        break;
      case 'body':
        handleSensationSubmit();
        break;
      case 'compass':
        if (skip || state.compassTouched) {
          goToStep('library');
        } else {
          const board = compassRoot?.querySelector('.emotion-compass__board');
          board?.focus();
        }
        break;
      case 'library':
        goToStep('journal');
        break;
      case 'journal':
        goToStep('regulation');
        break;
      case 'regulation':
        goToStep('communication');
        break;
      case 'communication':
        goToStep('closing');
        break;
      default:
        break;
    }
  }

  function retreatFromStep(current) {
    switch (current) {
      case 'breathing':
        goToStep('intro');
        break;
      case 'body':
        goToStep('breathing');
        break;
      case 'compass':
        goToStep('body');
        break;
      case 'library':
        goToStep('compass');
        break;
      case 'journal':
        goToStep('library');
        break;
      case 'regulation':
        goToStep('journal');
        break;
      case 'communication':
        goToStep('regulation');
        break;
      case 'closing':
        goToStep('communication');
        break;
      default:
        break;
    }
  }

  function handleStart() {
    goToStep('breathing');
  }

  function handleStepCtaClick(event) {
    const button = event.target.closest('[data-step-back],[data-step-next],[data-step-skip]');
    if (!button || button.disabled) return;
    const stepArticle = button.closest('[data-step]');
    const stepKey = stepArticle?.dataset?.step;
    if (!stepKey || stepKey !== state.activeStep) return;
    event.preventDefault();
    if (button.hasAttribute('data-step-back')) {
      retreatFromStep(stepKey);
    } else if (button.hasAttribute('data-step-skip')) {
      advanceFromStep(stepKey, { skip: true });
    } else if (button.hasAttribute('data-step-next')) {
      advanceFromStep(stepKey);
    }
  }

  const BREATH_PATTERNS = {
    slow_446: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold softly', seconds: 4 },
      { label: 'Exhale slowly', seconds: 6 },
      { label: 'Rest', seconds: 2 },
    ],
    physiological_sigh: [
      { label: 'Inhale', seconds: 2 },
      { label: 'Top-off inhale', seconds: 1 },
      { label: 'Long exhale', seconds: 6 },
      { label: 'Rest', seconds: 1 },
    ],
    resonance_6bpm: [
      { label: 'Inhale', seconds: 5 },
      { label: 'Exhale', seconds: 5 },
    ],
  };

  const BREATH_PATTERN_LABELS = {
    slow_446: '4-4-6 breath',
    physiological_sigh: 'Physiological sigh',
    resonance_6bpm: 'Resonance breath (6 bpm)',
  };

  function resetBreathingVisual() {
    breathingVisual?.classList.remove('is-active');
    if (breathingDisplay) {
      breathingDisplay.textContent = 'Press start for a 30-second guided breath.';
    }
    if (breathingTimer) {
      clearInterval(breathingTimer);
      breathingTimer = null;
    }
  }

  function startBreathing(patternKey = 'slow_446') {
    if (!breathingDisplay || !breathingVisual) {
      goToStep('body');
      return;
    }
    if (breathingTimer) {
      clearInterval(breathingTimer);
      breathingTimer = null;
    }
    breathingVisual.classList.add('is-active');
    const sequence = BREATH_PATTERNS[patternKey] || BREATH_PATTERNS.slow_446;
    const label = BREATH_PATTERN_LABELS[patternKey] || 'Guided breath';
    state.preferredBreathPattern = patternKey;
    let elapsed = 0;
    let phaseIndex = 0;
    let remaining = sequence[phaseIndex].seconds;
    breathingDisplay.textContent = `${sequence[phaseIndex].label} • ${remaining}s`;

    breathingTimer = setInterval(() => {
      elapsed += 1;
      remaining -= 1;
      if (remaining <= 0) {
        phaseIndex = (phaseIndex + 1) % sequence.length;
        remaining = sequence[phaseIndex].seconds;
      }
      breathingDisplay.textContent = `${sequence[phaseIndex].label} • ${remaining}s`;
      if (elapsed >= 30) {
        clearInterval(breathingTimer);
        breathingTimer = null;
        breathingVisual.classList.remove('is-active');
        breathingDisplay.textContent = 'Breathing complete. Ready for the body check-in.';
        goToStep('body');
      }
    }, 1000);
  }

  function handleBreathingStart(event) {
    const pattern = event?.currentTarget?.dataset?.breathPattern || state.preferredBreathPattern || 'slow_446';
    startBreathing(pattern);
  }

  function skipBreathing() {
    resetBreathingVisual();
    goToStep('body');
  }

  function getRejections() {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    try {
      const raw = localStorage.getItem(REJECTION_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('Support lane: unable to read rejection history', error);
      return {};
    }
  }

  function setRejections(map) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(REJECTION_KEY, JSON.stringify(map));
    } catch (error) {
      console.warn('Support lane: unable to persist rejection history', error);
    }
  }

  function recordRejection(emotionKey) {
    if (!emotionKey) {
      return;
    }
    const map = getRejections();
    map[emotionKey] = (map[emotionKey] || 0) + 1;
    setRejections(map);
    state.lastRejectedEmotion = emotionKey;
  }

  function rejectionPenalty(emotionKey) {
    const map = getRejections();
    const count = map[emotionKey] || 0;
    return calculateRejectionPenalty(count);
  }

  function buildEmotionTag(emotionKey, { confidence = 0 } = {}) {
    const emotion = EMOTION_LIBRARY[emotionKey];
    const wrapper = document.createElement('div');
    wrapper.className = 'emotion-tag__wrapper';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emotion-tag';
    button.dataset.emotion = emotionKey;
    button.setAttribute('aria-pressed', state.selectedEmotion === emotionKey ? 'true' : 'false');
    if (Number.isFinite(confidence)) {
      button.dataset.confidence = confidence.toFixed(2);
      button.title = `Confidence: ${confidence.toFixed(2)}`;
    }
    button.textContent = emotion ? emotion.name : emotionKey;
    wrapper.appendChild(button);

    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'emotion-tag__reject';
    reject.dataset.emotionReject = emotionKey;
    reject.setAttribute('aria-label', `Reject ${emotion ? emotion.name : emotionKey}`);
    reject.textContent = 'Not it';
    wrapper.appendChild(reject);

    if (state.lastRejectedEmotion === emotionKey) {
      const sanitizedKey = String(emotionKey).replace(/[^a-z0-9_-]/gi, '-');
      const feedbackId = `emotion-reject-feedback-${sanitizedKey}-${rejectionFeedbackIdCounter++}`;
      wrapper.classList.add('emotion-tag__wrapper--rejected');
      button.classList.add('emotion-tag--rejected');
      reject.classList.add('emotion-tag__reject--recent');
      const feedback = document.createElement('span');
      feedback.className = 'emotion-tag__feedback';
      feedback.id = feedbackId;
      feedback.textContent = "We\u2019ll show this less.";
      wrapper.appendChild(feedback);
      reject.setAttribute('aria-describedby', feedbackId);
    }

    return wrapper;
  }

  function renderSuggestionBlock(container, title, message, emotionEntries, contextKeys = []) {
    if (!container) return;
    container.innerHTML = '';
    const headingWrap = document.createElement('div');
    headingWrap.className = 'emotion-suggestions__heading';

    const heading = document.createElement('h4');
    heading.className = 'emotion-suggestions__title';
    heading.textContent = title;
    headingWrap.appendChild(heading);

    if (EVIDENCE_MODE_ENABLED && contextKeys.length) {
      const whyButton = document.createElement('button');
      whyButton.type = 'button';
      whyButton.className = 'evidence-link';
      whyButton.textContent = 'Why these?';
      whyButton.dataset.evidenceTrigger = 'true';
      whyButton.dataset.evidenceKeys = contextKeys.join(',');
      headingWrap.appendChild(whyButton);
    }

    container.appendChild(headingWrap);

    if (message) {
      const para = document.createElement('p');
      para.className = 'support-note';
      para.textContent = message;
      container.appendChild(para);
    }

    if (!emotionEntries || !emotionEntries.length) {
      const none = document.createElement('p');
      none.className = 'support-note';
      none.textContent = 'No clear matches yet. That is okay—try the emotion compass or pick any word to explore.';
      container.appendChild(none);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'emotion-suggestions__list';
    emotionEntries.forEach(({ key, confidence = 0 }) => {
      const item = document.createElement('li');
      const tagWrapper = buildEmotionTag(key, { confidence });
      item.appendChild(tagWrapper);
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function evidenceKeyForQuadrant(quadrantKey) {
    if (!quadrantKey || typeof quadrantKey !== 'string') {
      return null;
    }
    const [arousal, valence] = quadrantKey.split('-');
    if (!arousal || !valence) {
      return null;
    }
    return `zone-${valence}-${arousal}`;
  }

  function quadrantKeyFromEvidenceKey(key) {
    if (!key || !key.startsWith('zone-')) {
      return null;
    }
    const [, valence, arousal] = key.split('-');
    if (!valence || !arousal) {
      return null;
    }
    return `${arousal}-${valence}`;
  }

  function updateCandidateSnapshot() {
    const combined = [...state.bodyCandidates, ...state.compassCandidates];
    const seen = new Map();
    combined.forEach(({ key, confidence }) => {
      if (!seen.has(key) || confidence > (seen.get(key)?.confidence ?? 0)) {
        seen.set(key, { key, confidence });
      }
    });
    state.candidateEmotions = Array.from(seen.values()).slice(0, 5);
  }

  function updateBreathingPatternFromZone() {
    const quadrantKey = state.quadrant;
    if (!quadrantKey) {
      state.preferredBreathPattern = 'slow_446';
      return;
    }
    const [arousal, valence] = quadrantKey.split('-');
    if ((valence === 'unpleasant' && (arousal === 'high' || arousal === 'medium'))) {
      state.preferredBreathPattern = 'physiological_sigh';
    } else if (arousal === 'high' && (valence === 'pleasant' || valence === 'neutral')) {
      state.preferredBreathPattern = 'resonance_6bpm';
    } else {
      state.preferredBreathPattern = 'slow_446';
    }
  }

  function getBreathingRecommendation() {
    const pattern = state.preferredBreathPattern || 'slow_446';
    const label = BREATH_PATTERN_LABELS[pattern] || 'guided breath';
    let summary = 'Try a steady 4-4-6 breath to invite calm and soften the edges.';
    if (pattern === 'physiological_sigh') {
      summary = 'Use a physiological sigh (double inhale, long exhale) to release high unpleasant activation.';
    } else if (pattern === 'resonance_6bpm') {
      summary = 'Resonance breathing (5s in, 5s out) steadies high energy while staying grounded.';
    }
    return { pattern, label, summary };
  }

  function refreshSuggestions() {
    if (state.bodySuggestionMeta) {
      const bodyEntries = state.bodySuggestionMeta.entries
        .map(({ key, baseScore }) => ({ key, score: baseScore * rejectionPenalty(key), baseScore }))
        .filter(({ score }) => score > 0);
      const normalizedBody = normalizeScoresWithPenalty(bodyEntries.map(({ key, score }) => ({ key, score })));
      const baseMap = new Map(state.bodySuggestionMeta.entries.map(({ key, baseScore }) => [key, baseScore]));
      const displayEntries = normalizedBody.map((entry) => ({
        ...entry,
        baseScore: baseMap.get(entry.key) ?? entry.score,
      }));
      renderSuggestionBlock(
        bodySuggestions,
        state.bodySuggestionMeta.title,
        state.bodySuggestionMeta.message,
        displayEntries,
        state.bodySuggestionMeta.contextKeys
      );
      state.bodyCandidates = displayEntries.slice(0, 5).map(({ key, confidence }) => ({ key, confidence }));
    }

    if (state.compassSuggestionMeta) {
      const compassEntries = state.compassSuggestionMeta.entries
        .map(({ key, baseScore }) => ({ key, score: baseScore * rejectionPenalty(key), baseScore }))
        .filter(({ score }) => score > 0);
      const normalizedCompass = normalizeScoresWithPenalty(compassEntries.map(({ key, score }) => ({ key, score })));
      const baseMap = new Map(state.compassSuggestionMeta.entries.map(({ key, baseScore }) => [key, baseScore]));
      const displayEntries = normalizedCompass.map((entry) => ({
        ...entry,
        baseScore: baseMap.get(entry.key) ?? entry.score,
      }));
      renderSuggestionBlock(
        compassSuggestions,
        state.compassSuggestionMeta.title,
        state.compassSuggestionMeta.message,
        displayEntries,
        state.compassSuggestionMeta.contextKeys
      );
      state.compassCandidates = displayEntries.slice(0, 5).map(({ key, confidence }) => ({ key, confidence }));
    }

    if (state.lastRejectedEmotion) {
      state.lastRejectedEmotion = null;
    }

    updateCandidateSnapshot();
  }

  if (typeof process !== 'undefined' && process.env?.NVC_TEST === '1') {
    globalThis.__NVC_SUPPORT_TESTS__ = {
      renderSuggestionBlock,
    };
  }

  function setChipState(button, pressed) {
    if (!button) return;
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.classList.toggle('is-active', pressed);
  }

  function clampIntensityValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return SENSATION_DEFAULT_INTENSITY;
    }
    return Math.max(0, Math.min(10, Math.round(numeric)));
  }

  function getSensationIntensity(optionId) {
    const elements = sensationOptionElements.get(optionId);
    if (!elements) {
      return SENSATION_DEFAULT_INTENSITY;
    }
    const rawValue = Number(elements.slider?.value ?? elements.defaultValue ?? SENSATION_DEFAULT_INTENSITY);
    return clampIntensityValue(rawValue);
  }

  function syncSensationIntensity(optionId, rawValue) {
    const elements = sensationOptionElements.get(optionId);
    if (!elements) {
      return SENSATION_DEFAULT_INTENSITY;
    }
    const clamped = clampIntensityValue(rawValue);
    if (elements.slider && Number(elements.slider.value) !== clamped) {
      elements.slider.value = String(clamped);
    }
    if (elements.output) {
      elements.output.textContent = String(clamped);
    }
    return clamped;
  }

  function updateRegionSummary(regionId) {
    const region = regionElements.get(regionId);
    if (!region) return;
    const optionIds = REGION_OPTION_IDS.get(regionId) || [];
    const selections = [];
    optionIds.forEach((optionId) => {
      const elements = sensationOptionElements.get(optionId);
      if (!elements) return;
      if (elements.button?.getAttribute('aria-pressed') !== 'true') {
        return;
      }
      const option = BODY_SENSATION_OPTIONS.get(optionId);
      if (!option) return;
      const intensity = getSensationIntensity(optionId);
      selections.push(`${option.title} (${intensity}/10)`);
    });
    if (!selections.length) {
      region.summary.textContent = '';
      region.summary.hidden = true;
      region.summary.dataset.hasSelection = 'false';
      return;
    }
    const display = selections.slice(0, 3).join(', ');
    region.summary.hidden = false;
    region.summary.textContent = selections.length === 1 ? `Noticing: ${display}.` : `Noticing: ${display}${
      selections.length > 3 ? '…' : ''
    }.`;
    region.summary.dataset.hasSelection = 'true';
  }

  function setRegionToggleState(regionId, { completed = false } = {}) {
    const region = regionElements.get(regionId);
    if (!region?.toggle) {
      return;
    }
    region.toggle.dataset.regionCompleted = completed ? 'true' : 'false';
    const label = completed ? `Review ${region.label} check-in` : `Check in: ${region.label}`;
    region.toggle.setAttribute('aria-label', label);
    region.toggle.title = label;
  }

  function setSensationState(optionId, active, { focusSlider = false, skipDraft = false } = {}) {
    const elements = sensationOptionElements.get(optionId);
    if (!elements) return;
    setChipState(elements.button, active);
    if (elements.wrapper) {
      elements.wrapper.classList.toggle('is-selected', active);
    }
    if (elements.intensity) {
      elements.intensity.hidden = !active;
    }
    if (elements.slider) {
      if (active) {
        elements.slider.disabled = false;
        syncSensationIntensity(optionId, elements.slider.value);
        if (focusSlider) {
          try {
            elements.slider.focus({ preventScroll: true });
          } catch (error) {
            // ignore focus errors
          }
        }
      } else {
        elements.slider.disabled = true;
        syncSensationIntensity(optionId, elements.defaultValue);
      }
    }
    const option = BODY_SENSATION_OPTIONS.get(optionId);
    if (option) {
      updateRegionSummary(option.regionId);
    }
    if (!skipDraft) {
    }
  }

  function getSelectedSensations() {
    const selections = [];
    sensationOptionElements.forEach((elements, optionId) => {
      if (!elements?.button) return;
      if (elements.button.getAttribute('aria-pressed') !== 'true') {
        return;
      }
      const option = BODY_SENSATION_OPTIONS.get(optionId);
      if (!option) return;
      const intensity = getSensationIntensity(optionId);
      selections.push({ id: optionId, intensity, option });
    });
    return selections;
  }

  function serializeSensationSelections(selections) {
    if (!Array.isArray(selections) || !selections.length) {
      return [];
    }
    return selections.map(({ id, intensity }) => `${id}:${clampIntensityValue(intensity)}`);
  }

  function handleSensationChoiceClick(event) {
    const toggle = event.target.closest('[data-region-toggle]');
    if (toggle) {
      event.preventDefault();
      const regionId = toggle.dataset.regionToggle;
      if (!regionId) {
        return;
      }
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        collapseRegion(regionId);
      } else {
        expandRegion(regionId, { focus: true });
      }
      return;
    }

    const closeButton = event.target.closest('[data-region-close]');
    if (closeButton) {
      event.preventDefault();
      const regionId = closeButton.dataset.regionClose;
      if (!regionId) {
        return;
      }
      setRegionToggleState(regionId, { completed: true });
      collapseRegion(regionId, { returnFocus: true });
      return;
    }

    const button = event.target.closest('[data-sensation]');
    if (!button) return;
    event.preventDefault();
    const optionId = button.dataset.sensation;
    if (!optionId) return;
    const pressed = button.getAttribute('aria-pressed') === 'true';
    setSensationState(optionId, !pressed, { focusSlider: !pressed });
  }

  function handleSensationIntensityInput(event) {
    const input = event.target;
    if (!input || !input.dataset || !input.dataset.sensationIntensity) {
      return;
    }
    const optionId = input.dataset.sensationIntensity;
    const option = BODY_SENSATION_OPTIONS.get(optionId);
    syncSensationIntensity(optionId, input.value);
    if (option) {
      updateRegionSummary(option.regionId);
    }
  }

  function handleSensationSubmit(event) {
    event?.preventDefault?.();
    const selections = getSelectedSensations();
    if (!selections.length) {
      state.bodySuggestionMeta = null;
      state.bodyCandidates = [];
      state.inferredQuadrant = null;
      state.quadrant = mergeCompassAndInferredZone(state.compassQuadrant, null);
      updateBreathingPatternFromZone();
      updateCandidateSnapshot();
      renderSuggestionBlock(
        bodySuggestions,
        'Body-based matches',
        'Try choosing a region and setting how strong the sensation feels. If nothing stands out, move on to the emotion compass.',
        []
      );
      goToStep('compass');
      return false;
    }

    const emotionScores = new Map();
    const notes = [];
    const contextKeys = new Set();

    selections.forEach(({ option, intensity }) => {
      if (!option) return;
      const safeIntensity = clampIntensityValue(intensity);
      notes.push(`• ${option.regionLabel}: ${option.title} (${safeIntensity}/10). ${option.insight}`);
      const intensityFactor = safeIntensity / 10;
      contextKeys.add(option.id);
      if (intensityFactor > 0) {
        Object.entries(option.emotions || {}).forEach(([emotionKey, weight]) => {
          const numericWeight = Number(weight);
          if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
            return;
          }
          const score = numericWeight * intensityFactor;
          emotionScores.set(emotionKey, (emotionScores.get(emotionKey) ?? 0) + score);
        });
      }
    });

    const inferredQuadrant = inferZoneFromSensations(selections);
    state.inferredQuadrant = inferredQuadrant;
    state.quadrant = mergeCompassAndInferredZone(state.compassQuadrant, inferredQuadrant);
    updateBreathingPatternFromZone();

    const scored = Array.from(emotionScores.entries())
      .filter(([, score]) => Number.isFinite(score) && score > 0)
      .map(([key, baseScore]) => {
        const penalizedScore = baseScore * rejectionPenalty(key);
        return { key, baseScore, score: penalizedScore };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    const normalized = normalizeScoresWithPenalty(scored.map(({ key, score }) => ({ key, score })));
    const baseMap = new Map(scored.map(({ key, baseScore }) => [key, baseScore]));
    const entries = normalized.map((entry) => ({
      ...entry,
      baseScore: baseMap.get(entry.key) ?? entry.score,
    }));

    entries.forEach(({ key }) => {
      contextKeys.add(`emotion-${key}`);
    });

    const zoneEvidenceKey = evidenceKeyForQuadrant(state.quadrant);
    if (zoneEvidenceKey) {
      contextKeys.add(zoneEvidenceKey);
    }

    const zoneLine = zoneEvidenceKey && QUADRANT_SUGGESTIONS[state.quadrant]
      ? `• Affective zone estimate: ${QUADRANT_SUGGESTIONS[state.quadrant].label}.`
      : '• Affective zone estimate: not clear yet (that’s okay).';

    const messageParts = [...notes, zoneLine, 'Use these as invitations, not rules.'];
    const message = messageParts.join(' ');

    state.bodyCandidates = entries.slice(0, 5).map(({ key, confidence }) => ({ key, confidence }));
    state.bodySuggestionMeta = {
      title: 'Body-based matches',
      message,
      contextKeys: Array.from(contextKeys),
      entries: scored.map(({ key, baseScore }) => ({ key, baseScore })),
    };

    renderSuggestionBlock(bodySuggestions, 'Body-based matches', message, entries, state.bodySuggestionMeta.contextKeys);
    updateCandidateSnapshot();
    goToStep('compass');
    return true;
  }

  function handleSensationClear() {
    sensationOptionElements.forEach((_, optionId) => {
      setSensationState(optionId, false, { skipDraft: true });
    });
    renderSuggestionBlock(
      bodySuggestions,
      'Body-based matches',
      'Body-based matches will appear here after you choose sensations and set their intensity.',
      []
    );
    state.bodySuggestionMeta = null;
    state.bodyCandidates = [];
    state.inferredQuadrant = null;
    state.quadrant = mergeCompassAndInferredZone(state.compassQuadrant, null);
    updateBreathingPatternFromZone();
    updateCandidateSnapshot();
    regionElements.forEach((_, regionId) => {
      collapseRegion(regionId);
      setRegionToggleState(regionId, { completed: false });
    });
  }

  function renderBodyRegions(container) {
    if (!container) return;
    container.innerHTML = '';
    sensationOptionElements.clear();
    regionElements.clear();

    BODY_REGIONS.forEach((region) => {
      const section = document.createElement('section');
      section.className = 'sensation-region';
      section.dataset.region = region.id;

      const header = document.createElement('div');
      header.className = 'sensation-region__header';

      const meta = document.createElement('div');
      meta.className = 'sensation-region__meta';

      const detailsId = `sensation-region-${region.id}-details`;

      const title = document.createElement('h4');
      title.className = 'sensation-region__title';
      title.textContent = region.label;
      meta.appendChild(title);

      const summary = document.createElement('p');
      summary.className = 'sensation-region__summary';
      summary.dataset.hasSelection = 'false';
      summary.dataset.defaultSummary = '';
      summary.textContent = '';
      summary.hidden = true;
      meta.appendChild(summary);

      header.appendChild(meta);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'support-button support-button--ghost sensation-region__toggle';
      toggle.dataset.regionToggle = region.id;
      toggle.dataset.regionCompleted = 'false';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', detailsId);
      toggle.setAttribute('aria-label', `Check in: ${region.label}`);
      toggle.title = `Check in: ${region.label}`;
      header.appendChild(toggle);

      section.appendChild(header);

      const details = document.createElement('div');
      details.className = 'sensation-region__details';
      details.dataset.regionDetails = region.id;
      details.hidden = true;
      details.id = detailsId;
      details.setAttribute('aria-hidden', 'true');

      if (region.prompt) {
        const prompt = document.createElement('p');
        prompt.className = 'sensation-region__prompt support-note support-note--subtle';
        prompt.textContent = region.prompt;
        details.appendChild(prompt);
      }

      const instructions = document.createElement('p');
      instructions.className = 'sensation-region__instructions support-note support-note--subtle';
      instructions.textContent = 'Tap the sensation that fits. A 0–10 slider will appear after you choose.';
      details.appendChild(instructions);

      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'sensation-region__options';
      details.appendChild(optionsContainer);

      region.options.forEach((option) => {
        const optionWrapper = document.createElement('div');
        optionWrapper.className = 'sensation-option';
        optionWrapper.dataset.sensationOption = option.id;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip chip--stacked';
        button.dataset.sensation = option.id;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', `${region.label}: ${option.title}`);

        const buttonTitle = document.createElement('span');
        buttonTitle.className = 'chip__title';
        buttonTitle.textContent = option.title;
        button.appendChild(buttonTitle);

        if (option.note) {
          const note = document.createElement('span');
          note.className = 'chip__note';
          note.textContent = option.note;
          button.appendChild(note);
        }

        optionWrapper.appendChild(button);

        const intensity = document.createElement('div');
        intensity.className = 'sensation-intensity';
        intensity.dataset.sensationIntensityContainer = option.id;
        intensity.hidden = true;
        const sliderId = `sensation-${option.id}-intensity`;
        const defaultValue = clampIntensityValue(option.defaultIntensity ?? SENSATION_DEFAULT_INTENSITY);

        const label = document.createElement('label');
        label.className = 'sensation-intensity__label';
        label.setAttribute('for', sliderId);
        label.textContent = 'Intensity (0–10)';
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'sensation-intensity__value';
        valueDisplay.dataset.intensityOutput = option.id;
        valueDisplay.textContent = String(defaultValue);
        label.appendChild(valueDisplay);
        intensity.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'sensation-intensity__slider';
        slider.id = sliderId;
        slider.name = sliderId;
        slider.min = '0';
        slider.max = '10';
        slider.step = '1';
        slider.value = String(defaultValue);
        slider.dataset.sensationIntensity = option.id;
        slider.disabled = true;
        slider.setAttribute('aria-label', `${option.title} intensity (0 to 10)`);
        intensity.appendChild(slider);

        const scale = document.createElement('div');
        scale.className = 'sensation-intensity__scale';
        const minLabel = document.createElement('span');
        minLabel.textContent = '0';
        const maxLabel = document.createElement('span');
        maxLabel.textContent = '10';
        scale.appendChild(minLabel);
        scale.appendChild(maxLabel);
        intensity.appendChild(scale);

        optionWrapper.appendChild(intensity);
        optionsContainer.appendChild(optionWrapper);

        sensationOptionElements.set(option.id, {
          wrapper: optionWrapper,
          button,
          slider,
          output: valueDisplay,
          defaultValue,
          regionId: region.id,
          intensity,
        });
      });

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'support-button support-button--ghost support-button--icon-label sensation-region__close';
      closeButton.dataset.regionClose = region.id;
      closeButton.dataset.supportIcon = 'check';
      closeButton.textContent = 'Done';
      details.appendChild(closeButton);

      section.appendChild(details);
      container.appendChild(section);

      regionElements.set(region.id, {
        element: section,
        summary,
        label: region.label,
        toggle,
        details,
      });
    });
  }

  function collapseRegion(regionId, { returnFocus = false } = {}) {
    const region = regionElements.get(regionId);
    if (!region) return;
    region.element?.classList.remove('sensation-region--open');
    if (region.details) {
      region.details.hidden = true;
      region.details.setAttribute('aria-hidden', 'true');
    }
    if (region.toggle) {
      region.toggle.setAttribute('aria-expanded', 'false');
      const completed = region.toggle.dataset.regionCompleted === 'true';
      const label = completed ? `Review ${region.label} check-in` : `Check in: ${region.label}`;
      region.toggle.setAttribute('aria-label', label);
      region.toggle.title = label;
      if (returnFocus) {
        try {
          region.toggle.focus({ preventScroll: true });
        } catch (error) {
          // ignore focus errors
        }
      }
    }
  }

  function expandRegion(regionId, { focus = false, collapseOthers = true } = {}) {
    const region = regionElements.get(regionId);
    if (!region) return;
    if (collapseOthers) {
      regionElements.forEach((_, otherId) => {
        if (otherId !== regionId) {
          collapseRegion(otherId);
        }
      });
    }
    if (region.details) {
      region.details.hidden = false;
      region.details.setAttribute('aria-hidden', 'false');
    }
    region.element?.classList.add('sensation-region--open');
    if (region.toggle) {
      region.toggle.setAttribute('aria-expanded', 'true');
      const label = `Close ${region.label} check-in`;
      region.toggle.setAttribute('aria-label', label);
      region.toggle.title = label;
    }
    if (focus && region.details) {
      const selected = region.details.querySelector('[data-sensation][aria-pressed="true"]');
      const firstButton = selected || region.details.querySelector('[data-sensation]');
      if (firstButton) {
        try {
          firstButton.focus({ preventScroll: true });
        } catch (error) {
          // ignore focus errors
        }
      }
    }
  }

  function restoreSensationSelections(serialized) {
    if (!Array.isArray(serialized) || !serialized.length) {
      sensationOptionElements.forEach((_, optionId) => {
        setSensationState(optionId, false, { skipDraft: true });
      });
      return;
    }
    const intensityMap = new Map();
    serialized.forEach((entry) => {
      if (typeof entry !== 'string') return;
      const [id, raw] = entry.split(':');
      if (!id || !BODY_SENSATION_OPTIONS.has(id)) return;
      intensityMap.set(id, clampIntensityValue(Number(raw)));
    });
    sensationOptionElements.forEach((_, optionId) => {
      if (!intensityMap.has(optionId)) {
        setSensationState(optionId, false, { skipDraft: true });
        return;
      }
      const value = intensityMap.get(optionId);
      setSensationState(optionId, true, { skipDraft: true });
      syncSensationIntensity(optionId, value);
      const option = BODY_SENSATION_OPTIONS.get(optionId);
      if (option) {
        updateRegionSummary(option.regionId);
      }
    });
  }

  function computeQuadrant(energy, valence) {
    if (!energy || !valence) return null;
    return `${energy}-${valence}`;
  }

  function handleCompassSelection(event) {
    const detail = event?.detail;
    if (!detail) return;
    if (typeof detail.energy === 'number') {
      state.energyValue = detail.energy;
    }
    if (typeof detail.valence === 'number') {
      state.valenceValue = detail.valence;
    }
    if (detail.userTriggered) {
      state.compassTouched = true;
      updateStepControls();
    }
    const quadrantKey = computeQuadrant(detail.energyKey, detail.valenceKey);
    state.compassQuadrant = quadrantKey;
    state.quadrant = mergeCompassAndInferredZone(quadrantKey, state.inferredQuadrant);
    updateBreathingPatternFromZone();
    if (!quadrantKey || !QUADRANT_SUGGESTIONS[quadrantKey]) {
      renderSuggestionBlock(
        compassSuggestions,
        'Emotion compass matches',
        'Pick one energy and one pleasantness option to see compass matches.',
        []
      );
      state.compassCandidates = [];
      state.compassSuggestionMeta = null;
      updateCandidateSnapshot();
      return;
    }
    const info = QUADRANT_SUGGESTIONS[quadrantKey];
    const baseEntries = info.emotions.map((key, index) => ({ key, baseScore: 1 / (index + 1) }));
    const scored = baseEntries
      .map(({ key, baseScore }) => ({ key, baseScore, score: baseScore * rejectionPenalty(key) }))
      .filter(({ score }) => score > 0);
    const normalized = normalizeScoresWithPenalty(scored.map(({ key, score }) => ({ key, score })));
    const baseMap = new Map(baseEntries.map(({ key, baseScore }) => [key, baseScore]));
    const entries = normalized.map((entry) => ({
      ...entry,
      baseScore: baseMap.get(entry.key) ?? entry.score,
    }));

    const contextKeys = new Set();
    const zoneEvidenceKey = evidenceKeyForQuadrant(state.quadrant || quadrantKey);
    if (zoneEvidenceKey) {
      contextKeys.add(zoneEvidenceKey);
    }
    entries.forEach(({ key }) => contextKeys.add(`emotion-${key}`));

    const message = `${info.label}: ${info.description}`;
    renderSuggestionBlock(
      compassSuggestions,
      'Emotion compass matches',
      message,
      entries,
      Array.from(contextKeys)
    );
    state.compassCandidates = entries.slice(0, 5).map(({ key, confidence }) => ({ key, confidence }));
    state.compassSuggestionMeta = {
      title: 'Emotion compass matches',
      message,
      contextKeys: Array.from(contextKeys),
      entries: baseEntries,
    };
    updateCandidateSnapshot();
    updateStepControls();
  }

  function renderListSection(title, items) {
    if (!items || !items.length) return '';
    const listItems = items.map((item) => `<li>${item}</li>`).join('');
    return `
      <div>
        <h4 class="emotion-suggestions__title">${title}</h4>
        <ul class="emotion-detail__list">${listItems}</ul>
      </div>
    `;
  }

  function slugifyNeed(label) {
    if (typeof label !== 'string') {
      return '';
    }
    return label
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function isNormalizedNeed(value) {
    return !!value && typeof value === 'object' && typeof value.label === 'string';
  }

  function normalizeNeed(need) {
    if (!need) {
      return null;
    }
    if (isNormalizedNeed(need)) {
      const slug = typeof need.slug === 'string' && need.slug ? need.slug : slugifyNeed(need.label);
      return { label: need.label, slug };
    }
    if (typeof need === 'string') {
      const label = need.trim();
      if (!label) {
        return null;
      }
      return { label, slug: slugifyNeed(label) };
    }
    return null;
  }

  function normalizeNeeds(needs) {
    if (!Array.isArray(needs)) {
      return [];
    }
    return needs.map((need) => normalizeNeed(need)).filter(Boolean);
  }

  function renderNeedLinks(needs) {
    const normalized = Array.isArray(needs) && needs.every(isNormalizedNeed) ? needs : normalizeNeeds(needs);
    if (!normalized.length) {
      return '';
    }
    const items = normalized
      .map((need) => {
        const href = need.slug ? `${basePath}needs/${need.slug}/` : `${basePath}needs/`;
        return `<li><a class="emotion-need-link" href="${href}">${need.label}</a></li>`;
      })
      .join('');
    return `
      <div>
        <h4 class="emotion-suggestions__title">Possible needs this feeling can point to (hypotheses)</h4>
        <ul class="emotion-detail__list emotion-detail__list--links">${items}</ul>
      </div>
    `;
  }

  function setActiveTag(tag) {
    if (state.activeTag) {
      state.activeTag.classList.remove('is-active');
    }
    if (tag) {
      tag.classList.add('is-active');
      state.activeTag = tag;
    }
  }

  function renderEmotionDetails(emotionKey, sourceTag) {
    const emotion = EMOTION_LIBRARY[emotionKey];
    if (!emotion || !emotionLibrary) return;
    setActiveTag(sourceTag);
    state.selectedEmotion = emotionKey;
    const candidate = state.candidateEmotions.find((item) => item.key === emotionKey);

    const html = `
      <div class="emotion-detail">
        <h3 class="emotion-detail__name">${emotion.name}</h3>
        <p class="emotion-detail__definition">${emotion.definition}</p>
        ${renderListSection('Common body cues', emotion.bodySignals)}
        ${renderListSection('Typical thoughts', emotion.thoughts)}
        ${renderListSection('When it often appears', emotion.contexts)}
        ${renderNeedLinks(emotion.needs)}
        ${renderListSection('Care ideas to experiment with', emotion.regulation)}
        <p class="support-note">Everyone feels emotions uniquely. Use these clues as invitations, not rules.</p>
      </div>
    `;
    emotionLibrary.innerHTML = html;

    renderRegulationCard(emotion);
    renderCommunicationCard(emotion);
    refreshSuggestions();
    updateStepControls();
  }

  function renderRegulationCard(emotion) {
    if (!regulationCard) return;
    const quadrantInfo = state.quadrant ? QUADRANT_SUGGESTIONS[state.quadrant] : null;
    const extraCare = quadrantInfo?.care ? renderListSection(`Support when you feel ${quadrantInfo.label.toLowerCase()}`, quadrantInfo.care) : '';
    const journalLink = `${basePath}inventory/journal/`;
    const breathingRecommendation = getBreathingRecommendation();
    const breathingSection = `
      <div class="regulation-breathing">
        <h4 class="emotion-suggestions__title">Matched breathing option</h4>
        <p>${breathingRecommendation.summary}</p>
        <button type="button" class="support-button support-button--ghost" data-action="breathing-start" data-breath-pattern="${breathingRecommendation.pattern}">Start ${breathingRecommendation.label}</button>
      </div>
    `;
    const evidenceNote =
      '<p class="support-note support-note--mini">Affect labeling and exhale-biased breathing can reduce distress (see “Why these?”).</p>';
    regulationCard.innerHTML = `
      <h4 class="emotion-suggestions__title">Support for ${emotion.name}</h4>
      ${renderListSection('Try one of these nurturing steps', emotion.regulation)}
      ${extraCare}
      ${breathingSection}
      <p class="support-note">Experiment kindly. If none of these help, it simply means your body wants something different today. Track what works or needs tweaking so future-you can adjust with care.</p>
      ${evidenceNote}
      <div class="regulation-actions">
        <a class="support-button support-button--link" href="${journalLink}">Open Journal History</a>
      </div>
    `;
  }

  function renderCommunicationCard(emotion) {
    if (!communicationCard) return;
    const normalizedNeeds = normalizeNeeds(emotion.needs);
    const needLabel = normalizedNeeds.length ? normalizedNeeds[0].label.toLowerCase() : 'support';
    const template = `I feel ${emotion.name.toLowerCase()} because I need ${needLabel}.`;
    communicationCard.innerHTML = `
      <p class="communication-template" data-communication-template>${template}</p>
      <div class="communication-actions">
        <button class="support-button" type="button" data-action="copy-template">Copy sentence</button>
        <button class="support-button support-button--ghost" type="button" data-action="speak-template">Read it aloud</button>
      </div>
      <p class="support-note" data-communication-status role="status"></p>
      <p class="support-note">It is okay to say, “I’m still figuring out my feelings.” The goal is practice, not perfection.</p>
    `;
  }

  function getEvidenceTitle(key) {
    if (!key) {
      return 'Evidence';
    }
    if (BODY_SENSATION_OPTIONS.has(key)) {
      const option = BODY_SENSATION_OPTIONS.get(key);
      return option?.title || 'Body sensation';
    }
    if (key.startsWith('zone-')) {
      const quadrantKey = quadrantKeyFromEvidenceKey(key);
      const info = quadrantKey ? QUADRANT_SUGGESTIONS[quadrantKey] : null;
      return info?.label || 'Affect zone';
    }
    if (key.startsWith('emotion-')) {
      const emotionKey = key.slice('emotion-'.length);
      const emotion = EMOTION_LIBRARY[emotionKey];
      return emotion?.name || emotionKey;
    }
    if (key === 'skill-labeling') {
      return 'Affect labeling';
    }
    if (key.startsWith('skill-')) {
      const pattern = key.slice('skill-'.length);
      return BREATH_PATTERN_LABELS[pattern] || pattern;
    }
    return key;
  }

  function ensureEvidencePopover() {
    if (!EVIDENCE_MODE_ENABLED || evidencePopover) {
      return;
    }
    evidencePopover = document.createElement('div');
    evidencePopover.className = 'evidence-popover';
    evidencePopover.hidden = true;
    evidencePopover.setAttribute('aria-hidden', 'true');

    evidencePopoverOverlay = document.createElement('div');
    evidencePopoverOverlay.className = 'evidence-popover__overlay';
    evidencePopoverOverlay.setAttribute('aria-hidden', 'true');
    evidencePopoverOverlay.addEventListener('click', () => closeEvidencePopover());

    const dialog = document.createElement('div');
    dialog.className = 'evidence-popover__dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const heading = document.createElement('h4');
    heading.className = 'evidence-popover__title';
    heading.textContent = 'Why these suggestions';
    dialog.appendChild(heading);

    evidencePopoverClose = document.createElement('button');
    evidencePopoverClose.type = 'button';
    evidencePopoverClose.className = 'evidence-popover__close';
    evidencePopoverClose.textContent = 'Close';
    evidencePopoverClose.addEventListener('click', () => closeEvidencePopover());
    dialog.appendChild(evidencePopoverClose);

    evidencePopoverContent = document.createElement('div');
    evidencePopoverContent.className = 'evidence-popover__body';
    dialog.appendChild(evidencePopoverContent);

    evidencePopover.appendChild(evidencePopoverOverlay);
    evidencePopover.appendChild(dialog);
    document.body.appendChild(evidencePopover);
  }

  function buildEvidenceSection(key, entry) {
    const section = document.createElement('section');
    section.className = 'evidence-popover__section';

    const title = document.createElement('h5');
    title.className = 'evidence-popover__heading';
    title.textContent = getEvidenceTitle(key);
    section.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'evidence-popover__meta';
    meta.textContent = `Level ${entry.level || 'B'} • Reviewed ${entry.lastReviewed || REVIEW_DATE}`;
    section.appendChild(meta);

    if (Array.isArray(entry.supports) && entry.supports.length) {
      const supportList = document.createElement('ul');
      supportList.className = 'evidence-popover__list';
      entry.supports.forEach(({ label, ref }) => {
        const li = document.createElement('li');
        li.textContent = ref ? `${label} — ${ref}` : label;
        supportList.appendChild(li);
      });
      section.appendChild(supportList);
    }

    if (Array.isArray(entry.limitations) && entry.limitations.length) {
      const limitsHeading = document.createElement('p');
      limitsHeading.className = 'evidence-popover__subheading';
      limitsHeading.textContent = 'Limitations';
      section.appendChild(limitsHeading);
      const limitsList = document.createElement('ul');
      limitsList.className = 'evidence-popover__list evidence-popover__list--limits';
      entry.limitations.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        limitsList.appendChild(li);
      });
      section.appendChild(limitsList);
    }

    return section;
  }

  function openEvidencePopover(trigger, keys) {
    if (!EVIDENCE_MODE_ENABLED) {
      return;
    }
    ensureEvidencePopover();
    if (!evidencePopover || !evidencePopoverContent) {
      return;
    }
    const parsedKeys = Array.from(
      new Set(
        (Array.isArray(keys) ? keys : [])
          .map((key) => (key || '').trim())
          .filter(Boolean)
      )
    );
    evidencePopoverContent.innerHTML = '';
    const sections = parsedKeys
      .map((key) => ({ key, entry: EVIDENCE_REGISTRY[key] }))
      .filter(({ entry }) => !!entry);

    if (!sections.length) {
      const note = document.createElement('p');
      note.className = 'support-note';
      note.textContent = 'Sources will appear here once the mapping is documented.';
      evidencePopoverContent.appendChild(note);
    } else {
      sections.forEach(({ key, entry }) => {
        evidencePopoverContent.appendChild(buildEvidenceSection(key, entry));
      });
    }

    evidencePopover.hidden = false;
    evidencePopover.setAttribute('aria-hidden', 'false');
    document.body?.classList?.add('has-evidence-popover-open');
    evidencePopoverFocusReturn = trigger;
    document.addEventListener('keydown', handleEvidenceEscape);
    try {
      evidencePopoverClose?.focus({ preventScroll: true });
    } catch (error) {
      evidencePopoverClose?.focus();
    }
  }

  function closeEvidencePopover() {
    if (!evidencePopover) {
      return;
    }
    evidencePopover.hidden = true;
    evidencePopover.setAttribute('aria-hidden', 'true');
    document.body?.classList?.remove('has-evidence-popover-open');
    document.removeEventListener('keydown', handleEvidenceEscape);
    if (evidencePopoverFocusReturn && typeof evidencePopoverFocusReturn.focus === 'function') {
      try {
        evidencePopoverFocusReturn.focus();
      } catch (error) {
        // ignore focus errors
      }
    }
    evidencePopoverFocusReturn = null;
  }

  function handleEvidenceEscape(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      closeEvidencePopover();
    }
  }

  function handleEvidenceClick(event) {
    const trigger = event.target.closest('[data-evidence-trigger]');
    if (!trigger) {
      return;
    }
    event.preventDefault();
    const keys = (trigger.dataset.evidenceKeys || '').split(',');
    openEvidencePopover(trigger, keys);
  }

  function maybeShowEvidenceNote() {
    if (!EVIDENCE_MODE_ENABLED || !supportFlow) {
      return;
    }
    let dismissed = false;
    if (typeof localStorage !== 'undefined') {
      try {
        dismissed = localStorage.getItem(EVIDENCE_NOTE_KEY) === '1';
      } catch (error) {
        dismissed = false;
      }
    }
    if (dismissed) {
      return;
    }
    const notice = document.createElement('div');
    notice.className = 'evidence-note';
    const message = document.createElement('p');
    message.textContent = 'Suggestions are hypotheses based on affect science; tap “Why these?” for sources.';
    notice.appendChild(message);
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'evidence-note__dismiss';
    dismiss.textContent = 'Got it';
    dismiss.addEventListener('click', () => {
      notice.remove();
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(EVIDENCE_NOTE_KEY, '1');
        } catch (error) {
          // ignore storage errors
        }
      }
    });
    notice.appendChild(dismiss);
    supportFlow.prepend(notice);
  }

  function copyTemplate(text, statusNode) {
    if (!navigator.clipboard) {
      statusNode.textContent = 'Copy is unavailable in this browser. You can highlight the sentence manually.';
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        statusNode.textContent = 'Copied! Share it or keep it where it helps.';
      })
      .catch(() => {
        statusNode.textContent = 'Copy did not work. Try copying manually.';
      });
  }

  function speakTemplate(text, statusNode) {
    if (!('speechSynthesis' in window)) {
      statusNode.textContent = 'Speech is unavailable here. Try reading the sentence aloud yourself.';
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
    statusNode.textContent = 'Playing the sentence out loud—pause or stop if you prefer to speak it yourself.';
  }

  function handleSuggestionClick(event) {
    const rejectButton = event.target.closest('[data-emotion-reject]');
    if (rejectButton) {
      event.preventDefault();
      const emotionKey = rejectButton.dataset.emotionReject;
      recordRejection(emotionKey);
      refreshSuggestions();
      return;
    }

    const target = event.target.closest('[data-emotion]');
    if (!target) return;
    const emotionKey = target.dataset.emotion;
    renderEmotionDetails(emotionKey, target);
    if (state.activeStep !== 'library') {
      goToStep('library', { focus: false });
    }
  }

  function handleCommunicationClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const templateNode = communicationCard?.querySelector('[data-communication-template]');
    const statusNode = communicationCard?.querySelector('[data-communication-status]');
    if (!templateNode || !statusNode) return;
    const text = templateNode.textContent ?? '';
    const action = actionButton.dataset.action;
    if (action === 'copy-template') {
      copyTemplate(text, statusNode);
    } else if (action === 'speak-template') {
      speakTemplate(text, statusNode);
    }
  }

  function init() {
    showOnlyStep(state.activeStep);

    if (startButton) {
      startButton.addEventListener('click', handleStart);
    }
    const breathingStart = document.querySelector('[data-action="breathing-start"]');
    const breathingSkip = document.querySelector('[data-action="breathing-skip"]');
    breathingStart?.addEventListener('click', handleBreathingStart);
    breathingSkip?.addEventListener('click', skipBreathing);

    if (sensationRegionList) {
      renderBodyRegions(sensationRegionList);
      sensationRegionList.addEventListener('click', handleSensationChoiceClick);
      sensationRegionList.addEventListener('input', handleSensationIntensityInput);
    }

    const sensationSubmit = document.querySelector('[data-action="sensation-submit"]');
    const sensationClear = document.querySelector('[data-action="sensation-clear"]');
    sensationSubmit?.addEventListener('click', handleSensationSubmit);
    sensationClear?.addEventListener('click', handleSensationClear);

    compassRoot?.addEventListener('nvc-compass-change', handleCompassSelection);

    supportFlow?.addEventListener('click', handleStepCtaClick);
    supportFlow?.addEventListener('click', handleEvidenceClick);

    bodySuggestions?.addEventListener('click', handleSuggestionClick);
    compassSuggestions?.addEventListener('click', handleSuggestionClick);

    communicationCard?.addEventListener('click', handleCommunicationClick);

    renderSuggestionBlock(
      bodySuggestions,
      'Body-based matches',
      'Body-based matches will appear here after you choose sensations and set their intensity.',
      []
    );
    renderSuggestionBlock(
      compassSuggestions,
      'Emotion compass matches',
      'Pick one energy and one pleasantness option to see suggestions.',
      []
    );
    if (EVIDENCE_MODE_ENABLED) {
      ensureEvidencePopover();
      maybeShowEvidenceNote();
    }
    updateStepControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
