import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const generatorPath = 'scripts/build-pages.mjs';
let source = readFileSync(generatorPath, 'utf8');

const styleStart = source.indexOf('  const magnetHubStyles = `    <style>');
const styleEndAnchor = '    </style>`;';
const styleEnd = source.indexOf(styleEndAnchor, styleStart);
if (styleStart < 0 || styleEnd < 0) {
  throw new Error('Could not locate current magnet hub style block.');
}

const newStyles = `  const magnetHubStyles = \`    <style>
      /* Magnet hub UX v3 — compact mobile resting layout */
      [data-magnet-key$='-hub-v3'] .magnet-board {
        overflow: hidden;
      }

      [data-magnet-key$='-hub-v3'] .magnet-play-toggle--hub {
        top: -1.15rem;
        right: 0.35rem;
        z-index: 4;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
      }

      @media (max-width: 640px) {
        body {
          padding-left: 0.65rem;
          padding-right: 0.65rem;
        }

        .page-wrapper {
          gap: 1rem;
        }

        .page {
          padding: 1.05rem 0.85rem 1.2rem;
          gap: 0.85rem;
        }

        .breadcrumbs {
          padding: 0.42rem 0.7rem;
        }

        [data-magnet-key$='-hub-v3'] {
          gap: 0.6rem;
        }

        [data-magnet-key$='-hub-v3'] .magnet-search {
          margin-top: 0;
          gap: 0.45rem;
        }

        [data-magnet-key$='-hub-v3'] .magnet-search__search-row {
          gap: 0.35rem;
        }

        [data-magnet-key$='-hub-v3'] .magnet-search__input {
          padding: 0.55rem 0.7rem;
        }

        [data-magnet-key$='-hub-v3'] .shuffle-button {
          width: 44px;
          min-width: 44px;
        }

        [data-magnet-key$='-hub-v3'] .magnet-board-wrapper {
          padding-top: 0.2rem;
        }

        [data-magnet-key$='-hub-v3'] .magnet-board-wrapper .magnet-play-toggle--hub {
          top: -1.25rem;
          right: 0.15rem;
        }

        [data-magnet-key$='-hub-v3'] .magnet-board {
          padding: 0.55rem 0.35rem 0.45rem;
        }

        [data-magnet-key$='-hub-v3'] .pill.magnet {
          min-height: 44px;
          padding: 0.36rem 0.58rem;
          font-size: 0.9rem;
        }
      }
    </style>\`;`;

source = source.slice(0, styleStart) + newStyles + source.slice(styleEnd + styleEndAnchor.length);
source = source.replaceAll("-hub-v2", "-hub-v3");

const oldToggle = `<label class="magnet-play-toggle magnet-play-toggle--hub" data-magnet-toggle data-state="off">
            <span class="magnet-play-toggle__label" aria-hidden="true">Motion</span>
            <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Enable magnet physics">
            <span class="magnet-play-toggle__track" aria-hidden="true">
              <span class="magnet-play-toggle__thumb"></span>
            </span>
            <span class="visually-hidden magnet-play-toggle__sr-state">Physics is off</span>
          </label>`;

const newToggle = `<label class="magnet-play-toggle magnet-play-toggle--hub" data-magnet-toggle data-state="off" title="Toggle magnet motion">
            <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Toggle magnet motion">
            <span class="magnet-play-toggle__track" aria-hidden="true">
              <span class="magnet-play-toggle__thumb"></span>
            </span>
            <span class="visually-hidden magnet-play-toggle__sr-state">Physics is off</span>
          </label>`;

if (!source.includes(oldToggle)) {
  throw new Error('Could not locate labeled V2 motion toggle.');
}
source = source.replace(oldToggle, newToggle);
writeFileSync(generatorPath, source);

execFileSync('node', ['scripts/build-pages.mjs', '--scope=needs,feelings,faux-feelings'], { stdio: 'inherit' });

const hubs = [
  ['needs', 'needs-hub-v3'],
  ['feelings', 'feelings-hub-v3'],
  ['faux-feelings', 'faux-feelings-hub-v3'],
];

for (const [directory, key] of hubs) {
  const path = `${directory}/index.html`;
  const html = readFileSync(path, 'utf8');
  if (!html.includes('Magnet hub UX v3 — compact mobile resting layout')) throw new Error(`${path}: missing V3 styles.`);
  if (!html.includes(`data-magnet-key="${key}"`)) throw new Error(`${path}: missing V3 storage key.`);
  if (html.includes('magnet-play-toggle__label')) throw new Error(`${path}: visible Motion label still present.`);
  if (!html.includes('aria-label="Toggle magnet motion"')) throw new Error(`${path}: unlabeled control lacks accessible name.`);
  if (!html.includes('min-height: 44px')) throw new Error(`${path}: mobile magnet tap-height safeguard missing.`);
  if (!html.includes('data-magnet-search-input') || !html.includes('data-magnet-shuffle') || !html.includes('data-magnet-board')) {
    throw new Error(`${path}: existing magnet controls were lost.`);
  }
}

console.log('Magnet hub UX V3 integrated and verified.');
