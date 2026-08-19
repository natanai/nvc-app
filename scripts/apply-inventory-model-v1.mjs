import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const generatorPath = 'scripts/build-pages.mjs';
const inventoryScriptPath = 'scripts/inventory.js';
const marker = 'Inventory model prototype v1';

function replaceFunction(source, name, replacement) {
  const startToken = `function ${name}`;
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Could not find ${name}()`);
  const next = source.indexOf('\nfunction ', start + startToken.length);
  if (next < 0) throw new Error(`Could not find end of ${name}()`);
  return source.slice(0, start) + replacement.trimEnd() + '\n' + source.slice(next + 1);
}

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Could not find ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

// ---------------------------------------------------------------------------
// Generator: make the new Inventory structure first-paint HTML/CSS.
// ---------------------------------------------------------------------------
let generator = readFileSync(generatorPath, 'utf8');
const inventoryStart = generator.indexOf('function renderInventoryPage() {');
const inventoryEnd = generator.indexOf('\nfunction renderInventoryJournalPage', inventoryStart);
if (inventoryStart < 0 || inventoryEnd < 0) throw new Error('Could not isolate renderInventoryPage().');
let segment = generator.slice(inventoryStart, inventoryEnd);

if (!segment.includes(marker)) {
  segment = replaceOnce(
    segment,
    'Collect strategies you love, then visit the journal to follow how your feelings and needs shift over time.',
    'Build a personal library of strategies that help you care for your needs. Browse by need or review everything you have saved.',
    'Inventory description'
  );

  segment = replaceOnce(
    segment,
    '<a class="strategy-quick-actions__link" href="#inventory-form">',
    '<a class="strategy-quick-actions__link" href="#inventory-form" data-inventory-form-open>',
    'Inventory add-strategy action'
  );
  segment = replaceOnce(segment, '<span>Add personal strategy</span>', '<span>Add strategy</span>', 'Add strategy label');

  const jumpMarker = 'data-jump-to-strategies';
  const jumpIndex = segment.indexOf(jumpMarker);
  if (jumpIndex >= 0) {
    const jumpStart = segment.lastIndexOf('<a', jumpIndex);
    const sharedStart = segment.indexOf('<a class="inventory-shared-button"', jumpIndex);
    if (jumpStart < 0 || sharedStart < 0) throw new Error('Could not isolate old Review saved strategies action.');
    segment = segment.slice(0, jumpStart) + segment.slice(sharedStart);
  }

  const overviewStart = segment.indexOf('      <section class="inventory-overview"');
  const formStart = segment.indexOf('        <section class="inventory-form"', overviewStart);
  if (overviewStart < 0 || formStart < 0) throw new Error('Could not isolate Inventory overview markup.');

  const overviewMarkup = String.raw`      <section class="inventory-overview" aria-label="Strategy inventory views">
        <div class="inventory-view-switch" role="tablist" aria-label="Inventory view">
          <button
            type="button"
            id="inventory-view-needs"
            class="inventory-view-switch__button is-active"
            role="tab"
            aria-selected="true"
            aria-controls="inventory-needs-panel"
            data-inventory-view="needs"
          >
            Needs
          </button>
          <button
            type="button"
            id="inventory-view-strategies"
            class="inventory-view-switch__button"
            role="tab"
            aria-selected="false"
            aria-controls="inventory-strategies-panel"
            data-inventory-view="strategies"
          >
            Strategies
            <span class="inventory-view-switch__count" data-inventory-strategy-badge hidden></span>
          </button>
        </div>

        <section
          id="inventory-needs-panel"
          class="inventory-view-panel inventory-view-panel--needs"
          role="tabpanel"
          aria-labelledby="inventory-view-needs"
          data-inventory-view-panel="needs"
        >
          <div class="inventory-overview__header inventory-view-panel__header">
            <div>
              <h2 class="section-title">Needs</h2>
              <p class="inventory-overview__hint">Tap a need to see the strategies you have saved for it.</p>
            </div>
            <p class="inventory-needs-status" data-inventory-needs-status aria-live="polite"></p>
          </div>
          <div class="inventory-overview__tools">
            <div class="inventory-summary__filters" role="group" aria-label="Filter needs">
              <button type="button" class="inventory-summary__filter-button" data-summary-filter="all" aria-pressed="true">All</button>
              <button type="button" class="inventory-summary__filter-button" data-summary-filter="missing" aria-pressed="false">Needs care</button>
              <button type="button" class="inventory-summary__filter-button" data-summary-filter="ready" aria-pressed="false">Supported</button>
            </div>
          </div>
          <div id="inventory-summary" class="inventory-summary"></div>
        </section>

        <section
          id="inventory-strategies-panel"
          class="inventory-view-panel inventory-view-panel--strategies"
          role="tabpanel"
          aria-labelledby="inventory-view-strategies"
          data-inventory-view-panel="strategies"
          hidden
        >
          <div class="inventory-list__header inventory-view-panel__header">
            <div>
              <h2 id="inventory-list-heading" class="section-title" tabindex="-1">My strategies</h2>
              <p class="inventory-list__hint">Everything you have saved, regardless of which needs it supports.</p>
            </div>
            <p class="inventory-strategy-count" data-inventory-strategy-count aria-live="polite"></p>
          </div>
          <label class="inventory-strategy-search">
            <span class="visually-hidden">Search saved strategies</span>
            <span class="inventory-strategy-search__icon" aria-hidden="true">⌕</span>
            <input type="search" placeholder="Search your strategies" autocomplete="off" data-inventory-strategy-search />
          </label>
          <div
            class="inventory-list-panel"
            id="strategies-list"
            data-strategies-container
            aria-labelledby="inventory-list-heading"
          >
            <div id="inventory-list" class="inventory-list"></div>
          </div>
        </section>
      </section>

`;
  segment = segment.slice(0, overviewStart) + overviewMarkup + segment.slice(formStart);

  // Turn the always-open form into an intentional disclosure.
  const newFormStart = segment.indexOf('        <section class="inventory-form"');
  const newFormEnd = segment.indexOf('\n        </section>', newFormStart);
  if (newFormStart < 0 || newFormEnd < 0) throw new Error('Could not isolate Inventory form section.');
  const formOpenEnd = segment.indexOf('>\n', newFormStart) + 2;
  const formInner = segment.slice(formOpenEnd, newFormEnd);
  const formDetails = String.raw`        <details class="inventory-form inventory-form--collapsible" data-inventory-form-shell>
          <summary class="inventory-disclosure-summary">
            <span>Add a personal strategy</span>
            <span class="inventory-disclosure-summary__glyph" aria-hidden="true">+</span>
          </summary>
          <div class="inventory-disclosure-body">
${formInner.replace('<h2 id="inventory-form-heading" class="section-title">Add a personal strategy</h2>', '<h2 id="inventory-form-heading" class="visually-hidden">Add a personal strategy</h2>')}
          </div>
        </details>`;
  segment = segment.slice(0, newFormStart) + formDetails + segment.slice(newFormEnd + '\n        </section>'.length);

  // Turn backup/import/export into a secondary disclosure. CSS reorders it below the actual Inventory views.
  const actionsStart = segment.indexOf('        <section class="inventory-actions"');
  const actionsEnd = segment.indexOf('\n        </section>', actionsStart);
  if (actionsStart < 0 || actionsEnd < 0) throw new Error('Could not isolate Inventory backup actions.');
  const actionsOpenEnd = segment.indexOf('>\n', actionsStart) + 2;
  const actionsInner = segment.slice(actionsOpenEnd, actionsEnd);
  const actionDetails = String.raw`        <details class="inventory-actions inventory-actions--collapsible">
          <summary class="inventory-disclosure-summary">
            <span>Backup &amp; restore</span>
            <span class="inventory-disclosure-summary__glyph" aria-hidden="true">+</span>
          </summary>
          <div class="inventory-disclosure-body">
${actionsInner.replace('<h2 id="inventory-actions-heading" class="section-title">Save your progress</h2>', '<h2 id="inventory-actions-heading" class="visually-hidden">Backup and restore</h2>')}
          </div>
        </details>`;
  segment = segment.slice(0, actionsStart) + actionDetails + segment.slice(actionsEnd + '\n        </section>'.length);

  const cssMarker = '      /* Inventory model prototype v1 */';
  const styleEnd = segment.lastIndexOf('    </style>`;');
  if (styleEnd < 0) throw new Error('Could not find Inventory inline style end.');
  const css = String.raw`

      /* Inventory model prototype v1 */
      .inventory-main {
        display: flex;
        flex-direction: column;
        gap: clamp(0.9rem, 2vw, 1.25rem);
      }

      .inventory-overview { order: 1; }
      .inventory-form { order: 2; }
      .inventory-actions { order: 3; }

      .inventory-header__quick-actions {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }

      .inventory-view-switch {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        border: 2px solid color-mix(in srgb, var(--outline) 45%, transparent);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--lavender) 62%, #ffffff 38%);
        box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 12%, transparent);
      }

      .inventory-view-switch__button {
        min-height: 46px;
        border: 0;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--ink);
        font: 700 0.9rem/1 var(--font-body);
        letter-spacing: 0.02em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        cursor: pointer;
      }

      .inventory-view-switch__button.is-active,
      .inventory-view-switch__button[aria-selected='true'] {
        background: #ffffff;
        box-shadow: 0 2px 8px color-mix(in srgb, var(--outline) 13%, transparent);
      }

      .inventory-view-switch__count {
        min-width: 1.45rem;
        padding: 0.18rem 0.42rem;
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--sky) 58%, #ffffff 42%);
        font-size: 0.72rem;
      }

      .inventory-overview {
        display: grid;
        gap: 0.85rem;
        padding: clamp(0.8rem, 2vw, 1.1rem);
        border: 2px solid color-mix(in srgb, var(--outline) 50%, transparent);
        border-radius: var(--radius-2xl);
        background: color-mix(in srgb, #ffffff 90%, var(--lavender) 10%);
        box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 12%, transparent);
      }

      .inventory-view-panel {
        display: grid;
        gap: 0.75rem;
        min-width: 0;
      }

      .inventory-view-panel[hidden] { display: none !important; }

      .inventory-view-panel__header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .inventory-view-panel__header .section-title,
      .inventory-view-panel__header p { margin: 0; }

      .inventory-overview__hint,
      .inventory-list__hint {
        margin-top: 0.18rem !important;
        font-size: 0.84rem;
        line-height: 1.35;
        color: var(--ink-soft);
      }

      .inventory-needs-status,
      .inventory-strategy-count {
        flex: 0 0 auto;
        font-size: 0.78rem;
        color: var(--ink-soft);
        text-align: right;
      }

      .inventory-summary__filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }

      .inventory-summary__filter-button {
        min-height: 38px;
        min-width: 0;
        padding: 0.38rem 0.7rem;
        border: 1.5px solid color-mix(in srgb, var(--outline) 38%, transparent);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, #ffffff 88%, var(--lavender) 12%);
        box-shadow: none;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .inventory-summary__filter-button[aria-pressed='true'],
      .inventory-summary__filter-button--active {
        border-color: var(--outline);
        background: color-mix(in srgb, var(--sky) 54%, #ffffff 46%);
      }

      .inventory-summary {
        display: grid;
        gap: 0;
        overflow: hidden;
        border: 2px solid color-mix(in srgb, var(--outline) 46%, transparent);
        border-radius: var(--radius-xl);
        background: #ffffff;
      }

      .inventory-summary__item {
        display: grid;
        padding: 0;
        margin: 0;
        border: 0;
        border-bottom: 1px solid color-mix(in srgb, var(--outline) 17%, transparent);
        border-radius: 0;
        background: #ffffff;
        box-shadow: none;
        overflow: hidden;
      }

      .inventory-summary__item:last-child { border-bottom: 0; }
      .inventory-summary__item--ready { background: color-mix(in srgb, var(--mint) 13%, #ffffff 87%); }
      .inventory-summary__item--missing { background: color-mix(in srgb, var(--rose) 8%, #ffffff 92%); }

      .inventory-summary__focus {
        width: 100%;
        min-height: 62px;
        padding: 0.7rem 0.8rem;
        border: 0;
        background: transparent;
        box-shadow: none;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.7rem;
        text-align: left;
        color: var(--ink);
      }

      .inventory-summary__focus:hover,
      .inventory-summary__focus:focus-visible {
        transform: none;
        background: color-mix(in srgb, var(--sky) 16%, #ffffff 84%);
      }

      .inventory-summary__status {
        width: 0.82rem;
        height: 0.82rem;
        border: 2px solid var(--outline);
        border-radius: 50%;
        background: #ffffff;
      }

      .inventory-summary__item--ready .inventory-summary__status {
        background: var(--mint);
      }

      .inventory-summary__text {
        min-width: 0;
        display: grid;
        gap: 0.08rem;
      }

      .inventory-summary__label {
        font-size: 0.94rem;
        font-weight: 750;
        line-height: 1.2;
      }

      .inventory-summary__count {
        font-size: 0.78rem;
        line-height: 1.2;
        color: var(--ink-soft);
      }

      .inventory-summary__chevron {
        font-size: 1.35rem;
        line-height: 1;
        color: var(--ink-soft);
        transition: transform 0.16s ease;
      }

      .inventory-summary__focus[aria-expanded='true'] .inventory-summary__chevron {
        transform: rotate(90deg);
      }

      .inventory-summary__detail {
        padding: 0.75rem;
        border-top: 1px solid color-mix(in srgb, var(--outline) 17%, transparent);
        background: color-mix(in srgb, var(--lavender) 18%, #ffffff 82%);
        display: grid;
        gap: 0.65rem;
      }

      .inventory-summary__detail[hidden] { display: none !important; }

      .inventory-summary__detail-header,
      .inventory-summary__detail-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .inventory-summary__detail-title {
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .inventory-summary__about-link,
      .inventory-summary__add-button {
        min-height: 40px;
        border-radius: var(--radius-pill);
        font-size: 0.78rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.38rem 0.72rem;
      }

      .inventory-summary__about-link {
        color: var(--ink);
        text-decoration: none;
        border: 1.5px solid color-mix(in srgb, var(--outline) 34%, transparent);
        background: #ffffff;
      }

      .inventory-summary__add-button {
        border: 2px solid var(--outline);
        background: color-mix(in srgb, var(--rose) 74%, #ffffff 26%);
        color: var(--ink);
      }

      .inventory-summary__strategy-list {
        display: grid;
        gap: 0.5rem;
      }

      .inventory-item--compact {
        padding: 0.65rem 0.7rem;
        border-width: 1.5px;
        border-radius: var(--radius-lg);
        box-shadow: 0 3px 0 color-mix(in srgb, var(--outline) 11%, transparent);
        background: #ffffff;
      }

      .inventory-item--compact .inventory-item__title { font-size: 0.95rem; }
      .inventory-item--compact .inventory-item__description { font-size: 0.82rem; line-height: 1.35; }
      .inventory-item--compact .inventory-item__actions { margin-top: 0.35rem; }

      .inventory-strategy-search {
        min-height: 48px;
        padding: 0 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.55rem;
        border: 2px solid color-mix(in srgb, var(--outline) 42%, transparent);
        border-radius: var(--radius-lg);
        background: #ffffff;
      }

      .inventory-strategy-search__icon {
        flex: 0 0 auto;
        font-size: 1.1rem;
        color: var(--ink-soft);
      }

      .inventory-strategy-search input {
        width: 100%;
        min-width: 0;
        min-height: 44px;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);
        font: inherit;
      }

      .inventory-list-panel {
        display: block;
        padding: 0;
        border: 0;
        box-shadow: none;
        background: transparent;
      }

      .inventory-list {
        display: grid;
        gap: 0.65rem;
      }

      .inventory-list .inventory-item {
        margin: 0;
      }

      .inventory-form--collapsible,
      .inventory-actions--collapsible {
        border: 2px solid color-mix(in srgb, var(--outline) 40%, transparent);
        border-radius: var(--radius-xl);
        background: color-mix(in srgb, #ffffff 90%, var(--lavender) 10%);
        box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 10%, transparent);
        overflow: hidden;
      }

      .inventory-disclosure-summary {
        min-height: 50px;
        padding: 0.68rem 0.8rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        cursor: pointer;
        list-style: none;
        font-weight: 800;
      }

      .inventory-disclosure-summary::-webkit-details-marker { display: none; }

      .inventory-disclosure-summary__glyph {
        width: 1.7rem;
        height: 1.7rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: color-mix(in srgb, var(--sky) 45%, #ffffff 55%);
        transition: transform 0.16s ease;
      }

      details[open] > .inventory-disclosure-summary .inventory-disclosure-summary__glyph {
        transform: rotate(45deg);
      }

      .inventory-disclosure-body {
        padding: 0 0.8rem 0.85rem;
      }

      .inventory-actions--collapsible .inventory-actions__header .section-title { display: none; }

      @media (max-width: 640px) {
        .inventory-overview { padding: 0.7rem; border-radius: var(--radius-xl); }
        .inventory-view-panel__header { align-items: start; }
        .inventory-needs-status,
        .inventory-strategy-count { font-size: 0.72rem; }
        .inventory-summary__focus { min-height: 58px; padding: 0.62rem 0.65rem; gap: 0.58rem; }
        .inventory-summary__detail { padding: 0.62rem; }
        .inventory-header__quick-actions { grid-template-columns: minmax(0, 1fr); }
      }
`;
  segment = segment.slice(0, styleEnd) + css + segment.slice(styleEnd);

  generator = generator.slice(0, inventoryStart) + segment + generator.slice(inventoryEnd);
  writeFileSync(generatorPath, generator);
}

