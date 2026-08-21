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

test('restore protection loads only for restore intent or post-restore reconciliation', async () => {
  const loader = await read('scripts/inventory-bluesky.js');
  const restore = await read('scripts/profile-restore-rehydration.js');

  assert.ok(loader.includes("const RESTORE_PENDING_STORAGE_KEY = 'allneeds:restore-palette-rehydrate';"));
  assert.ok(loader.includes("'#inventory-import-trigger'"));
  assert.ok(loader.includes("'[data-backend-load-button]'"));
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

  // Shared Strategies is itself a network-backed route, so it intentionally
  // keeps its direct OAuth dependency rather than using the generic menu loader.
  assert.ok(feed.includes("from './bluesky-oauth.js?v=2024-07-11'"));
});
