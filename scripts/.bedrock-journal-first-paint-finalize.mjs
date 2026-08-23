import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Non-unique ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);

  source = replaceOnce(
    source,
    "  headExtras = '',\n  bodyExtras = '',",
    "  prepaintExtras = '',\n  headExtras = '',\n  bodyExtras = '',",
    'htmlPage prepaint option',
  );

  source = replaceOnce(
    source,
    "  const criticalStyles = navCriticalCss ? `    <style>${navCriticalCss}</style>` : '';\n  const extraHead = headExtras ? `\\n${headExtras}` : '';",
    "  const criticalStyles = navCriticalCss ? `    <style>${navCriticalCss}</style>` : '';\n  const prepaintHead = prepaintExtras ? `\\n${prepaintExtras}` : '';\n  const extraHead = headExtras ? `\\n${headExtras}` : '';",
    'htmlPage prepaint render value',
  );

  source = replaceOnce(
    source,
    "        ${themePreloadScript(basePath)}\n${criticalStyles ? `${criticalStyles}\\n` : ''}    <link rel=\"preload\" href=\"${cssHref}\" as=\"style\" />",
    "        ${themePreloadScript(basePath)}${prepaintHead}\n${criticalStyles ? `${criticalStyles}\\n` : ''}    <link rel=\"preload\" href=\"${cssHref}\" as=\"style\" />",
    'prepaint extras placement before styles',
  );

  const helper = `\nfunction journalHistoryPrepaintScript() {\n  return String.raw\`    <script data-journal-history-prepaint>\n      (function() {\n        var root = document.documentElement;\n        if (!root) return;\n        var hasEntries = false;\n        try {\n          var storage = window.localStorage;\n          var keys = ['journal:v2', 'nvcApp.journal', 'alexithymiaSupportJournal'];\n          for (var i = 0; i < keys.length; i += 1) {\n            var raw = storage && storage.getItem ? storage.getItem(keys[i]) : '';\n            if (!raw) continue;\n            var parsed = JSON.parse(raw);\n            if (Array.isArray(parsed) && parsed.length > 0) {\n              hasEntries = true;\n              break;\n            }\n          }\n        } catch (error) {\n          hasEntries = false;\n        }\n        root.setAttribute('data-journal-history-state', hasEntries ? 'populated' : 'empty');\n      })();\n    <\\/script>\`;\n}\n\n`;
  source = replaceOnce(
    source,
    '\nfunction renderInventoryJournalPage(needsList = []) {',
    helper + 'function renderInventoryJournalPage(needsList = []) {',
    'Journal prepaint helper insertion',
  );

  source = replaceOnce(
    source,
    `      /* Journal inline-size containment contract. Populated History introduces\n         a horizontally scrollable filter rail, while Patterns and entry text\n         add intrinsic content. Every nested grid/flex item in that path must\n         be allowed to shrink to the viewport so intrinsic width stays inside\n         the component instead of widening the document on mobile Safari. */`,
    `      /* Journal inline-size containment contract. Populated History adds a\n         bounded responsive filter grid, while Patterns and entry text add\n         intrinsic content. Every nested grid/flex item in that path must be\n         allowed to shrink to the viewport so intrinsic width stays inside the\n         component instead of widening the document on mobile Safari. */`,
    'Journal containment comment',
  );

  source = replaceOnce(
    source,
    `      main[data-page-id='inventory-journal'] .journal-history-controls[hidden],\n      main[data-page-id='inventory-journal'] .journal-history-control[hidden] {\n        display: none !important;\n      }\n\n      main[data-page-id='inventory-journal'] .journal-empty--history {`,
    `      main[data-page-id='inventory-journal'] .journal-history-controls[hidden],\n      main[data-page-id='inventory-journal'] .journal-history-control[hidden] {\n        display: none !important;\n      }\n\n      /* The Journal store is local browser state, but its empty/populated\n         classification is known synchronously. A tiny head bootstrap sets this\n         before first paint so the static shell never flashes the wrong state. */\n      html[data-journal-history-state='empty'] main[data-page-id='inventory-journal'] .journal-history-controls,\n      html[data-journal-history-state='empty'] main[data-page-id='inventory-journal'] .journal-history {\n        display: none !important;\n      }\n\n      html[data-journal-history-state='empty'] main[data-page-id='inventory-journal'] .journal-empty--history {\n        display: grid !important;\n      }\n\n      html[data-journal-history-state='populated'] main[data-page-id='inventory-journal'] .journal-empty--history {\n        display: none !important;\n      }\n\n      main[data-page-id='inventory-journal'] .journal-empty--history {`,
    'Journal first-paint state CSS',
  );

  source = replaceOnce(
    source,
    `    main,\n    mainAttributes: 'data-page-id="inventory-journal"',\n    headExtras: journalPageStyles,`,
    `    main,\n    mainAttributes: 'data-page-id="inventory-journal"',\n    prepaintExtras: journalHistoryPrepaintScript(),\n    headExtras: journalPageStyles,`,
    'Journal prepaint hook usage',
  );

  write(path, source);
}