// ---------------------------------------------------------------------------
// Runtime: reuse the existing inventory data and rendering pipeline.
// ---------------------------------------------------------------------------
let runtime = readFileSync(inventoryScriptPath, 'utf8');

if (!runtime.includes('inventoryView: \'needs\'')) {
  runtime = replaceOnce(
    runtime,
    "  summaryFilterButtons: [],\n",
    "  summaryFilterButtons: [],\n  inventoryView: 'needs',\n  inventoryViewButtons: [],\n  needsViewPanel: null,\n  strategiesViewPanel: null,\n  strategySearchInput: null,\n  strategyCountEl: null,\n  strategyBadgeEl: null,\n  needsStatusEl: null,\n  expandedNeedSlug: '',\n  strategySearch: '',\n  inventoryFormShell: null,\n",
    'Inventory state extension'
  );
}

const setupRefsAnchor = "  state.summaryFilterButtons = Array.from(document.querySelectorAll('[data-summary-filter]'));\n";
if (!runtime.includes("state.inventoryViewButtons = Array.from(document.querySelectorAll('[data-inventory-view]'))")) {
  runtime = replaceOnce(
    runtime,
    setupRefsAnchor,
    setupRefsAnchor +
      "  state.inventoryViewButtons = Array.from(document.querySelectorAll('[data-inventory-view]'));\n" +
      "  state.needsViewPanel = document.querySelector('[data-inventory-view-panel=\"needs\"]');\n" +
      "  state.strategiesViewPanel = document.querySelector('[data-inventory-view-panel=\"strategies\"]');\n" +
      "  state.strategySearchInput = document.querySelector('[data-inventory-strategy-search]');\n" +
      "  state.strategyCountEl = document.querySelector('[data-inventory-strategy-count]');\n" +
      "  state.strategyBadgeEl = document.querySelector('[data-inventory-strategy-badge]');\n" +
      "  state.needsStatusEl = document.querySelector('[data-inventory-needs-status]');\n" +
      "  state.inventoryFormShell = document.querySelector('[data-inventory-form-shell]');\n",
    'Inventory setup refs'
  );
}

