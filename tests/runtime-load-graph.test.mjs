import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

test('ordinary app pages keep optional account runtimes out of the first-render graph', async () => {
  const loader = await read('scripts/inventory-bluesky.js');
  const runtime = await read('scripts/inventory-bluesky-runtime.js');
  const oauth = await read('scripts/bluesky-oauth.js');
  const needHtml = await read('needs/acceptance/index.html');

  assert.ok(loader.includes("import('./inventory-bluesky-runtime.js?v=2026-08-21-session-hint')"));
  assert.ok(loader.includes("import('./profile-restore-rehydration.js?v=2026-08-21-lazy')"));
  assert.ok(!loader.includes("import './profile-restore-rehydration.js';"));
  assert.ok(!loader.includes("from './bluesky-oauth.js"));
  assert.ok(!loader.includes('esm.sh'));

  assert.ok(runtime.includes("from './bluesky-oauth.js?v=2024-07-11'"));
  assert.ok(oauth.includes('https://esm.sh/@atproto/oauth-client-browser@0.3.36'));
  assert.ok(needHtml.includes('../../scripts/inventory-bluesky.js'));
});

test('known signed-out browsers do no idle OAuth work on ordinary navigation', async () => {
  const loader = await read('scripts/inventory-bluesky.js');
  const runtime = await read('scripts/inventory-bluesky-runtime.js');

  assert.ok(loader.includes("const SESSION_HINT_STORAGE_KEY = 'allneeds:bsky-session-hint';"));
  assert.ok(loader.includes("const SESSION_HINT_NONE = 'none';"));
  assert.ok(loader.includes('else if (hint !== SESSION_HINT_NONE) schedulePostLoadRestore();'));
  assert.ok(runtime.includes('window.localStorage.setItem('));
  assert.ok(runtime.includes('SESSION_HINT_STORAGE_KEY'));
  assert.ok(runtime.includes('hasSession ? SESSION_HINT_ACTIVE : SESSION_HINT_NONE'));
});

test('known signed-out Shared Strategies renders the public feed without loading OAuth', async () => {
  const feed = await read('scripts/strategy-feed.js');

  assert.ok(feed.includes("const SESSION_HINT_STORAGE_KEY = 'allneeds:bsky-session-hint';"));
  assert.ok(feed.includes("const SESSION_HINT_NONE = 'none';"));
  assert.ok(feed.includes("const BACKEND_BASE_URL = 'https://backend.allneeds.app/api';"));
  assert.ok(feed.includes('if (!shouldLoadFeedOAuth()) {\n    return null;\n  }'));
  assert.ok(feed.includes("import('./bluesky-oauth.js?v=2024-07-11')"));
  assert.ok(!feed.includes("from './bluesky-oauth.js?v=2024-07-11'"));
  assert.ok(feed.includes('readSessionHint() !== SESSION_HINT_NONE || hasLoginIntent() || isOAuthReturn()'));
  assert.ok(feed.includes('applySession(session, { publish: true });'));
  assert.ok(feed.includes("window.dispatchEvent(new CustomEvent('allneeds:bsky-login-changed'"));
});

test('Shared Strategies owns route session restore instead of duplicating it in the generic Account loader', async () => {
  const loader = await read('scripts/inventory-bluesky.js');
  const feed = await read('scripts/strategy-feed.js');

  assert.ok(loader.includes("function isStrategyFeedRoute() {\n  return Boolean(document.querySelector('[data-feed-list]'));\n}"));
  assert.ok(loader.includes('if (!isStrategyFeedRoute()) {'));
  assert.ok(feed.includes('const session = await loadFeedSession();'));
  assert.ok(feed.includes('applySession(session, { publish: true });'));
  assert.ok(loader.includes("document.addEventListener('pointerover', warmOptionalRuntimes"), 'Account intent warming must remain available on Feed');
  assert.ok(loader.includes('if (hasPendingRestoreRehydrate())'), 'post-restore local-state reconciliation must remain global');
});

