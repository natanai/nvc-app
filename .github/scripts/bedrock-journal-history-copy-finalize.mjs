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

// 1) Replace the conversational/anthropomorphic Journal prompt copy at the
// canonical Journal component owner. These prompts are optional editor content,
// not a post-paint rewrite of route markup.
{
  const path = 'assets/js/journal/module.js';
  let source = await read(path);

  source = replaceOnce(
    source,
`  prompts: {
    heading: 'Need a nudge?',
    items: [
      'What sensations stood out in your body?',
      'What need might be shining through or feeling tender?',
      'What support, boundary, or self-care step sounds kind?',
    ],
  },`,
`  prompts: {
    heading: 'Optional reflection prompts',
    items: [
      'What did you notice in your body, thoughts, or emotions?',
      'What was happening when you noticed it?',
      'What would be useful to understand, request, or do next?',
    ],
  },`,
    'base Journal prompt copy',
  );

  source = replaceOnce(
    source,
`    prompts: {
      heading: 'Need a gentle prompt?',
      items: [
        'What was happening right before you noticed this feeling?',
        'Does the emotion you chose fit? What signals line up or feel different?',
        'How strong is it right now on a scale from 1 (just there) to 10 (all-consuming)?',
        'What do you need or long for in this moment?',
      ],
    },`,
`    prompts: {
      heading: 'Optional reflection prompts',
      items: [
        'What did you notice in your body, thoughts, or emotions?',
        'What was happening when you first noticed it?',
        'Which feeling or need best fits what you noticed?',
        'What response or support would be useful now?',
      ],
    },`,
    'support Journal prompt copy',
  );

  await write(path, source);
}

// 2) Long reflections are user state, so the History runtime owns the decision
// to collapse them. Use a native details disclosure rather than a modal or a
// CSS-only clamp so the complete reflection remains directly accessible.
{
  const path = 'scripts/inventory.js';
  let source = await read(path);

  const helper = `const JOURNAL_HISTORY_COLLAPSE_AFTER_WORDS = 80;
const JOURNAL_HISTORY_PREVIEW_WORDS = 55;

function getJournalHistoryNotePresentation(value) {
  const full = String(value ?? '').trim();
  if (!full) {
    return null;
  }
  const words = full.split(/\\s+/).filter(Boolean);
  if (words.length <= JOURNAL_HISTORY_COLLAPSE_AFTER_WORDS) {
    return { full, preview: full, collapsible: false };
  }
  return {
    full,
    preview: \`\${words.slice(0, JOURNAL_HISTORY_PREVIEW_WORDS).join(' ')}…\`,
    collapsible: true,
  };
}

function buildJournalHistoryNote(value) {
  const note = getJournalHistoryNotePresentation(value);
  if (!note) {
    return null;
  }

  if (!note.collapsible) {
    const paragraph = document.createElement('p');
    paragraph.className = 'journal-entry__notes';
    paragraph.textContent = note.full;
    return paragraph;
  }

  const details = document.createElement('details');
  details.className = 'journal-entry__notes-disclosure';

  const summary = document.createElement('summary');
  summary.className = 'journal-entry__notes-summary';

  const preview = document.createElement('span');
  preview.className = 'journal-entry__notes journal-entry__notes--preview';
  preview.textContent = note.preview;

  const closedLabel = document.createElement('span');
  closedLabel.className = 'journal-entry__notes-toggle journal-entry__notes-toggle--closed';
  closedLabel.textContent = 'Read full entry';

  const openLabel = document.createElement('span');
  openLabel.className = 'journal-entry__notes-toggle journal-entry__notes-toggle--open';
  openLabel.textContent = 'Show less';

  summary.append(preview, closedLabel, openLabel);

  const full = document.createElement('p');
  full.className = 'journal-entry__notes journal-entry__notes--full';
  full.textContent = note.full;

  details.append(summary, full);
  return details;
}

`;

  source = replaceOnce(
    source,
    'function renderJournalHistory() {',
    `${helper}function renderJournalHistory() {`,
    'Journal History renderer insertion point',
  );

  source = replaceOnce(
    source,
`    if (entry.notes) {
      const notes = document.createElement('p');
      notes.className = 'journal-entry__notes';
      notes.textContent = entry.notes;
      card.appendChild(notes);
    }`,
`    const noteElement = buildJournalHistoryNote(entry.notes);
    if (noteElement) {
      card.appendChild(noteElement);
    }`,
    'Journal History note rendering block',
  );

  await write(path, source);
}

