import {
  initBlueskyOAuth,
  getCurrentBlueskySession,
  signInWithBluesky,
  signOutFromBluesky,
  ensureBackendSession,
} from './bluesky-oauth.js?v=2024-07-11';
import './profile-restore-rehydration.js';

const LOGIN_INTENT_STORAGE_KEY = 'allneeds:bsky-login-intent';
let initialized = false;

function consumeLoginIntent() {
  try {
    if (!window.sessionStorage) return false;
    const hasIntent = window.sessionStorage.getItem(LOGIN_INTENT_STORAGE_KEY) === '1';
    if (hasIntent) window.sessionStorage.removeItem(LOGIN_INTENT_STORAGE_KEY);
    return hasIntent;
  } catch (error) {
    return false;
  }
}

function setLoginIntent() {
  try {
    if (window.sessionStorage) window.sessionStorage.setItem(LOGIN_INTENT_STORAGE_KEY, '1');
  } catch (error) {
    // Ignore storage errors. Sign-in can still proceed.
  }
}

function setGlobalBlueskySession(session, { reason = '' } = {}) {
  const normalizedDid = session?.did || session?.sub || null;
  const normalizedHandle = session?.preferred_username || session?.handle || session?.username || null;

  window.allneedsSession = normalizedDid
    ? { did: normalizedDid, handle: normalizedHandle }
    : null;

  window.dispatchEvent(new CustomEvent('allneeds:bsky-login-changed', {
    detail: {
      ...(window.allneedsSession || {}),
      reason,
    },
  }));
}

function describeSession(session) {
  const handle = session?.preferred_username || session?.handle || session?.username || '';
  return handle ? `Signed in as @${String(handle).replace(/^@/, '')}` : 'Signed in with Bluesky';
}

function updateBlueskyAuthUi(session) {
  const handleField = document.querySelector('[data-bluesky-handle-field]');
  const statusText = document.querySelector('#bluesky-auth-status-text');
  const authButton = document.querySelector('#bluesky-auth-button');
  const authButtonText = authButton?.querySelector('.inventory-button__text');

  if (session) {
    if (handleField) handleField.hidden = true;
    if (statusText) {
      statusText.textContent = describeSession(session);
      statusText.classList.remove('inventory-auth-panel__status-text--error');
    }
    if (authButton) {
      authButton.classList.add('inventory-button--ghost');
      if (authButtonText) authButtonText.textContent = 'Sign out';
      authButton.setAttribute('aria-label', 'Sign out of Bluesky');
    }
  } else {
    if (handleField) handleField.hidden = false;
    if (statusText) {
      statusText.textContent = '';
      statusText.classList.remove('inventory-auth-panel__status-text--error');
    }
    if (authButton) {
      authButton.classList.remove('inventory-button--ghost');
      if (authButtonText) authButtonText.textContent = 'Sign in';
      authButton.setAttribute('aria-label', 'Sign in with Bluesky');
    }
  }
}

function setStatusText(message, { isError = false } = {}) {
  const statusText = document.querySelector('#bluesky-auth-status-text');
  if (!statusText) return;
  statusText.textContent = message || '';
  statusText.classList.toggle('inventory-auth-panel__status-text--error', Boolean(isError));
}

async function onBlueskySignInClick() {
  const input = document.querySelector('#bluesky-handle-input');
  const handle = input?.value?.trim();
  if (!handle) {
    setStatusText('Enter your Bluesky handle first.', { isError: true });
    return;
  }

  try {
    setStatusText('Opening Bluesky sign-in…');
    setLoginIntent();
    await signInWithBluesky(handle);
  } catch (err) {
    console.error('Error during Bluesky OAuth sign-in', err);
    setStatusText(err?.message || 'Unable to start Bluesky sign-in. Please check your handle.', { isError: true });
  }
}

async function onBlueskySignOutClick() {
  try {
    await signOutFromBluesky();
  } catch (err) {
    console.error('Error during Bluesky OAuth sign-out', err);
  }
  setGlobalBlueskySession(null, { reason: 'signout' });
  updateBlueskyAuthUi(null);
}

async function initBlueskyUi() {
  if (initialized) return;
  initialized = true;

  const authButton = document.querySelector('#bluesky-auth-button');
  if (authButton) {
    authButton.addEventListener('click', () => {
      if (window.allneedsSession) onBlueskySignOutClick();
      else onBlueskySignInClick();
    });
  }

  const handleInput = document.querySelector('#bluesky-handle-input');
  if (handleInput) {
    handleInput.addEventListener('input', () => setStatusText(''));
    handleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !window.allneedsSession) {
        event.preventDefault();
        onBlueskySignInClick();
      }
    });
  }

  let session = null;
  const loginIntent = consumeLoginIntent();
  try {
    session = await initBlueskyOAuth();
  } catch (err) {
    console.error('Error initializing Bluesky OAuth', err);
  }

  if (!session) session = getCurrentBlueskySession();

  if (session) {
    try {
      await ensureBackendSession(session);
    } catch (err) {
      console.error('Could not start backend session', err);
    }
  }

  const reason = session ? (loginIntent ? 'signin' : 'restore') : 'signout';
  setGlobalBlueskySession(session || null, { reason });
  updateBlueskyAuthUi(session);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlueskyUi, { once: true });
} else {
  initBlueskyUi();
}
