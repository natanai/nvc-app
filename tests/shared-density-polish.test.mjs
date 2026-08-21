import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('shared density styles are part of the static CSS graph', async () => {
  const shell = await fs.readFile(path.join(root, 'styles/inventory-core-shell.css'), 'utf8');
  const contrast = await fs.readFile(path.join(root, 'assets/js/ui/contrast.js'), 'utf8');

  assert.ok(shell.startsWith("@import url('shared-density.css');"));
  assert.ok(!contrast.includes('loadSharedPolishAssets'));
  assert.ok(!contrast.includes('shared-ui-polish.js'));
  assert.ok(!contrast.includes('styles/shared-density.css'));
});

test('deterministic Inventory and Body Cues styles are parser-discovered', async () => {
  const buildPages = await fs.readFile(path.join(root, 'scripts/build-pages.mjs'), 'utf8');
  const inventoryHtml = await fs.readFile(path.join(root, 'inventory/index.html'), 'utf8');
  const bodyCuesHtml = await fs.readFile(path.join(root, 'feelings/body-cues/index.html'), 'utf8');
  const contrast = await fs.readFile(path.join(root, 'assets/js/ui/contrast.js'), 'utf8');

  const inventoryLink = '<link rel="stylesheet" href="../styles/inventory-mobile.css" media="(max-width: 640px)" />';
  assert.ok(buildPages.includes(inventoryLink));
  assert.ok(inventoryHtml.includes(inventoryLink));
  assert.ok(inventoryHtml.indexOf(inventoryLink) > inventoryHtml.indexOf('<link rel="stylesheet" href="../styles.css" fetchpriority="high" />'));

  assert.ok(buildPages.includes('<link rel="stylesheet" href="../../styles/body-cues.css" />'));
  assert.ok(buildPages.includes('<link rel="stylesheet" href="../../styles/body-cues-mobile.css" media="(max-width: 640px)" />'));
  assert.ok(bodyCuesHtml.includes('<link rel="stylesheet" href="../../styles/body-cues.css" />'));
  assert.ok(bodyCuesHtml.includes('<link rel="stylesheet" href="../../styles/body-cues-mobile.css" media="(max-width: 640px)" />'));

  assert.ok(!contrast.includes('loadInventoryMobileStylesBeforePaint'));
  assert.ok(!contrast.includes('loadBodyCuesStylesBeforePaint'));
  assert.ok(!contrast.includes('document.write'));
  assert.ok(!contrast.includes("document.createElement('link')"));
});

test('there is no browser-side DOM normalizer for static UI copy', async () => {
  await assert.rejects(
    fs.access(path.join(root, 'scripts/shared-ui-polish.js')),
    { code: 'ENOENT' },
  );

  const feed = await fs.readFile(path.join(root, 'scripts/strategy-feed.js'), 'utf8');
  assert.ok(!feed.includes('prepareFeedUi'));
  assert.ok(!feed.includes("document.querySelectorAll('#main .inventory-header .page-description')"));
});

test('build pipeline writes final user-facing static markup before deployment', async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const finalizer = await fs.readFile(path.join(root, 'scripts/finalize-static-assets.mjs'), 'utf8');

  assert.equal(
    packageJson.scripts['build:pages'],
    'node scripts/build-pages.mjs && node scripts/finalize-static-assets.mjs',
  );
  assert.ok(finalizer.includes('Backup, restore, and account sync are in Menu → Account &amp; data.'));
  assert.ok(finalizer.includes(".replaceAll('💾 Save to device', 'Save to device')"));
  assert.ok(finalizer.includes(".replaceAll('☁️ Save to profile', 'Save to profile')"));
  assert.ok(finalizer.includes('Tag what’s present now. Feeling optional—notes are enough.'));
  assert.ok(finalizer.includes("relative(rootDir, file).replaceAll('\\\\', '/') === 'feed/index.html'"));
});

test('checked-in static artifacts already contain the final UI', async () => {
  const feedHtml = await fs.readFile(path.join(root, 'feed/index.html'), 'utf8');
  const needHtml = await fs.readFile(path.join(root, 'needs/acceptance/index.html'), 'utf8');
  const inventoryHtml = await fs.readFile(path.join(root, 'inventory/index.html'), 'utf8');
  const journalHtml = await fs.readFile(path.join(root, 'inventory/journal/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/shared-density.css'), 'utf8');

  assert.ok(feedHtml.includes('<h1 class="page-title">Shared strategies</h1>'));
  assert.ok(!feedHtml.includes('Pull strategies'));
  assert.ok(!feedHtml.includes('data-feed-follows-check'));
  assert.ok(!feedHtml.includes('Browse strategies that other allneeds users have chosen to share.'));
  assert.ok(inventoryHtml.includes('Backup, restore, and account sync are in Menu → Account &amp; data.'));
  assert.ok(!needHtml.includes('💾 Save to device'));
  assert.ok(needHtml.includes('>Save to device</button>'));
  assert.ok(journalHtml.includes('<h2 id="journal-form-heading" class="section-title">New entry</h2>'));
  assert.ok(journalHtml.includes('Tag what’s present now. Feeling optional—notes are enough.'));
  assert.ok(!css.includes('.feed-controls__icon-button'));
  assert.ok(!css.includes('.feed-controls__button'));
});

