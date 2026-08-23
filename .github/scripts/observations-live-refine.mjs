import { promises as fs } from 'node:fs';

const read = path => fs.readFile(path, 'utf8');
const write = (path, content) => fs.writeFile(path, content, 'utf8');

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(`Missing expected ${label}`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected one ${label}, found more than one`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let critical = await read('styles/observations-critical.css');
critical = replaceOnce(
  critical,
  `    height: 100%;\n    overflow: hidden;\n    z-index: 1;\n  }\n\n  .observation-editor__highlight mark {\n    border-radius: var(--radius-md-plus);`,
  `    height: 100%;\n    overflow: auto;\n    scrollbar-width: none;\n    z-index: 1;\n  }\n\n  .observation-editor__highlight mark {\n    color: transparent;\n    -webkit-text-fill-color: transparent;\n    border-radius: var(--radius-md-plus);`,
  'highlight overlay paint contract',
);
critical = replaceOnce(
  critical,
  `    white-space: pre-wrap;\n    overflow: hidden;\n    pointer-events: none;\n    user-select: none;\n    color: color-mix(in srgb, var(--outline) 58%, transparent);\n    z-index: 2;\n  }\n\n  .observation-editor__formula[hidden] {`,
  `    white-space: pre-wrap;\n    overflow: auto;\n    scrollbar-width: none;\n    pointer-events: none;\n    user-select: none;\n    color: color-mix(in srgb, var(--outline) 58%, transparent);\n    z-index: 2;\n  }\n\n  .observation-editor__highlight::-webkit-scrollbar,\n  .observation-editor__formula::-webkit-scrollbar {\n    width: 0;\n    height: 0;\n    display: none;\n  }\n\n  .observation-editor__formula[hidden] {`,
  'formula overlay scroll contract',
);
await write('styles/observations-critical.css', critical);

let editor = await read('assets/js/observation-editor.js');
editor = replaceOnce(
  editor,
  `  renderDetectionStatus();\n  renderObservationFormula();\n  renderObservationSlotStatus(state.formula);`,
  `  renderDetectionStatus();\n  renderObservationFormula();\n  syncObservationHighlightScroll();\n  renderObservationSlotStatus(state.formula);`,
  'post-formula overlay synchronization',
);
await write('assets/js/observation-editor.js', editor);

let mobile = await read('styles/observations-mobile.css');
mobile = replaceOnce(
  mobile,
  `  #main.observations-page .observation-editor__recipe {\n    padding: 0;\n    grid-template-columns: minmax(0, 1fr) 44px;\n    gap: 0;\n    border-style: solid;\n    background: color-mix(in srgb, #ffffff 74%, var(--lavender) 26%);\n    overflow: hidden;\n  }`,
  `  #main.observations-page .observation-editor__recipe {\n    min-height: 48px;\n    padding: 0;\n    grid-template-columns: minmax(0, 1fr) 44px;\n    gap: 0;\n    border-style: solid;\n    border-radius: var(--radius-lg);\n    background: color-mix(in srgb, #ffffff 82%, var(--lavender) 18%);\n    overflow: hidden;\n  }`,
  'mobile recipe surface',
);
mobile = replaceOnce(
  mobile,
  `  #main.observations-page .observation-suggestions {\n    gap: 0.8rem;\n    padding-block: 0.95rem 0.2rem;\n  }`,
  `  #main.observations-page .observation-suggestions {\n    gap: 0.62rem;\n    padding-block: 0.72rem 0.12rem;\n  }\n\n  #main.observations-page .observation-suggestions[data-mode='results'] {\n    border-top: 0;\n  }`,
  'mobile suggestions rhythm',
);
mobile = replaceOnce(
  mobile,
  `  #main.observations-page .observation-suggestions__title {\n    font-size: 1.15rem;\n  }\n\n  #main.observations-page .observation-suggestions__why-details,\n  #main.observations-page .observation-suggestions__fallback {\n    padding: 0.62rem 0.7rem;\n  }`,
  `  #main.observations-page .observation-suggestions__title {\n    font-size: 1.08rem;\n  }\n\n  #main.observations-page .observation-suggestions__preview {\n    display: -webkit-box;\n    margin: 0;\n    overflow: hidden;\n    -webkit-box-orient: vertical;\n    -webkit-line-clamp: 2;\n    font-size: 0.78rem;\n    line-height: 1.4;\n    color: color-mix(in srgb, var(--ink-soft) 76%, transparent);\n  }\n\n  #main.observations-page .observation-suggestions__why-details {\n    gap: 0;\n    padding: 0;\n    overflow: hidden;\n    border-radius: var(--radius-lg);\n    background: color-mix(in srgb, #ffffff 82%, var(--sky) 18%);\n  }\n\n  #main.observations-page .observation-suggestions__why-toggle {\n    display: flex;\n    align-items: center;\n    min-height: 44px;\n    padding: 0.48rem 0.66rem;\n    font-size: 0.82rem;\n    line-height: 1.2;\n  }\n\n  #main.observations-page .observation-suggestions__why {\n    padding: 0 0.66rem 0.62rem;\n    font-size: 0.8rem;\n    line-height: 1.4;\n  }\n\n  #main.observations-page .observation-suggestions__fallback {\n    padding: 0.58rem 0.66rem;\n  }`,
  'mobile results disclosure surfaces',
);
mobile = replaceOnce(
  mobile,
  `  #main.observations-page .observation-panel {\n    gap: 0.55rem;\n    padding: 0.72rem;\n  }\n\n  #main.observations-page .observation-panel__header,\n  #main.observations-page .observation-panel__header-main {\n    gap: 0.35rem;\n  }\n\n  #main.observations-page .observation-panel__title {\n    font-size: 0.82rem;\n    letter-spacing: 0.055em;\n  }\n\n  #main.observations-page .observation-chip-list {\n    gap: 0.42rem;\n  }\n\n  #main.observations-page .observation-chip {\n    min-height: 44px;\n    padding: 0.4rem 0.68rem;\n    border-width: 1px;\n    box-shadow: none;\n    font-size: 0.82rem;\n  }`,
  `  #main.observations-page .observation-panel {\n    gap: 0.48rem;\n    padding: 0.62rem 0.66rem;\n    border-radius: var(--radius-lg);\n  }\n\n  #main.observations-page .observation-panel__header,\n  #main.observations-page .observation-panel__header-main {\n    gap: 0.25rem;\n  }\n\n  #main.observations-page .observation-panel__title {\n    font-size: 0.8rem;\n    font-weight: 750;\n    letter-spacing: 0;\n    text-transform: none;\n  }\n\n  #main.observations-page .observation-chip-list {\n    gap: 0.34rem;\n  }\n\n  #main.observations-page .observation-chip {\n    min-height: 44px;\n    padding: 0.34rem 0.6rem;\n    border: 1px solid color-mix(in srgb, var(--outline) 24%, transparent);\n    background: color-mix(in srgb, #ffffff 88%, var(--sky) 12%);\n    box-shadow: none;\n    font-size: 0.82rem;\n    font-weight: 650;\n  }`,
  'mobile suggestion panels',
);
mobile = replaceOnce(
  mobile,
  `  #main.observations-page .observation-suggestions__action-row {\n    grid-template-columns: minmax(0, 1fr) minmax(5rem, auto);\n    gap: 0.45rem;\n  }\n\n  #main.observations-page .observation-suggestions__action,\n  #main.observations-page .observation-suggestions__clear {\n    min-height: 46px;\n    padding-inline: 0.72rem;\n    box-shadow: none;\n  }\n\n  #main.observations-page .observation-suggestions__action:not(:disabled)::after {\n    content: none;\n    animation: none;\n  }`,
  `  #main.observations-page .observation-suggestions__action-row {\n    grid-template-columns: minmax(0, 1fr) auto;\n    gap: 0.38rem;\n    align-items: center;\n  }\n\n  #main.observations-page .observation-suggestions__action,\n  #main.observations-page .observation-suggestions__clear {\n    min-height: 44px;\n    padding: 0.4rem 0.66rem;\n    border: 1px solid color-mix(in srgb, var(--outline) 22%, transparent);\n    border-radius: var(--radius-lg);\n    box-shadow: none;\n    font-size: 0.8rem;\n    line-height: 1.15;\n  }\n\n  #main.observations-page .observation-suggestions__action:disabled {\n    border-color: color-mix(in srgb, var(--outline) 14%, transparent);\n    background: color-mix(in srgb, #ffffff 76%, var(--gold) 24%);\n    color: color-mix(in srgb, var(--ink-soft) 72%, transparent);\n    box-shadow: none;\n    opacity: 1;\n  }\n\n  #main.observations-page .observation-suggestions__action:not(:disabled) {\n    border-color: color-mix(in srgb, var(--outline) 28%, transparent);\n    background: color-mix(in srgb, #ffffff 64%, var(--gold) 36%);\n    box-shadow: none;\n  }\n\n  #main.observations-page .observation-suggestions__clear {\n    min-width: 4.5rem;\n    background: color-mix(in srgb, #ffffff 84%, var(--rose) 16%);\n  }\n\n  #main.observations-page .observation-suggestions__action:not(:disabled)::after {\n    content: none;\n    animation: none;\n  }\n\n  #main.observations-page .observation-feelings-toggle {\n    width: 100%;\n  }\n\n  #main.observations-page .need-status-toggle {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    width: 100%;\n    min-height: 42px;\n    padding: 2px;\n    border: 1px solid color-mix(in srgb, var(--outline) 14%, transparent);\n    border-radius: var(--radius-lg);\n    background: color-mix(in srgb, #ffffff 58%, var(--lavender) 42%);\n    overflow: hidden;\n  }\n\n  #main.observations-page .need-status-toggle__option {\n    min-height: 38px;\n    padding: 0.34rem 0.5rem;\n    border: 0;\n    border-radius: calc(var(--radius-lg) - 2px);\n    background: transparent;\n    color: color-mix(in srgb, var(--ink-soft) 72%, transparent);\n    font-size: 0.82rem;\n    font-weight: 700;\n  }\n\n  #main.observations-page .need-status-toggle__option--active {\n    background: #ffffff;\n    color: var(--ink);\n    box-shadow: 0 1px 3px color-mix(in srgb, var(--outline) 12%, transparent);\n  }\n\n  #main.observations-page .observation-suggestions__links {\n    gap: 0.35rem;\n    padding-inline: 0.1rem;\n    font-size: 0.82rem;\n    line-height: 1.35;\n  }`,
  'mobile result actions and segmented control',
);
await write('styles/observations-mobile.css', mobile);

