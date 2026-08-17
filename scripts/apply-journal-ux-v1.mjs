import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const generatorPath = 'scripts/build-pages.mjs';
let source = readFileSync(generatorPath, 'utf8');
const functionStart = source.indexOf('function renderInventoryJournalPage(needsList = []) {');
const functionEnd = source.indexOf('\nfunction renderPillGroup(', functionStart);

if (functionStart < 0 || functionEnd < 0) {
  throw new Error('Could not isolate renderInventoryJournalPage().');
}

let segment = source.slice(functionStart, functionEnd);
const marker = 'Journal UX first pass v1 — inline pre-paint overrides';

if (!segment.includes(marker)) {
  const css = String.raw`      /* Journal UX first pass v1 — inline pre-paint overrides */
      main[data-page-id='inventory-journal'] {
        gap: clamp(1rem, 2.4vw, 1.5rem);
      }

      main[data-page-id='inventory-journal'] .journal-page-header {
        padding: clamp(1rem, 3vw, 1.35rem);
        border: 2px solid color-mix(in srgb, var(--outline) 58%, transparent);
        border-radius: var(--radius-2xl);
        background: color-mix(in srgb, #ffffff 90%, var(--lavender) 10%);
        box-shadow: 0 10px 0 color-mix(in srgb, var(--outline) 14%, transparent);
        gap: 0.8rem;
      }

      main[data-page-id='inventory-journal'] .journal-page-title-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(220px, 0.8fr);
        gap: 0.85rem;
        align-items: center;
      }

      main[data-page-id='inventory-journal'] .journal-page-header .page-title {
        display: block;
        position: static;
        width: auto;
        height: auto;
        margin: 0;
        overflow: visible;
        clip: auto;
        white-space: normal;
        font-size: clamp(1.45rem, 4.8vw, 2.2rem);
        line-height: 1.08;
        text-transform: uppercase;
        letter-spacing: 0.055em;
      }

      main[data-page-id='inventory-journal'] .journal-page-title-row__actions {
        width: 100%;
        justify-content: stretch;
      }

      main[data-page-id='inventory-journal'] .journal-fullscreen-button--spotlight {
        width: 100%;
        min-height: 58px;
        justify-content: center;
        padding: 0.72rem 0.9rem;
        border: 3px solid var(--outline);
        border-radius: var(--radius-lg);
        background: color-mix(in srgb, var(--rose) 84%, #ffffff 16%);
        color: var(--ink);
        box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 34%, transparent);
        font-weight: 700;
      }

      main[data-page-id='inventory-journal'] .journal-fullscreen-button--spotlight:hover,
      main[data-page-id='inventory-journal'] .journal-fullscreen-button--spotlight:focus-visible {
        transform: translateY(-2px);
        border-color: var(--outline);
        background: color-mix(in srgb, var(--rose) 90%, #ffffff 10%);
        box-shadow: 0 11px 0 color-mix(in srgb, var(--outline) 38%, transparent);
      }

      main[data-page-id='inventory-journal'] .journal-fullscreen-button__icon {
        width: 2rem;
        height: 2rem;
        min-width: 2rem;
        min-height: 2rem;
        border-width: 2px;
        box-shadow: none;
      }

      main[data-page-id='inventory-journal'] .journal-fullscreen-button__title {
        font-size: 0.95rem;
        letter-spacing: 0.035em;
        text-transform: uppercase;
      }

      main[data-page-id='inventory-journal'] .journal-page-description {
        max-width: 62ch;
        font-size: 0.94rem;
        line-height: 1.45;
      }

      main[data-page-id='inventory-journal'] .journal-page {
        display: grid;
        gap: clamp(0.9rem, 2.5vw, 1.25rem);
      }

      main[data-page-id='inventory-journal'] .journal-overview-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas:
          'summary'
          'backup';
        gap: clamp(0.75rem, 2vw, 1rem);
      }

      main[data-page-id='inventory-journal'] .journal-summary-section {
        grid-area: summary;
        border: 2px solid color-mix(in srgb, var(--outline) 45%, transparent);
        background: color-mix(in srgb, #ffffff 86%, var(--sky) 14%);
      }

      main[data-page-id='inventory-journal'] .journal-actions {
        grid-area: backup;
        border: 2px solid color-mix(in srgb, var(--outline) 34%, transparent);
        background: color-mix(in srgb, #ffffff 92%, var(--lavender) 8%);
      }

      main[data-page-id='inventory-journal'] .journal-panel {
        padding: clamp(0.9rem, 2.6vw, 1.15rem);
        border-radius: var(--radius-xl);
        box-shadow: 0 6px 0 color-mix(in srgb, var(--outline) 10%, transparent);
      }

      main[data-page-id='inventory-journal'] .journal-actions__header,
      main[data-page-id='inventory-journal'] .journal-history-section__header {
        gap: 0.25rem;
      }

      main[data-page-id='inventory-journal'] .journal-actions__hint,
      main[data-page-id='inventory-journal'] .journal-form-section__hint,
      main[data-page-id='inventory-journal'] .journal-list__hint {
        line-height: 1.4;
      }

      main[data-page-id='inventory-journal'] .journal-actions__buttons {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
      }

      main[data-page-id='inventory-journal'] .journal-actions__buttons .inventory-button {
        width: 100%;
        min-height: 46px;
        padding: 0.55rem 0.7rem;
        border-width: 2px;
        box-shadow: 0 4px 0 color-mix(in srgb, var(--outline) 15%, transparent);
        font-size: 0.82rem;
      }

      main[data-page-id='inventory-journal'] .journal-summary__header {
        align-items: center;
        gap: 0.65rem;
      }

      main[data-page-id='inventory-journal'] .journal-summary__header .inventory-button {
        min-height: 44px;
        padding: 0.45rem 0.7rem;
        border-width: 2px;
        font-size: 0.78rem;
      }

      main[data-page-id='inventory-journal'] .journal-history-section {
        border: 2px solid color-mix(in srgb, var(--outline) 52%, transparent);
        background: #ffffff;
        box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 12%, transparent);
      }

      main[data-page-id='inventory-journal'] .journal-filters {
        gap: 0.65rem;
      }

      main[data-page-id='inventory-journal'] .journal-inline-fallback {
        margin-top: 0.1rem;
        border-width: 2px;
        border-color: color-mix(in srgb, var(--outline) 30%, transparent);
        background: color-mix(in srgb, #ffffff 92%, var(--lavender) 8%);
        box-shadow: none;
      }

      main[data-page-id='inventory-journal'] .journal-inline-fallback__summary {
        padding: 0.72rem 0.85rem;
        font-size: 0.82rem;
      }

      @media (min-width: 760px) {
        main[data-page-id='inventory-journal'] .journal-overview-grid {
          grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.6fr);
          grid-template-areas: 'summary backup';
          align-items: start;
        }
      }

      @media (max-width: 640px) {
        main[data-page-id='inventory-journal'] .journal-page-header {
          padding: 0.95rem;
          gap: 0.7rem;
        }

        main[data-page-id='inventory-journal'] .journal-page-title-row {
          grid-template-columns: minmax(0, 1fr);
          gap: 0.65rem;
        }

        main[data-page-id='inventory-journal'] .journal-fullscreen-button--spotlight {
          min-height: 62px;
        }

        main[data-page-id='inventory-journal'] .journal-page-description {
          font-size: 0.9rem;
        }

        main[data-page-id='inventory-journal'] .journal-panel {
          padding: 0.85rem;
        }

        main[data-page-id='inventory-journal'] .journal-actions__buttons {
          grid-template-columns: minmax(0, 1fr);
        }
      }`;

  const styles = "  const journalPageStyles = `    <style>\n" + css + "\n    </style>`;\n";
  const anchor = '  const needsJson = JSON.stringify(needsDataset);\n  const main = `';
  if (!segment.includes(anchor)) {
    throw new Error('Journal styles insertion anchor not found.');
  }
  segment = segment.replace(
    anchor,
    '  const needsJson = JSON.stringify(needsDataset);\n' + styles + '\n  const main = `'
  );

  const replacements = [
    ['<h1 class="page-title visually-hidden">Journal</h1>', '<h1 class="page-title">Journal</h1>'],
    ['<span class="journal-fullscreen-button__title">Open full screen journal</span>', '<span class="journal-fullscreen-button__title">Open journal</span>'],
    [
      `          Log feelings, needs, and notes from any check-in. Entries are stored locally so you can review patterns privately or\n          export them when you're ready.`,
      `          Log feelings, needs, and notes from any check-in. Review patterns over time, or export a backup when you want one.`
    ],
    ['<h2 id="journal-actions-heading" class="section-title">Save your progress</h2>', '<h2 id="journal-actions-heading" class="section-title">Backup &amp; restore</h2>'],
    [
      `                Export or import a JSON dump of this site's localStorage (inventory, journal, and customizer settings).`,
      `                Export or import a backup of your journal, inventory, and customizer settings.`
    ],
    ['<h2 id="journal-summary-heading" class="section-title">Trends at a glance</h2>', '<h2 id="journal-summary-heading" class="section-title">Patterns at a glance</h2>'],
    ['<span class="journal-inline-fallback__summary-text">Full screen journal unavailable? Use the legacy inline form.</span>', '<span class="journal-inline-fallback__summary-text">Need the legacy inline journal form?</span>'],
  ];

  for (const [from, to] of replacements) {
    if (!segment.includes(from)) {
      throw new Error(`Journal markup anchor not found: ${from.slice(0, 80)}`);
    }
    segment = segment.replace(from, to);
  }

  const headAnchor = `    mainAttributes: 'data-page-id="inventory-journal"',\n    scripts: [`;
  if (!segment.includes(headAnchor)) {
    throw new Error('Journal headExtras anchor not found.');
  }
  segment = segment.replace(
    headAnchor,
    `    mainAttributes: 'data-page-id="inventory-journal"',\n    headExtras: journalPageStyles,\n    scripts: [`
  );

  source = source.slice(0, functionStart) + segment + source.slice(functionEnd);
  writeFileSync(generatorPath, source);
}