test('restore protection loads only for restore intent or post-restore reconciliation', async () => {
  const loader = await read('scripts/inventory-bluesky.js');
  const restore = await read('scripts/profile-restore-rehydration.js');

  assert.ok(loader.includes("const RESTORE_PENDING_STORAGE_KEY = 'allneeds:restore-palette-rehydrate';"));
  assert.ok(loader.includes("const RESTORE_TRIGGER_SELECTOR = [\n  '[data-backend-load-button]',\n  '#inventory-import-trigger',\n].join(',');"));
  assert.ok(!loader.match(/RESTORE_TRIGGER_SELECTOR\s*=\s*\[[\s\S]*?data-menu-drill/));
  assert.ok(loader.includes('if (hasPendingRestoreRehydrate())'));
  assert.ok(loader.includes('const loads = [loadRestoreRuntime()];'));
  assert.ok(restore.includes('pauseActiveMagnetBoards()'));
  assert.ok(restore.includes('markPaletteRehydrateForNextLoad()'));
});

test('OAuth returns and explicit account intent still load the real runtime', async () => {
  const loader = await read('scripts/inventory-bluesky.js');
  const feed = await read('scripts/strategy-feed.js');

  assert.ok(loader.includes('if (isOAuthReturn() || hasLoginIntent())'));
  assert.ok(loader.includes("'[data-menu-drill=\"account-data\"]'"));
  assert.ok(loader.includes("'#bluesky-auth-button'"));
  assert.ok(loader.includes("'.strategy-card__save--profile'"));
  assert.ok(loader.includes("document.addEventListener('pointerover', warmOptionalRuntimes"));
  assert.ok(loader.includes("document.addEventListener('focusin', warmOptionalRuntimes"));

  assert.ok(feed.includes('hasLoginIntent() || isOAuthReturn()'));
  assert.ok(feed.includes("import('./bluesky-oauth.js?v=2024-07-11')"));
});

test('shared Inventory controller initializes safely before or after DOMContentLoaded', async () => {
  const inventory = await read('scripts/inventory.js');

  assert.ok(inventory.includes('let inventoryRuntimeInitialized = false;'));
  assert.ok(inventory.includes('function initializeInventoryRuntime() {'));
  assert.ok(inventory.includes('if (inventoryRuntimeInitialized) {\n    return;\n  }'));
  assert.ok(inventory.includes("if (document.readyState === 'loading') {"));
  assert.ok(inventory.includes("document.addEventListener('DOMContentLoaded', initializeInventoryRuntime, { once: true });"));
  assert.ok(inventory.includes('} else {\n  initializeInventoryRuntime();\n}'));
  assert.ok(!inventory.includes("document.addEventListener('DOMContentLoaded', () => {"));
});

test('Shared Strategies keeps the shared Inventory controller off first load and restores it on owned interaction intent', async () => {
  const feed = await read('scripts/strategy-feed.js');
  const feedHtml = await read('feed/index.html');

  assert.ok(!feed.includes("import './inventory.js"), 'Feed must not execute Inventory as an ES module');
  assert.ok(feed.includes("const INVENTORY_RUNTIME_URL = new URL('./inventory.js?v=2026-08-19-feed-ui', import.meta.url).href;"));
  assert.ok(feed.includes("'[data-palette-toggle]'"), 'Customizer intent must warm the shared controller');
  assert.ok(feed.includes("'[data-support-journal-open]'"), 'Journal intent must warm the shared controller');
  assert.ok(feed.includes("'[data-menu-drill=\"account-data\"]'"), 'Account & data intent must warm the shared controller');
  assert.ok(feed.includes("'[data-menu-action=\"share-with-nat\"]'"), 'personal sharing must warm the shared controller');
  assert.ok(feed.includes("document.addEventListener('pointerover', warmInventoryRuntime"));
  assert.ok(feed.includes("document.addEventListener('focusin', warmInventoryRuntime"));
  assert.ok(feed.includes('event.stopImmediatePropagation();'), 'direct activation should wait for its owner instead of falling through');
  assert.ok(feed.includes('window.requestAnimationFrame(() => replayTrigger.click());'), 'held interactions should replay after the controller is ready');
  assert.ok(feed.includes('function finishAfterInventoryInitialization(resolve)'), 'Feed must distinguish script load from controller initialization');
  assert.ok(feed.includes("if (document.readyState === 'loading')"), 'early Feed activation must wait for DOMContentLoaded');
  assert.ok(feed.includes("document.addEventListener('DOMContentLoaded', finish, { once: true });"), 'Feed should release held interactions only after the controller initializer runs');
  assert.ok(feed.includes('const finish = () => finishAfterInventoryInitialization(resolve);'));
  assert.ok(feed.includes("script.dataset.feedInventoryRuntime = 'true';"));
  assert.ok(feed.includes('installInventoryRuntimeIntentLoader();\ninit();'));
  assert.ok(!feed.includes('const inventoryRuntimeReady = ensureInventoryClassicRuntime();'));
  assert.ok(!feed.includes('await inventoryRuntimeReady;'));
  assert.ok(!feedHtml.includes('<script src="../scripts/inventory.js" defer></script>'), 'Feed HTML must not restore the controller to the parser graph');

  assert.ok(feedHtml.includes('data-magnet-id="nav-faux-feelings"'), 'optional nav magnets must exist statically before the controller loads');
  assert.ok(feedHtml.includes('data-magnet-id="nav-body-cues"'), 'Body Cues nav state must remain prepaint-restorable');
  assert.ok(feedHtml.includes('data-magnet-id="nav-journal-dashboard"'), 'Journal History nav state must remain prepaint-restorable');
});