const listenerAnchor = "  updateStrategiesVisibility();\n  updateInventoryToggleLabel();\n";
if (!runtime.includes("state.inventoryViewButtons.forEach((button) =>")) {
  const listeners = `  state.inventoryViewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setInventoryView(button.dataset.inventoryView || 'needs');
    });
  });

  if (state.strategySearchInput) {
    state.strategySearchInput.addEventListener('input', () => {
      state.strategySearch = state.strategySearchInput.value || '';
      renderInventoryList();
    });
  }

  document.querySelectorAll('[data-inventory-form-open]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openInventoryFormForNeed('');
    });
  });

`;
  runtime = replaceOnce(runtime, listenerAnchor, listeners + listenerAnchor, 'Inventory view listeners');
}

// The summary container now owns disclosure plus compact-card edit/delete actions.
const oldSummaryListenerStart = runtime.indexOf('  if (state.inventorySummaryEl) {\n    state.inventorySummaryEl.addEventListener');
if (oldSummaryListenerStart < 0) throw new Error('Could not find Inventory summary click listener.');
const oldSummaryListenerEnd = runtime.indexOf('\n  }\n}\n\nfunction highlightNavigation()', oldSummaryListenerStart);
if (oldSummaryListenerEnd < 0) throw new Error('Could not isolate Inventory summary click listener.');
const summaryListener = `  if (state.inventorySummaryEl) {
    state.inventorySummaryEl.addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-action="edit"]');
      if (editButton) {
        const entry = state.inventory.find((item) => item.id === editButton.dataset.id);
        if (entry?.personal) setInventoryFormMode({ entry });
        return;
      }

      const deleteButton = event.target.closest('[data-action="delete"]');
      if (deleteButton) {
        const entry = state.inventory.find((item) => item.id === deleteButton.dataset.id);
        if (!entry) return;
        if (!window.confirm(\`Remove “\${entry.title}” from your inventory?\`)) return;
        persistInventory(state.inventory.filter((item) => item.id !== entry.id), {
          inventoryMessage: \`Removed “\${entry.title}” from your inventory.\`,
        });
        return;
      }

      const addButton = event.target.closest('[data-add-strategy-for-need]');
      if (addButton) {
        openInventoryFormForNeed(addButton.dataset.addStrategyForNeed || '');
        return;
      }

      const focusButton = event.target.closest('.inventory-summary__focus');
      if (!focusButton) return;
      const slug = focusButton.dataset.needSlug || '';
      state.expandedNeedSlug = state.expandedNeedSlug === slug ? '' : slug;
      renderInventorySummary();
      applySummaryFilter();
    });
  }
}`;
runtime = runtime.slice(0, oldSummaryListenerStart) + summaryListener + runtime.slice(oldSummaryListenerEnd + '\n  }\n}'.length);

