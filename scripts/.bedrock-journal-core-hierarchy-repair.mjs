import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

function replaceRegex(source, regex, replacement, label) {
  if (source.includes(replacement.trim())) return source;
  const matches = source.match(regex);
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected one ${label}; found ${matches ? matches.length : 0}`);
  }
  return source.replace(regex, replacement);
}

{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);

  source = replaceOnce(
    source,
    "      main[data-page-id='inventory-journal'] {\n        gap: clamp(0.65rem, 1.8vw, 0.95rem);\n      }",
    "      main[data-page-id='inventory-journal'] {\n        gap: clamp(0.65rem, 1.8vw, 0.95rem);\n      }\n\n      @media (max-width: 720px) {\n        main[data-page-id='inventory-journal'].page {\n          padding-inline: max(0.78rem, env(safe-area-inset-left));\n        }\n      }",
    'Journal mobile page width rule',
  );

  source = replaceRegex(
    source,
    /      main\[data-page-id='inventory-journal'\] \.journal-history-control select,\n      main\[data-page-id='inventory-journal'\] \.journal-history-controls__clear \{[\s\S]*?      main\[data-page-id='inventory-journal'\] \.journal-history-controls__clear \{[\s\S]*?      \}/,
    `      main[data-page-id='inventory-journal'] .journal-history-control select {
        width: auto;
        min-width: 7rem;
        min-height: 44px;
        padding: 0.42rem 1.55rem 0.42rem 0.68rem;
        border: 1px solid color-mix(in srgb, var(--outline) 18%, transparent);
        border-radius: var(--radius-pill);
        background-color: color-mix(in srgb, #ffffff 94%, var(--lavender) 6%);
        box-shadow: none;
        color: var(--ink);
        font: inherit;
        font-size: 0.78rem;
        font-weight: 650;
        white-space: nowrap;
      }

      main[data-page-id='inventory-journal'] #journal-filter-range {
        min-width: 7.4rem;
      }

      main[data-page-id='inventory-journal'] #journal-filter-sort {
        min-width: 8.5rem;
      }

      main[data-page-id='inventory-journal'] .journal-history-controls__clear {
        justify-self: end;
        min-width: 0;
        min-height: 44px;
        margin: -0.08rem 0 0;
        padding: 0.22rem 0.18rem;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        box-shadow: none;
        color: var(--ink-soft);
        font: inherit;
        font-size: 0.72rem;
        font-weight: 700;
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
      }

      main[data-page-id='inventory-journal'] .journal-history-controls__clear[hidden] {
        display: none;
      }`,
    'Journal filter/select and reset styles',
  );

  source = replaceOnce(
    source,
    `              <label class="journal-history-control" for="journal-filter-sort"><span>Sort</span><select id="journal-filter-sort" name="sort" aria-label="Sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="intensity-high">Highest intensity</option><option value="intensity-low">Lowest intensity</option></select></label>
              <button type="button" class="journal-history-controls__clear" data-journal-filters-reset>Clear</button>
            </div>`,
    `              <label class="journal-history-control" for="journal-filter-sort"><span>Sort</span><select id="journal-filter-sort" name="sort" aria-label="Sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="intensity-high">Highest intensity</option><option value="intensity-low">Lowest intensity</option></select></label>
            </div>
            <button type="button" class="journal-history-controls__clear" data-journal-filters-reset hidden>Clear filters</button>`,
    'Journal filter reset placement',
  );

  source = replaceOnce(
    source,
    `          <details class="journal-summary-section journal-utility-disclosure">
            <summary class="journal-utility-disclosure__summary">
              <span>Patterns</span>
              <span class="journal-utility-disclosure__chevron" aria-hidden="true">›</span>
            </summary>
            <div class="journal-utility-disclosure__body">
              <div class="journal-summary" data-journal-summary></div>
            </div>
          </details>`,
    `          <details class="journal-summary-section journal-utility-disclosure">
            <summary class="journal-utility-disclosure__summary">
              <span class="journal-utility-disclosure__label">
                <span>Patterns</span>
                <span class="journal-utility-disclosure__hint">Trends across entries</span>
              </span>
              <span class="journal-utility-disclosure__chevron" aria-hidden="true">›</span>
            </summary>
            <div class="journal-utility-disclosure__body">
              <div class="journal-summary" data-journal-summary>
                <div class="journal-patterns-empty" data-journal-patterns-placeholder>
                  <strong>Patterns grow with your journal.</strong>
                  <span>Recurring feelings, needs, tags, and intensity trends will appear here as you save entries.</span>
                </div>
              </div>
            </div>
          </details>`,
    'Patterns disclosure markup',
  );

  source = replaceOnce(
    source,
    '<span class="journal-inline-fallback__summary-text">Trouble opening the journal?</span>',
    '<span class="journal-inline-fallback__summary-text">Fallback editor</span>',
    'fallback summary copy',
  );
  source = replaceOnce(
    source,
    '<p class="journal-inline-fallback__note">Use this inline form only if the full-screen editor will not open.</p>',
    '<p class="journal-inline-fallback__note">Use only if New entry does not open.</p>',
    'fallback helper copy',
  );

  const utilityBodyRule = `      main[data-page-id='inventory-journal'] .journal-utility-disclosure__body {
        display: grid;
        gap: 0.55rem;
        padding: 0 0.72rem 0.72rem;
      }`;
  const utilityEnhancements = `

      main[data-page-id='inventory-journal'] .journal-utility-disclosure__label {
        min-width: 0;
        display: grid;
        gap: 0.04rem;
      }

      main[data-page-id='inventory-journal'] .journal-utility-disclosure__hint {
        font-size: 0.68rem;
        font-weight: 560;
        line-height: 1.2;
        color: var(--ink-soft);
      }

      main[data-page-id='inventory-journal'] .journal-summary-section.journal-utility-disclosure {
        border-color: color-mix(in srgb, var(--outline) 24%, transparent);
        background: #ffffff;
      }

      main[data-page-id='inventory-journal'] .journal-summary-section .journal-utility-disclosure__summary {
        min-height: 54px;
        font-size: 0.9rem;
        font-weight: 780;
      }

      main[data-page-id='inventory-journal'] .journal-actions.journal-utility-disclosure {
        border-color: color-mix(in srgb, var(--outline) 12%, transparent);
        background: color-mix(in srgb, #ffffff 78%, var(--lavender) 22%);
      }

      main[data-page-id='inventory-journal'] .journal-actions .journal-utility-disclosure__summary {
        font-size: 0.78rem;
        font-weight: 680;
        color: var(--ink-soft);
      }

      main[data-page-id='inventory-journal'] .journal-patterns-empty {
        display: grid;
        gap: 0.18rem;
        padding: 0.62rem 0.68rem;
        border-radius: var(--radius-lg);
        background: color-mix(in srgb, var(--lavender) 24%, #ffffff 76%);
        color: var(--ink-soft);
        font-size: 0.76rem;
        line-height: 1.38;
      }

      main[data-page-id='inventory-journal'] .journal-patterns-empty strong {
        color: var(--ink);
        font-size: 0.8rem;
      }`;
  if (!source.includes(".journal-utility-disclosure__hint {")) {
    source = replaceOnce(
      source,
      utilityBodyRule,
      utilityBodyRule + utilityEnhancements,
      'Journal utility body style insertion',
    );
  }

  write(path, source);
}

{
  const path = 'styles.css';
  let source = read(path);
  const fallbackCss = `.journal-inline-fallback {
  margin-top: clamp(1.15rem, 3vw, 1.8rem);
  padding-top: 0.45rem;
  border-top: 1px solid color-mix(in srgb, var(--outline) 14%, transparent);
  background: none;
}

.journal-inline-fallback__summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.35rem 0.12rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: color-mix(in srgb, var(--ink-soft) 76%, transparent);
  font-size: 0.74rem;
  font-weight: 650;
  line-height: 1.25;
  cursor: pointer;
  transition: color 160ms ease;
}

.journal-inline-fallback__summary:hover,
.journal-inline-fallback__summary:focus-visible {
  border: 0;
  background: transparent;
  color: var(--ink);
}

.journal-inline-fallback__summary::after {
  content: "";
  flex-shrink: 0;
  width: 0.52rem;
  height: 0.52rem;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  transition: transform 180ms ease;
}

.journal-inline-fallback[open] .journal-inline-fallback__summary::after {
  transform: rotate(225deg);
}

.journal-inline-fallback__summary-text {
  flex: 1;
}

.journal-inline-fallback__body {
  width: 100%;
  margin-top: 0.3rem;
  display: grid;
  gap: 0.5rem;
}

.journal-inline-fallback:not([open]) > .journal-inline-fallback__body {
  display: none;
}

.journal-inline-fallback__note {
  margin: 0;
  padding: 0.2rem 0.12rem 0.4rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: color-mix(in srgb, var(--ink-soft) 72%, transparent);
  font-size: 0.72rem;
  line-height: 1.4;
}

.journal-inline-fallback__summary::-webkit-details-marker {
  display: none;
}

.journal-inline-fallback[open] .journal-panel--form-shell {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0.3rem;
  border: 0;
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, #ffffff 68%, var(--lavender) 32%);
  box-shadow: none;
}

.journal-inline-fallback[open] .journal-form,
.journal-inline-fallback[open] .inventory-journal-form {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0.48rem;
  gap: 0.65rem;
  border: 1px solid color-mix(in srgb, var(--outline) 22%, transparent);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, #ffffff 92%, var(--mint) 8%);
  box-shadow: none;
}

.journal-inline-fallback[open] .journal-form__layout,
.journal-inline-fallback[open] .journal-form__pages,
.journal-inline-fallback[open] .journal-form__page,
.journal-inline-fallback[open] .journal-form__sheet,
.journal-inline-fallback[open] .journal-form__sidebar {
  width: 100%;
  max-width: none;
  min-width: 0;
  margin: 0;
}

.journal-inline-fallback[open] .journal-form__layout,
.journal-inline-fallback[open] .journal-form__page,
.journal-inline-fallback[open] .journal-form__pages {
  gap: clamp(0.52rem, 1.8vw, 0.72rem);
}

.journal-inline-fallback[open] .journal-form__sheet {
  min-height: 0;
  height: auto;
  padding: 0.42rem;
  border-radius: var(--radius-lg);
  background: transparent;
  box-shadow: none;
}

.journal-inline-fallback[open] .journal-form__sidebar {
  padding: 0.42rem;
  border-radius: var(--radius-lg);
  box-shadow: none;
}

.journal-inline-fallback[open] .journal-form__notes {
  min-height: 7.25rem;
  height: auto;
}

`;
  source = replaceRegex(
    source,
    /\.journal-inline-fallback \{[\s\S]*?(?=\.journal-actions-panel \{)/,
    fallbackCss,
    'canonical Journal fallback component block',
  );
  write(path, source);
}

{
  const path = 'scripts/inventory.js';
  let source = read(path);

  source = replaceOnce(
    source,
    `  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'journal-empty';
    empty.textContent = 'Save entries to see a snapshot of your progress.';
    container.appendChild(empty);
    return;
  }`,
    `  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'journal-patterns-empty';
    const title = document.createElement('strong');
    title.textContent = 'Patterns grow with your journal.';
    const description = document.createElement('span');
    description.textContent = 'Recurring feelings, needs, tags, and intensity trends will appear here as you save entries.';
    empty.append(title, description);
    container.appendChild(empty);
    return;
  }`,
    'Journal patterns empty state',
  );

  const historyMarker = `function renderJournalHistory() {
  if (!state.journalHistoryEl) return;
  syncJournalHistoryFilterOptions();`;
  const historyReplacement = `function updateJournalFiltersResetVisibility() {
  const button = state.journalFiltersForm?.querySelector('[data-journal-filters-reset]');
  if (!button) return;
  const filters = state.journalFilters || {};
  const active = Boolean(
    filters.search ||
      filters.emotion ||
      filters.need ||
      filters.tag ||
      (filters.sort && filters.sort !== 'newest') ||
      (filters.range && filters.range !== 'all')
  );
  button.hidden = !active;
}

function renderJournalHistory() {
  if (!state.journalHistoryEl) return;
  syncJournalHistoryFilterOptions();
  updateJournalFiltersResetVisibility();`;
  source = replaceOnce(source, historyMarker, historyReplacement, 'Journal filter reset visibility owner');

  write(path, source);
}

{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = read(path);
  const marker = `  assert.ok(css.includes('.journal-inline-fallback[open] .journal-form__sheet'), 'fallback editor must neutralize the full-screen sheet minimum height');`;
  const assertions = `${marker}
  assert.ok(build.includes('data-journal-filters-reset hidden>Clear filters</button>'), 'filter reset must stay outside the horizontal filter strip until needed');
  assert.ok(runtime.includes('updateJournalFiltersResetVisibility'), 'filter reset visibility must be state-driven');
  assert.ok(build.includes('journal-utility-disclosure__hint">Trends across entries'), 'Patterns must explain its role before it is opened');
  assert.ok(runtime.includes('Patterns grow with your journal.'), 'empty Patterns must explain what will appear later');
  assert.ok(build.includes('journal-inline-fallback__summary-text">Fallback editor'), 'fallback editor must be labeled as secondary recovery UI');
  assert.ok(css.includes('border-top: 1px solid color-mix(in srgb, var(--outline) 14%, transparent);'), 'fallback editor must use pushed-back separator styling');
  assert.ok(css.includes('.journal-inline-fallback[open] .journal-form,'), 'fallback form must use the full available inline width');`;
  source = replaceOnce(source, marker, assertions, 'final hierarchy regression additions');
  write(path, source);
}

{
  const path = 'docs/bedrock-acceptance-checklist.md';
  let source = read(path);
  source = replaceOnce(
    source,
    '4. **Patterns** and **Backup & restore** should sit below History as compact collapsed disclosure rows. Opening either should reveal its contents without a custom Hide/Show-summary button or another hero-sized panel.',
    '4. **Patterns** is a core Journal surface: its collapsed row should identify it as trends across entries, and opening it with no entries should explain that recurring feelings, needs, tags, and intensity trends will appear as entries accumulate. **Backup & restore** remains available below it but visually quieter.',
    'Journal hierarchy acceptance Patterns rule',
  );
  source = replaceOnce(
    source,
    'Pass condition: History, not navigation ceremony or utility cards, dominates the dedicated Journal screen; filters and entries are easy to scan within one phone viewport; and Patterns/Backup remain available without competing with the primary task.',
    'Pass condition: History and Patterns read as the two core dedicated-Journal surfaces; filters and entries are easy to scan within one phone viewport; Clear filters only appears when there is something to clear; Backup remains secondary; and the fallback editor is visually pushed back, compact when closed, and uses the available width when deliberately opened.',
    'Journal hierarchy acceptance completion rule',
  );
  write(path, source);
}

console.log('Repaired Journal width, Patterns empty-state hierarchy, filter reset density, and tertiary fallback editor at canonical owners.');
