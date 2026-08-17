import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const buildPagesPath = join(rootDir, 'scripts', 'build-pages.mjs');
const inventoryCssPath = join(rootDir, 'styles', 'inventory.css');

const stylesheetLink = '<link rel="stylesheet" href="../styles/inventory.css" />';
const oldHeadExtras = '    headExtras: blueskyPanelStyles,';
const newHeadExtras = '    headExtras: `${blueskyPanelStyles}\\n    <link rel="stylesheet" href="../styles/inventory.css" />`,';

let buildSource = readFileSync(buildPagesPath, 'utf8');
if (!buildSource.includes(stylesheetLink)) {
  if (!buildSource.includes(oldHeadExtras)) {
    throw new Error('Could not find the Inventory headExtras insertion point. Refusing to modify build-pages.mjs.');
  }
  buildSource = buildSource.replace(oldHeadExtras, newHeadExtras);
  writeFileSync(buildPagesPath, buildSource);
}

const inventoryCss = `/* Inventory UX first pass
 * Presentation-only overrides for the Strategy Inventory page.
 * Keep behavior, data attributes, storage, sync, journal, and feed links unchanged.
 */

.inventory-header {
  gap: clamp(0.85rem, 2vw, 1.25rem);
}

.inventory-header__layout,
.inventory-header__content {
  gap: clamp(0.6rem, 1.5vw, 0.9rem);
}

.inventory-header__title-row {
  align-items: center;
}

.inventory-header .page-description {
  max-width: 56ch;
  font-size: 0.96rem;
  line-height: 1.45;
}

/* Journal remains immediately available, but no longer competes with the
   Inventory's primary task. */
.inventory-journal-button {
  min-height: 44px;
  padding: 0.42rem 0.72rem;
  border-width: 2px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--sky) 32%, #ffffff 68%);
  box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 20%, transparent);
  font-weight: 700;
}

.inventory-journal-button:hover,
.inventory-journal-button:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 7px 0 color-mix(in srgb, var(--outline) 24%, transparent);
}

.inventory-journal-button__icon {
  width: 1.35rem;
  height: 1.35rem;
}

.inventory-journal-button__label {
  font-size: 0.82rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* One task hierarchy: add is primary; saved/community destinations are
   quieter utilities. */
.inventory-header__quick-actions {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr);
  gap: clamp(0.55rem, 1.5vw, 0.8rem);
  margin: 0.15rem 0 0;
  align-items: stretch;
  width: 100%;
}

.inventory-header__quick-actions .strategy-quick-actions__link,
.inventory-header__quick-actions .inventory-shared-button {
  width: 100%;
  min-height: 52px;
  margin: 0;
  justify-content: flex-start;
  padding: 0.65rem 0.8rem;
  border-radius: var(--radius-lg);
  line-height: 1.25;
}

.inventory-header__quick-actions > .strategy-quick-actions__link:first-child {
  border-width: 3px;
  background: color-mix(in srgb, var(--rose) 86%, #ffffff 14%);
  box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 35%, transparent);
  font-weight: 700;
}

.inventory-header__quick-actions > .strategy-quick-actions__link:first-child:hover,
.inventory-header__quick-actions > .strategy-quick-actions__link:first-child:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 11px 0 color-mix(in srgb, var(--outline) 40%, transparent);
}

.inventory-header__quick-actions .strategy-quick-actions__link--secondary {
  border-width: 2px;
  background: color-mix(in srgb, var(--sky) 46%, #ffffff 54%);
  box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 20%, transparent);
  font-size: 0.9rem;
}

.inventory-header__quick-actions .inventory-shared-button {
  border-width: 2px;
  background: color-mix(in srgb, var(--lavender) 55%, #ffffff 45%);
  box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 18%, transparent);
}

.inventory-header__quick-actions .strategy-quick-actions__link--secondary:hover,
.inventory-header__quick-actions .strategy-quick-actions__link--secondary:focus-visible,
.inventory-header__quick-actions .inventory-shared-button:hover,
.inventory-header__quick-actions .inventory-shared-button:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 7px 0 color-mix(in srgb, var(--outline) 24%, transparent);
}

.inventory-header__quick-actions .strategy-quick-actions__icon,
.inventory-header__quick-actions .inventory-shared-button__icon {
  flex: 0 0 auto;
}

.inventory-header__quick-actions .inventory-shared-button__text {
  gap: 0.05rem;
}

.inventory-header__quick-actions .inventory-shared-button__eyebrow {
  font-size: 0.62rem;
  letter-spacing: 0.08em;
}

.inventory-header__quick-actions .inventory-shared-button__label {
  font-size: 0.84rem;
  line-height: 1.2;
}

/* Sync is useful but optional. Give it the visual weight of settings rather
   than another primary destination. */
.inventory-bluesky-panel {
  margin-top: 0.45rem;
  border-width: 2px;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--lavender) 45%, #ffffff 55%);
  box-shadow: 0 6px 0 color-mix(in srgb, var(--outline) 16%, transparent);
}

.inventory-bluesky-panel__summary {
  gap: 0.7rem;
  padding: 0.72rem 0.85rem;
  align-items: center;
}

.inventory-bluesky-panel__titles {
  gap: 0.08rem;
}

.inventory-bluesky-panel__title {
  font-size: 0.86rem;
  letter-spacing: 0.05em;
}

.inventory-bluesky-panel__subtitle {
  font-size: 0.78rem;
  line-height: 1.35;
}

.inventory-bluesky-panel__chevron {
  flex: 0 0 auto;
}

@media (max-width: 760px) {
  .inventory-header__quick-actions {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .inventory-header__quick-actions > .strategy-quick-actions__link:first-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .inventory-header {
    gap: 0.8rem;
  }

  .inventory-header__title-row {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'title'
      'button';
    gap: 0.5rem;
    align-items: start;
  }

  .inventory-journal-button {
    justify-self: start;
    width: auto;
    margin: 0;
  }

  .inventory-header .page-description {
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .inventory-header__quick-actions {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    margin-top: 0.1rem;
  }

  .inventory-header__quick-actions > .strategy-quick-actions__link:first-child {
    grid-column: auto;
    min-height: 54px;
    justify-content: center;
  }

  .inventory-header__quick-actions .strategy-quick-actions__link--secondary,
  .inventory-header__quick-actions .inventory-shared-button {
    min-height: 46px;
    padding: 0.52rem 0.7rem;
    justify-content: flex-start;
  }

  .inventory-header__quick-actions .strategy-quick-actions__link--secondary {
    font-size: 0.86rem;
  }

  .inventory-header__quick-actions .inventory-shared-button__eyebrow {
    display: none;
  }

  .inventory-header__quick-actions .inventory-shared-button__label {
    font-size: 0.86rem;
  }

  .inventory-bluesky-panel {
    margin-top: 0.3rem;
  }

  .inventory-bluesky-panel__summary {
    padding: 0.65rem 0.75rem;
  }

  .inventory-bluesky-panel__title {
    font-size: 0.82rem;
  }

  .inventory-bluesky-panel__subtitle {
    font-size: 0.74rem;
  }
}
`;

mkdirSync(dirname(inventoryCssPath), { recursive: true });
writeFileSync(inventoryCssPath, inventoryCss);

console.log('Inventory UX first-pass source changes applied.');