const helpers = `
function setInventoryView(nextView, { focus = false } = {}) {
  const normalized = nextView === 'strategies' ? 'strategies' : 'needs';
  state.inventoryView = normalized;
  state.showStrategies = normalized === 'strategies';
  updateStrategiesVisibility();
  updateInventoryViewControls();
  if (normalized === 'strategies') renderInventoryList();
  if (focus) {
    const target = normalized === 'strategies' ? state.strategySearchInput : state.needsViewPanel;
    requestAnimationFrame(() => target?.focus?.());
  }
}

function updateInventoryViewControls() {
  state.inventoryViewButtons.forEach((button) => {
    const active = (button.dataset.inventoryView || 'needs') === state.inventoryView;
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.classList.toggle('is-active', active);
    button.tabIndex = active ? 0 : -1;
  });
}

function openInventoryFormForNeed(needSlug = '') {
  const form = state.inventoryForm || document.getElementById('inventory-form');
  if (!form) return;
  setInventoryFormMode({ entry: null });
  if (state.inventoryFormShell instanceof HTMLDetailsElement) state.inventoryFormShell.open = true;
  const normalized = normalizeNeedSlugValue(needSlug);
  const select = form.querySelector('#inventory-need');
  if (select instanceof HTMLSelectElement) {
    Array.from(select.options).forEach((option) => {
      option.selected = Boolean(normalized) && normalizeNeedSlugValue(option.value) === normalized;
    });
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  requestAnimationFrame(() => {
    state.inventoryFormShell?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    form.querySelector('#inventory-title')?.focus?.({ preventScroll: true });
  });
}

function renderNeedInventoryDetail(need, entries) {
  const detail = document.createElement('div');
  detail.className = 'inventory-summary__detail';
  detail.id = \`inventory-need-detail-\${need.slug}\`;

  const header = document.createElement('div');
  header.className = 'inventory-summary__detail-header';
  const title = document.createElement('span');
  title.className = 'inventory-summary__detail-title';
  title.textContent = entries.length ? 'Saved strategies' : 'No saved strategies yet';
  const about = document.createElement('a');
  about.className = 'inventory-summary__about-link';
  about.href = \`\${state.basePath}needs/\${need.slug}/\`;
  about.textContent = 'About this need →';
  header.append(title, about);
  detail.append(header);

  if (entries.length) {
    const list = document.createElement('div');
    list.className = 'inventory-summary__strategy-list';
    entries.forEach((entry) => list.append(renderInventoryItem(entry, { compact: true, showNeeds: false })));
    detail.append(list);
  } else {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = 'Add something that helps you care for this need.';
    detail.append(empty);
  }

  const actions = document.createElement('div');
  actions.className = 'inventory-summary__detail-actions';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'inventory-summary__add-button';
  add.dataset.addStrategyForNeed = need.slug;
  add.textContent = '+ Add strategy';
  actions.append(add);
  detail.append(actions);
  return detail;
}

`;
if (!runtime.includes('function setInventoryView(')) {
  runtime = replaceOnce(runtime, 'function renderInventorySummary() {', helpers + 'function renderInventorySummary() {', 'Inventory model helpers');
}

