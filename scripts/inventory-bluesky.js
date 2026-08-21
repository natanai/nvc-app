import './profile-restore-rehydration.js';

const LOGIN_INTENT_STORAGE_KEY = 'allneeds:bsky-login-intent';
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
    runtimePromise = import('./inventory-bluesky-runtime.js?v=2026-08-21-lazy')
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

function scheduleIdleRestore() {
  const start = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => loadBlueskyRuntime().catch(() => {}), { timeout: 1800 });
    } else {
      window.setTimeout(() => loadBlueskyRuntime().catch(() => {}), 900);
    }
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

// OAuth returns must be consumed immediately. Ordinary page views defer the
// remote AT Protocol SDK until after the page has loaded (or until the user
// approaches Account & data), so a third-party module is no longer part of the
// first-render network path.
if (isOAuthReturn() || hasLoginIntent()) {
  loadBlueskyRuntime().catch(() => {});
} else {
  scheduleIdleRestore();
}