let tests = await read('tests/shared-density-polish.test.mjs');
const testAnchor = `  assert.ok(!css.includes('!important'));\n});\n`;
const testReplacement = `  assert.ok(css.includes('#main.observations-page .need-status-toggle'));\n  assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'));\n  assert.ok(css.includes('-webkit-line-clamp: 2;'));\n  assert.ok(css.includes('#main.observations-page .observation-suggestions__why-toggle'));\n  assert.ok(css.includes('#main.observations-page .observation-suggestions__action:disabled'));\n  assert.ok(!css.includes('!important'));\n});\n\ntest('Observation text overlays remain paint-only and re-sync after formula rendering', async () => {\n  const critical = await fs.readFile(path.join(root, 'styles/observations-critical.css'), 'utf8');\n  const editor = await fs.readFile(path.join(root, 'assets/js/observation-editor.js'), 'utf8');\n\n  assert.ok(critical.includes('.observation-editor__highlight mark {\\n    color: transparent;'));\n  assert.ok(critical.includes('-webkit-text-fill-color: transparent;'));\n  assert.ok(critical.includes('overflow: auto;\\n    scrollbar-width: none;'));\n  assert.ok(critical.includes('.observation-editor__highlight::-webkit-scrollbar'));\n  assert.ok(editor.includes('renderObservationFormula();\\n  syncObservationHighlightScroll();\\n  renderObservationSlotStatus(state.formula);'));\n});\n`;
const lastAnchor = tests.lastIndexOf(testAnchor);
if (lastAnchor < 0) {
  throw new Error('Missing mobile Observations regression anchor');
}
tests = tests.slice(0, lastAnchor) + testReplacement + tests.slice(lastAnchor + testAnchor.length);
await write('tests/shared-density-polish.test.mjs', tests);

