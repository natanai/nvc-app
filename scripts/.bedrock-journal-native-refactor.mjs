import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, value) {
  writeFileSync(path, value, 'utf8');
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing replacement target: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Replacement target is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`Expected one ${label} match, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

// 1) Shared Journal renderer: one metadata group and one interaction grammar.
{
  const path = 'assets/js/journal/module.js';
  let source = read(path);

  source = replaceOnce(source, "  needsMode: 'select',", "  needsMode: 'combobox',", 'Journal needs mode');
  source = replaceOnce(
    source,
`  labels: {
    emotion: 'Emotion (optional)',
    intensity: 'Intensity',
    needs: 'Related needs',
    tags: 'Tags (optional)',
    notes: 'Reflection',
  },
  hints: {
    emotion: 'Use any word that fits. Leave blank if unsure.',
    intensity: 'How strong is it right now?',
    needs: 'Choose any needs that connect. Leave blank if unsure.',
    tags: 'Separate tags with commas.',
    notes: '',
  },
  placeholders: {
    emotion: '',
    needs: '',
    tags: 'work, weekend, boundaries',
    notes: '',
  },`,
`  labels: {
    emotion: 'Feeling',
    intensity: 'Intensity',
    needs: 'Needs',
    tags: 'Tags',
    notes: 'Reflection',
  },
  hints: {
    emotion: '',
    intensity: '',
    needs: '',
    tags: '',
    notes: '',
  },
  placeholders: {
    emotion: 'Choose or type',
    needs: 'Add needs',
    tags: 'Add tags',
    notes: '',
  },`,
    'Journal concise labels',
  );
  source = replaceOnce(
    source,
    "    grid: ['journal-form__grid', 'inventory-journal-form__grid'],",
    "    grid: ['journal-meta-group'],",
    'Journal metadata group class',
  );
  source = replaceOnce(
    source,
`    intensityField: [
      'journal-form__field',
      'journal-form__field--intensity',
      'inventory-journal-form__field',
      'inventory-journal-form__field--intensity',
    ],`,
`    intensityField: ['journal-meta-row', 'journal-meta-row--intensity'],`,
    'Journal intensity row class',
  );

  const fieldHelper = `const buildJournalField = ({
  config,
  label,
  id,
  input,
  hint,
  fieldClasses,
}) => {
  const field = createElement('div', { classes: fieldClasses || config.classes.field });
  const labelEl = createElement('label', { attrs: { for: id }, text: label });
  field.append(labelEl, input);
  if (hint) {
    field.append(createElement('p', { classes: config.classes.hint, text: hint }));
  }
  return field;
};`;
  const metaHelper = `${fieldHelper}\n\nconst buildJournalMetaRow = ({ config, label, id, input, modifier = '', suggestions = null }) => {\n  const classes = ['journal-meta-row'];\n  if (modifier) classes.push(\`journal-meta-row--\${modifier}\`);\n  const row = createElement('div', { classes });\n  const labelEl = createElement('label', { attrs: { for: id }, text: label });\n  const control = createElement('div', { classes: ['journal-meta-row__control'] });\n  control.append(input);\n  if (suggestions) control.append(suggestions);\n  row.append(labelEl, control);\n  return row;\n};`;
  source = replaceOnce(source, fieldHelper, metaHelper, 'Journal metadata row helper');

  source = replaceRegexOnce(
    source,
    /const buildNeedsField = \(config\) => \{[\s\S]*?\n\};\n\nconst buildTagsField/,
`const buildNeedsField = (config) => {
  const id = \`${'${config.idPrefix}'}-needs\`;
  const input = createElement('input', {
    attrs: {
      id,
      name: 'needs',
      type: 'text',
      autocomplete: 'off',
      placeholder: config.placeholders.needs || '',
    },
  });
  input.setAttribute('data-journal-needs', '');
  const suggestions = createElement('div', {
    classes: ['journal-tag-suggestions'],
    attrs: {
      'data-journal-need-suggestions': '',
      hidden: true,
      role: 'listbox',
      'aria-label': config.aria.needSuggestions,
    },
  });
  return buildJournalMetaRow({
    config,
    label: config.labels.needs,
    id,
    input,
    modifier: 'needs',
    suggestions,
  });
};

const buildTagsField`,
    'Journal needs field',
  );

  source = replaceRegexOnce(
    source,
    /const buildTagsField = \(config\) => \{[\s\S]*?\n\};\n\nconst buildPrompts/,
`const buildTagsField = (config) => {
  const id = \`${'${config.idPrefix}'}-tags\`;
  const input = createElement('input', {
    attrs: {
      id,
      name: 'tags',
      type: 'text',
      autocomplete: 'off',
      placeholder: config.placeholders.tags || '',
    },
  });
  input.setAttribute('data-journal-tags', '');
  const suggestions = createElement('div', {
    classes: ['journal-tag-suggestions'],
    attrs: {
      'data-journal-tag-suggestions': '',
      hidden: true,
      role: 'listbox',
      'aria-label': config.aria.tagSuggestions,
    },
  });
  return buildJournalMetaRow({
    config,
    label: config.labels.tags,
    id,
    input,
    modifier: 'tags',
    suggestions,
  });
};

const buildPrompts`,
    'Journal tags field',
  );

  source = replaceRegexOnce(
    source,
    /  const emotionId = `\$\{config\.idPrefix\}-emotion`;[\s\S]*?  grid\.append\(emotionField\);/,
`  const emotionId = \`${'${config.idPrefix}'}-emotion\`;
  const emotionInput = createElement('input', {
    attrs: {
      id: emotionId,
      name: 'emotion',
      type: 'text',
      autocomplete: 'off',
      placeholder: config.placeholders.emotion || '',
    },
  });
  emotionInput.setAttribute('data-journal-emotion', '');
  grid.append(
    buildJournalMetaRow({
      config,
      label: config.labels.emotion,
      id: emotionId,
      input: emotionInput,
      modifier: 'feeling',
    }),
  );`,
    'Journal feeling row',
  );

  source = replaceRegexOnce(
    source,
    /  const intensityId = `\$\{config\.idPrefix\}-intensity`;[\s\S]*?  grid\.append\(intensityField\);/,
`  const intensityId = \`${'${config.idPrefix}'}-intensity\`;
  const intensityField = createElement('div', { classes: config.classes.intensityField });
  const intensityLabel = createElement('label', { attrs: { for: intensityId }, text: config.labels.intensity });
  const intensityControl = createElement('div', { classes: ['journal-meta-row__control'] });
  const intensityWrap = createElement('div', { classes: config.classes.intensityWrap });
  const intensityInput = createElement('input', {
    attrs: {
      id: intensityId,
      name: 'intensity',
      type: 'range',
      min: config.intensityRange.min,
      max: config.intensityRange.max,
      value: config.intensityRange.defaultValue,
      step: 1,
    },
  });
  intensityInput.setAttribute('data-journal-intensity', '');
  const intensityOutput = createElement('output', {
    classes: config.classes.intensityOutput,
    attrs: { for: intensityId },
    text: \`${'${config.intensityRange.defaultValue}'}/10\`,
  });
  intensityOutput.setAttribute('data-journal-intensity-display', '');
  intensityWrap.append(intensityInput, intensityOutput);
  intensityControl.append(intensityWrap);
  intensityField.append(intensityLabel, intensityControl);
  grid.append(intensityField);`,
    'Journal intensity row',
  );

  write(path, source);
}

// 2) History: same vocabulary for Feeling / Need / Tag, compact native controls.
{
  const path = 'scripts/inventory.js';
  let source = read(path);
  source = source.replaceAll(
    "journalFilters: { search: '', tag: '', sort: 'newest', range: 'all' },",
    "journalFilters: { search: '', emotion: '', need: '', tag: '', sort: 'newest', range: 'all' },",
  );

  source = replaceRegexOnce(
    source,
    /function renderJournalHistory\(\) \{[\s\S]*?\n\}\n\nfunction renderJournalOverlayHistory/,
`function renderJournalHistory() {
  if (!state.journalHistoryEl) return;
  syncJournalHistoryFilterOptions();
  const container = state.journalHistoryEl;
  container.innerHTML = '';
  const entries = getFilteredJournalEntries();
  if (state.journalEmptyEl) state.journalEmptyEl.hidden = entries.length > 0;
  if (!entries.length) return;

  entries.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'journal-entry';
    card.dataset.journalId = entry.id;

    const header = document.createElement('div');
    header.className = 'journal-entry__header';
    const titleRow = document.createElement('div');
    titleRow.className = 'journal-entry__title-row';
    const emotion = document.createElement('h4');
    emotion.className = 'journal-entry__emotion';
    emotion.textContent = entry.emotion ? capitalizeWord(entry.emotion) : 'Reflection';
    titleRow.appendChild(emotion);
    if (Number.isFinite(entry.intensity)) {
      const intensity = document.createElement('span');
      intensity.className = 'journal-entry__intensity';
      intensity.textContent = \`${'${entry.intensity}'}/10\`;
      intensity.setAttribute('aria-label', \`Intensity ${'${entry.intensity}'} out of 10\`);
      titleRow.appendChild(intensity);
    }
    header.appendChild(titleRow);
    const meta = document.createElement('div');
    meta.className = 'journal-entry__meta';
    meta.textContent = formatJournalDate(entry.dateISO);
    header.appendChild(meta);
    card.appendChild(header);

    if (entry.notes) {
      const notes = document.createElement('p');
      notes.className = 'journal-entry__notes';
      notes.textContent = entry.notes;
      card.appendChild(notes);
    }

    if ((Array.isArray(entry.needs) && entry.needs.length) || (Array.isArray(entry.tags) && entry.tags.length)) {
      const facets = document.createElement('div');
      facets.className = 'journal-entry__facets';
      (entry.needs || []).forEach((needValue) => {
        const { href, label } = buildNeedLink(needValue);
        const link = document.createElement('a');
        link.className = 'journal-value-token journal-value-token--need';
        link.href = href;
        link.textContent = label;
        facets.appendChild(link);
      });
      (entry.tags || []).forEach((tag) => {
        const chip = document.createElement('span');
        chip.className = 'journal-value-token journal-value-token--tag';
        chip.textContent = \`#${'${tag}'}\`;
        facets.appendChild(chip);
      });
      card.appendChild(facets);
    }

    const actions = document.createElement('div');
    actions.className = 'journal-entry__actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'journal-entry__edit';
    editButton.dataset.journalAction = 'edit';
    editButton.dataset.journalId = entry.id;
    editButton.textContent = 'Edit';
    actions.appendChild(editButton);
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'journal-entry__delete';
    deleteButton.dataset.journalAction = 'delete';
    deleteButton.dataset.journalId = entry.id;
    deleteButton.textContent = 'Delete';
    actions.appendChild(deleteButton);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function renderJournalOverlayHistory`,
    'Journal history renderer',
  );

  source = replaceRegexOnce(
    source,
    /function getFilteredJournalEntries\(\) \{[\s\S]*?\n\}\n\nfunction showJournalStatus/,
`function populateJournalHistorySelect(select, entries, allLabel = 'All') {
  if (!select) return;
  const current = select.value || '';
  select.innerHTML = '';
  const all = document.createElement('option');
  all.value = '';
  all.textContent = allLabel;
  select.appendChild(all);
  entries.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  select.value = Array.from(select.options).some((option) => option.value === current) ? current : '';
}

function syncJournalHistoryFilterOptions() {
  if (!state.journalFiltersForm) return;
  const entries = Array.isArray(state.journalEntries) ? state.journalEntries : [];
  const unique = (values, labeler = (value) => value) => {
    const map = new Map();
    values.filter(Boolean).forEach((value) => {
      const raw = value.toString().trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!map.has(key)) map.set(key, { value: raw, label: labeler(raw) });
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  };
  const emotions = unique(entries.map((entry) => entry.emotion), capitalizeWord);
  const needs = unique(entries.flatMap((entry) => entry.needs || []), (value) => buildNeedLink(value).label);
  const tags = unique(entries.flatMap((entry) => entry.tags || []), (value) => \`#${'${value}'}\`);
  populateJournalHistorySelect(state.journalFiltersForm.querySelector('[name="emotion"]'), emotions);
  populateJournalHistorySelect(state.journalFiltersForm.querySelector('[name="need"]'), needs);
  populateJournalHistorySelect(state.journalFiltersForm.querySelector('[name="tag"]'), tags);
}

function getFilteredJournalEntries() {
  const entries = Array.isArray(state.journalEntries) ? [...state.journalEntries] : [];
  const normalize = (value) => (value || '').toString().trim().toLowerCase();
  const searchTerm = normalize(state.journalFilters.search);
  const emotionFilter = normalize(state.journalFilters.emotion);
  const needFilter = normalize(state.journalFilters.need);
  const tagFilter = normalize(state.journalFilters.tag);
  const sort = state.journalFilters.sort || 'newest';
  const range = state.journalFilters.range || 'all';

  let filtered = entries;
  if (searchTerm) {
    filtered = filtered.filter((entry) =>
      [entry.notes || '', entry.emotion || '', ...(entry.tags || []), ...(entry.needs || [])]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm),
    );
  }
  if (emotionFilter) filtered = filtered.filter((entry) => normalize(entry.emotion) === emotionFilter);
  if (needFilter) filtered = filtered.filter((entry) => (entry.needs || []).some((need) => normalize(need) === needFilter));
  if (tagFilter) filtered = filtered.filter((entry) => (entry.tags || []).some((tag) => normalize(tag) === tagFilter));

  if (range !== 'all') {
    const days = Number(range);
    if (Number.isFinite(days) && days > 0) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((entry) => {
        const time = new Date(entry.dateISO || 0).getTime();
        return Number.isFinite(time) && time >= cutoff;
      });
    }
  }

  const newest = (a, b) => new Date(b.dateISO || 0) - new Date(a.dateISO || 0);
  if (sort === 'oldest') filtered.sort((a, b) => new Date(a.dateISO || 0) - new Date(b.dateISO || 0));
  else if (sort === 'intensity-high') {
    filtered.sort((a, b) => {
      const aVal = Number.isFinite(a.intensity) ? a.intensity : -Infinity;
      const bVal = Number.isFinite(b.intensity) ? b.intensity : -Infinity;
      return bVal === aVal ? newest(a, b) : bVal - aVal;
    });
  } else if (sort === 'intensity-low') {
    filtered.sort((a, b) => {
      const aVal = Number.isFinite(a.intensity) ? a.intensity : Infinity;
      const bVal = Number.isFinite(b.intensity) ? b.intensity : Infinity;
      return aVal === bVal ? newest(a, b) : aVal - bVal;
    });
  } else filtered.sort(newest);
  return filtered;
}

function showJournalStatus`,
    'Journal history filtering',
  );

  source = replaceRegexOnce(
    source,
    /function handleJournalFiltersChange\(\) \{[\s\S]*?\n\}\n\nfunction handleJournalFiltersReset\(\) \{[\s\S]*?\n\}/,
`function handleJournalFiltersChange() {
  if (!state.journalFiltersForm) return;
  const formData = new FormData(state.journalFiltersForm);
  state.journalFilters = {
    search: (formData.get('search') || '').toString().trim(),
    emotion: (formData.get('emotion') || '').toString().trim(),
    need: (formData.get('need') || '').toString().trim(),
    tag: (formData.get('tag') || '').toString().trim(),
    sort: (formData.get('sort') || 'newest').toString(),
    range: (formData.get('range') || 'all').toString(),
  };
  renderJournalHistory();
}

function handleJournalFiltersReset() {
  if (!state.journalFiltersForm) return;
  state.journalFiltersForm.reset();
  state.journalFilters = { search: '', emotion: '', need: '', tag: '', sort: 'newest', range: 'all' };
  renderJournalHistory();
}`,
    'Journal filter handlers',
  );

  source = source.replaceAll(
`    if (state.journalFiltersForm) {
      state.journalFiltersForm.addEventListener('input', handleJournalFiltersChange);
    }`,
`    if (state.journalFiltersForm) {
      state.journalFiltersForm.addEventListener('input', handleJournalFiltersChange);
      state.journalFiltersForm.addEventListener('change', handleJournalFiltersChange);
    }`,
  );
  write(path, source);
}

// 3) Generator owns the final static Journal history controls; remove prototype helper prose.
{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);
  source = replaceOnce(
    source,
    `                  <p class="journal-form-section__hint">Tag what’s present now. Feeling optional—notes are enough.</p>\n`,
    '',
    'Journal prototype helper copy',
  );
  source = replaceRegexOnce(
    source,
    /        <section class="journal-history-section journal-panel journal-panel--history" aria-labelledby="journal-history-heading">[\s\S]*?<div class="journal-history journal-history--cards" data-journal-history><\/div>\n        <\/section>/,
`        <section class="journal-history-section journal-panel journal-panel--history" aria-labelledby="journal-history-heading">
          <div class="journal-history-section__header">
            <h2 id="journal-history-heading" class="section-title">Journal history</h2>
          </div>
          <form class="journal-history-controls" data-journal-filters>
            <div class="journal-history-controls__search">
              <label class="visually-hidden" for="journal-filter-search">Search journal</label>
              <input id="journal-filter-search" name="search" type="search" placeholder="Search journal" autocomplete="off" />
            </div>
            <div class="journal-history-controls__choices" aria-label="Filter journal history">
              <label class="journal-history-control" for="journal-filter-emotion"><span>Feeling</span><select id="journal-filter-emotion" name="emotion" data-journal-filter-emotion><option value="">All</option></select></label>
              <label class="journal-history-control" for="journal-filter-need"><span>Need</span><select id="journal-filter-need" name="need" data-journal-filter-need><option value="">All</option></select></label>
              <label class="journal-history-control" for="journal-filter-tag"><span>Tag</span><select id="journal-filter-tag" name="tag" data-journal-filter-tag><option value="">All</option></select></label>
            </div>
            <div class="journal-history-controls__secondary">
              <label class="journal-history-control" for="journal-filter-range"><span>Date</span><select id="journal-filter-range" name="range"><option value="all">Any time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
              <label class="journal-history-control" for="journal-filter-sort"><span>Sort</span><select id="journal-filter-sort" name="sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="intensity-high">Highest intensity</option><option value="intensity-low">Lowest intensity</option></select></label>
              <button type="button" class="journal-history-controls__clear app-action app-action--quiet" data-journal-filters-reset>Clear</button>
            </div>
          </form>
          <p class="journal-empty" data-journal-empty hidden>Save an entry to see it here.</p>
          <div class="journal-history journal-history--cards" data-journal-history></div>
        </section>`,
    'Journal history generator markup',
  );
  write(path, source);
}

// 4) Canonical shared deterministic component styles. These are new component classes,
// not an override layer cancelling the prototype card selectors.
{
  const path = 'styles/shared-density.css';
  let source = read(path);
  if (source.includes('.journal-meta-group {')) throw new Error('Journal native UX styles already present');
  const css = `

/* Journal metadata and history controls: canonical compact component contract. */
.journal-meta-group {
  display: grid;
  gap: 0;
  overflow: visible;
  border: 1px solid color-mix(in srgb, var(--outline) 16%, transparent);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, #fff 96%, var(--lavender) 4%);
}

.journal-meta-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(5rem, 0.72fr) minmax(0, 1.65fr);
  align-items: center;
  min-height: 54px;
  gap: 0.65rem;
  padding: 0.28rem 0.72rem;
  min-width: 0;
}

.journal-meta-row + .journal-meta-row {
  border-top: 1px solid color-mix(in srgb, var(--outline) 10%, transparent);
}

.journal-meta-row > label {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink);
}

.journal-meta-row__control {
  position: relative;
  min-width: 0;
}

.journal-meta-row__control > input[type='text'] {
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0.42rem 0.12rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  box-shadow: none;
  color: var(--ink);
  font: inherit;
  font-size: 0.96rem;
  text-align: right;
}

.journal-meta-row__control > input[type='text']::placeholder {
  color: color-mix(in srgb, var(--ink-soft) 56%, transparent);
  opacity: 1;
}

.journal-meta-row__control > input[type='text']:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--plum) 62%, #fff 38%);
  outline-offset: 1px;
}

.journal-meta-row .journal-form__intensity,
.journal-meta-row .inventory-journal-form__intensity {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.62rem;
  min-width: 0;
}

.journal-meta-row .journal-form__intensity-display {
  min-width: 2.9rem;
  font-size: 0.9rem;
  font-weight: 700;
  text-align: right;
  color: var(--ink-soft);
}

.journal-meta-row .journal-tag-suggestions {
  left: 0;
  right: 0;
  top: calc(100% + 0.25rem);
  z-index: 15;
}

.journal-history-controls {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}

.journal-history-controls__search input {
  width: 100%;
  min-height: 44px;
  padding: 0.55rem 0.72rem;
  border: 1px solid color-mix(in srgb, var(--outline) 16%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, #fff 96%, var(--lavender) 4%);
  box-shadow: none;
  color: var(--ink);
  font: inherit;
}

.journal-history-controls__choices,
.journal-history-controls__secondary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.journal-history-control {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.journal-history-control > span {
  padding-inline: 0.15rem;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--ink-soft);
}

.journal-history-control select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0.42rem 1.55rem 0.42rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--outline) 16%, transparent);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, #fff 96%, var(--lavender) 4%);
  box-shadow: none;
  color: var(--ink);
  font: inherit;
  font-size: 0.84rem;
  text-overflow: ellipsis;
}

.journal-history-controls__clear {
  align-self: end;
  min-height: 44px;
  padding-inline: 0.6rem;
  font-size: 0.84rem;
}

.journal-entry__title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.7rem;
}

.journal-entry__intensity {
  flex: 0 0 auto;
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--ink-soft);
}

.journal-entry__facets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.journal-value-token {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0.26rem 0.58rem;
  border: 1px solid color-mix(in srgb, var(--outline) 13%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, #fff 88%, var(--lavender) 12%);
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.2;
  text-decoration: none;
}

.journal-value-token--need {
  background: color-mix(in srgb, #fff 82%, var(--mint) 18%);
}

.journal-value-token--tag {
  color: var(--ink-soft);
}

@media (max-width: 720px) {
  .journal-meta-row {
    grid-template-columns: minmax(4.6rem, 0.68fr) minmax(0, 1.72fr);
    min-height: 52px;
    padding-inline: 0.62rem;
  }

  .journal-history-controls__choices,
  .journal-history-controls__secondary {
    gap: 0.35rem;
  }

  .journal-history-control select,
  .journal-history-controls__clear {
    font-size: 0.78rem;
  }
}
`;
  source += css;
  write(path, source);
}

// 5) Permanent regression proof for the interaction contract and root ownership.
{
  const path = 'tests/journal-native-ux.test.mjs';
  write(path, `import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('Journal metadata shares one compact interaction grammar', async () => {
  const moduleSource = await load('assets/js/journal/module.js');
  const densityCss = await load('styles/shared-density.css');
  assert.ok(moduleSource.includes("needsMode: 'combobox'"));
  assert.ok(moduleSource.includes("grid: ['journal-meta-group']"));
  assert.ok(moduleSource.includes("intensityField: ['journal-meta-row', 'journal-meta-row--intensity']"));
  assert.ok(moduleSource.includes("emotion: 'Feeling'"));
  assert.ok(moduleSource.includes("needs: 'Needs'"));
  assert.ok(moduleSource.includes("tags: 'Tags'"));
  assert.ok(!moduleSource.includes("text: 'Selected needs'"));
  assert.ok(densityCss.includes('.journal-meta-group {'));
  assert.ok(densityCss.includes('.journal-meta-row--intensity'));
});

test('Journal history reuses Feeling Need Tag vocabulary without prototype instructions', async () => {
  const builder = await load('scripts/build-pages.mjs');
  const runtime = await load('scripts/inventory.js');
  const html = await load('inventory/journal/index.html');
  for (const source of [builder, html]) {
    assert.ok(source.includes('class="journal-history-controls" data-journal-filters'));
    assert.ok(source.includes('name="emotion" data-journal-filter-emotion'));
    assert.ok(source.includes('name="need" data-journal-filter-need'));
    assert.ok(source.includes('name="tag" data-journal-filter-tag'));
    assert.ok(!source.includes('Search entries, focus on a tag, or sort by intensity to notice patterns.'));
    assert.ok(!source.includes('Tag what’s present now. Feeling optional—notes are enough.'));
  }
  assert.ok(runtime.includes('syncJournalHistoryFilterOptions'));
  assert.ok(runtime.includes("emotion: (formData.get('emotion') || '')"));
  assert.ok(runtime.includes("need: (formData.get('need') || '')"));
  assert.ok(runtime.includes('journal-value-token journal-value-token--need'));
});
`);
}

// Keep the permanent test in the normal Bedrock runtime suite.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const script = pkg.scripts['test:flicker-jitter'];
  if (!script.includes('tests/journal-native-ux.test.mjs')) {
    pkg.scripts['test:flicker-jitter'] = script.replace(
      'tests/journal-load-graph.test.mjs',
      'tests/journal-load-graph.test.mjs tests/journal-native-ux.test.mjs',
    );
  }
  write(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Update the older static-density proof so it guards the new finished copy instead.
{
  const path = 'tests/shared-density-polish.test.mjs';
  let source = read(path);
  source = source.replaceAll(
    "  assert.ok(buildPages.includes('Tag what’s present now. Feeling optional—notes are enough.'));",
    "  assert.ok(!buildPages.includes('Tag what’s present now. Feeling optional—notes are enough.'));\n  assert.ok(buildPages.includes('class=\"journal-history-controls\" data-journal-filters'));",
  );
  source = source.replaceAll(
    "  assert.ok(journalHtml.includes('Tag what’s present now. Feeling optional—notes are enough.'));",
    "  assert.ok(!journalHtml.includes('Tag what’s present now. Feeling optional—notes are enough.'));\n  assert.ok(journalHtml.includes('class=\"journal-history-controls\" data-journal-filters'));",
  );
  write(path, source);
}

console.log('Bedrock Journal native UX refactor staged successfully.');

// Push-trigger marker: the workflow already exists on this branch.
