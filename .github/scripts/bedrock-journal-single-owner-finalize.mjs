import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value);

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Missing ${label}`);
  }
  return source.replace(before, after);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Missing ${label}`);
  }
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function cutBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Missing ${label}`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

// 1) One canonical Journal form definition. Context may supply only identity/density,
// never a parallel set of labels, prompts, placeholders, or actions.
{
  const path = 'assets/js/journal/module.js';
  let source = read(path);

  source = replaceExact(source, "  variant: 'inventory',\n", '', 'base Journal variant marker');

  source = replaceRegex(
    source,
    /\nconst JOURNAL_VARIANT_CONFIG = \{[\s\S]*?\n\};\n\nconst parseDatasetOptions = \(dataset = \{\}\) => \{[\s\S]*?\n\};\n\nconst createElement =/,
    `\nconst parseDatasetOptions = (dataset = {}) => {\n  const options = {};\n  if (dataset.journalIdPrefix) {\n    options.idPrefix = dataset.journalIdPrefix;\n  }\n  if (dataset.journalNotesRows) {\n    const rows = Number.parseInt(dataset.journalNotesRows, 10);\n    if (Number.isFinite(rows) && rows > 0) {\n      options.notes = { rows: Math.min(24, rows) };\n    }\n  }\n  return options;\n};\n\nconst normalizeRenderContext = (context = {}) => {\n  const options = {};\n  if (typeof context.idPrefix === 'string' && context.idPrefix.trim()) {\n    options.idPrefix = context.idPrefix.trim();\n  }\n  if (context.notesRows !== undefined) {\n    const rows = Number.parseInt(context.notesRows, 10);\n    if (Number.isFinite(rows) && rows > 0) {\n      options.notes = { rows: Math.min(24, rows) };\n    }\n  }\n  return options;\n};\n\nconst createElement =`,
    'variant and semantic dataset override block',
  );

  source = replaceExact(
    source,
    'export function renderJournalForm(root, overrides = {}) {',
    'export function renderJournalForm(root, context = {}) {',
    'renderJournalForm context signature',
  );

  source = replaceExact(
    source,
    `  const datasetOptions = parseDatasetOptions(container.dataset || {});\n  const variantKey = overrides.variant || datasetOptions.variant || container.dataset?.journalVariant || 'inventory';\n  const variantConfig = JOURNAL_VARIANT_CONFIG[variantKey] || {};\n  const config = deepMerge(JOURNAL_BASE_CONFIG, variantConfig, datasetOptions, overrides || {});\n\n  container.classList.add(...(config.classes.container || []));\n  container.dataset.journalVariant = config.variant;\n  container.innerHTML = '';`,
    `  const datasetOptions = parseDatasetOptions(container.dataset || {});\n  const contextOptions = normalizeRenderContext(context || {});\n  const config = deepMerge(JOURNAL_BASE_CONFIG, datasetOptions, contextOptions);\n\n  container.classList.add(...(config.classes.container || []));\n  container.innerHTML = '';`,
    'renderJournalForm variant resolution',
  );

  source = replaceExact(
    source,
    "  form.dataset.journalVariant = config.variant;\n\n",
    '',
    'form Journal variant marker',
  );

  for (const forbidden of [
    'JOURNAL_VARIANT_CONFIG',
    'journalVariant',
    'journalPromptsHeading',
    'journalPrompts',
    'journalNotesPlaceholder',
    'journalNotesLabel',
    'journalTagsPlaceholder',
    'journalNeedsPlaceholder',
    'journalSubmitLabel',
    'journalClearLabel',
    'journalOpenLabel',
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`Journal module still exposes duplicate semantic channel: ${forbidden}`);
    }
  }
  if ((source.match(/Optional reflection prompts/g) || []).length !== 1) {
    throw new Error('Canonical Journal prompt copy must have exactly one owner');
  }

  write(path, source);
}

// 2) Dedicated/fallback Journal mounts identify only the canonical module and
// optional context density. There is no semantic "inventory variant" anymore.
{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);
  if (!source.includes('data-journal-variant="inventory"')) {
    throw new Error('Missing generated Journal variant marker');
  }
  source = source.replaceAll(' data-journal-variant="inventory"', '');
  if (source.includes('data-journal-variant=')) {
    throw new Error('Page compiler still emits Journal variants');
  }
  write(path, source);
}

// 3) Shared Journal runtime binds the canonical module; it does not choose a
// semantic variant or manufacture one for overlay/fallback contexts.
{
  const path = 'scripts/inventory.js';
  let source = read(path);
  const variantLine = "          variant: mount.dataset.journalVariant || 'inventory',\n";
  const moduleMarker = "    module.dataset.journalVariant = 'inventory';\n";
  const mountMarker = "    mount.dataset.journalVariant = 'inventory';\n";
  const argumentCount = source.split(variantLine).length - 1;
  const moduleCount = source.split(moduleMarker).length - 1;
  const mountCount = source.split(mountMarker).length - 1;
  if (argumentCount !== 2 || moduleCount !== 1 || mountCount !== 1) {
    throw new Error(`Unexpected Inventory Journal variant ownership: args=${argumentCount}, module=${moduleCount}, mount=${mountCount}`);
  }
  source = source.replaceAll(variantLine, '');
  source = source.replaceAll(moduleMarker, '');
  source = source.replaceAll(mountMarker, '');
  if (source.includes('journalVariant')) {
    throw new Error('Shared runtime still branches Journal semantics by variant');
  }
  write(path, source);
}

// 4) Alexithymia Support no longer contains a parallel Journal form/controller,
// draft layer, history renderer, save implementation, or generic Journal copy.
// It keeps only its guided-flow behavior and opens the shared global Journal.
{
  const path = 'scripts/alexithymia-support.js';
  let source = read(path);

  for (const line of [
    "    draftPath: typeof window !== 'undefined' ? window.location.pathname : '',\n",
    '    draftTimer: null,\n',
    '    savedFeedbackTimer: null,\n',
    "    lastSavedEntryId: '',\n",
    "    saveButtonDefaultLabel: '',\n",
    '    journalController: null,\n',
    '    needs: [],\n',
    '    feelings: [],\n',
    '    selectedEmotionConfidence: null,\n',
    '    regulationLog: new Set(),\n',
  ]) {
    source = replaceExact(source, line, '', `Alexithymia dead Journal state ${line.trim()}`);
  }

  source = cutBetween(
    source,
    '  let journalForm = null;',
    '  function showOnlyStep(key) {',
    `  const regulationCard = document.querySelector('[data-regulation-card]');\n  const communicationCard = document.querySelector('[data-communication-card]');\n  let evidencePopover = null;\n  let evidencePopoverContent = null;\n  let evidencePopoverClose = null;\n  let evidencePopoverOverlay = null;\n  let evidencePopoverFocusReturn = null;\n\n  let breathingTimer = null;\n\n`,
    'Alexithymia local Journal initialization block',
  );

  source = source.replace(/^\s*state\.regulationLog\.add\([^\n]*\);\n/gm, '');
  source = source.replace(/^\s*state\.regulationLog = new Set\(\);\n/gm, '');
  source = source.replace(/^\s*resetLaneSaveButton\(\);\n/gm, '');
  source = source.replace(/^\s*scheduleLaneDraftSave\(\);\n/gm, '');
  source = source.replace(/^\s*prefillSupportEmotion\([^\n]*\);\n/gm, '');
  source = source.replace(/^\s*state\.selectedEmotionConfidence = [^\n]*\n(?:\s*\?[^\n]*\n\s*:[^\n]*\n)?/gm, '');

  source = cutBetween(
    source,
    '  function renderJournalHistory() {',
    '  function handleSuggestionClick(event) {',
    '',
    'Alexithymia parallel Journal implementation block',
  );

  source = cutBetween(
    source,
    '  function loadLaneReferenceData() {',
    '  function init() {',
    '',
    'Alexithymia Journal reference-data loader',
  );

  const journalBindingsStart = `    if (journalForm) {\n      journalForm.addEventListener('submit', handleJournalSubmit);\n    }`;
  const communicationBinding = "    communicationCard?.addEventListener('click', handleCommunicationClick);";
  source = cutBetween(
    source,
    journalBindingsStart,
    communicationBinding,
    '',
    'Alexithymia Journal event binding block',
  );

  source = replaceRegex(
    source,
    /\n\s*applyLaneDraft\(\);\n\s*loadLaneReferenceData\(\);\n\s*renderJournalHistory\(\);\n\s*updateStepControls\(\);\n\s*if \(!getJournalStore\(\)[\s\S]*?\n\s*}\n\s*}\n\n\s*if \(document\.readyState/,
    `\n    updateStepControls();\n  }\n\n  if (document.readyState`,
    'Alexithymia Journal init tail',
  );

  for (const forbidden of [
    'journalController',
    'journalForm',
    'journalStatus',
    'journalHistory',
    'supportJournal',
    'renderJournalForm',
    'handleJournalSubmit',
    'handleJournalClear',
    'gatherSupportJournalData',
    'createLaneEntry',
    'saveLaneDraft',
    'applyLaneDraft',
    'loadLaneReferenceData',
    'getJournalStore',
    'normalizeJournalTagsValue',
    'joinJournalTagsValue',
    "variant: 'support'",
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`Alexithymia Support still contains duplicate Journal implementation: ${forbidden}`);
    }
  }

  write(path, source);
}

// 5) The Alexithymia page itself explains that its Journal action opens the
// same Journal used everywhere else; contextual guidance remains outside the form.
{
  const path = 'alexithymia-support/index.html';
  let source = read(path);
  source = replaceExact(
    source,
    `              Linking a feeling to context strengthens emotional awareness. Use the prompts below as writing cues or simply sit\n              with them.`,
    `              Open the same Journal used throughout allneeds.app when you want to record what you noticed. Entries saved here\n              appear in the same Journal history as entries made elsewhere.`,
    'Alexithymia Journal step description',
  );
  write(path, source);
}

// 6) Permanent provenance gate: one semantic form owner, context-only mounts.
{
  const path = 'tests/bedrock-runtime-provenance.test.mjs';
  let source = read(path);
  const marker = "test('Journal form semantics have one canonical owner'";
  if (!source.includes(marker)) {
    source += `\n\ntest('Journal form semantics have one canonical owner', () => {\n  const moduleSource = read('assets/js/journal/module.js');\n  const inventory = read('scripts/inventory.js');\n  const support = read('scripts/alexithymia-support.js');\n  const pages = read('scripts/build-pages.mjs');\n  const journal = read('inventory/journal/index.html');\n  const supportPage = read('alexithymia-support/index.html');\n\n  assert.equal(moduleSource.includes('JOURNAL_VARIANT_CONFIG'), false, 'parallel Journal semantic variants must stay retired');\n  assert.equal(moduleSource.includes('journalVariant'), false, 'Journal module must not branch semantics by context name');\n  assert.equal((moduleSource.match(/Optional reflection prompts/g) || []).length, 1, 'generic Journal copy must have one canonical owner');\n  for (const duplicateChannel of [\n    'journalPromptsHeading',\n    'journalPrompts',\n    'journalNotesPlaceholder',\n    'journalNotesLabel',\n    'journalTagsPlaceholder',\n    'journalNeedsPlaceholder',\n    'journalSubmitLabel',\n    'journalClearLabel',\n    'journalOpenLabel',\n  ]) {\n    assert.equal(moduleSource.includes(duplicateChannel), false, duplicateChannel + ' must not reopen per-mount semantic drift');\n  }\n\n  assert.equal(inventory.includes('journalVariant'), false, 'shared runtime binds the canonical Journal without selecting a variant');\n  assert.equal(pages.includes('data-journal-variant='), false, 'compiler must not serialize semantic Journal variants');\n  assert.equal(journal.includes('data-journal-variant='), false, 'generated Journal must not ship a semantic variant marker');\n  assert.ok(pages.includes('data-journal-notes-rows=\\"5\\"'), 'fallback may keep context-specific density without redefining Journal semantics');\n\n  for (const duplicateImplementation of [\n    'journalController',\n    'renderJournalForm',\n    'handleJournalSubmit',\n    'gatherSupportJournalData',\n    'createLaneEntry',\n    'renderJournalHistory',\n  ]) {\n    assert.equal(support.includes(duplicateImplementation), false, 'Alexithymia must not maintain a parallel Journal implementation: ' + duplicateImplementation);\n  }\n  assert.ok(supportPage.includes('data-support-journal-open'), 'Alexithymia keeps only its contextual entry point into the shared Journal');\n  assert.ok(supportPage.includes('same Journal history as entries made elsewhere'), 'Alexithymia context must describe shared Journal ownership explicitly');\n});\n`;
  }
  write(path, source);
}