// 3) Extend the existing Journal-entry style owner in-place. The disclosure is
// deliberately lightweight: no new card, shadow, modal, or late override layer.
{
  const path = 'styles.css';
  let source = await read(path);
  source = replaceOnce(
    source,
`.journal-entry__notes {
  margin: 0;
  white-space: pre-wrap;
}`,
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
    'Journal History note style owner',
  );
  await write(path, source);
}

// 4) Turn the two observations into permanent regression requirements in the
// existing final-hierarchy suite rather than adding a separate cosmetic test.
{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = await read(path);
  source = replaceOnce(
    source,
`  }
});

test('Need strategy browsing and personal strategy editing use compact final hierarchy', async () => {`,
`  }

  assert.ok(runtime.includes('const JOURNAL_HISTORY_COLLAPSE_AFTER_WORDS = 80;'), 'long Journal entries must have a stable collapse threshold');
  assert.ok(runtime.includes("details.className = 'journal-entry__notes-disclosure'"), 'long entries must use a native disclosure rather than overpowering History');
  assert.ok(runtime.includes("closedLabel.textContent = 'Read full entry'"), 'collapsed long entries must have an explicit expansion action');
  assert.ok(runtime.includes("openLabel.textContent = 'Show less'"), 'expanded long entries must be collapsible again');
  assert.ok(css.includes('.journal-entry__notes-disclosure[open] .journal-entry__notes--preview'), 'History disclosure state must be styled at the canonical Journal-entry owner');
  assert.ok(moduleSource.includes("heading: 'Optional reflection prompts'"), 'Journal prompts must use neutral professional labeling');
  assert.equal(moduleSource.includes('Need a nudge?'), false, 'retired conversational Journal prompt heading must not return');
  assert.equal(moduleSource.includes('shining through or feeling tender'), false, 'retired anthropomorphic Journal prompt copy must not return');
});

test('Need strategy browsing and personal strategy editing use compact final hierarchy', async () => {`,
    'final hierarchy regression insertion point',
  );
  await write(path, source);
}

// 5) Keep the device acceptance checklist synchronized with the shipped History
// behavior so a future density pass does not silently regress it.
{
  const path = 'docs/bedrock-acceptance-checklist.md';
  let source = await read(path);
  source = replaceOnce(
    source,
`4. Saved entries should scan like a dense native log/list: Feeling/intensity first, quiet date metadata, a concise note body when present, small Need/Tag facets, and secondary Edit/Delete actions. Entries should be separated without each becoming another heavy shadowed card. With filters, entries, and Patterns populated, the entire Journal must remain locked to the phone viewport width; the filter controls themselves must also fit in bounded grid rows rather than creating any horizontal pan surface.`,
`4. Saved entries should scan like a dense native log/list: Feeling/intensity first, quiet date metadata, a concise note body when present, small Need/Tag facets, and secondary Edit/Delete actions. Entries should be separated without each becoming another heavy shadowed card. Reflections longer than 80 words should collapse to a short preview with **Read full entry** / **Show less** disclosure controls so one entry cannot dominate History. With filters, entries, and Patterns populated, the entire Journal must remain locked to the phone viewport width; the filter controls themselves must also fit in bounded grid rows rather than creating any horizontal pan surface.`,
    'Journal hierarchy acceptance long-entry step',
  );
  source = replaceOnce(
    source,
`Pass condition: History and Patterns read as the two core dedicated-Journal surfaces; empty history does not expose meaningless controls or flash them during first paint; populated history does not flash an empty state; populated filters use self-explanatory neutral labels and remain bounded to the viewport; entries are easy to scan within one phone viewport; Clear filters only appears when there is something to clear; Backup remains secondary; and the fallback editor is visually pushed back, compact when closed, and uses the available width when deliberately opened.`,
`Pass condition: History and Patterns read as the two core dedicated-Journal surfaces; empty history does not expose meaningless controls or flash them during first paint; populated history does not flash an empty state; populated filters use self-explanatory neutral labels and remain bounded to the viewport; entries are easy to scan within one phone viewport, with long reflections collapsed by default and fully available on demand; Clear filters only appears when there is something to clear; Backup remains secondary; and the fallback editor is visually pushed back, compact when closed, and uses the available width when deliberately opened.`,
    'Journal hierarchy pass condition',
  );
  await write(path, source);
}

console.log('Journal history/copy finalization applied at canonical owners.');
