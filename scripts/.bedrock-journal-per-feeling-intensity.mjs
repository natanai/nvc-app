import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Non-unique ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing ${label} start`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Missing ${label} end`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// Canonical model: feelings carry their own intensity. Legacy emotion/intensity remain derived compatibility fields.
{
  const path = 'assets/js/journal/model.js';
  let source = read(path);
  source = replaceOnce(
    source,
    "  emotion: '',\n  intensity: undefined,",
    "  emotion: '',\n  intensity: undefined,\n  feelings: [],",
    'Journal model feeling ratings',
  );
  write(path, source);
}

// Store owner: normalize new per-feeling ratings and migrate legacy entries without losing their old meaning.
{
  const path = 'assets/js/journal/store.js';
  let source = read(path);

  const helper = `const normalizeFeelingRatings = (value, fallbackEmotion = '', fallbackIntensity) => {\n  const fallbackScale = sanitizeScale(fallbackIntensity);\n  const defaultScale = typeof fallbackScale === 'number' && fallbackScale > 0 ? fallbackScale : 5;\n  const rawItems = Array.isArray(value) && value.length\n    ? value\n    : normalizeStringList(fallbackEmotion).map((feeling) => ({ feeling, intensity: defaultScale }));\n  const seen = new Map();\n  rawItems.forEach((item) => {\n    let feeling = '';\n    let intensityCandidate;\n    if (typeof item === 'string') {\n      feeling = item.trim();\n      intensityCandidate = defaultScale;\n    } else if (item && typeof item === 'object') {\n      const rawFeeling = item.feeling ?? item.emotion ?? item.label ?? item.name ?? item.key ?? '';\n      feeling = typeof rawFeeling === 'string' ? rawFeeling.trim() : '';\n      intensityCandidate = item.intensity ?? item.level ?? item.scale ?? item.rating;\n      if (intensityCandidate === undefined) intensityCandidate = defaultScale;\n    }\n    const intensity = sanitizeScale(intensityCandidate);\n    if (!feeling || !Number.isFinite(intensity) || intensity <= 0) return;\n    const key = feeling.toLowerCase();\n    const existing = seen.get(key);\n    if (!existing || intensity > existing.intensity) seen.set(key, { feeling, intensity });\n  });\n  return Array.from(seen.values());\n};\n\n`;
  source = replaceOnce(source, 'const normalizeRegulationUsed = (value) => normalizeStringList(value);\n', helper + 'const normalizeRegulationUsed = (value) => normalizeStringList(value);\n', 'feeling rating normalizer');

  source = replaceOnce(
    source,
    `  overrides.emotion = coerceEmotion(raw.emotion ?? extras.emotion);\n\n  const intensityCandidate = raw.intensity ?? raw.intensityValue ?? extras.intensity;\n  overrides.intensity = sanitizeScale(intensityCandidate);`,
    `  const intensityCandidate = raw.intensity ?? raw.intensityValue ?? extras.intensity;\n  overrides.feelings = normalizeFeelingRatings(\n    raw.feelings ?? extras.feelings,\n    raw.emotion ?? extras.emotion,\n    intensityCandidate,\n  );\n  overrides.emotion = overrides.feelings.length\n    ? overrides.feelings.map((item) => item.feeling).join(', ')\n    : coerceEmotion(raw.emotion ?? extras.emotion);\n  overrides.intensity = overrides.feelings.length\n    ? Math.max(...overrides.feelings.map((item) => item.intensity))\n    : sanitizeScale(intensityCandidate);`,
    'store emotion/intensity normalization',
  );

  source = replaceOnce(
    source,
    `    sensations: Array.isArray(overrides.sensations) ? overrides.sensations : [],`,
    `    feelings: Array.isArray(overrides.feelings)\n      ? overrides.feelings.map(({ feeling, intensity }) => ({ feeling, intensity }))\n      : [],\n    sensations: Array.isArray(overrides.sensations) ? overrides.sensations : [],`,
    'normalized entry feelings output',
  );

  source = replaceOnce(
    source,
    `  sensations: Array.isArray(entry.sensations) ? [...entry.sensations] : [],`,
    `  feelings: Array.isArray(entry.feelings)\n    ? entry.feelings.map(({ feeling, intensity }) => ({ feeling, intensity }))\n    : [],\n  sensations: Array.isArray(entry.sensations) ? [...entry.sensations] : [],`,
    'clone feeling ratings',
  );

  source = replaceOnce(
    source,
    `      entry.emotion || '',\n      ...(Array.isArray(entry.tags) ? entry.tags : []),`,
    `      entry.emotion || '',\n      ...(Array.isArray(entry.feelings) ? entry.feelings.map((item) => item?.feeling || '') : []),\n      ...(Array.isArray(entry.tags) ? entry.tags : []),`,
    'feeling ratings search index',
  );

  write(path, source);
}

