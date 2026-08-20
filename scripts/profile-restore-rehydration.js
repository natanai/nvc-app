const RESTORE_CONFIRM_FRAGMENT = 'Replace all saved localStorage data for this app';
const MIRRORED_CUSTOMIZER_KEYS = ['nvcApp.theme', 'nvcApp.navSettings'];
const RESTORE_FUNCTION_NAMES = ['loadSnapshotFromBackend', 'handleImportInventory'];
const WRAPPED_FLAG = '__allneedsRestoreRehydrationWrapped';
const THEME_STORAGE_KEY = 'nvcApp.theme';
const RESTORED_PALETTE_PENDING_KEY = 'allneeds:restore-palette-rehydrate';
const PALETTE_CSS_VARIABLES = {
  plum: '--plum',
  lavender: '--lavender',
  ink: '--ink',
  inkSoft: '--ink-soft',
  rose: '--rose',
  mint: '--mint',
  gold: '--gold',
  sky: '--sky',
  outline: '--outline',
};

function captureLocalStorageState() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const snapshot = {};
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (typeof key !== 'string') continue;
      snapshot[key] = window.localStorage.getItem(key);
    }
    return snapshot;
  } catch (error) {
    console.warn('Unable to inspect localStorage before profile restore', error);
    return null;
  }
}

function storageStateChanged(before, after) {
  if (!before || !after) return false;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if ((before[key] ?? null) !== (after[key] ?? null)) return true;
  }
  return false;
}

function syncCustomizerMirrorsFromLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage || !window.sessionStorage) return;
  MIRRORED_CUSTOMIZER_KEYS.forEach((key) => {
    try {
      const value = window.localStorage.getItem(key);
      if (value == null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Unable to synchronize restored customizer key ${key}`, error);
    }
  });
}

function sanitizePaletteColor(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(prefixed) ? prefixed.toUpperCase() : '';
}

function readStoredThemeRaw() {
  if (typeof window === 'undefined') return '';
  try {
    const local = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (typeof local === 'string' && local.trim()) return local;
  } catch (error) {
    console.warn('Unable to read restored theme from localStorage', error);
  }
  try {
    const session = window.sessionStorage?.getItem(THEME_STORAGE_KEY);
    if (typeof session === 'string' && session.trim()) return session;
  } catch (error) {
    console.warn('Unable to read restored theme from sessionStorage', error);
  }
  return '';
}

function applyStoredPaletteToCurrentPage() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  const raw = readStoredThemeRaw();
  if (!raw) return false;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to parse restored color theme', error);
    return false;
  }

  const values = parsed?.values && typeof parsed.values === 'object'
    ? parsed.values
    : (parsed?.colors && typeof parsed.colors === 'object' ? parsed.colors : null);
  if (!values) return false;

  const root = document.documentElement;
  if (!root?.style) return false;

  let applied = false;
  Object.entries(PALETTE_CSS_VARIABLES).forEach(([key, cssVariable]) => {
    const color = sanitizePaletteColor(values[key]);
    if (!color) return;
    root.style.setProperty(cssVariable, color);
    applied = true;
  });

  if (!applied) return false;

  const rose = sanitizePaletteColor(values.rose);
  if (rose) root.style.setProperty('--btn-bg', rose);

  const outline = sanitizePaletteColor(values.outline);
  if (outline) root.style.setProperty('--shadow', `color-mix(in srgb, ${outline} 55%, transparent)`);

  root.style.setProperty('--btn-fg', '#111111');
  root.style.setProperty('--chip-fg', '#111111');
  root.removeAttribute('data-theme-contrast');
  root.style.removeProperty('--chip-bg');

  try {
    if (window.NVCContrast && typeof window.NVCContrast.autoContrast === 'function') {
      window.NVCContrast.autoContrast('--btn-bg', '--btn-fg');
    }
  } catch (error) {
    console.warn('Unable to auto-adjust restored palette contrast', error);
  }

  return true;
}

function markPaletteRehydrateForNextLoad() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(RESTORED_PALETTE_PENDING_KEY, '1');
    }
  } catch (error) {
    console.warn('Unable to mark restored palette for reload reconciliation', error);
  }
}

function rehydratePendingPaletteAfterReload() {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  let pending = false;
  try {
    pending = window.sessionStorage.getItem(RESTORED_PALETTE_PENDING_KEY) === '1';
  } catch (error) {
    return false;
  }
  if (!pending) return false;

  const applied = applyStoredPaletteToCurrentPage();
  if (applied) {
    try {
      window.sessionStorage.removeItem(RESTORED_PALETTE_PENDING_KEY);
    } catch (error) {
      // A stale one-time marker is harmless; the palette reconciliation is idempotent.
    }
  }
  return applied;
}

function pauseActiveMagnetBoards() {
  if (typeof document === 'undefined') return () => {};
  const paused = [];

  document.querySelectorAll('[data-magnet-root]').forEach((root) => {
    const toggle = root.querySelector('[data-magnet-toggle]');
    const input = toggle?.querySelector('.magnet-play-toggle__input');

    if (input && input.checked) {
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      paused.push({ input });
      return;
    }

    if (!input && toggle && root.getAttribute('data-magnet-active') === '1') {
      toggle.click();
      paused.push({ toggle, root });
    }
  });

  return () => {
    paused.forEach((entry) => {
      if (entry.input && entry.input.isConnected && !entry.input.checked) {
        entry.input.checked = true;
        entry.input.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (entry.toggle && entry.toggle.isConnected && entry.root?.getAttribute('data-magnet-active') !== '1') {
        entry.toggle.click();
      }
    });
  };
}

function suspendNavReseeding() {
  if (typeof window === 'undefined' || !window.NVCNavLayout) return () => {};
  const api = window.NVCNavLayout;
  const originalReseed = api.reseed;
  const originalReseedNavLayouts = api.reseedNavLayouts;
  const suspended = () => true;

  api.reseed = suspended;
  api.reseedNavLayouts = suspended;

  return () => {
    if (api.reseed === suspended) api.reseed = originalReseed;
    if (api.reseedNavLayouts === suspended) api.reseedNavLayouts = originalReseedNavLayouts;
  };
}

function prepareRuntimeForRestore() {
  const resumeBoards = pauseActiveMagnetBoards();
  const resumeReseeding = suspendNavReseeding();

  return () => {
    resumeReseeding();
    resumeBoards();
  };
}

function isFullStorageRestorePrompt(message) {
  return typeof message === 'string' && message.includes(RESTORE_CONFIRM_FRAGMENT);
}

function requestReloadFromRestoredStorage() {
  try {
    window.location.reload();
    return true;
  } catch (error) {
    console.warn('Unable to reload after restoring allneeds data', error);
    return false;
  }
}

function wrapRestoreFunction(name) {
  if (typeof window === 'undefined') return false;
  const original = window[name];
  if (typeof original !== 'function' || original[WRAPPED_FLAG]) return false;

  const wrapped = async function restoreWithFreshRuntime(...args) {
    let restoreAccepted = false;
    let restoreBaseline = null;
    let runtimeCleanup = null;
    let reloadCommitted = false;
    const originalConfirm = window.confirm;

    const trackedConfirm = function trackedRestoreConfirm(message) {
      const accepted = originalConfirm.call(window, message);
      if (isFullStorageRestorePrompt(message)) {
        restoreAccepted = Boolean(accepted);
        if (restoreAccepted && !runtimeCleanup) {
          runtimeCleanup = prepareRuntimeForRestore();
          // Pausing live magnet boards can persist their current state. Capture
          // the baseline after that deliberate write so only the actual import
          // counts as a successful storage replacement.
          restoreBaseline = captureLocalStorageState();
        }
      }
      return accepted;
    };

    try {
      if (typeof originalConfirm === 'function') window.confirm = trackedConfirm;
      const result = await original.apply(this, args);
      const restoredState = captureLocalStorageState();

      if (restoreAccepted && storageStateChanged(restoreBaseline, restoredState)) {
        // Theme/nav settings are intentionally mirrored into sessionStorage by
        // the Customizer. Replace those mirrors too so an older/newer session
        // copy cannot immediately override the profile that was just loaded.
        syncCustomizerMirrorsFromLocalStorage();

        // Reconcile palette CSS variables immediately before the reload. The
        // Customizer's pre-paint path can intentionally skip a second DOM write,
        // so mark a one-time reconciliation for the reloaded page as well.
        applyStoredPaletteToCurrentPage();
        markPaletteRehydrateForNextLoad();

        // Magnet positions and play state live inside the running magnet engine.
        // A reload lets the existing startup path hydrate them from the restored
        // localStorage before physics or resize persistence can write old state
        // back over the imported snapshot.
        reloadCommitted = requestReloadFromRestoredStorage();
      }

      return result;
    } finally {
      if (window.confirm === trackedConfirm) window.confirm = originalConfirm;
      if (!reloadCommitted && typeof runtimeCleanup === 'function') runtimeCleanup();
    }
  };

  wrapped[WRAPPED_FLAG] = true;
  wrapped.__allneedsOriginalRestore = original;
  window[name] = wrapped;
  return true;
}

export function installProfileRestoreRehydration() {
  if (typeof window === 'undefined') return 0;
  let wrappedCount = 0;
  RESTORE_FUNCTION_NAMES.forEach((name) => {
    if (wrapRestoreFunction(name)) wrappedCount += 1;
  });
  return wrappedCount;
}

if (typeof window !== 'undefined') {
  rehydratePendingPaletteAfterReload();
  installProfileRestoreRehydration();

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installProfileRestoreRehydration, { once: true });
  }

  window.setTimeout(() => {
    rehydratePendingPaletteAfterReload();
    installProfileRestoreRehydration();
  }, 0);
}
