// inventory/bluesky-oauth.js

// Bluesky OAuth in the browser, using the official client SDK.
import { BrowserOAuthClient } from "https://esm.sh/@atproto/oauth-client-browser@0.3.16";

const CLIENT_METADATA_URL = "https://allneeds.app/oauth-client-metadata.json";

let oauthClient = null;
/**
 * A very small normalized view of the current session:
 * { did, handle, raw }
 */
let oauthSession = null;

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

  return { did, handle, raw: session };
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
  if (!oauthClient) return;

  try {
    const result = await oauthClient.init();
    if (result && result.session && typeof result.session.signOut === "function") {
      await result.session.signOut();
    }
  } catch (err) {
    console.warn("Bluesky OAuth: error during sign-out", err);
  }

  oauthSession = null;
  console.log("Bluesky OAuth: signed out (local state cleared)");
}
