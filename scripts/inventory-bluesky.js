const LOGIN_INTENT_STORAGE_KEY = 'allneeds:bsky-login-intent';
const SESSION_HINT_STORAGE_KEY = 'allneeds:bsky-session-hint';
const RESTORE_PENDING_STORAGE_KEY = 'allneeds:restore-palette-rehydrate';
const SESSION_HINT_ACTIVE = 'active';
const SESSION_HINT_NONE = 'none';
const ACCOUNT_TRIGGER_SELECTOR = [
  '[data-menu-drill="account-data"]',
  '#bluesky-auth-button',
  '[data-backend-save-button]',
  '[data-backend-load-button]',
  '[data-save-to-profile-button]',
  '.strategy-card__save--profile',
].join(',');
const RESTORE_TRIGGER_SELECTOR = [
  '[data-backend-load-button]',
  '#inventory-import-trigger',
].join(',');

let runtimePromise = null;
let runtimeReady = false;
let restorePromise = null;
let restoreReady = false;

function loadBlueskyRuntime() {
  if (!runtimePromise) {
    runtimePromise = import('./inventory-bluesky-runtime.js?v=2026-08-21-session-hint')
      .then((module) => {
        runtimeReady = true;
        return module;
      })
      .catch((error) => {
        runtimePromise = null;
        console.error('Unable to load Bluesky account runtime', error);
        throw error;
      });
  }
  return runtimePromise;
}

function loadRestoreRuntime() {
  if (!restorePromise) {
    restorePromise = import('./profile-restore-rehydration.js?v=2026-08-21-lazy')
      .then((module) => {
        restoreReady = true;
        return module;
      })
      .catch((error) => {
        restorePromise = null;
        console.error('Unable to load profile restore protection', error);
        throw error;
      });
  }
  return restorePromise;
}

function hasLoginIntent() {
  try {
    return window.sessionStorage?.getItem(LOGIN_INTENT_STORAGE_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function hasPendingRestoreRehydrate() {
  try {
    return window.sessionStorage?.getItem(RESTORE_PENDING_STORAGE_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function readSessionHint() {
  try {
    const hint = window.localStorage?.getItem(SESSION_HINT_STORAGE_KEY);
    return hint === SESSION_HINT_ACTIVE || hint === SESSION_HINT_NONE ? hint : '';
  } catch (error) {
    return '';
  }
}

function isOAuthReturn() {
  try {
    const params = new URL(window.location.href).searchParams;
    return params.has('state') && (params.has('code') || params.has('error') || params.has('iss'));
  } catch (error) {
    return false;
  }
}

function closestTrigger(target, selector) {
  return target instanceof Element ? target.closest(selector) : null;
}

function warmOptionalRuntimes(event) {
  if (closestTrigger(event.target, ACCOUNT_TRIGGER_SELECTOR)) {
    loadBlueskyRuntime().catch(() => {});
  }
  if (closestTrigger(event.target, RESTORE_TRIGGER_SELECTOR)) {
    loadRestoreRuntime().catch(() => {});
  }
}

// Pointer/focus intent begins fetching before the eventual click without
// changing the interaction itself. Account & data can open normally while its
// optional network runtime becomes ready; restore protection is warmed only
// when the person approaches an action that can replace local data.
document.addEventListener('pointerover', warmOptionalRuntimes, { capture: true, passive: true });
document.addEventListener('focusin', warmOptionalRuntimes, { capture: true });

// Direct activation can happen without pointer/focus warming (automation,
// assistive tooling, synthetic clicks). Hold only the affected action until the
// runtime that owns it is installed, then replay the same click once.
document.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const authButton = target.closest('#bluesky-auth-button');
  if (authButton instanceof HTMLElement && !runtimeReady) {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      await loadBlueskyRuntime();
      window.requestAnimationFrame(() => authButton.click());
    } catch (error) {
      const status = document.querySelector('#bluesky-auth-status-text');
      if (status) status.textContent = 'Unable to load Bluesky sign-in right now.';
    }
    return;
  }

  const restoreTrigger = target.closest('#inventory-import-trigger, [data-backend-load-button]');
  const needsBluesky = restoreTrigger?.matches('[data-backend-load-button]') === true;
  if (
    restoreTrigger instanceof HTMLElement &&
    (!restoreReady || (needsBluesky && !runtimeReady))
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const loads = [loadRestoreRuntime()];
      if (needsBluesky) loads.push(loadBlueskyRuntime());
      await Promise.all(loads);
      window.requestAnimationFrame(() => restoreTrigger.click());
    } catch (error) {
      const status = document.querySelector('[data-backend-sync-status]');
      if (status) status.textContent = 'Unable to prepare restore right now.';
    }
  }
}, true);

function schedulePostLoadRestore({ knownActive = false } = {}) {
  const start = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(
        () => loadBlueskyRuntime().catch(() => {}),
        { timeout: knownActive ? 600 : 1800 },
      );
    } else {
      window.setTimeout(() => loadBlueskyRuntime().catch(() => {}), knownActive ? 0 : 900);
    }
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

// Restore reconciliation is only needed on the one reload following a restore;
// ordinary pages do not parse the restore/magnet suspension machinery.
if (hasPendingRestoreRehydrate()) {
  loadRestoreRuntime().catch(() => {});
}

// OAuth returns must be consumed immediately. A browser with a previously
// confirmed session restores it after first paint. Once a browser has confirmed
// there is no Bluesky session, ordinary page navigation does no OAuth work at
// all until the user approaches Account & data. Unknown/legacy browsers perform
// one idle discovery, and the runtime records the result for later navigations.
if (isOAuthReturn() || hasLoginIntent()) {
  loadBlueskyRuntime().catch(() => {});
} else {
  const hint = readSessionHint();
  if (hint === SESSION_HINT_ACTIVE) schedulePostLoadRestore({ knownActive: true });
  else if (hint !== SESSION_HINT_NONE) schedulePostLoadRestore();
}