{
  const path = 'scripts/inventory.js';
  let source = read(path);
  source = replaceOnce(
    source,
    `  const allEntries = Array.isArray(state.journalEntries) ? state.journalEntries : [];\n  const hasJournalEntries = allEntries.length > 0;\n  if (state.journalFiltersForm) state.journalFiltersForm.hidden = !hasJournalEntries;`,
    `  const allEntries = Array.isArray(state.journalEntries) ? state.journalEntries : [];\n  const hasJournalEntries = allEntries.length > 0;\n  if (document.documentElement) {\n    document.documentElement.setAttribute('data-journal-history-state', hasJournalEntries ? 'populated' : 'empty');\n  }\n  if (state.journalFiltersForm) state.journalFiltersForm.hidden = !hasJournalEntries;`,
    'Journal runtime state synchronization',
  );
  write(path, source);
}

{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = read(path);
  source = replaceOnce(
    source,
    `  assert.ok(runtime.includes("'No matches'"), 'filtered-empty history must distinguish no matches from no entries');\n\n  // Regression target: populated Journal filters must fit the viewport by`,
    `  assert.ok(runtime.includes("'No matches'"), 'filtered-empty history must distinguish no matches from no entries');\n  assert.ok(build.includes('function journalHistoryPrepaintScript()'), 'Journal must classify local entry state before first paint');\n  assert.ok(build.includes("prepaintExtras: journalHistoryPrepaintScript()"), 'Journal must use the prepaint hook rather than a post-paint normalizer');\n  assert.ok(html.includes('data-journal-history-prepaint'), 'generated Journal must ship the tiny state bootstrap');\n  assert.ok(html.indexOf('data-journal-history-prepaint') < html.indexOf('styles/shared-density.css'), 'Journal state bootstrap must run before render-blocking page styles');\n  assert.ok(html.includes("html[data-journal-history-state='empty'] main[data-page-id='inventory-journal'] .journal-history-controls"), 'empty Journal filters must be hidden by first-paint CSS');\n  assert.ok(runtime.includes("document.documentElement.setAttribute('data-journal-history-state'"), 'runtime must keep the prepaint state attribute synchronized after saves/deletes');\n\n  // Regression target: populated Journal filters must fit the viewport by`,
    'Journal first-paint regression assertions',
  );
  write(path, source);
}

{
  const path = 'docs/bedrock-acceptance-checklist.md';
  let source = read(path);
  source = replaceOnce(
    source,
    '2. With no saved entries, **History** should show a purposeful empty state explaining that history, filters, and patterns grow after the first entry; Search and filter controls should not be shown because there is nothing to search or filter.',
    '2. With no saved entries, **History** should show a purposeful empty state explaining that history, filters, and patterns grow after the first entry; Search and filter controls should not be shown because there is nothing to search or filter. On a full reload, this correct empty state must be present on the first painted frame—there should be no flash of the populated filter controls while JavaScript initializes.',
    'Journal empty first-paint acceptance',
  );
  source = replaceOnce(
    source,
    '3. After at least one entry exists, fully reload or reopen Journal. The saved entry and its relevant filter dimensions must appear immediately without touching Sort, Search, or another control.',
    '3. After at least one entry exists, fully reload or reopen Journal. The saved entry and its relevant filter dimensions must appear immediately without touching Sort, Search, or another control, and the page must not first paint the no-entry state before reconciling browser storage.',
    'Journal populated first-paint acceptance',
  );
  write(path, source);
}

console.log('Journal first-paint state repair applied at canonical owners.');