execFileSync('node', ['scripts/build-pages.mjs', '--scope=inventory'], { stdio: 'inherit' });

const generated = readFileSync('inventory/journal/index.html', 'utf8');
const headEnd = generated.indexOf('</head>');
const markerIndex = generated.indexOf(marker);

if (markerIndex < 0 || headEnd < 0 || markerIndex > headEnd) {
  throw new Error('Journal UX styles are not present in the generated <head>.');
}

const requiredMarkers = [
  'data-page-id="inventory-journal"',
  'data-support-journal-open',
  'aria-controls="global-support-journal-layer"',
  'id="journal-export"',
  'id="journal-import-trigger"',
  'data-journal-summary-toggle',
  'data-journal-history',
  'data-journal-inline-fallback',
  'assets/js/journal/store.js',
  'assets/js/journal/module.js',
  'scripts/inventory.js',
];

for (const required of requiredMarkers) {
  if (!generated.includes(required)) {
    throw new Error(`Generated Journal is missing required marker: ${required}`);
  }
}

if (!generated.includes('<h1 class="page-title">Journal</h1>')) {
  throw new Error('Generated Journal does not expose its page title.');
}

if (!generated.includes('Backup &amp; restore') || !generated.includes('Patterns at a glance')) {
  throw new Error('Generated Journal did not receive the intended hierarchy copy.');
}

console.log('Journal UX v1 integrated into generator and generated output.');
