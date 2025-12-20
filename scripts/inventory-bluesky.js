import {
  initBlueskyOAuth,
  getCurrentBlueskySession,
  signInWithBluesky,
  signOutFromBluesky,
  ensureBackendSession,
} from './bluesky-oauth.js?v=2024-07-11';

function setGlobalBlueskySession(session) {
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
    detail: window.allneedsSession,
  });
  window.dispatchEvent(evt);
}

function describeSession(session) {
  const did = session?.did || session?.sub || '';
  const handle = session?.preferred_username || session?.handle || session?.username || '';

  if (handle && did) {
    return `Signed in as @${handle} (${did})`;
  }
  if (handle) {
    return `Signed in as @${handle}`;
  }
  if (did) {
    return `Signed in (${did})`;
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
    }
    if (authButton) {
      authButton.classList.remove('inventory-button--ghost');
      if (authButtonText) authButtonText.textContent = 'Sign in';
      authButton.setAttribute('aria-label', 'Sign in with Bluesky');
    }
  }
}

async function onBlueskySignInClick() {
  const input = document.querySelector('#bluesky-handle-input');
  const handle = input?.value?.trim();
  if (!handle) return;

  try {
    await signInWithBluesky(handle);
  } catch (err) {
    console.error('Error during Bluesky OAuth sign-in', err);
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

  let session = null;
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

  setGlobalBlueskySession(session || null);
  updateBlueskyAuthUi(session);
});
