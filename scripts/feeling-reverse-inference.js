import { QUADRANT_SUGGESTIONS } from './alexithymia-support-data.js';
import { EVIDENCE_REGISTRY } from './evidence-registry.js';
import { EMOTION_CIRCUMPLEX } from './alexithymia-support-logic.js';

const SKILL_LIBRARY = {
  labeling: {
    buttonLabel: 'Label it',
    duration: '15–45s',
    description:
      'Name the feeling softly—out loud or on paper—to give your brain a handle and reduce guessing loops.',
  },
  physiological_sigh: {
    buttonLabel: 'Exhale-biased breath',
    duration: '1–2 min',
    description:
      'Take two gentle inhales through your nose, then a long sigh out through your mouth. Repeat a few times to downshift arousal.',
  },
  slow_446: {
    buttonLabel: '4-4-6 breath',
    duration: '1–2 min',
    description: 'Inhale for four counts, pause for four, and exhale for six. The longer exhale can invite a parasympathetic tilt.',
  },
  resonance_6bpm: {
    buttonLabel: 'Resonance breath',
    duration: '3–5 min',
    description: 'Breathe at roughly six cycles per minute (for example, inhale five counts, exhale five) to steady heart-rate variability.',
  },
};

const SDT_LABELS = {
  autonomy: 'Autonomy',
  competence: 'Competence',
  relatedness: 'Relatedness',
};

const AROUSAL_LABELS = {
  high: 'High energy',
  medium: 'Moderate energy',
  low: 'Low energy',
};

let reverseIndexPromise = null;

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getBasePath() {
  return document.body?.dataset?.basePath || '';
}