test('mobile journal chrome remains compact without runtime mutation', async () => {
  const css = await fs.readFile(path.join(root, 'styles/shared-density.css'), 'utf8');

  assert.ok(css.includes('body .support-journal__header'));
  assert.ok(css.includes('max(0.48rem, env(safe-area-inset-top))'));
  assert.ok(css.includes('body .support-journal__content .journal-form'));
  assert.ok(css.includes('min-height: clamp(15rem, 52dvh, 28rem)'));
});

test('shared strategies behavior is feed-first without repairing static chrome in JS', async () => {
  const feed = await fs.readFile(path.join(root, 'scripts/strategy-feed.js'), 'utf8');
  const finalizer = await fs.readFile(path.join(root, 'scripts/finalize-static-assets.mjs'), 'utf8');

  assert.ok(feed.includes("addButton.textContent = 'Save to inventory'"));
  assert.ok(feed.includes('await fetchAndRenderFeed();'));
  assert.ok(feed.includes("state.scopeSelect?.addEventListener('change'"));
  assert.ok(feed.includes("state.sortSelect?.addEventListener('change', fetchAndRenderFeed)"));
  assert.ok(!feed.includes('[data-feed-follows-check]'));
  assert.ok(!feed.includes('[data-feed-fetch]'));
  assert.ok(finalizer.includes('<h1 class="page-title">Shared strategies</h1>'));
  assert.ok(finalizer.includes('data-feed-follows-check'));
  assert.ok(finalizer.includes('data-feed-fetch'));
});

test('desktop Inventory keeps the Needs header left-aligned and uses one segmented filter control', async () => {
  const css = await fs.readFile(path.join(root, 'styles/shared-density.css'), 'utf8');
  const inventoryHtml = await fs.readFile(path.join(root, 'inventory/index.html'), 'utf8');

  assert.ok(css.includes('@media (min-width: 641px)'));
  assert.ok(css.includes('body .inventory-page .inventory-view-panel__header'));
  assert.ok(css.includes('flex-direction: row;'));
  assert.ok(css.includes('body .inventory-page .inventory-summary__filters'));
  assert.ok(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'));
  assert.ok(css.includes("body .inventory-page .inventory-summary__filter-button[aria-pressed='true']"));

  assert.ok(inventoryHtml.includes('class="inventory-summary__filters" role="group" aria-label="Filter needs"'));
  assert.ok(inventoryHtml.includes('data-summary-filter="all"'));
  assert.ok(inventoryHtml.includes('data-summary-filter="missing"'));
  assert.ok(inventoryHtml.includes('data-summary-filter="ready"'));
});

test('mobile Inventory foregrounds the inventory with one phone-layout owner', async () => {
  const css = await fs.readFile(path.join(root, 'styles/inventory-mobile.css'), 'utf8');
  const shell = await fs.readFile(path.join(root, 'styles/inventory-core-shell.css'), 'utf8');
  const buildPages = await fs.readFile(path.join(root, 'scripts/build-pages.mjs'), 'utf8');

  assert.ok(css.includes('authoritative presentation layer for /inventory/ at <= 640px'));
  assert.ok(css.includes('body:has(#main.inventory-page) .breadcrumbs'));
  assert.ok(css.includes('body:has(#main.inventory-page) .page-wrapper'));
  assert.ok(css.includes('gap: 0.45rem;'));
  assert.ok(css.includes('width: calc(100% + 2rem);'));
  assert.ok(css.includes('margin-inline: -1rem;'));
  assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'));
  assert.ok(css.includes('border-left: 0;'));
  assert.ok(css.includes('border-right: 0;'));
  assert.ok(css.includes('grid-template-areas:'));
  assert.ok(css.includes("'title'"));
  assert.ok(css.includes("'action';"));
  assert.ok(!css.includes('!important'));
  assert.ok(!css.includes('body .inventory-page.inventory-page'));

  assert.ok(css.includes('.inventory-page .inventory-view-switch'));
  assert.ok(css.includes('border-bottom: 1px solid'));
  assert.ok(css.includes(".inventory-page .inventory-view-switch__button[aria-selected='true']::after"));

  assert.ok(css.includes('.inventory-page .inventory-overview__hint'));
  assert.ok(css.includes('.inventory-page .inventory-summary__filters'));
  assert.ok(css.includes('height: 36px;'));

  assert.ok(css.includes('.inventory-page .inventory-summary__item--missing .inventory-summary__status'));
  assert.ok(css.includes('.inventory-page .inventory-summary__item--missing .inventory-summary__count'));
  assert.ok(css.includes('grid-template-columns: minmax(0, 1fr) auto;'));
  assert.ok(css.includes('.inventory-page .inventory-summary__item--ready .inventory-summary__count'));

  assert.ok(shell.includes("Inventory's <=640px page presentation is\n   owned by inventory-mobile.css"));
  assert.ok(!shell.includes('body .inventory-page.inventory-page'));
  assert.ok(!buildPages.includes('/* Inventory is the app surface on phones, not a card inside the page. */'));
});