// Shared editor owner: Feeling popup becomes the intensity selector; 0 means absent.
{
  const path = 'assets/js/journal/module.js';
  let source = read(path);

  source = replaceOnce(source, 'intensityRange: { min: 1, max: 10, defaultValue: DEFAULT_INTENSITY },', 'intensityRange: { min: 0, max: 10, defaultValue: DEFAULT_INTENSITY },', 'Journal intensity range');

  const intensityStart = `  grid.append(buildFeelingField(config));\n\n  const intensityId = \`${'${config.idPrefix}'}-intensity\`;`;
  const intensityEnd = `  const notesId = \`${'${config.idPrefix}'}-notes\`;`;
  source = replaceRange(
    source,
    intensityStart,
    intensityEnd,
    `  grid.append(buildFeelingField(config), buildNeedsField(config), buildTagsField(config));\n\n  const notesId = \`${'${config.idPrefix}'}-notes\`;`,
    'standalone Journal intensity row',
  );

  source = replaceOnce(
    source,
    `    this.emotionOptions = [];\n    this.needsOptions = [];`,
    `    this.emotionOptions = [];\n    this.feelingIntensities = new Map();\n    this.needsOptions = [];`,
    'feeling intensity state',
  );

  source = replaceOnce(
    source,
    `      options?.addEventListener('click', (event) => {\n        const option = event.target.closest('[data-journal-catalog-option]');\n        if (!option) return;\n        this.toggleCatalogValue(kind, option.dataset.value || '');\n      });`,
    `      options?.addEventListener('click', (event) => {\n        if (kind === 'feeling') return;\n        const option = event.target.closest('[data-journal-catalog-option]');\n        if (!option) return;\n        this.toggleCatalogValue(kind, option.dataset.value || '');\n      });\n      options?.addEventListener('input', (event) => {\n        if (kind !== 'feeling') return;\n        const slider = event.target.closest('[data-journal-feeling-intensity]');\n        if (!slider) return;\n        const feeling = slider.dataset.value || '';\n        const intensity = normalizeNumber(slider.value, 0, this.options.intensityRange.max) ?? 0;\n        this.setFeelingIntensity(feeling, intensity, { render: false });\n        const row = slider.closest('[data-journal-feeling-row]');\n        const output = row?.querySelector('[data-journal-feeling-intensity-output]');\n        if (output) output.textContent = String(intensity);\n        row?.classList.toggle('is-selected', intensity > 0);\n      });\n      options?.addEventListener('change', (event) => {\n        if (kind !== 'feeling') return;\n        const slider = event.target.closest('[data-journal-feeling-intensity]');\n        if (!slider) return;\n        this.dispatchCatalogChange('feeling');\n      });`,
    'catalog selector event contract',
  );

  source = replaceOnce(
    source,
    `  getCatalogValues(kind) {\n    const input = this.getCatalogInput(kind);\n    return normalizeList(input?.value || '');\n  }`,
    `  getCatalogValues(kind) {\n    if (kind === 'feeling') return this.getFeelingRatings().map((item) => item.feeling);\n    const input = this.getCatalogInput(kind);\n    return normalizeList(input?.value || '');\n  }\n\n  getFeelingRatings() {\n    return Array.from(this.feelingIntensities.entries())\n      .filter(([, intensity]) => Number.isFinite(intensity) && intensity > 0)\n      .map(([feeling, intensity]) => ({ feeling, intensity }));\n  }\n\n  setFeelingIntensity(feeling, intensity, { render = true } = {}) {\n    const normalized = this.normalizeCatalogValues('feeling', [feeling])[0] || '';\n    if (!normalized) return;\n    const value = normalizeNumber(intensity, 0, this.options.intensityRange.max) ?? 0;\n    if (value > 0) this.feelingIntensities.set(normalized, value);\n    else this.feelingIntensities.delete(normalized);\n    if (this.emotionInput) this.emotionInput.value = joinListValues(this.getFeelingRatings().map((item) => item.feeling));\n    this.updateCatalogSummary('feeling');\n    if (render) {\n      const popover = this.feelingSelectRoot?.querySelector('[data-journal-catalog-popover]');\n      if (popover && !popover.hidden) this.renderCatalogOptions('feeling');\n    }\n  }\n\n  setFeelingRatings(values = []) {\n    const items = Array.isArray(values) ? values : [];\n    const next = new Map();\n    items.forEach((item) => {\n      const rawFeeling = typeof item === 'string' ? item : item?.feeling ?? item?.emotion ?? item?.label ?? '';\n      const feeling = this.normalizeCatalogValues('feeling', [rawFeeling])[0] || (!this.emotionOptions.length ? String(rawFeeling || '').trim() : '');\n      const rawIntensity = typeof item === 'string' ? this.defaultIntensity : item?.intensity;\n      const intensity = normalizeNumber(rawIntensity, 0, this.options.intensityRange.max) ?? this.defaultIntensity;\n      if (feeling && intensity > 0) next.set(feeling, intensity);\n    });\n    this.feelingIntensities = next;\n    if (this.emotionInput) this.emotionInput.value = joinListValues(this.getFeelingRatings().map((item) => item.feeling));\n    this.updateCatalogSummary('feeling');\n    const popover = this.feelingSelectRoot?.querySelector('[data-journal-catalog-popover]');\n    if (popover && !popover.hidden) this.renderCatalogOptions('feeling');\n  }`,
    'per-feeling selector state methods',
  );

  source = replaceOnce(
    source,
    `  setCatalogValues(kind, values) {\n    const input = this.getCatalogInput(kind);\n    if (!input) return;\n    const normalized = this.normalizeCatalogValues(kind, values);\n    input.value = joinListValues(normalized);`,
    `  setCatalogValues(kind, values) {\n    if (kind === 'feeling') {\n      const normalized = this.normalizeCatalogValues(kind, values);\n      this.setFeelingRatings(normalized.map((feeling) => ({\n        feeling,\n        intensity: this.feelingIntensities.get(feeling) || this.defaultIntensity,\n      })));\n      return;\n    }\n    const input = this.getCatalogInput(kind);\n    if (!input) return;\n    const normalized = this.normalizeCatalogValues(kind, values);\n    input.value = joinListValues(normalized);`,
    'catalog values setter feeling branch',
  );

  source = replaceOnce(
    source,
    `    const values = this.getCatalogValues(kind);\n    if (!values.length) {\n      valueEl.textContent = this.getCatalogPlaceholder(kind);\n      valueEl.classList.add('is-placeholder');\n      return;\n    }\n    valueEl.classList.remove('is-placeholder');\n    valueEl.textContent = values.length <= 2 ? values.join(', ') : \`${'${values[0]}, ${values[1]} +${values.length - 2}'}\`;`,
    `    const values = this.getCatalogValues(kind);\n    if (!values.length) {\n      valueEl.textContent = this.getCatalogPlaceholder(kind);\n      valueEl.classList.add('is-placeholder');\n      return;\n    }\n    valueEl.classList.remove('is-placeholder');\n    if (kind === 'feeling') {\n      const ratings = this.getFeelingRatings();\n      const labels = ratings.map(({ feeling, intensity }) => \`${'${feeling} ${intensity}'}\`);\n      valueEl.textContent = labels.length <= 2 ? labels.join(', ') : \`${'${labels[0]}, ${labels[1]} +${labels.length - 2}'}\`;\n      return;\n    }\n    valueEl.textContent = values.length <= 2 ? values.join(', ') : \`${'${values[0]}, ${values[1]} +${values.length - 2}'}\`;`,
    'catalog summary per-feeling intensity',
  );

  const renderStart = '  renderCatalogOptions(kind) {';
  const renderEnd = '  toggleCatalogValue(kind, value) {';
  const renderReplacement = `  renderCatalogOptions(kind) {\n    const root = this.getCatalogRoot(kind);\n    const list = root?.querySelector('[data-journal-catalog-options]');\n    const search = root?.querySelector('[data-journal-catalog-search]');\n    if (!list) return;\n    const query = (search?.value || '').trim().toLowerCase();\n    const selected = new Set(this.getCatalogValues(kind).map((value) => value.toLowerCase()));\n    const options = this.getCatalogOptions(kind).filter((option) => !query || option.label.toLowerCase().includes(query));\n    list.innerHTML = '';\n    if (!options.length) {\n      const empty = createElement('p', { classes: ['journal-catalog-popover__empty'], text: 'No matches' });\n      list.append(empty);\n      return;\n    }\n    if (kind === 'feeling') {\n      const ratings = new Map(this.getFeelingRatings().map(({ feeling, intensity }) => [feeling.toLowerCase(), intensity]));\n      options.forEach((option) => {\n        const intensity = ratings.get(option.label.toLowerCase()) || 0;\n        const row = createElement('div', {\n          classes: ['journal-feeling-rating', ...(intensity > 0 ? ['is-selected'] : [])],\n          attrs: { role: 'group', 'aria-label': option.label },\n        });\n        row.setAttribute('data-journal-feeling-row', '');\n        const label = createElement('span', { classes: ['journal-feeling-rating__label'], text: option.label });\n        const control = createElement('div', { classes: ['journal-feeling-rating__control'] });\n        const slider = createElement('input', {\n          classes: ['journal-feeling-rating__slider'],\n          attrs: {\n            type: 'range',\n            min: 0,\n            max: this.options.intensityRange.max,\n            step: 1,\n            value: intensity,\n            'aria-label': \`${'${option.label} intensity; 0 means not selected'}\`,\n          },\n        });\n        slider.setAttribute('data-journal-feeling-intensity', '');\n        slider.dataset.value = option.label;\n        const output = createElement('output', { classes: ['journal-feeling-rating__value'], text: String(intensity) });\n        output.setAttribute('data-journal-feeling-intensity-output', '');\n        control.append(slider, output);\n        row.append(label, control);\n        list.append(row);\n      });\n      return;\n    }\n    options.forEach((option) => {\n      const isSelected = selected.has(option.label.toLowerCase());\n      const button = createElement('button', {\n        classes: ['journal-catalog-option', ...(isSelected ? ['is-selected'] : [])],\n        attrs: { type: 'button', role: 'option', 'aria-selected': isSelected ? 'true' : 'false' },\n      });\n      button.setAttribute('data-journal-catalog-option', '');\n      button.dataset.value = option.label;\n      const label = createElement('span', { text: option.label });\n      const check = createElement('span', { classes: ['journal-catalog-option__check'], attrs: { 'aria-hidden': 'true' }, text: isSelected ? '✓' : '' });\n      button.append(label, check);\n      list.append(button);\n    });\n  }\n\n`;
  source = replaceRange(source, renderStart, renderEnd, renderReplacement, 'catalog option renderer');

  source = replaceOnce(
    source,
    `  collectData() {\n    const emotion = this.emotionInput?.value?.trim() || '';\n    const intensityValue = normalizeNumber(\n      this.intensityInput?.value,\n      this.options.intensityRange.min,\n      this.options.intensityRange.max,\n    );`,
    `  collectData() {\n    const feelings = this.getFeelingRatings();\n    const emotion = feelings.map((item) => item.feeling).join(', ');\n    const intensityValue = feelings.length ? Math.max(...feelings.map((item) => item.intensity)) : undefined;`,
    'Journal collect per-feeling ratings',
  );
  source = replaceOnce(source, '    return { emotion, intensity: intensityValue, needs, tags, notes };', '    return { feelings, emotion, intensity: intensityValue, needs, tags, notes };', 'Journal collect return');

  const setValuesOld = `    this.setCatalogValues('feeling', normalizeList(data.emotion));\n    if (this.notesInput) {`;
  const setValuesNew = `    const legacyFeelings = normalizeList(data.emotion);\n    const legacyIntensity = normalizeNumber(data.intensity, 0, this.options.intensityRange.max) ?? this.defaultIntensity;\n    const feelingRatings = Array.isArray(data.feelings) && data.feelings.length\n      ? data.feelings\n      : legacyFeelings.map((feeling) => ({ feeling, intensity: legacyIntensity }));\n    this.setFeelingRatings(feelingRatings);\n    if (this.notesInput) {`;
  source = replaceOnce(source, setValuesOld, setValuesNew, 'Journal setValues feeling migration');

  const standaloneSet = `    if (this.intensityInput) {\n      const intensityValue = normalizeNumber(\n        data.intensity,\n        this.options.intensityRange.min,\n        this.options.intensityRange.max,\n      );\n      this.intensityInput.value = intensityValue !== undefined ? String(intensityValue) : String(this.defaultIntensity);\n      this.updateIntensityDisplay(intensityValue ?? this.defaultIntensity);\n    }\n`;
  source = replaceOnce(source, standaloneSet, '', 'obsolete standalone intensity restoration');

  source = replaceOnce(
    source,
    `    this.emotionOptions = [...new Map(options.map((label) => [label.toLowerCase(), label])).values()];\n    this.setCatalogValues('feeling', this.getCatalogValues('feeling'));`,
    `    const existingRatings = this.getFeelingRatings();\n    this.emotionOptions = [...new Map(options.map((label) => [label.toLowerCase(), label])).values()];\n    this.setFeelingRatings(existingRatings);`,
    'preserve ratings when feelings catalog loads',
  );

  write(path, source);
}