const newSummary = `function renderInventorySummary() {
  if (!state.inventorySummaryEl || !state.needs.length) return;

  const counts = new Map();
  const entriesByNeed = new Map();
  state.needs.forEach((need) => {
    counts.set(need.slug, 0);
    entriesByNeed.set(need.slug, []);
  });

  state.inventory.forEach((entry) => {
    const uniqueSlugs = new Set(resolveEntryNeedSlugs(entry));
    uniqueSlugs.forEach((slug) => {
      if (!counts.has(slug)) return;
      counts.set(slug, counts.get(slug) + 1);
      entriesByNeed.get(slug).push(entry);
    });
  });

  const supported = Array.from(counts.values()).filter((count) => count > 0).length;
  const missing = Math.max(state.needs.length - supported, 0);
  if (state.needsStatusEl) {
    state.needsStatusEl.textContent = \`\${supported} supported · \${missing} without strategies\`;
  }

  state.inventorySummaryEl.innerHTML = '';
  state.needs.forEach((need) => {
    const count = counts.get(need.slug) || 0;
    const expanded = state.expandedNeedSlug === need.slug;
    const wrapper = document.createElement('div');
    wrapper.className = \`inventory-summary__item \${count ? 'inventory-summary__item--ready' : 'inventory-summary__item--missing'}\`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-summary__focus';
    button.dataset.needSlug = need.slug;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.setAttribute('aria-controls', \`inventory-need-detail-\${need.slug}\`);
    button.setAttribute('aria-label', \`\${need.title}, \${count ? `${count} saved ${count === 1 ? 'strategy' : 'strategies'}` : 'no saved strategies'}. \${expanded ? 'Hide' : 'Show'} details.\`);

    const status = document.createElement('span');
    status.className = 'inventory-summary__status';
    status.setAttribute('aria-hidden', 'true');

    const textWrap = document.createElement('span');
    textWrap.className = 'inventory-summary__text';
    const label = document.createElement('span');
    label.className = 'inventory-summary__label';
    label.textContent = need.title;
    const countText = document.createElement('span');
    countText.className = 'inventory-summary__count';
    countText.textContent = count ? \`\${count} \${count === 1 ? 'strategy' : 'strategies'}\` : 'No strategies';
    textWrap.append(label, countText);

    const chevron = document.createElement('span');
    chevron.className = 'inventory-summary__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';
    button.append(status, textWrap, chevron);
    wrapper.append(button);

    const detail = renderNeedInventoryDetail(need, entriesByNeed.get(need.slug) || []);
    detail.hidden = !expanded;
    wrapper.append(detail);
    state.inventorySummaryEl.append(wrapper);
  });
}`;
runtime = replaceFunction(runtime, 'renderInventorySummary', newSummary);

