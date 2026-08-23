import { promises as fs } from 'node:fs';

async function read(path) {
  return fs.readFile(path, 'utf8');
}

async function write(path, content) {
  await fs.writeFile(path, content, 'utf8');
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

// Keep styles.css at its base Journal-entry responsibility and move the new
// density/disclosure presentation into the already parser-discovered shared
// density owner. This responds to the asset ceiling by extracting ownership,
// not by raising the budget.
{
  const path = 'styles.css';
  let source = await read(path);
  source = replaceOnce(
    source,
`.journal-entry__notes {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.journal-entry__notes-disclosure {
  margin: 0;
  min-width: 0;
}

.journal-entry__notes-summary {
  min-width: 0;
  min-height: 44px;
  cursor: pointer;
  color: inherit;
}

.journal-entry__notes--preview {
  display: block;
  margin-bottom: 0.35rem;
}

.journal-entry__notes--full {
  margin-top: 0.55rem;
}

.journal-entry__notes-toggle {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  color: color-mix(in srgb, var(--ink) 78%, var(--ink-soft) 22%);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.journal-entry__notes-toggle--open {
  display: none;
}

.journal-entry__notes-disclosure[open] .journal-entry__notes--preview,
.journal-entry__notes-disclosure[open] .journal-entry__notes-toggle--closed {
  display: none;
}

.journal-entry__notes-disclosure[open] .journal-entry__notes-toggle--open {
  display: inline-block;
}`,
`.journal-entry__notes {
  margin: 0;
  white-space: pre-wrap;
}`,
    'expanded Journal note styles in styles.css',
  );
  await write(path, source);
}

{
  const path = 'styles/shared-density.css';
  let source = await read(path);
  const anchor = `.journal-entry__intensity { flex:0 0 auto; font-size:.84rem; font-weight:700; color:var(--ink-soft); }`;
  const addition = `${anchor}
.journal-entry__notes { overflow-wrap:anywhere; }
.journal-entry__notes-disclosure { margin:0; min-width:0; }
.journal-entry__notes-summary { min-width:0; min-height:44px; cursor:pointer; color:inherit; }
.journal-entry__notes--preview { display:block; margin-bottom:.35rem; }
.journal-entry__notes--full { margin-top:.55rem; }
.journal-entry__notes-toggle { display:inline-block; font-size:.78rem; font-weight:700; color:color-mix(in srgb,var(--ink) 78%,var(--ink-soft) 22%); text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:2px; }
.journal-entry__notes-toggle--open { display:none; }
.journal-entry__notes-disclosure[open] .journal-entry__notes--preview, .journal-entry__notes-disclosure[open] .journal-entry__notes-toggle--closed { display:none; }
.journal-entry__notes-disclosure[open] .journal-entry__notes-toggle--open { display:inline-block; }`;
  source = replaceOnce(source, anchor, addition, 'Journal density insertion point');
  await write(path, source);
}

{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = await read(path);
  source = replaceOnce(
    source,
`  const moduleSource = await load('assets/js/journal/module.js');
  const css = await load('styles.css');
  const html = await load('inventory/journal/index.html');`,
`  const moduleSource = await load('assets/js/journal/module.js');
  const css = await load('styles.css');
  const densityCss = await load('styles/shared-density.css');
  const html = await load('inventory/journal/index.html');`,
    'Journal hierarchy stylesheet fixtures',
  );
  source = replaceOnce(
    source,
`  assert.ok(css.includes('.journal-entry__notes-disclosure[open] .journal-entry__notes--preview'), 'History disclosure state must be styled at the canonical Journal-entry owner');`,
`  assert.ok(densityCss.includes('.journal-entry__notes-disclosure[open] .journal-entry__notes--preview'), 'History disclosure state must be styled at the canonical shared-density owner');`,
    'Journal disclosure ownership assertion',
  );
  await write(path, source);
}

console.log('Journal disclosure presentation extracted to shared-density owner.');
