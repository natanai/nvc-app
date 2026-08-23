import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('profile and backup restore reload from the imported customizer snapshot', async () => {
  const helper = await fs.readFile(path.join(root, 'scripts/profile-restore-rehydration.js'), 'utf8');
  const bluesky = await fs.readFile(path.join(root, 'scripts/inventory-bluesky.js'), 'utf8');

  assert.ok(
    bluesky.includes("import('./profile-restore-rehydration.js?v=2026-08-21-lazy')")
      && bluesky.includes("target.closest('#inventory-import-trigger, [data-backend-load-button]')")
      && bluesky.includes('const loads = [loadRestoreRuntime()];')
      && bluesky.includes('await Promise.all(loads);'),
    'restore actions must await the restore guard before profile load or backup restore is replayed',
  );
  assert.ok(
    helper.includes("const RESTORE_FUNCTION_NAMES = ['loadSnapshotFromBackend', 'handleImportInventory'];"),
    'both profile load and local backup restore must use the same deterministic rehydration path',
  );
  assert.ok(
    helper.includes("const MIRRORED_CUSTOMIZER_KEYS = ['nvcApp.theme', 'nvcApp.navSettings'];"),
    'theme and navigation settings must have their sessionStorage mirrors replaced with the restored localStorage values',
  );
  assert.ok(
    helper.includes("document.querySelectorAll('[data-magnet-root]')"),
    'active magnet boards must be paused before localStorage is replaced',
  );
  assert.ok(
    helper.includes('api.reseed = suspended;') && helper.includes('api.reseedNavLayouts = suspended;'),
    'nav layout reseeding must be suspended while restored magnet positions are being applied',
  );
  assert.ok(
    helper.includes('storageStateChanged(restoreBaseline, restoredState)'),
    'reload must depend on an actual storage replacement rather than merely opening the restore flow',
  );
  assert.ok(
    helper.includes('window.sessionStorage.setItem(key, value)'),
    'restored customizer values must replace stale sessionStorage copies',
  );
  assert.ok(
    helper.includes('window.location.reload();'),
    'successful full-data restore must restart the page so magnet positions and play state hydrate from restored storage',
  );
  assert.ok(
    helper.includes("if (!reloadCommitted && typeof runtimeCleanup === 'function') runtimeCleanup();"),
    'failed or canceled restores must resume the runtime rather than leaving magnet physics paused',
  );
});

test('restore guard freezes runtime only after the user confirms replacement', async () => {
  const helper = await fs.readFile(path.join(root, 'scripts/profile-restore-rehydration.js'), 'utf8');

  const acceptedIndex = helper.indexOf('restoreAccepted = Boolean(accepted);');
  const prepareIndex = helper.indexOf('runtimeCleanup = prepareRuntimeForRestore();', acceptedIndex);
  const baselineIndex = helper.indexOf('restoreBaseline = captureLocalStorageState();', prepareIndex);

  assert.ok(acceptedIndex >= 0, 'restore confirmation result should be tracked');
  assert.ok(prepareIndex > acceptedIndex, 'magnet persistence should not pause before confirmation');
  assert.ok(baselineIndex > prepareIndex, 'comparison baseline must be captured after pausing can persist current magnet state');
});

test('restored palette is reconciled on the current page and after reload', async () => {
  const helper = await fs.readFile(path.join(root, 'scripts/profile-restore-rehydration.js'), 'utf8');

  assert.ok(
    helper.includes("const RESTORED_PALETTE_PENDING_KEY = 'allneeds:restore-palette-rehydrate';"),
    'a one-time session marker should carry palette reconciliation across the restore reload',
  );
  assert.ok(
    helper.includes("plum: '--plum'")
      && helper.includes("lavender: '--lavender'")
      && helper.includes("inkSoft: '--ink-soft'")
      && helper.includes("outline: '--outline'"),
    'all persisted palette colors should map back to their root CSS variables',
  );
  assert.ok(
    helper.includes('root.style.setProperty(cssVariable, color);'),
    'restored palette colors must be written directly to the current page DOM',
  );
  assert.ok(
    helper.includes('applyStoredPaletteToCurrentPage();\n        markPaletteRehydrateForNextLoad();'),
    'palette should reconcile immediately before the restore-triggered reload',
  );
  assert.ok(
    helper.includes('rehydratePendingPaletteAfterReload();\n  installProfileRestoreRehydration();'),
    'the reloaded page should reconcile the palette before normal restore wiring continues',
  );
  assert.ok(
    helper.includes("window.sessionStorage.removeItem(RESTORED_PALETTE_PENDING_KEY);"),
    'the palette reconciliation marker should be consumed after a successful application',
  );
});


test('canonical snapshot replacement synchronizes Customizer mirrors before live rehydration', async () => {
  const inventory = await fs.readFile(path.join(root, 'scripts/inventory.js'), 'utf8');

  const helperIndex = inventory.indexOf('function syncRestoredCustomizerMirrors(snapshot)');
  const callIndex = inventory.indexOf('syncRestoredCustomizerMirrors(normalized.localStorage);');
  const refreshIndex = inventory.indexOf('const counts = await refreshStateFromLocalStorageSnapshot(normalized.localStorage);');

  assert.ok(helperIndex >= 0, 'canonical snapshot import must own Customizer mirror synchronization');
  assert.ok(inventory.includes('[THEME_STORAGE_KEY, NAV_SETTINGS_STORAGE_KEY].forEach((key) => {'));
  assert.ok(inventory.includes('window.sessionStorage.setItem(key, value)'));
  assert.ok(inventory.includes('window.sessionStorage.removeItem(key)'));
  assert.ok(callIndex >= 0 && refreshIndex > callIndex, 'session mirrors must match the imported snapshot before current-page theme/nav rehydration');
});

test('automatic post-sign-in profile restore installs the full restore guard first', async () => {
  const inventory = await fs.readFile(path.join(root, 'scripts/inventory.js'), 'utf8');

  const listenerIndex = inventory.indexOf("window.addEventListener('allneeds:bsky-login-changed'");
  const guardImportIndex = inventory.indexOf("import('./profile-restore-rehydration.js?v=2026-08-21-lazy')", listenerIndex);
  const wrappedCheckIndex = inventory.indexOf('guardedLoad.__allneedsRestoreRehydrationWrapped !== true', guardImportIndex);
  const loadIndex = inventory.indexOf('await guardedLoad();', wrappedCheckIndex);

  assert.ok(listenerIndex >= 0 && guardImportIndex > listenerIndex, 'sign-in restoration should prepare restore protection inside the login path');
  assert.ok(wrappedCheckIndex > guardImportIndex, 'automatic restore must verify that the backend loader is actually wrapped');
  assert.ok(loadIndex > wrappedCheckIndex, 'the saved profile may load only after restore protection is installed');
});
