// scripts/bluesky-login.js
// Lightweight Bluesky "login": resolve handle -> DID via backend,
// store the result in localStorage, expose it globally, and let the
// Inventory page hook into it.

const BSKY_API_BASE = 'https://backend.allneeds.app/api';
const SESSION_STORAGE_KEY = 'allneeds.bskySession';

export function loadBlueskySession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.did || !parsed.handle) return null;
    return parsed;
  } catch (err) {
    console.warn('Failed to load Bluesky session from storage', err);
    return null;
  }
}

export function saveBlueskySession(session) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Failed to save Bluesky session', err);
  }
}

export function clearBlueskySession() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear Bluesky session', err);
  }
}

/**
 * Call the backend resolver:
 *   GET /api/resolve-handle?handle=...
 * Returns { did, handle, displayName, avatar } on success.
 */
export async function resolveHandleViaBackend(handle) {
  let h = (handle || '').trim();
  if (!h) {
    throw new Error('Please enter your Bluesky handle.');
  }

  if (h.startsWith('@')) {
    h = h.slice(1);
  }

  const url = `${BSKY_API_BASE}/api/resolve-handle?handle=${encodeURIComponent(h)}`;
  const res = await fetch(url, { method: 'GET' });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error('Could not parse server response.');
  }

  if (!res.ok || !data || data.status !== 'ok') {
    throw new Error(data && data.message ? data.message : 'Could not resolve that handle.');
  }

  return {
    did: data.did,
    handle: data.handle,
    displayName: data.displayName || null,
    avatar: data.avatar || null,
  };
}

/**
 * Expose the current session on window and fire an event so
 * other code can listen if needed.
 */
export function setGlobalBlueskySession(session) {
  window.allneedsSession = session ? { ...session } : null;

  const evt = new CustomEvent('allneeds:bsky-login-changed', {
    detail: session ? { ...session } : null,
  });
  window.dispatchEvent(evt);
}