function fetchReverseIndex() {
  if (!reverseIndexPromise) {
    const basePath = getBasePath();
    const url = `${basePath}data/reverse-inference.json`;
    reverseIndexPromise = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load reverse inference data (${response.status})`);
        }
        return response.json();
      })
      .catch((error) => {
        console.warn('[reverse-inference] Failed to load data', error);
        return null;
      });
  }
  return reverseIndexPromise;
}

function resolveFeelingKey(data, slug) {
  if (!data) return null;
  const slugMap = data._meta?.slugMap || {};
  if (slug && slugMap[slug]) {
    return slugMap[slug];
  }
  if (slug) {
    const fallback = slugMap[slugify(slug)];
    if (fallback) {
      return fallback;
    }
  }
  return null;
}

function formatZoneLabel(zoneKey) {
  const info = QUADRANT_SUGGESTIONS[zoneKey];
  if (info?.label) {
    return info.label;
  }
  const [energy, valence] = zoneKey.split('-');
  if (!energy || !valence) {
    return zoneKey;
  }
  const energyLabel = energy.charAt(0).toUpperCase() + energy.slice(1);
  const valenceLabel = valence.charAt(0).toUpperCase() + valence.slice(1);
  return `${energyLabel} energy · ${valenceLabel}`;
}

function normalizeIntensityBand(band) {
  if (!Array.isArray(band) || band.length < 2) {
    return null;
  }
  const min = Number(band[0]);
  const max = Number(band[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  const clampedMin = Math.max(0, Math.min(10, min));
  const clampedMax = Math.max(clampedMin, Math.min(10, max));
  return [Math.round(clampedMin), Math.round(clampedMax)];
}

function formatIntensityBand(band) {
  const normalized = normalizeIntensityBand(band);
  if (!normalized) {
    return '—';
  }
  return `${normalized[0]}–${normalized[1]}`;
}

function describeArousal(arousal) {
  const label = AROUSAL_LABELS[arousal];
  return label || null;
}

function createIntensityDisplay(band, arousal) {
  const normalized = normalizeIntensityBand(band);
  const container = createEl('div', 'feeling-inference__cue-intensity');
  const energyLabel = describeArousal(arousal);
  const rangeLabel = formatIntensityBand(normalized || band);
  const label = createEl('div', 'feeling-inference__cue-intensity-label');
  const labelTitle = createEl('span', 'feeling-inference__cue-intensity-title', 'Typical intensity range');
  label.appendChild(labelTitle);
  if (energyLabel) {
    label.appendChild(createEl('span', 'feeling-inference__cue-intensity-energy', energyLabel));
  }
  const rangeText = rangeLabel === '—' ? 'Not enough data yet' : rangeLabel;
  label.appendChild(createEl('span', 'feeling-inference__cue-intensity-value', rangeText));
  container.appendChild(label);

  if (!normalized) {
    return container;
  }

  const [min, max] = normalized;
  const meter = createEl('div', 'feeling-inference__cue-intensity-meter');
  meter.setAttribute('role', 'img');
  meter.setAttribute('aria-label', `Intensity range ${min} to ${max} on a 0 to 10 scale.`);
  const fill = createEl('div', 'feeling-inference__cue-intensity-fill');
  const startPercent = Math.max(0, Math.min(100, (min / 10) * 100));
  const endPercent = Math.max(startPercent, Math.min(100, (max / 10) * 100));
  const widthPercent = Math.min(100 - startPercent, Math.max(4, endPercent - startPercent));
  fill.style.left = `${startPercent}%`;
  fill.style.width = `${widthPercent}%`;
  meter.appendChild(fill);
  container.appendChild(meter);

  const scale = createEl('div', 'feeling-inference__cue-intensity-scale');
  scale.appendChild(createEl('span', null, '0'));
  scale.appendChild(createEl('span', null, '10'));
  container.appendChild(scale);

  return container;
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text) {
    el.textContent = text;
  }
  return el;
}

function buildZoneSection(entry, primaryZone) {
  const section = createEl('section', 'feeling-inference__section feeling-inference__section--zones');
  const heading = createEl('h3', 'feeling-inference__subheading', 'Affective zone (hypotheses)');
  section.appendChild(heading);
  const list = createEl('div', 'feeling-inference__zones');
  entry.zones.forEach((zoneKey) => {
    const chip = createEl('span', 'feeling-inference__zone-chip chip', formatZoneLabel(zoneKey));
    if (zoneKey === primaryZone) {
      chip.classList.add('is-primary');
      chip.setAttribute('aria-label', `${chip.textContent} (primary)`);
    }
    list.appendChild(chip);
  });
  section.appendChild(list);
  return section;
}

function groupBodyCuesByRegion(bodyCues) {
  const groups = new Map();
  bodyCues.forEach((cue) => {
    if (!groups.has(cue.regionId)) {
      groups.set(cue.regionId, { label: cue.regionLabel, cues: [] });
    }
    groups.get(cue.regionId).cues.push(cue);
  });
  return groups;
}

function buildBodyCueSection(entry) {
  const section = createEl('section', 'feeling-inference__section feeling-inference__section--body');
  const heading = createEl('h3', 'feeling-inference__subheading', 'Body cues that can point here');
  const disclaimer = createEl(
    'p',
    'feeling-inference__disclaimer',
    'Cues are invitations, not rules; people differ. The green bar shows the feeling intensity (0–10) where folks tend to notice it. The purple bar shows how much this cue mattered compared with other cues in the same body area.'
  );
  section.appendChild(heading);
  section.appendChild(disclaimer);

  const groups = groupBodyCuesByRegion(entry.bodyCues);
  const regionContainer = createEl('div', 'feeling-inference__body-groups');

  groups.forEach((group, regionId) => {
    const region = createEl('article', 'feeling-inference__body-region');
    region.dataset.regionId = regionId;
    region.appendChild(createEl('h4', 'feeling-inference__region-title', group.label));
    group.cues.forEach((cue) => {
      const item = createEl('div', 'feeling-inference__cue');
      item.dataset.optionId = cue.optionId;
      item.appendChild(createEl('h5', 'feeling-inference__cue-title', cue.title));
      if (cue.note) {
        item.appendChild(createEl('p', 'feeling-inference__cue-note', cue.note));
      }
      const intensity = createIntensityDisplay(cue.intensityBand, cue.arousal);
      item.appendChild(intensity);
      const weightLabelId = `feeling-cue-${cue.optionId}-weight-label`;
      const weightPercent = Math.round(cue.relativeWeight * 100);
      const weightLabel = createEl('div', 'feeling-inference__cue-weight-label');
      weightLabel.id = weightLabelId;
      weightLabel.appendChild(
        createEl('span', 'feeling-inference__cue-weight-heading', 'How strongly this cue points to this feeling')
      );
      weightLabel.appendChild(
        createEl(
          'span',
          'feeling-inference__cue-weight-detail',
          `${weightPercent}% of the body-cue signal for this area`
        )
      );
      const weight = createEl('div', 'feeling-inference__cue-weight');
      weight.setAttribute('role', 'img');
      weight.setAttribute(
        'aria-label',
        `Relative contribution approximately ${weightPercent}% of the body-cue signal for this feeling in this area.`
      );
      weight.setAttribute('aria-labelledby', weightLabelId);
      const weightFill = createEl('div', 'feeling-inference__cue-weight-fill');
      weightFill.style.width = `${weightPercent}%`;
      weight.appendChild(weightFill);
      const weightScale = createEl('div', 'feeling-inference__cue-weight-scale');
      weightScale.appendChild(createEl('span', null, '0% (weak match)'));
      weightScale.appendChild(createEl('span', null, '100% (primary cue)'));
      item.appendChild(weightLabel);
      item.appendChild(weight);
      item.appendChild(weightScale);
      region.appendChild(item);
    });
    regionContainer.appendChild(region);
  });

  section.appendChild(regionContainer);
  return section;
}

function buildNeedsSection(entry, basePath) {
  const section = createEl('section', 'feeling-inference__section feeling-inference__section--needs');
  section.appendChild(
    createEl('h3', 'feeling-inference__subheading', 'Possible needs if this fits (hypotheses)')
  );

  if (entry.needsHypotheses.sdt.length) {
    const sdtList = createEl('div', 'feeling-inference__sdt');
    entry.needsHypotheses.sdt.forEach((key) => {
      const label = SDT_LABELS[key] || key;
      sdtList.appendChild(createEl('span', 'feeling-inference__sdt-chip', label));
    });
    section.appendChild(sdtList);
  }

  if (entry.needsHypotheses.nvc.length) {
    const list = createEl('ul', 'feeling-inference__needs-list');
    entry.needsHypotheses.nvc.forEach((need) => {
      const li = document.createElement('li');
      if (need.slug) {
        const link = createEl('a', 'feeling-inference__need-link', need.title);
        link.href = `${basePath}needs/${need.slug}/`;
        li.appendChild(link);
      } else {
        li.textContent = need.title;
      }
      list.appendChild(li);
    });
    section.appendChild(list);
  }

  return section;
}

function buildSkillsSection(entry) {
  const section = createEl('section', 'feeling-inference__section feeling-inference__section--skills');
  section.appendChild(createEl('h3', 'feeling-inference__subheading', 'Try now'));
  const list = createEl('div', 'feeling-inference__skills');

  entry.skills.forEach((skillId, index) => {
    const skill = SKILL_LIBRARY[skillId];
    if (!skill) {
      return;
    }
    const skillCard = createEl('article', 'feeling-inference__skill');
    const button = createEl('button', 'feeling-inference__skill-btn', skill.buttonLabel);
    button.type = 'button';
    const duration = createEl('span', 'feeling-inference__skill-duration', skill.duration);
    button.appendChild(duration);
    const detailId = `feeling-skill-${skillId}-${index}`;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', detailId);

    const detail = createEl('p', 'feeling-inference__skill-detail', skill.description);
    detail.id = detailId;
    detail.hidden = true;

    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      detail.hidden = expanded;
    });

    skillCard.appendChild(button);
    skillCard.appendChild(detail);
    list.appendChild(skillCard);
  });

  section.appendChild(list);
  return section;
}

function collectEvidenceEntries(entry, feelingKey) {
  const keys = new Set(entry.evidenceKeys || []);
  const primaryZone = entry.zones?.[0];
  if (primaryZone) {
    const anchor = primaryZone.split('-');
    if (anchor.length === 2) {
      keys.add(`zone-${anchor[1]}-${anchor[0]}`);
    }
  }
  keys.add(`emotion-${feelingKey}`);
  const evidence = [];
  keys.forEach((key) => {
    const record = EVIDENCE_REGISTRY[key];
    if (record) {
      evidence.push({ key, record });
    }
  });
  return evidence;
}

function gatherLimitations(evidence) {
  const seen = new Set();
  const items = [];
  evidence.forEach(({ record }) => {
    (record.limitations || []).forEach((limitation) => {
      if (!seen.has(limitation)) {
        seen.add(limitation);
        items.push(limitation);
      }
    });
  });
  const baseline = 'Self-report body maps and affect clusters are directional hints, not diagnoses.';
  if (!seen.has(baseline)) {
    items.push(baseline);
  }
  return items;
}

function renderEvidencePopover(container, trigger, feelingKey, entry) {
  const evidence = collectEvidenceEntries(entry, feelingKey);
  if (!evidence.length) {
    return;
  }
  const backdrop = createEl('div', 'feeling-inference__popover-backdrop');
  const dialog = createEl('div', 'feeling-inference__popover');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const titleId = 'feeling-inference-popover-title';
  dialog.setAttribute('aria-labelledby', titleId);

  const closeButton = createEl('button', 'feeling-inference__popover-close', 'Close');
  closeButton.type = 'button';

  const title = createEl('h3', 'feeling-inference__popover-title', 'Why these?');
  title.id = titleId;

  const list = createEl('ul', 'feeling-inference__evidence-list');
  evidence.forEach(({ key, record }) => {
    const support = record.supports?.[0];
    if (!support) return;
    const item = createEl('li', 'feeling-inference__evidence-item');
    const label = createEl('span', 'feeling-inference__evidence-label', support.label);
    if (support.ref) {
      const ref = createEl('span', 'feeling-inference__evidence-ref', support.ref);
      item.appendChild(label);
      item.appendChild(ref);
    } else {
      item.appendChild(label);
    }
    list.appendChild(item);
  });

  const limitations = gatherLimitations(evidence);
  const limitationHeading = createEl('h4', 'feeling-inference__popover-subheading', 'Limitations');
  const limitationList = createEl('ul', 'feeling-inference__limitations');
  limitations.forEach((text) => {
    limitationList.appendChild(createEl('li', null, text));
  });

  dialog.appendChild(closeButton);
  dialog.appendChild(title);
  dialog.appendChild(list);
  dialog.appendChild(limitationHeading);
  dialog.appendChild(limitationList);
  backdrop.appendChild(dialog);

  const focusableSelectors = ['button', '[href]', 'input', 'select', 'textarea', '[tabindex]:not([tabindex="-1"])'];
  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = dialog.querySelectorAll(focusableSelectors.join(','));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        event.preventDefault();
      }
    } else if (document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }

  function closePopover() {
    document.removeEventListener('keydown', onKeydown);
    dialog.removeEventListener('keydown', trapFocus);
    backdrop.remove();
    trigger.focus();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      closePopover();
    }
  }

  closeButton.addEventListener('click', closePopover);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closePopover();
    }
  });
  document.addEventListener('keydown', onKeydown);
  dialog.addEventListener('keydown', trapFocus);

  document.body.appendChild(backdrop);
  closeButton.focus();
}

function buildEvidenceButton(container, feelingKey, entry) {
  const button = createEl('button', 'feeling-inference__evidence-btn', 'Why these?');
  button.type = 'button';
  button.addEventListener('click', () => {
    renderEvidencePopover(container, button, feelingKey, entry);
  });
  return button;
}

function renderPanel(container, feelingKey, entry) {
  container.innerHTML = '';
  container.classList.add('feeling-inference--ready');
  container.setAttribute('tabindex', '-1');

  const heading = createEl(
    'h2',
    'feeling-inference__title',
    'How this feeling might be inferred (hypotheses)'
  );
  container.appendChild(heading);

  const anchor = EMOTION_CIRCUMPLEX[feelingKey];
  const primaryZone = anchor ? `${anchor.arousal}-${anchor.valence}` : entry.zones?.[0];
  if (entry.zones?.length) {
    container.appendChild(buildZoneSection(entry, primaryZone));
  }
  container.appendChild(buildBodyCueSection(entry));

  const basePath = getBasePath();
  container.appendChild(buildNeedsSection(entry, basePath));
  container.appendChild(buildSkillsSection(entry));

  const footer = createEl(
    'footer',
    'feeling-inference__footer',
    'These suggestions are hypotheses from affect science (valence × arousal) and self-reported body maps; they are not diagnostic.'
  );
  container.appendChild(footer);

  const controls = createEl('div', 'feeling-inference__actions');
  controls.appendChild(buildEvidenceButton(container, feelingKey, entry));
  container.appendChild(controls);
}

function ready(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

ready(() => {
  const wrapper = document.querySelector('[data-reverse-inference-container]');
  if (!wrapper) {
    return;
  }
  const toggle = wrapper.querySelector('[data-reverse-inference-toggle]');
  const panelShell = wrapper.querySelector('[data-reverse-inference-panel]');
  const container = panelShell?.querySelector('[data-reverse-inference]');
  if (!toggle || !panelShell || !container) {
    return;
  }

  const removeWrapper = () => {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    } else if (typeof wrapper.remove === 'function') {
      wrapper.remove();
    }
  };

  panelShell.setAttribute('aria-hidden', 'true');

  let expanded = false;

  const setExpanded = (next, { scrollIntoView = false } = {}) => {
    expanded = next;
    toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    panelShell.hidden = !next;
    container.hidden = !next;
    panelShell.setAttribute('aria-hidden', next ? 'false' : 'true');
    if (next && scrollIntoView) {
      requestAnimationFrame(() => {
        container.focus({ preventScroll: true });
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  toggle.addEventListener('click', () => {
    if (toggle.disabled) {
      return;
    }
    const next = !expanded;
    setExpanded(next, { scrollIntoView: next });
    if (!next) {
      toggle.focus({ preventScroll: true });
    }
  });

  const main = document.querySelector('main[data-feeling-slug]');
  const slug = main?.dataset?.feelingSlug;

  fetchReverseIndex().then((data) => {
    if (!data) {
      removeWrapper();
      return;
    }
    const feelingKey = resolveFeelingKey(data, slug);
    if (!feelingKey) {
      removeWrapper();
      return;
    }
    const entry = data[feelingKey];
    if (!entry) {
      removeWrapper();
      return;
    }
    renderPanel(container, feelingKey, entry);
    setExpanded(false);
    toggle.disabled = false;
    wrapper.hidden = false;
    panelShell.setAttribute('aria-hidden', 'true');
  });
});
