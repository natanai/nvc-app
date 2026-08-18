import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const generatorPath = 'scripts/build-pages.mjs';
let source = readFileSync(generatorPath, 'utf8');
const start = source.indexOf('function renderInventoryJournalPage(needsList = []) {');
const end = source.indexOf('\nfunction renderPillGroup(', start);

if (start < 0 || end < 0) {
  throw new Error('Could not isolate renderInventoryJournalPage().');
}

let segment = source.slice(start, end);

const replacements = [
  [
    "grid-template-columns: repeat(2, minmax(0, 1fr));\n        gap: 0.55rem;",
    "grid-template-columns: minmax(0, 1fr);\n        gap: 0.55rem;"
  ],
  [
    '<button type="button" id="journal-export" class="inventory-button">Export localStorage</button>',
    '<button type="button" id="journal-export" class="inventory-button">Export backup</button>'
  ],
  [
    '<button type="button" id="journal-import-trigger" class="inventory-button inventory-button--ghost">Import localStorage</button>',
    '<button type="button" id="journal-import-trigger" class="inventory-button inventory-button--ghost">Import backup</button>'
  ],
];

for (const [from, to] of replacements) {
  if (!segment.includes(from)) {
    throw new Error(`Expected Journal anchor not found: ${from}`);
  }
  segment = segment.replace(from, to);
}

source = source.slice(0, start) + segment + source.slice(end);
writeFileSync(generatorPath, source);

execFileSync('node', ['scripts/build-pages.mjs', '--scope=inventory'], { stdio: 'inherit' });

const generated = readFileSync('inventory/journal/index.html', 'utf8');
const required = [
  '>Export backup</button>',
  '>Import backup</button>',
  "main[data-page-id='inventory-journal'] .journal-actions__buttons",
  'grid-template-columns: minmax(0, 1fr);',
  'id="journal-export"',
  'id="journal-import-trigger"',
  'id="journal-import"',
];

for (const marker of required) {
  if (!generated.includes(marker)) {
    throw new Error(`Generated Journal missing expected marker: ${marker}`);
  }
}

if (generated.includes('>Export localStorage</button>') || generated.includes('>Import localStorage</button>')) {
  throw new Error('Old long localStorage button labels remain in generated Journal.');
}

console.log('Journal backup button text/wrap fix applied and regenerated.');
