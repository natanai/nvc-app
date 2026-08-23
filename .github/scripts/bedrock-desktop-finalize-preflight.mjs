import { readFileSync, writeFileSync } from 'node:fs';

// Temporary preflight aligns the one-shot migration with canonical source indentation.
const path = '.github/scripts/bedrock-desktop-finalize.mjs';
let source = readFileSync(path, 'utf8');

const substitutions = [
  ["const oldDesktopJournal = lines(\n  '    @media (min-width: 760px) {',\n  \"      main[data-page-id='inventory-journal'] .journal-overview-grid {\",\n  '        grid-template-columns: repeat(2, minmax(0, 1fr));',\n  '      }',\n  '',\n  \"      main[data-page-id='inventory-journal'] .journal-history-controls__filters {\",\n);",
   "const oldDesktopJournal = lines(\n  '      @media (min-width: 760px) {',\n  \"        main[data-page-id='inventory-journal'] .journal-overview-grid {\",\n  '          grid-template-columns: repeat(2, minmax(0, 1fr));',\n  '        }',\n  '',\n  \"        main[data-page-id='inventory-journal'] .journal-history-controls__filters {\",\n);"],
  ["const newDesktopJournal = lines(\n  '    @media (min-width: 760px) {',\n  \"      main[data-page-id='inventory-journal'] .journal-history-controls__filters {\",\n);",
   "const newDesktopJournal = lines(\n  '      @media (min-width: 760px) {',\n  \"        main[data-page-id='inventory-journal'] .journal-history-controls__filters {\",\n);"],
];

for (const [before, after] of substitutions) {
  if (!source.includes(before)) {
    throw new Error('Desktop finalizer preflight could not locate expected migration fragment');
  }
  source = source.replace(before, after);
}

writeFileSync(path, source);
console.log('Adjusted desktop migration to the canonical Journal style indentation.');
