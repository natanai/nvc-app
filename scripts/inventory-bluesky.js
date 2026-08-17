import {
  initBlueskyOAuth,
  getCurrentBlueskySession,
  signInWithBluesky,
  signOutFromBluesky,
  ensureBackendSession,
} from './bluesky-oauth.js?v=2024-07-11';

function loadInventoryPageStyles() {
  if (typeof document === 'undefined' || document.querySelector('link[data-inventory-page-styles]')) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../styles/inventory.css', import.meta.url).href;
  link.dataset.inventoryPageStyles = 'true';
  document.head.appendChild(link);
}

loadInventoryPageStyles();

const LOGIN_INTENT_STORAGE_KEY = 'allneeds:bsky-login-intent';

function consumeLoginIntent() {
  try {
    if (!window.sessionStorage) {
      return false;
    }
    const hasIntent = window.sessionStorage.getItem(LOGIN_INTENT_STORAGE_KEY) === '1';
    if (hasIntent) {
      window.sessionStorage.removeItem(LOGIN_INTENT_STORAGE_KEY);
    }
    return hasIntent;
  } catch (error) {
    return false;
  }
}

function setLoginIntent() {
  try {
    if (window.sessionStorage) {
      window.sessionStorage.setItem(LOGIN_INTENT_STORAGE_KEY, '1');
    }
  } catch (error) {
    // ignore storage errors
  }
}

function setGlobalBlueskySession(session, { reason = '' } = {}) {
  const normalizedDid = session?.did || session?.sub || null;
  const normalizedHandle =
    session?.preferred_username || session?.handle || session?.username || null;

  if (normalizedDid) {
    window.allneedsSession = {
      did: normalizedDid,
      handle: normalizedHandle,
    };
  } else {
    window.allneedsSession = null;
  }

  const evt = new CustomEvent('allneeds:bsky-login-changed', {
    detail: {
      ...(window.allneedsSession || {}),
      reason,
    },
  });
  window.dispatchEvent(evt);
}

function describeSession(session) {
  const handle = session?.preferred_username || session?.handle || session?.username || '';

  if (handle) {
    return `Signed in as @${handle}`;
  }
  return 'Signed in with Bluesky';
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
  if (!handle) return;

  try {
    setStatusText('Opening Bluesky sign-in…');
    setLoginIntent();
    await signInWithBluesky(handle);
  } catch (err) {
    console.error('Error during Bluesky OAuth sign-in', err);
    const message = err?.message || 'Unable to start Bluesky sign-in. Please check your handle.';
    setStatusText(message, { isError: true });
  }
}

async function onBlueskySignOutClick() {
  try {
    await signOutFromBluesky();
  } catch (err) {
    console.error('Error during Bluesky OAuth sign-out', err);
  }
  setGlobalBlueskySession(null);
  updateBlueskyAuthUi(null);
}

document.addEventListener('DOMContentLoaded', async () => {
  const authButton = document.querySelector('#bluesky-auth-button');
  if (authButton) {
    authButton.addEventListener('click', () => {
      if (window.allneedsSession) {
        onBlueskySignOutClick();
      } else {
        onBlueskySignInClick();
      }
    });
  }
  const handleInput = document.querySelector('#bluesky-handle-input');
  if (handleInput) {
    handleInput.addEventListener('input', () => {
      setStatusText('');
    });
  }

  let session = null;
  const loginIntent = consumeLoginIntent();
  try {
    session = await initBlueskyOAuth();
  } catch (err) {
    console.error('Error initializing Bluesky OAuth', err);
  }

  if (!session) {
    session = getCurrentBlueskySession();
  }

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
});