// Journal History: display and summarize the canonical per-feeling ratings, with legacy fallback.
{
  const path = 'scripts/inventory.js';
  let source = read(path);

  const helper = `function parseJournalFeelingRatings(entry) {\n  if (Array.isArray(entry?.feelings) && entry.feelings.length) {\n    return entry.feelings\n      .map((item) => ({\n        feeling: (item?.feeling || item?.emotion || '').toString().trim(),\n        intensity: Number(item?.intensity),\n      }))\n      .filter((item) => item.feeling && Number.isFinite(item.intensity) && item.intensity > 0);\n  }\n  const fallback = Number.isFinite(Number(entry?.intensity)) ? Math.min(10, Math.max(1, Math.round(Number(entry.intensity)))) : 5;\n  return parseJournalFeelings(entry?.emotion).map((feeling) => ({ feeling, intensity: fallback }));\n}\n\n`;
  source = replaceOnce(source, 'function renderJournalHistory() {', helper + 'function renderJournalHistory() {', 'history feeling rating helper');

  source = replaceOnce(
    source,
    `  const intensityEntries = entries.filter((entry) => Number.isFinite(entry.intensity));\n  const averageIntensity = intensityEntries.length\n    ? (intensityEntries.reduce((sum, entry) => sum + entry.intensity, 0) / intensityEntries.length).toFixed(1)\n    : '—';`,
    `  const feelingRatings = entries.flatMap((entry) => parseJournalFeelingRatings(entry));\n  const averageIntensity = feelingRatings.length\n    ? (feelingRatings.reduce((sum, item) => sum + item.intensity, 0) / feelingRatings.length).toFixed(1)\n    : '—';`,
    'Journal summary average rating',
  );

  source = replaceOnce(
    source,
    `  const emotionCounts = new Map();\n  entries.forEach((entry) => {\n    if (!entry.emotion) {\n      return;\n    }\n    const key = entry.emotion.trim().toLowerCase();\n    if (!key) {\n      return;\n    }\n    emotionCounts.set(key, (emotionCounts.get(key) || 0) + 1);\n  });`,
    `  const emotionCounts = new Map();\n  entries.forEach((entry) => {\n    parseJournalFeelingRatings(entry).forEach(({ feeling }) => {\n      const key = feeling.trim().toLowerCase();\n      if (key) emotionCounts.set(key, (emotionCounts.get(key) || 0) + 1);\n    });\n  });`,
    'Journal summary feeling counts',
  );

  source = replaceOnce(
    source,
    `    const feelings = parseJournalFeelings(entry.emotion);\n    emotion.textContent = feelings.length ? feelings.join(', ') : 'Reflection';\n    titleRow.appendChild(emotion);\n    if (Number.isFinite(entry.intensity)) {\n      const intensity = document.createElement('span');\n      intensity.className = 'journal-entry__intensity';\n      intensity.textContent = \`${'${entry.intensity}/10'}\`;\n      intensity.setAttribute('aria-label', \`Intensity ${'${entry.intensity}'} out of 10\`);\n      titleRow.appendChild(intensity);\n    }`,
    `    const feelings = parseJournalFeelingRatings(entry);\n    emotion.textContent = feelings.length\n      ? feelings.map(({ feeling, intensity }) => \`${'${feeling} ${intensity}/10'}\`).join(' · ')\n      : 'Reflection';\n    titleRow.appendChild(emotion);`,
    'history card feeling intensities',
  );

  source = replaceOnce(
    source,
    `      const feelings = parseJournalFeelings(entry.emotion);\n      const emotionLabel = feelings.length ? \`${'${feelings.join(\', \')} — '}\` : '';`,
    `      const feelings = parseJournalFeelingRatings(entry);\n      const emotionLabel = feelings.length\n        ? \`${'${feelings.map(({ feeling, intensity }) => `${feeling} ${intensity}/10`).join(\', \')} — '}\`\n        : '';`,
    'overlay history feeling intensities',
  );

  source = replaceOnce(
    source,
    `  populateJournalHistorySelect(state.journalFiltersForm.querySelector('[name="emotion"]'), unique(entries.flatMap((entry) => parseJournalFeelings(entry.emotion))));`,
    `  populateJournalHistorySelect(state.journalFiltersForm.querySelector('[name="emotion"]'), unique(entries.flatMap((entry) => parseJournalFeelingRatings(entry).map((item) => item.feeling))));`,
    'history feeling filter options',
  );
  source = replaceOnce(
    source,
    `  if (emotionFilter) filtered = filtered.filter((entry) => parseJournalFeelings(entry.emotion).some((feeling) => normalize(feeling) === emotionFilter));`,
    `  if (emotionFilter) filtered = filtered.filter((entry) => parseJournalFeelingRatings(entry).some(({ feeling }) => normalize(feeling) === emotionFilter));`,
    'history per-feeling filter',
  );

  write(path, source);
}

