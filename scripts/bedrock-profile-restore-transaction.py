from pathlib import Path

inventory_path = Path('scripts/inventory.js')
inventory = inventory_path.read_text(encoding='utf-8')

helper_anchor = """  return { success: true };
}

async function importLocalStorageSnapshot(payload) {
"""
helper_replacement = """  return { success: true };
}

function syncRestoredCustomizerMirrors(snapshot) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  [THEME_STORAGE_KEY, NAV_SETTINGS_STORAGE_KEY].forEach((key) => {
    try {
      const value = snapshot?.[key];
      if (typeof value === 'string' && value.trim()) {
        window.sessionStorage.setItem(key, value);
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Unable to synchronize restored customizer key ${key}`, error);
    }
  });
}

async function importLocalStorageSnapshot(payload) {
"""
if inventory.count(helper_anchor) != 1:
    raise SystemExit(f'Customizer mirror helper anchor count: {inventory.count(helper_anchor)}')
inventory = inventory.replace(helper_anchor, helper_replacement)

refresh_anchor = """  if (!replaceResult.success) {
    console.warn('Unable to apply localStorage backup', replaceResult.error);
    broadcastDataMessage('Import failed. Unable to write to localStorage.', 'error');
    return;
  }

  const counts = await refreshStateFromLocalStorageSnapshot(normalized.localStorage);
"""
refresh_replacement = """  if (!replaceResult.success) {
    console.warn('Unable to apply localStorage backup', replaceResult.error);
    broadcastDataMessage('Import failed. Unable to write to localStorage.', 'error');
    return;
  }

  // A full snapshot is authoritative. Theme and nav settings are mirrored
  // into sessionStorage during normal Customizer use, so update those mirrors
  // before the running page re-reads presentation state.
  syncRestoredCustomizerMirrors(normalized.localStorage);

  const counts = await refreshStateFromLocalStorageSnapshot(normalized.localStorage);
"""
if inventory.count(refresh_anchor) != 1:
    raise SystemExit(f'Restore refresh anchor count: {inventory.count(refresh_anchor)}')
inventory = inventory.replace(refresh_anchor, refresh_replacement)

signin_anchor = """    loadSnapshotFromBackend().catch((error) => {
      console.error('Failed to auto-load backend snapshot after sign-in', error);
    });
"""
signin_replacement = """    (async () => {
      // Automatic post-sign-in restore must use the same full-storage guard as
      // an explicit profile load. This prevents running magnet persistence from
      // racing the newly restored snapshot.
      const restoreModule = await import('./profile-restore-rehydration.js?v=2026-08-21-lazy');
      if (typeof restoreModule.installProfileRestoreRehydration === 'function') {
        restoreModule.installProfileRestoreRehydration();
      }

      const guardedLoad = window.loadSnapshotFromBackend;
      if (
        typeof guardedLoad !== 'function' ||
        guardedLoad.__allneedsRestoreRehydrationWrapped !== true
      ) {
        throw new Error('Profile restore guard did not attach before automatic sign-in restore');
      }

      await guardedLoad();
    })().catch((error) => {
      console.error('Failed to auto-load backend snapshot after sign-in', error);
    });
"""
if inventory.count(signin_anchor) != 1:
    raise SystemExit(f'Post-signin restore anchor count: {inventory.count(signin_anchor)}')
inventory = inventory.replace(signin_anchor, signin_replacement)
inventory_path.write_text(inventory, encoding='utf-8')

test_path = Path('tests/profile-restore-rehydration.test.mjs')
test = test_path.read_text(encoding='utf-8')
test_name = 'canonical snapshot replacement synchronizes Customizer mirrors before live rehydration'
if test_name not in test:
    test += """

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
"""
test_path.write_text(test, encoding='utf-8')
