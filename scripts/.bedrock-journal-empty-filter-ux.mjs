import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`Non-unique ${label}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

// Canonical generated Journal shell: no filter controls when there is no history,
// and contextual default values instead of ambiguous "All" options.
{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);

  source = replaceOnce(
    source,
    '<label class="journal-history-control" for="journal-filter-emotion"><span>Feeling</span><select id="journal-filter-emotion" name="emotion" aria-label="Feeling"><option value="">Feeling</option></select></label>',
    '<label class="journal-history-control" for="journal-filter-emotion"><span>Feeling</span><select id="journal-filter-emotion" name="emotion" aria-label="Feeling"><option value="">Any feeling</option></select></label>',
    'Feeling filter default label',
  );
  source = replaceOnce(
    source,
    '<label class="journal-history-control" for="journal-filter-need"><span>Need</span><select id="journal-filter-need" name="need" aria-label="Need"><option value="">Need</option></select></label>',
    '<label class="journal-history-control" for="journal-filter-need"><span>Need</span><select id="journal-filter-need" name="need" aria-label="Need"><option value="">Any need</option></select></label>',
    'Need filter default label',
  );
  source = replaceOnce(
    source,
    '<label class="journal-history-control" for="journal-filter-tag"><span>Tag</span><select id="journal-filter-tag" name="tag" aria-label="Tag"><option value="">Tag</option></select></label>',
    '<label class="journal-history-control" for="journal-filter-tag"><span>Tag</span><select id="journal-filter-tag" name="tag" aria-label="Tag"><option value="">Any tag</option></select></label>',
    'Tag filter default label',
  );
  source = replaceOnce(
    source,
    '<p class="journal-empty" data-journal-empty hidden>Save an entry to see it here.</p>',
    '<div class="journal-empty journal-empty--history" data-journal-empty hidden><strong class="journal-empty__title">No entries yet</strong><span class="journal-empty__description">Save your first entry to start building history and patterns. Filters will appear once there is something to explore.</span></div>',
    'Journal History empty state markup',
  );

  const controlsCss = `      main[data-page-id='inventory-journal'] .journal-history-controls {\n        display: grid;\n        gap: 0.48rem;\n      }`;
  const controlsCssReplacement = `${controlsCss}\n\n      main[data-page-id='inventory-journal'] .journal-history-controls[hidden],\n      main[data-page-id='inventory-journal'] .journal-history-control[hidden] {\n        display: none !important;\n      }\n\n      main[data-page-id='inventory-journal'] .journal-empty--history {\n        gap: 0.28rem;\n        padding: 0.78rem 0.85rem;\n        border-style: solid;\n        border-color: color-mix(in srgb, var(--outline) 14%, transparent);\n        background: color-mix(in srgb, #ffffff 94%, var(--lavender) 6%);\n      }\n\n      main[data-page-id='inventory-journal'] .journal-empty--history .journal-empty__title {\n        font-size: 0.9rem;\n        font-weight: 760;\n      }\n\n      main[data-page-id='inventory-journal'] .journal-empty--history .journal-empty__description {\n        font-size: 0.78rem;\n        line-height: 1.35;\n        color: var(--ink-soft);\n      }`;
  source = replaceOnce(source, controlsCss, controlsCssReplacement, 'Journal History empty-state CSS');

  write(path, source);
}

// Runtime owner: filter controls only exist visually when there is data to filter;
// each filter dimension names its neutral state in plain language.
{
  const path = 'scripts/inventory.js';
  let source = read(path);

  const populatePattern = /function populateJournalHistorySelect\(select, entries\) \{[\s\S]*?\n\}/;
  const populateMatch = source.match(populatePattern);
  if (!populateMatch) throw new Error('Missing populateJournalHistorySelect');
  source = source.replace(populatePattern, `function populateJournalHistorySelect(select, entries) {\n  if (!select) return;\n  const current = select.value || '';\n  const neutralLabels = {\n    emotion: 'Any feeling',\n    need: 'Any need',\n    tag: 'Any tag',\n  };\n  const neutralLabel = neutralLabels[select.name] || 'Any';\n  select.replaceChildren(new Option(neutralLabel, ''), ...entries.map(({ value, label }) => new Option(label, value)));\n  if ([...select.options].some((option) => option.value === current)) select.value = current;\n  const control = select.closest('.journal-history-control');\n  if (control && Object.prototype.hasOwnProperty.call(neutralLabels, select.name)) {\n    control.hidden = entries.length === 0;\n  }\n}`);

  const renderPattern = /function renderJournalHistory\(\) \{[\s\S]*?\n  entries\.forEach\(\(entry\) => \{/;
  const renderMatch = source.match(renderPattern);
  if (!renderMatch) throw new Error('Missing renderJournalHistory opening');
  const renderReplacement = `function renderJournalHistory() {\n  if (!state.journalHistoryEl) return;\n  const allEntries = Array.isArray(state.journalEntries) ? state.journalEntries : [];\n  const hasJournalEntries = allEntries.length > 0;\n  if (state.journalFiltersForm) state.journalFiltersForm.hidden = !hasJournalEntries;\n  syncJournalHistoryFilterOptions();\n  updateJournalFiltersResetVisibility();\n  const container = state.journalHistoryEl;\n  container.innerHTML = '';\n  const entries = getFilteredJournalEntries();\n  if (state.journalEmptyEl) {\n    const title = state.journalEmptyEl.querySelector('.journal-empty__title');\n    const description = state.journalEmptyEl.querySelector('.journal-empty__description');\n    state.journalEmptyEl.hidden = entries.length > 0;\n    if (title) title.textContent = hasJournalEntries ? 'No matches' : 'No entries yet';\n    if (description) {\n      description.textContent = hasJournalEntries\n        ? 'Try another filter or clear filters.'\n        : 'Save your first entry to start building history and patterns. Filters will appear once there is something to explore.';\n    }\n  }\n  if (!entries.length) return;\n\n  entries.forEach((entry) => {`;
  source = source.replace(renderPattern, renderReplacement);

  write(path, source);
}

// Permanent acceptance contract.
{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = read(path);
  const anchor = "  assert.ok(css.includes('.journal-inline-fallback[open] .journal-form,'), 'fallback form must use the full available inline width');";
  if (!source.includes(anchor)) throw new Error('Missing final hierarchy test anchor');
  const extra = `${anchor}\n  assert.ok(build.includes('>Any feeling</option>'), 'Feeling filter neutral state must be contextual');\n  assert.ok(build.includes('>Any need</option>'), 'Need filter neutral state must be contextual');\n  assert.ok(build.includes('>Any tag</option>'), 'Tag filter neutral state must be contextual');\n  assert.ok(build.includes('journal-empty--history'), 'Journal History must ship a purposeful empty state');\n  assert.ok(runtime.includes("state.journalFiltersForm.hidden = !hasJournalEntries"), 'filters must disappear when there is nothing to filter');\n  assert.ok(runtime.includes("control.hidden = entries.length === 0"), 'empty filter dimensions must stay out of the UI');\n  assert.ok(runtime.includes("'No matches'"), 'filtered-empty history must distinguish no matches from no entries');`;
  source = replaceOnce(source, anchor, extra, 'final hierarchy Journal filter assertions');
  write(path, source);
}

console.log('Journal empty-state and filter UX repair applied.');
