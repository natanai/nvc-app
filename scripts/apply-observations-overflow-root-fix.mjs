import { readFileSync, writeFileSync } from 'node:fs';

const pagePath = 'observations/index.html';
const editorPath = 'assets/js/observation-editor.js';

let page = readFileSync(pagePath, 'utf8');
let editor = readFileSync(editorPath, 'utf8');

const oldMobileSlotBlock = `  @media (max-width: 460px) {
    .observation-editor__slot-row {
      flex-wrap: nowrap;
      gap: 0.45rem;
      overflow-x: auto;
      max-width: 100%;
      padding-block: 0.2rem 0.45rem;
      scrollbar-width: thin;
    }

    .observation-editor__slot {
      flex: 0 0 auto;
      min-height: 2rem;
      padding: 0.25rem 0.35rem;
    }

    .observation-editor__slot-label {
      font-size: 0.86rem;
      white-space: nowrap;
    }
  }`;

const newMobileSlotBlock = `  @media (max-width: 460px) {
    .observation-editor__slot-row {
      gap: 0.45rem;
      padding-block: 0.2rem 0.45rem;
    }

    .observation-editor__slot {
      min-height: 2rem;
      padding: 0.25rem 0.35rem;
    }

    .observation-editor__slot-label {
      font-size: 0.86rem;
    }
  }`;

if (!page.includes(oldMobileSlotBlock)) {
  throw new Error('Could not find the current <=460px horizontal Quick Check strip CSS.');
}
page = page.replace(oldMobileSlotBlock, newMobileSlotBlock);

const oldJournalHandlerCall = '    resetObservationPageFocusState({ blur: true });';
if (!editor.includes(oldJournalHandlerCall)) {
  throw new Error('Could not find Journal click viewport-reset call.');
}
editor = editor.replace(oldJournalHandlerCall, '    blurObservationEditor();');

const oldResetFunctions = `function resetObservationHorizontalScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const y = window.scrollY || window.pageYOffset || 0;
  if ((window.scrollX || window.pageXOffset || 0) !== 0) {
    window.scrollTo(0, y);
  }
  if (document.documentElement) {
    document.documentElement.scrollLeft = 0;
  }
  if (document.body) {
    document.body.scrollLeft = 0;
  }
}

function resetObservationPageFocusState(options = {}) {
  const textarea = document.getElementById('observation-text');
  if (options.blur && textarea && typeof textarea.blur === 'function') {
    textarea.blur();
  }
  resetObservationHorizontalScroll();
}`;

const newBlurHelper = `function blurObservationEditor() {
  const textarea = document.getElementById('observation-text');
  if (textarea && typeof textarea.blur === 'function') {
    textarea.blur();
  }
}`;

if (!editor.includes(oldResetFunctions)) {
  throw new Error('Could not find legacy observation horizontal-scroll reset helpers.');
}
editor = editor.replace(oldResetFunctions, newBlurHelper);

const oldConvertCall = '  resetObservationPageFocusState({ blur: true });';
if (!editor.includes(oldConvertCall)) {
  throw new Error('Could not find Journal conversion viewport-reset call.');
}
editor = editor.replace(oldConvertCall, '  blurObservationEditor();');

writeFileSync(pagePath, page);
writeFileSync(editorPath, editor);

const finalPage = readFileSync(pagePath, 'utf8');
const finalEditor = readFileSync(editorPath, 'utf8');

const forbiddenPageFragments = [
  `.observation-editor__slot-row {\n      flex-wrap: nowrap;`,
  `overflow-x: auto;\n      max-width: 100%;\n      padding-block: 0.2rem 0.45rem;`,
  `.observation-editor__slot {\n      flex: 0 0 auto;`,
  `font-size: 0.86rem;\n      white-space: nowrap;`,
];

for (const fragment of forbiddenPageFragments) {
  if (finalPage.includes(fragment)) {
    throw new Error(`Horizontal Quick Check behavior remains: ${fragment}`);
  }
}

const forbiddenEditorFragments = [
  'function resetObservationHorizontalScroll()',
  'function resetObservationPageFocusState(',
  'document.documentElement.scrollLeft = 0',
  'document.body.scrollLeft = 0',
  'window.scrollTo(0, y)',
];

for (const fragment of forbiddenEditorFragments) {
  if (finalEditor.includes(fragment)) {
    throw new Error(`Legacy viewport workaround remains: ${fragment}`);
  }
}

const requiredPageFragments = [
  'id="observation-text"',
  'id="observation-slot-row"',
  'class="observation-editor__slot-row"',
  'data-slot-id="time"',
  'data-slot-id="context"',
  'data-slot-id="sensory"',
  'data-slot-id="measure"',
  'id="observation-submit"',
  'id="observation-info-dialog"',
  '../assets/js/observation-editor.js',
];

for (const fragment of requiredPageFragments) {
  if (!finalPage.includes(fragment)) {
    throw new Error(`Observations page lost required functionality marker: ${fragment}`);
  }
}

if (!finalEditor.includes('function blurObservationEditor()')) {
  throw new Error('Expected blur-only Journal helper was not created.');
}
if ((finalEditor.match(/blurObservationEditor\(\);/g) || []).length !== 2) {
  throw new Error('Expected exactly two Journal transition calls to blurObservationEditor().');
}

console.log('Observations <=460px horizontal strip and forced document-scroll reset removed.');
