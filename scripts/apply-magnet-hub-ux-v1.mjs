import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const generatorPath = 'scripts/build-pages.mjs';
let source = readFileSync(generatorPath, 'utf8');
const marker = 'Magnet hub UX v1 — stable resting layout';

if (!source.includes(marker)) {
  const startAnchor = "  const listSectionA11yAttr = suppressDirectoryHeading ? `aria-label=\"${escapedTitle} magnets\"` : `aria-labelledby=\"${type}-list\"`;";
  const start = source.indexOf(startAnchor);
  if (start < 0) throw new Error('Could not locate category hub template start.');

  const endAnchor = '  writePage(`${type}/index.html`, html);';
  const end = source.indexOf(endAnchor, start);
  if (end < 0) throw new Error('Could not locate category hub template end.');

  let segment = source.slice(start, end + endAnchor.length);

  const css = String.raw`      /* Magnet hub UX v1 — stable resting layout */
      [data-magnet-key$='-hub-v2'] .magnet-board-wrapper {
        padding-top: 2.9rem;
      }

      [data-magnet-key$='-hub-v2'] .magnet-play-toggle--hub {
        top: 0.35rem;
        right: 0.35rem;
        z-index: 4;
        gap: 0.42rem;
        justify-content: flex-end;
        min-height: 38px;
        padding: 0.28rem 0.48rem 0.28rem 0.62rem;
        border: 2px solid color-mix(in srgb, var(--outline) 72%, transparent);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, #ffffff 88%, var(--lavender) 12%);
        box-shadow: 0 4px 0 color-mix(in srgb, var(--outline) 18%, transparent);
      }

      [data-magnet-key$='-hub-v2'] .magnet-play-toggle__label {
        font-family: var(--font-display);
        font-size: 0.7rem;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--ink-soft);
        user-select: none;
      }

      [data-magnet-key$='-hub-v2'] .magnet-play-toggle--hub:has(.magnet-play-toggle__input:checked) {
        background: color-mix(in srgb, #ffffff 72%, var(--mint) 28%);
        box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 22%, transparent);
      }

      [data-magnet-key$='-hub-v2'] .magnet-board {
        overflow: hidden;
      }

      @media (max-width: 640px) {
        [data-magnet-key$='-hub-v2'] .magnet-board-wrapper {
          padding-top: 2.7rem;
        }

        [data-magnet-key$='-hub-v2'] .magnet-board-wrapper .magnet-play-toggle--hub {
          top: 0.25rem;
          right: 0.2rem;
        }

        [data-magnet-key$='-hub-v2'] .magnet-board {
          padding-left: 0.85rem;
          padding-right: 0.85rem;
        }
      }`;

  const styles = "\n\n  const magnetHubStyles = `    <style>\n" + css + "\n    </style>`;\n";
  segment = segment.replace(startAnchor, startAnchor + styles);

  const rootAnchor = '<section ${listSectionA11yAttr} class="pill-section magnet-section" data-magnet-root>';
  if (!segment.includes(rootAnchor)) throw new Error('Could not locate category magnet root.');
  segment = segment.replace(
    rootAnchor,
    '<section ${listSectionA11yAttr} class="pill-section magnet-section" data-magnet-root data-magnet-key="${type}-hub-v2">',
  );

  const toggleAnchor = `<label class="magnet-play-toggle" data-magnet-toggle data-state="on">
            <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Disable magnet physics" checked>
            <span class="magnet-play-toggle__track" aria-hidden="true">
              <span class="magnet-play-toggle__thumb"></span>
            </span>
            <span class="visually-hidden magnet-play-toggle__sr-state">Physics is on</span>
          </label>`;

  if (!segment.includes(toggleAnchor)) throw new Error('Could not locate category magnet motion toggle.');
  segment = segment.replace(
    toggleAnchor,
    `<label class="magnet-play-toggle magnet-play-toggle--hub" data-magnet-toggle data-state="off">
            <span class="magnet-play-toggle__label" aria-hidden="true">Motion</span>
            <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Enable magnet physics">
            <span class="magnet-play-toggle__track" aria-hidden="true">
              <span class="magnet-play-toggle__thumb"></span>
            </span>
            <span class="visually-hidden magnet-play-toggle__sr-state">Physics is off</span>
          </label>`,
  );

  const pageAnchor = `    main,
    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],`;
  if (!segment.includes(pageAnchor)) throw new Error('Could not locate category htmlPage options.');
  segment = segment.replace(
    pageAnchor,
    `    main,
    headExtras: magnetHubStyles,
    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],`,
  );

  source = source.slice(0, start) + segment + source.slice(end + endAnchor.length);
  writeFileSync(generatorPath, source);
}

execFileSync('node', ['scripts/build-pages.mjs', '--scope=needs,feelings,faux-feelings'], { stdio: 'inherit' });

const hubs = [
  ['needs', 'needs-hub-v2'],
  ['feelings', 'feelings-hub-v2'],
  ['faux-feelings', 'faux-feelings-hub-v2'],
];

for (const [directory, key] of hubs) {
  const path = `${directory}/index.html`;
  const html = readFileSync(path, 'utf8');
  const headEnd = html.indexOf('</head>');
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0 || markerIndex > headEnd) throw new Error(`${path}: hub styles are not in <head>.`);
  if (!html.includes(`data-magnet-key="${key}"`)) throw new Error(`${path}: missing versioned hub layout key.`);
  if (!html.includes('magnet-play-toggle magnet-play-toggle--hub')) throw new Error(`${path}: missing labeled motion toggle.`);
  if (!html.includes('data-state="off"')) throw new Error(`${path}: motion does not default off.`);
  if (!html.includes('<span class="magnet-play-toggle__label" aria-hidden="true">Motion</span>')) throw new Error(`${path}: missing visible Motion label.`);
  if (!html.includes('data-magnet-search-input')) throw new Error(`${path}: search input missing.`);
  if (!html.includes('data-magnet-shuffle')) throw new Error(`${path}: shuffle control missing.`);
  if (!html.includes('data-magnet-board')) throw new Error(`${path}: magnet board missing.`);
  if (!html.includes('scripts/magnets.js')) throw new Error(`${path}: magnet runtime missing.`);
}

console.log('Magnet hub UX v1 integrated and verified.');