let doc = await read('docs/observations-mobile-layout.md');
doc = replaceOnce(
  doc,
  `The editor follows an iOS-style grouped hierarchy: the observation text area remains primary; Quick check becomes one compact grouped list with 44–48px rows and separators; example/help disclosures become lightweight rows; coaching, match status, suggestions, and the guide use restrained one-pixel surfaces and compact spacing instead of stacked heavy cards and shadows.`,
  `The editor follows an iOS-style grouped hierarchy: the observation text area remains primary; Quick check becomes one compact grouped list with 44–48px rows and separators; example/help disclosures become lightweight rows; coaching, match status, suggestions, and the guide use restrained one-pixel surfaces and compact spacing instead of stacked heavy cards and shadows. Results keep the submitted observation to a two-line context preview, use a compact status/action row, render the Unmet/Met choice as a native-style segmented control, and keep Needs, Feelings, rationale, and recipe surfaces visually quiet.\n\nThe highlight layer is paint-only: highlighted text is explicitly transparent (including WebKit text fill), while the visible textarea remains the sole text owner. Highlight/formula overlays are programmatically scrollable with hidden scrollbars, and the editor re-synchronizes them after formula markup is rendered so iOS textarea scrolling cannot expose a duplicated or offset second copy of highlighted text.`,
  'Observations mobile documentation',
);
await write('docs/observations-mobile-layout.md', doc);