const newList = `function renderInventoryList() {
  if (!state.inventoryListEl) return;
  state.inventoryListEl.innerHTML = '';

  const query = (state.strategySearch || '').trim().toLowerCase();
  const filtered = state.inventory.filter((entry) => {
    if (!query) return true;
    const needs = resolveEntryNeedSlugs(entry)
      .map((slug) => state.needsBySlug.get(slug)?.title || slug)
      .join(' ');
    const haystack = [entry.title, entry.description, entry.need, needs]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  if (state.strategyCountEl) {
    state.strategyCountEl.textContent = query
      ? \`\${filtered.length} of \${state.inventory.length}\`
      : \`\${state.inventory.length} saved\`;
  }
  if (state.strategyBadgeEl) {
    state.strategyBadgeEl.textContent = String(state.inventory.length);
    state.strategyBadgeEl.hidden = state.inventory.length === 0;
  }

  if (!state.inventory.length) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'inventory-empty';
    emptyNotice.textContent = 'No saved strategies yet. Add one from a need or create your own.';
    state.inventoryListEl.append(emptyNotice);
    return;
  }

  if (!filtered.length) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'inventory-empty';
    emptyNotice.textContent = 'No saved strategies match this search.';
    state.inventoryListEl.append(emptyNotice);
    return;
  }

  filtered.forEach((entry) => state.inventoryListEl.append(renderInventoryItem(entry)));
}`;
runtime = replaceFunction(runtime, 'renderInventoryList', newList);

