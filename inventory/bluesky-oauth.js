import { BrowserOAuthClient } from "https://esm.sh/@atproto/oauth-client-browser@0.3.16";

// Singleton client + session managed by the browser SDK.
let oauthClient = null;
let oauthSession = null;

const CLIENT_METADATA_URL = "https://allneeds.app/oauth/client-metadata.json";

// ⚠️ This only authenticates in the browser; the backend still trusts plain DIDs/handles.
// Journals and settings are not yet bound to OAuth tokens or server-side sessions.
export async function initBlueskyOAuth() {
  if (!oauthClient) {
    oauthClient = await BrowserOAuthClient.load({
      clientId: CLIENT_METADATA_URL,
      handleResolver: "https://bsky.social",
      redirectUri: window.location.origin + "/inventory/",
      responseMode: "fragment",
    });
  }

  await oauthClient.init();

  oauthSession = await oauthClient.getSession().catch(() => null);

  return oauthSession;
}

export function getCurrentBlueskySession() {
  return oauthSession;
}

export async function signInWithBluesky(handle) {
  if (!oauthClient) {
    throw new Error("OAuth client not initialized. Call initBlueskyOAuth() first.");
  }

  const state = crypto.randomUUID();
  await oauthClient.signIn(handle, { state });
}

export async function signOutFromBluesky() {
  if (!oauthClient) return;

  await oauthClient.signOut();
  oauthSession = null;
}
