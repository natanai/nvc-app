// scripts/bluesky-oauth.js

// Bluesky OAuth in the browser, using the official client SDK.
import { BrowserOAuthClient } from "https://esm.sh/@atproto/oauth-client-browser@0.3.36";

const CLIENT_METADATA_URL = "https://allneeds.app/oauth-client-metadata.json";
export const BACKEND_BASE_URL = "https://backend.allneeds.app/api";
const BACKEND_AUTH_BASE_URL = BACKEND_BASE_URL.replace(/\/api\/?$/, "");

let oauthClient = null;
/**
 * A very small normalized view of the current session:
 * { did, handle, raw }
 */
let oauthSession = null;
let backendSessionDid = null;
let backendSessionToken = null;

/**
 * Initialize the Bluesky OAuth client and try to restore
 * an existing session in this browser.
 */
export async function initBlueskyOAuth() {
  if (oauthClient) {
    return oauthSession;
  }

  try {
    oauthClient = await BrowserOAuthClient.load({
      clientId: CLIENT_METADATA_URL,
      handleResolver: "https://bsky.social",
      plcDirectoryUrl: "https://plc.directory",
    });

    // NOTE: the correct API is `init()`, not `getSession()`.
    const result = await oauthClient.init();

    if (result && result.session) {
      oauthSession = normalizeSession(result.session);
      console.log("Bluesky OAuth: restored session", oauthSession);
      try {
        await ensureBackendSession(oauthSession);
      } catch (err) {
        console.warn("Bluesky OAuth: could not start backend session", err);
      }
    } else {
      oauthSession = null;
      console.log("Bluesky OAuth: no existing session");
    }
  } catch (err) {
    console.error("Error initializing Bluesky OAuth", err);
    oauthClient = null;
    oauthSession = null;
  }

  return oauthSession;
}

/**
 * Return the currently cached session (if any).
 */
export function getCurrentBlueskySession() {
  return oauthSession;
}

function normalizeSession(session) {
  const did = session.sub || session.did;
  const handle =
    session.handle ||
    session.preferred_username ||
    null;
  const tokenData = extractTokenData(session);

  return { did, handle, tokenData, raw: session };
}

function extractTokenData(session) {
  if (!session || typeof session !== "object") {
    return null;
  }

  const accessToken =
    session.accessToken ||
    session.access_token ||
    session.accessJwt ||
    session.access_jwt ||
    session.token?.accessToken ||
    session.token?.access_token ||
    session.tokenSet?.access_token ||
    null;

  const refreshToken =
    session.refreshToken ||
    session.refresh_token ||
    session.token?.refreshToken ||
    session.token?.refresh_token ||
    session.tokenSet?.refresh_token ||
    null;

  const expiresAt =
    session.expiresAt ||
    session.expires_at ||
    session.token?.expiresAt ||
    session.token?.expires_at ||
    session.tokenSet?.expires_at ||
    null;

  if (!accessToken && !refreshToken && !expiresAt) {
    return null;
  }

  return { accessToken, refreshToken, expiresAt };
}

async function createBackendSession(did) {
  const tokenData = oauthSession?.tokenData || null;
  const res = await fetch(`${BACKEND_AUTH_BASE_URL}/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      did,
      accessToken: tokenData?.accessToken || null,
      refreshToken: tokenData?.refreshToken || null,
      tokenExpiresAt: tokenData?.expiresAt || null,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.status !== "ok") {
    throw new Error("Could not start backend session");
  }

  backendSessionDid = did;
  backendSessionToken = tokenData?.accessToken || null;
}

export async function ensureBackendSession(session) {
  const did = session?.did || session?.sub || null;
  if (!did) return;
  const tokenData = session?.tokenData || null;
  if (backendSessionDid === did && backendSessionToken === (tokenData?.accessToken || null)) {
    return;
  }

  await createBackendSession(did);
}

export async function logoutBackendSession() {
  backendSessionDid = null;
  backendSessionToken = null;
  await fetch(`${BACKEND_AUTH_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

/**
 * Clean up & validate the handle the user typed.
 * - trims whitespace
 * - removes a leading '@' if present
 * - enforces Bluesky's allowed characters
 */
function normalizeHandle(input) {
  const trimmed = (input || "").trim();

  // Allow people to paste "@name" but strip the '@'.
  const noAt = trimmed.replace(/^@/, "");

  if (!noAt) {
    throw new Error(
      "Please enter your Bluesky handle (for example: nathanael.ink)."
    );
  }

  // Bluesky handles: letters, digits, dashes, and periods only.
  if (!/^[A-Za-z0-9.-]+$/.test(noAt)) {
    throw new Error(
      "Bluesky handle can only contain letters, numbers, dashes, and periods (no @)."
    );
  }

  return noAt;
}

/**
 * Start the OAuth sign-in flow for the given handle.
 * This will redirect the browser to Bluesky's OAuth page.
 */
export async function signInWithBluesky(handleInput) {
  // Make sure the client is initialized.
  if (!oauthClient) {
    await initBlueskyOAuth();
    if (!oauthClient) {
      throw new Error("Could not initialize Bluesky OAuth client.");
    }
  }

  const handle = normalizeHandle(handleInput);

  console.log("Bluesky OAuth: starting authorization for handle:", handle);

  // Start OAuth – this returns a URL we should navigate to.
  const authUrl = await oauthClient.authorize(handle, {
    scope: "atproto", // enough for DID + following graph
  });

  // This will leave allneeds.app and go to the Bluesky auth UI.
  window.location.href = authUrl.toString();
}

/**
 * Best-effort sign-out.
 * The library keeps the session; we ask it to re-init and, if supported,
 * call a `signOut()` method on the session object.
 */
export async function signOutFromBluesky() {
  if (oauthClient) {
    try {
      const result = await oauthClient.init();
      if (result && result.session && typeof result.session.signOut === "function") {
        await result.session.signOut();
      }
    } catch (err) {
      console.warn("Bluesky OAuth: error during sign-out", err);
    }
  }

  oauthSession = null;
  await logoutBackendSession();
  console.log("Bluesky OAuth: signed out (local state cleared)");
}
