import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function insertAfter(source, marker, insertion, label) {
  if (source.includes(insertion.trim())) return source;
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Missing ${label}`);
  const end = index + marker.length;
  return source.slice(0, end) + insertion + source.slice(end);
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);

  source = replaceOnce(
    source,
    "      main[data-page-id='inventory-journal'] .journal-utility-disclosure {\n        border: 1px solid color-mix(in srgb, var(--outline) 16%, transparent);",
    "      main[data-page-id='inventory-journal'] .journal-utility-disclosure {\n        display: block;\n        min-height: 0;\n        border: 1px solid color-mix(in srgb, var(--outline) 16%, transparent);",
    'Journal utility disclosure base rule',
  );

  const utilityBody = "      main[data-page-id='inventory-journal'] .journal-utility-disclosure__body {\n        display: grid;\n        gap: 0.55rem;\n        padding: 0 0.72rem 0.72rem;\n      }";
  source = insertAfter(
    source,
    utilityBody,
    "\n\n      main[data-page-id='inventory-journal'] .journal-utility-disclosure:not([open]) > .journal-utility-disclosure__body {\n        display: none;\n      }",
    'Journal utility disclosure body rule',
  );

  source = replaceOnce(
    source,
    '<div class=\\"journal-inline-container journal-panel journal-panel--form-shell\\" data-journal-inline-container>',
    '<div class=\\"journal-inline-container journal-panel journal-panel--form-shell\\" data-journal-inline-container data-journal-notes-rows=\\"5\\">',
    'Journal inline fallback container',
  );

  write(path, source);
}

{
  const path = 'styles.css';
  let source = read(path);
  const fallbackBody = `.journal-inline-fallback__body {\n  margin-top: clamp(1rem, 3vw, 1.6rem);\n  display: grid;\n  gap: clamp(1rem, 3vw, 1.4rem);\n}`;
  source = insertAfter(
    source,
    fallbackBody,
    `\n\n.journal-inline-fallback:not([open]) > .journal-inline-fallback__body {\n  display: none;\n}\n\n.journal-inline-fallback[open] .journal-panel--form-shell {\n  padding: clamp(0.7rem, 2vw, 1rem);\n}\n\n.journal-inline-fallback[open] .journal-form__layout,\n.journal-inline-fallback[open] .journal-form__page {\n  gap: clamp(0.6rem, 2vw, 0.85rem);\n}\n\n.journal-inline-fallback[open] .journal-form__sheet {\n  min-height: 0;\n  height: auto;\n  padding: clamp(0.7rem, 2vw, 1rem);\n  box-shadow: none;\n}\n\n.journal-inline-fallback[open] .journal-form__notes {\n  min-height: 8rem;\n}`,
    'Journal inline fallback body rule',
  );
  write(path, source);
}

{
  const path = 'assets/js/journal/module.js';
  let source = read(path);
  const marker = `  if (dataset.journalNotesPlaceholder) {\n    options.placeholders = options.placeholders || {};\n    options.placeholders.notes = dataset.journalNotesPlaceholder;\n  }`;
  source = insertAfter(
    source,
    marker,
    `\n  if (dataset.journalNotesRows) {\n    const rows = Number.parseInt(dataset.journalNotesRows, 10);\n    if (Number.isFinite(rows) && rows > 0) {\n      options.notes = options.notes || {};\n      options.notes.rows = Math.min(24, rows);\n    }\n  }`,
    'Journal dataset notes placeholder parser',
  );
  write(path, source);
}

{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = read(path);
  source = replaceOnce(
    source,
    "  const runtime = await load('scripts/inventory.js');\n  const html = await load('inventory/journal/index.html');",
    "  const runtime = await load('scripts/inventory.js');\n  const moduleSource = await load('assets/js/journal/module.js');\n  const css = await load('styles.css');\n  const html = await load('inventory/journal/index.html');",
    'Journal hierarchy test source loads',
  );
  const marker = "  assert.equal(runtime.includes('updateJournalSummaryVisibility'), false);";
  source = insertAfter(
    source,
    marker,
    `\n  assert.ok(build.includes(\".journal-utility-disclosure:not([open]) > .journal-utility-disclosure__body\"), 'closed Journal utility disclosures must hide their bodies explicitly for Safari');\n  assert.ok(css.includes('.journal-inline-fallback:not([open]) > .journal-inline-fallback__body'), 'closed inline fallback must not render its body');\n  assert.ok(build.includes('data-journal-notes-rows=\\"5\\"'), 'fallback Journal editor must request a compact reflection field');\n  assert.ok(moduleSource.includes('dataset.journalNotesRows'), 'Journal module must support per-instance reflection row density');\n  assert.ok(css.includes('.journal-inline-fallback[open] .journal-form__sheet'), 'fallback editor must neutralize the full-screen sheet minimum height');`,
    'Journal hierarchy assertions',
  );
  write(path, source);
}

console.log('Repaired Safari details collapsing and compacted the emergency inline Journal editor at canonical owners.');
