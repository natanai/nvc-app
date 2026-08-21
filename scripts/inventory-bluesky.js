import './profile-restore-rehydration.js';

const LOGIN_INTENT_STORAGE_KEY = 'allneeds:bsky-login-intent';
const SESSION_HINT_STORAGE_KEY = 'allneeds:bsky-session-hint';
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

let runtimePromise = null;
let runtimeReady = false;

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

function hasLoginIntent() {
  try {
    return window.sessionStorage?.getItem(LOGIN_INTENT_STORAGE_KEY) === '1';
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

function closestAccountTrigger(target) {
  return target instanceof Element ? target.closest(ACCOUNT_TRIGGER_SELECTOR) : null;
}

function warmAccountRuntime(event) {
  if (closestAccountTrigger(event.target)) loadBlueskyRuntime().catch(() => {});
}

// Pointer/focus intent begins fetching before the eventual click without
// changing the interaction itself. The Account & data drill can open normally
// while its optional network-backed controls finish becoming ready.
document.addEventListener('pointerover', warmAccountRuntime, { capture: true, passive: true });
document.addEventListener('focusin', warmAccountRuntime, { capture: true });

// A direct first click on the sign-in button can happen before a pointerover
// (keyboard activation, automation, accessibility tooling). Hold only that
// action long enough to install the real handler, then replay it once.
document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest('#bluesky-auth-button') : null;
  if (!(button instanceof HTMLElement) || runtimeReady) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    await loadBlueskyRuntime();
    window.requestAnimationFrame(() => button.click());
  } catch (error) {
    const status = document.querySelector('#bluesky-auth-status-text');
    if (status) status.textContent = 'Unable to load Bluesky sign-in right now.';
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
