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
  const loggedOut = document.querySelector('#bluesky-auth-logged-out');
  const loggedIn = document.querySelector('#bluesky-auth-logged-in');
  const statusText = document.querySelector('#bluesky-auth-status-text');

  if (session) {
    if (loggedOut) loggedOut.hidden = true;
    if (loggedIn) loggedIn.hidden = false;
    if (statusText) {
      statusText.textContent = describeSession(session);
    }
  } else {
    if (loggedOut) loggedOut.hidden = false;
    if (loggedIn) loggedIn.hidden = true;
    if (statusText) {
      statusText.textContent = '';
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
  document
    .querySelector('#bluesky-signin-button')
    ?.addEventListener('click', onBlueskySignInClick);

  document
    .querySelector('#bluesky-signout-button')
    ?.addEventListener('click', onBlueskySignOutClick);

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