// Presentation owner: compact native rows inside the Feeling popup, with 0 as the unselected state.
{
  const path = 'styles/shared-density.css';
  let source = read(path);
  if (source.includes('.journal-feeling-rating {')) throw new Error('Per-feeling Journal styles already present');
  source += `\n\n/* Journal Feeling popup: each Feeling owns its own 0–10 intensity. */\n.journal-feeling-rating { min-height:48px; display:grid; grid-template-columns:minmax(7.2rem,.9fr) minmax(8.5rem,1.25fr); align-items:center; gap:.7rem; padding:.42rem .55rem; border-radius:var(--radius-md); color:var(--ink); }\n.journal-feeling-rating + .journal-feeling-rating { border-top:1px solid color-mix(in srgb,var(--outline) 8%,transparent); border-radius:0; }\n.journal-feeling-rating.is-selected { background:color-mix(in srgb,#fff 72%,var(--mint) 28%); }\n.journal-feeling-rating__label { min-width:0; font-size:.88rem; font-weight:650; line-height:1.2; }\n.journal-feeling-rating__control { display:grid; grid-template-columns:minmax(0,1fr) 1.6rem; align-items:center; gap:.42rem; min-width:0; }\n.journal-feeling-rating__slider { width:100%; min-width:0; margin:0; accent-color:var(--plum); }\n.journal-feeling-rating__value { font-size:.78rem; font-weight:750; color:var(--ink-soft); text-align:right; font-variant-numeric:tabular-nums; }\n@media (max-width:420px) { .journal-feeling-rating { grid-template-columns:minmax(6.4rem,.82fr) minmax(7.6rem,1.18fr); gap:.48rem; padding-inline:.42rem; } .journal-feeling-rating__label { font-size:.82rem; } }\n`;
  write(path, source);
}