runtime = replaceFunction(runtime, 'handleJumpToStrategies', `function handleJumpToStrategies(event) {
  if (event) event.preventDefault();
  jumpToSavedStrategies();
}`);

runtime = replaceFunction(runtime, 'jumpToSavedStrategies', `function jumpToSavedStrategies() {
  setInventoryView('strategies');
  requestAnimationFrame(() => {
    const overview = document.querySelector('.inventory-overview');
    overview?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    state.strategySearchInput?.focus?.({ preventScroll: true });
  });
}`);

runtime = replaceFunction(runtime, 'setShowStrategies', `function setShowStrategies(visible) {
  setInventoryView(visible ? 'strategies' : 'needs');
}`);

runtime = replaceFunction(runtime, 'updateStrategiesVisibility', `function updateStrategiesVisibility() {
  const showingStrategies = state.inventoryView === 'strategies';
  state.showStrategies = showingStrategies;
  if (state.needsViewPanel) state.needsViewPanel.hidden = showingStrategies;
  if (state.strategiesViewPanel) state.strategiesViewPanel.hidden = !showingStrategies;
  if (state.strategiesContainerEl) {
    state.strategiesContainerEl.hidden = !showingStrategies;
    state.strategiesContainerEl.classList.toggle('inventory-list-panel--hidden', !showingStrategies);
    state.strategiesContainerEl.setAttribute('aria-hidden', showingStrategies ? 'false' : 'true');
  }
  updateInventoryViewControls();
}`);

runtime = replaceFunction(runtime, 'openInventoryPanel', `function openInventoryPanel() {
  setInventoryView('strategies');
}`);

runtime = replaceFunction(runtime, 'closeInventoryPanel', `function closeInventoryPanel() {
  setInventoryView('needs');
}`);

runtime = replaceFunction(runtime, 'updateInventoryToggleLabel', `function updateInventoryToggleLabel() {
  updateInventoryViewControls();
  if (state.jumpToStrategiesButton) {
    state.jumpToStrategiesButton.setAttribute('aria-expanded', state.inventoryView === 'strategies' ? 'true' : 'false');
  }
}`);

