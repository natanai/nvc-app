import { promises as fs } from 'node:fs';

const read = path => fs.readFile(path, 'utf8');
const write = (path, content) => fs.writeFile(path, content, 'utf8');

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing expected ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected one ${label}, found more than one`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let editor = await read('assets/js/observation-editor.js');
editor = replaceOnce(
  editor,
  `function handlePrimaryAction() {`,
  `function syncLoadedMatchProvenance(suggestions, source) {\n  const normalizedSource = typeof source === 'string' ? source.trim() : '';\n  const exactTotal = Math.max(Number(suggestions?.total) || 0, 0);\n  const sameSource = state.detectionSource === normalizedSource;\n  const fallbackQueue = sameSource && Array.isArray(state.detectionFallbackQueue)\n    ? state.detectionFallbackQueue\n    : [];\n\n  state.detectionSource = normalizedSource;\n  state.detectionMatches = exactTotal;\n  if (exactTotal > 0) {\n    state.detectionStatus = 'match';\n    state.detectionFallbacks = 0;\n    state.detectionFallbackQueue = [];\n  } else {\n    state.detectionFallbackQueue = fallbackQueue;\n    state.detectionFallbacks = fallbackQueue.length;\n    state.detectionStatus = fallbackQueue.length ? 'near' : 'none';\n  }\n  renderDetectionStatus();\n}\n\nfunction handlePrimaryAction() {`,
  'loaded-match provenance helper',
);
editor = replaceOnce(
  editor,
  `  state.directSuggestions = direct;\n  const hasDirect = hasSuggestions(direct);`,
  `  state.directSuggestions = direct;\n  syncLoadedMatchProvenance(direct, trimmed);\n  const hasDirect = hasSuggestions(direct);`,
  'Load matches provenance synchronization',
);
editor = replaceOnce(
  editor,
  `  if (!summary) {\n    return;\n  }\n\n  const status = state.detectionStatus || 'loading';`,
  `  if (!summary) {\n    return;\n  }\n\n  const isResults = state.mode === 'results';\n  summary.hidden = !isResults;\n  if (!isResults) {\n    return;\n  }\n\n  const status = state.detectionStatus || 'loading';`,
  'post-load match summary visibility',
);
editor = replaceOnce(
  editor,
  `  let exactCount = 0;\n  let nearCount = 0;\n  const allowCounts = status !== 'loading' && status !== 'short' && status !== 'idle';\n  if (allowCounts) {\n    exactCount = Math.min(Number(state.detectionMatches) || 0, matchLimit);\n    nearCount = Math.min(Number(state.detectionFallbacks) || 0, nearLimit || Number(state.detectionFallbacks) || 0);\n  }`,
  `  let exactCount = 0;\n  let nearCount = 0;\n  const allowCounts = status !== 'loading' && status !== 'short' && status !== 'idle';\n  if (allowCounts) {\n    const loadedExactTotal = Math.max(Number(state.directSuggestions?.total) || 0, 0);\n    const loadedNearTotal = state.fallback?.active && Array.isArray(state.fallback.queue)\n      ? state.fallback.queue.length\n      : Math.max(Number(state.detectionFallbacks) || 0, 0);\n    exactCount = Math.min(loadedExactTotal, matchLimit);\n    nearCount = exactCount\n      ? 0\n      : Math.min(loadedNearTotal, nearLimit || loadedNearTotal);\n  }`,
  'loaded-result match counts',
);
await write('assets/js/observation-editor.js', editor);

let css = await read('styles/observations-mobile.css');
css = replaceOnce(
  css,
  `  #main.observations-page .observation-editor__card,\n  #main.observations-page .observation-editor__grid,\n  #main.observations-page .observation-editor__field {\n    gap: 0.65rem;\n  }\n\n  #main.observations-page .observation-editor__label-row {`,
  `  #main.observations-page .observation-editor__card,\n  #main.observations-page .observation-editor__grid,\n  #main.observations-page .observation-editor__field {\n    gap: 0.65rem;\n  }\n\n  /* Primary phone task flow: write → Load matches → results.\n     Coaching stays available, but it no longer sits between the observation\n     and the action the person came here to take. */\n  #main.observations-page .observation-editor__field > * {\n    order: 100;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-editor__label-row {\n    order: 10;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-editor__input-wrapper {\n    order: 20;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-editor__issues {\n    order: 25;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-suggestions {\n    order: 30;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-editor__match-summary {\n    order: 40;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-editor__slot-header {\n    order: 50;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-editor__slot-row {\n    order: 60;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-editor__example {\n    order: 70;\n  }\n\n  #main.observations-page .observation-editor__field > .observation-editor__recipe {\n    order: 80;\n  }\n\n  #main.observations-page .observation-editor__label-row {`,
  'mobile Observations task-flow ownership',
);
css = replaceOnce(
  css,
  `  #main.observations-page .observation-editor__example-body,\n  #main.observations-page .observation-editor__match-summary,\n  #main.observations-page .observation-panel,`,
  `  #main.observations-page .observation-editor__example-body,\n  #main.observations-page .observation-panel,`,
  'match summary removal from card-surface group',
);
css = replaceOnce(
  css,
  `  #main.observations-page .observation-editor__match-summary {\n    gap: 0.42rem;\n    padding: 0.58rem 0.65rem;\n    font-size: 0.82rem;\n  }\n\n  #main.observations-page .observation-editor__match-summary-main {\n    gap: 0.5rem;\n  }\n\n  #main.observations-page .observation-editor__match-summary-chips {\n    gap: 0.35rem;\n  }\n\n  #main.observations-page .observation-editor__match-summary-row {\n    min-height: 1.85rem;\n    padding: 0.2rem 0.55rem;\n  }`,
  `  #main.observations-page .observation-editor__match-summary {\n    gap: 0.3rem;\n    padding: 0.18rem 0.12rem;\n    border: 0;\n    border-radius: 0;\n    background: transparent;\n    box-shadow: none;\n    font-size: 0.76rem;\n  }\n\n  #main.observations-page .observation-editor__match-summary[hidden] {\n    display: none;\n  }\n\n  #main.observations-page .observation-editor__match-summary-main {\n    gap: 0.35rem;\n  }\n\n  #main.observations-page .observation-editor__match-summary-note {\n    font-size: 0.76rem;\n    color: color-mix(in srgb, var(--ink-soft) 72%, transparent);\n  }\n\n  #main.observations-page .observation-editor__match-summary-chips {\n    gap: 0.3rem;\n  }\n\n  #main.observations-page .observation-editor__match-summary-row {\n    min-height: 1.7rem;\n    padding: 0.14rem 0.48rem;\n    border-width: 1px;\n    box-shadow: none;\n  }`,
  'compact post-load match provenance',
);
css = replaceOnce(
  css,
  `  #main.observations-page .observation-suggestions {\n    gap: 0.62rem;\n    padding-block: 0.72rem 0.12rem;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='results'] {\n    border-top: 0;\n  }`,
  `  #main.observations-page .observation-suggestions {\n    gap: 0.62rem;\n    padding-block: 0.72rem 0.12rem;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='editing'] {\n    gap: 0;\n    padding-block: 0.08rem 0;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__heading,\n  #main.observations-page .observation-suggestions[data-mode='editing'] .need-status-toggle {\n    display: none;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__header {\n    gap: 0;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__action-row {\n    grid-template-columns: minmax(0, 1fr);\n    gap: 0;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__clear {\n    display: none;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__action {\n    width: 100%;\n    min-height: 52px;\n    border-radius: var(--radius-xl);\n    box-shadow: none;\n    font-size: 0.96rem;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='results'] {\n    border-top: 0;\n  }`,
  'editing-state primary Load matches action',
);
await write('styles/observations-mobile.css', css);

let tests = await read('tests/shared-density-polish.test.mjs');
tests = replaceOnce(
  tests,
  `  const css = await fs.readFile(path.join(root, 'styles/observations-mobile.css'), 'utf8');\n  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');`,
  `  const css = await fs.readFile(path.join(root, 'styles/observations-mobile.css'), 'utf8');\n  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');\n  const editor = await fs.readFile(path.join(root, 'assets/js/observation-editor.js'), 'utf8');`,
  'mobile Observations regression fixtures',
);
tests = replaceOnce(
  tests,
  `  assert.ok(css.includes('#main.observations-page .observation-suggestions__action:disabled'));\n  assert.ok(!css.includes('!important'));`,
  `  assert.ok(css.includes('#main.observations-page .observation-suggestions__action:disabled'));\n  assert.ok(css.includes('.observation-editor__field > .observation-suggestions {\\n    order: 30;'));\n  assert.ok(css.includes('.observation-editor__field > .observation-editor__match-summary {\\n    order: 40;'));\n  assert.ok(css.includes(".observation-suggestions[data-mode='editing'] .observation-suggestions__heading"));\n  assert.ok(css.includes(".observation-suggestions[data-mode='editing'] .observation-suggestions__action-row"));\n  assert.ok(css.includes('grid-template-columns: minmax(0, 1fr);'));\n  assert.ok(css.includes('min-height: 52px;'));\n  assert.ok(editor.includes("summary.hidden = !isResults;"));\n  assert.ok(editor.includes('syncLoadedMatchProvenance(direct, trimmed);'));\n  assert.ok(editor.includes('const loadedExactTotal = Math.max(Number(state.directSuggestions?.total) || 0, 0);'));\n  assert.ok(!css.includes('!important'));`,
  'mobile task-flow regression assertions',
);
await write('tests/shared-density-polish.test.mjs', tests);

let readme = await read('README.md');
readme = replaceOnce(
  readme,
  `- Inventory, dedicated Journal, and Alexithymia Support remain eager because their primary visible features directly depend on their current controllers.\n\n\`tests/route-runtime-ownership.test.mjs\` protects the behavior boundary`,
  `- Inventory, dedicated Journal, and Alexithymia Support remain eager because their primary visible features directly depend on their current controllers.\n- On phone, Observations now has one explicit primary task path: write the observation → Load matches → review results. Quick Check, examples, recipe guidance, and exact/nearby provenance remain available as secondary support rather than competing with the primary action. Exact/nearby counts are displayed only after Load matches and are derived from the same loaded suggestion result that produced the visible Needs and Feelings.\n\n\`tests/route-runtime-ownership.test.mjs\` protects the behavior boundary`,
  'README Observations canary flow',
);
await write('README.md', readme);
