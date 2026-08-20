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
    bluesky.includes("import './profile-restore-rehydration.js';"),
    'Bluesky account UI must install the restore guard before save/load can be used',
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