const newItem = `function renderInventoryItem(entry, options = {}) {
  const compact = options.compact === true;
  const showNeeds = options.showNeeds !== false;
  const card = document.createElement('article');
  card.className = compact ? 'inventory-item inventory-item--compact' : 'inventory-item';
  card.dataset.id = entry.id;

  const header = document.createElement('div');
  header.className = 'inventory-item__header';
  const title = document.createElement('h3');
  title.className = 'inventory-item__title';
  title.textContent = entry.title;
  header.append(title);

  if (entry.personal) {
    const badge = document.createElement('span');
    badge.className = 'inventory-item__tag';
    badge.textContent = 'Personal';
    header.append(badge);
  }
  if (entry.sourceNeedPage) {
    const badge = document.createElement('span');
    badge.className = 'inventory-item__tag inventory-item__tag--source';
    badge.textContent = 'Saved from site';
    header.append(badge);
  }
  card.append(header);

  if (entry.description) {
    const description = document.createElement('p');
    description.className = 'inventory-item__description';
    description.textContent = entry.description;
    card.append(description);
  }

  const contributorSource = entry.contributor && typeof entry.contributor === 'object' ? entry.contributor : {};
  const metaParts = [
    sanitizeContributorName(contributorSource.name || entry.firstName || ''),
    sanitizeLocation(contributorSource.location || entry.location || ''),
  ].filter(Boolean);
  if (metaParts.length) {
    const meta = document.createElement('p');
    meta.className = 'inventory-item__meta';
    meta.textContent = metaParts.join(' • ');
    card.append(meta);
  }

  if (showNeeds) {
    const needTitles = [];
    const seen = new Set();
    resolveEntryNeedSlugs(entry).forEach((slug) => {
      const normalized = normalizeNeedSlugValue(slug);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      needTitles.push(state.needsBySlug.get(normalized)?.title || normalized);
    });
    if (!needTitles.length && entry.need) needTitles.push(entry.need.toString().trim());
    if (needTitles.length) {
      const details = document.createElement('details');
      details.className = 'inventory-item__needs';
      const summary = document.createElement('summary');
      summary.className = 'inventory-item__needs-summary';
      summary.textContent = \`Needs (\${needTitles.length})\`;
      const tags = document.createElement('ul');
      tags.className = 'inventory-item__tags';
      needTitles.forEach((needTitle) => {
        const li = document.createElement('li');
        li.className = 'inventory-item__tag-pill';
        li.textContent = needTitle;
        tags.append(li);
      });
      details.append(summary, tags);
      card.append(details);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'inventory-item__actions';
  if (entry.personal) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'inventory-item__edit';
    edit.dataset.action = 'edit';
    edit.dataset.id = entry.id;
    edit.textContent = 'Edit';
    actions.append(edit);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'inventory-item__delete';
  remove.dataset.action = 'delete';
  remove.dataset.id = entry.id;
  remove.textContent = 'Delete';
  actions.append(remove);
  card.append(actions);
  return card;
}`;
runtime = replaceFunction(runtime, 'renderInventoryItem', newItem);

if (!runtime.includes("state.inventoryFormShell instanceof HTMLDetailsElement")) {
  runtime = replaceOnce(
    runtime,
    "function setInventoryFormMode({ entry }) {\n  if (!state.inventoryForm || !state.inventorySubmitButton) {\n    return;\n  }\n",
    "function setInventoryFormMode({ entry }) {\n  if (!state.inventoryForm || !state.inventorySubmitButton) {\n    return;\n  }\n  if (entry && state.inventoryFormShell instanceof HTMLDetailsElement) {\n    state.inventoryFormShell.open = true;\n  }\n",
    'Inventory edit form disclosure'
  );
}

writeFileSync(inventoryScriptPath, runtime);

execFileSync('node', ['--check', inventoryScriptPath], { stdio: 'inherit' });
execFileSync('node', ['scripts/build-pages.mjs', '--scope=inventory'], { stdio: 'inherit' });

const generated = readFileSync('inventory/index.html', 'utf8');
const required = [
  marker,
  'data-inventory-view="needs"',
  'data-inventory-view="strategies"',
  'data-inventory-view-panel="needs"',
  'data-inventory-view-panel="strategies"',
  'data-inventory-strategy-search',
  'data-inventory-form-shell',
  'Backup &amp; restore',
  'data-inventory-form-open',
  'id="inventory-summary"',
  'id="inventory-list"',
  'id="inventory-form"',
  'id="inventory-export"',
  'id="inventory-import-trigger"',
];
for (const token of required) {
  if (!generated.includes(token)) throw new Error(`Generated Inventory missing: ${token}`);
}
if (generated.includes('data-jump-to-strategies')) throw new Error('Old Review saved strategies action survived prototype integration.');
if (!runtime.includes('renderNeedInventoryDetail') || !runtime.includes("setInventoryView('strategies')")) {
  throw new Error('Inventory runtime prototype hooks are missing.');
}

console.log('Inventory model prototype v1 integrated and regenerated.');