// Permanent regression contract.
{
  const path = 'tests/journal-native-ux.test.mjs';
  let source = read(path);
  source = source.replace(
    "test('Journal Feeling and Needs are catalog-backed popup multi-selectors'",
    "test('Journal Feeling intensity is selected inside the Feeling popup and Needs remains a catalog popup'",
  );
  source = replaceOnce(
    source,
    `  assert.ok(css.includes('.journal-catalog-option.is-selected'));`,
    `  assert.ok(css.includes('.journal-catalog-option.is-selected'));\n  assert.ok(moduleSource.includes("data-journal-feeling-intensity"));\n  assert.ok(moduleSource.includes("min: 0"));\n  assert.ok(moduleSource.includes("const feelings = this.getFeelingRatings()"));\n  assert.ok(!moduleSource.includes("'journal-meta-row--intensity'"));\n  assert.ok(css.includes('.journal-feeling-rating {'));`,
    'Journal native UX feeling intensity assertions',
  );
  source = replaceOnce(
    source,
    `  assert.ok(runtime.includes('entries.flatMap((entry) => parseJournalFeelings(entry.emotion))'));\n  assert.ok(runtime.includes('parseJournalFeelings(entry.emotion).some((feeling) => normalize(feeling) === emotionFilter)'));`,
    `  assert.ok(runtime.includes('function parseJournalFeelingRatings(entry)'));\n  assert.ok(runtime.includes('parseJournalFeelingRatings(entry).map((item) => item.feeling)'));\n  assert.ok(runtime.includes('parseJournalFeelingRatings(entry).some(({ feeling }) => normalize(feeling) === emotionFilter)'));`,
    'Journal history per-feeling assertions',
  );
  write(path, source);

  const modelTest = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { promises as fs } from 'node:fs';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');\nconst load = (relative) => fs.readFile(path.join(root, relative), 'utf8');\n\ntest('Journal canonical model stores intensity per feeling with legacy compatibility fields', async () => {\n  const model = await load('assets/js/journal/model.js');\n  const store = await load('assets/js/journal/store.js');\n  const moduleSource = await load('assets/js/journal/module.js');\n  assert.ok(model.includes('feelings: []'));\n  assert.ok(store.includes('const normalizeFeelingRatings ='));\n  assert.ok(store.includes('Math.max(...overrides.feelings.map((item) => item.intensity))'));\n  assert.ok(moduleSource.includes('return { feelings, emotion, intensity: intensityValue, needs, tags, notes }'));\n  assert.ok(moduleSource.includes("aria-label': `${option.label} intensity; 0 means not selected`"));\n});\n`;
  write('tests/journal-per-feeling-intensity.test.mjs', modelTest);

  const packagePath = 'package.json';
  const pkg = JSON.parse(read(packagePath));
  if (!pkg.scripts['test:flicker-jitter'].includes('tests/journal-per-feeling-intensity.test.mjs')) {
    pkg.scripts['test:flicker-jitter'] = pkg.scripts['test:flicker-jitter'].replace('tests/journal-native-ux.test.mjs', 'tests/journal-native-ux.test.mjs tests/journal-per-feeling-intensity.test.mjs');
  }
  write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

console.log('Per-feeling Journal intensity refactor applied.');
