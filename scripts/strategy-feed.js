const BACKEND_BASE_URL = 'https://backend.allneeds.app/api';
const SESSION_HINT_STORAGE_KEY = 'allneeds:bsky-session-hint';
const LOGIN_INTENT_STORAGE_KEY = 'allneeds:bsky-login-intent';
const SESSION_HINT_ACTIVE = 'active';
const SESSION_HINT_NONE = 'none';
const FEED_ASSET_VERSION = '2026-08-19-static-feed';
const INVENTORY_RUNTIME_URL = new URL('./inventory.js?v=2026-08-19-feed-ui', import.meta.url).href;

let oauthModulePromise = null;

function ensureInventoryClassicRuntime() {
  if (typeof window.handleExportInventory === 'function') {
    return Promise.resolve();
  }

  const existing = Array.from(document.scripts).find((script) => {
    if (!script.src) return false;
    try {
      const url = new URL(script.src, window.location.href);
      return /\/scripts\/inventory\.js$/i.test(url.pathname);
    } catch (error) {
      return false;
    }
  });

  if (existing) {
    return new Promise((resolve, reject) => {
      if (typeof window.handleExportInventory === 'function') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load shared Inventory runtime')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = INVENTORY_RUNTIME_URL;
    script.async = false;
    script.dataset.feedInventoryRuntime = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Unable to load shared Inventory runtime')), { once: true });
    document.body.appendChild(script);
  });
}

function readSessionHint() {
  try {
    const hint = window.localStorage?.getItem(SESSION_HINT_STORAGE_KEY);
    return hint === SESSION_HINT_ACTIVE || hint === SESSION_HINT_NONE ? hint : '';
  } catch (error) {
    return '';
  }
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

function shouldLoadFeedOAuth() {
  return readSessionHint() !== SESSION_HINT_NONE || hasLoginIntent() || isOAuthReturn();
}

function loadFeedOAuthRuntime() {
  if (!oauthModulePromise) {
    oauthModulePromise = import('./bluesky-oauth.js?v=2024-07-11').catch((error) => {
      oauthModulePromise = null;
      throw error;
    });
  }
  return oauthModulePromise;
}

async function loadFeedSession() {
  if (!shouldLoadFeedOAuth()) {
    return null;
  }

  try {
    const oauth = await loadFeedOAuthRuntime();
    let session = await oauth.initBlueskyOAuth();
    if (!session) {
      session = oauth.getCurrentBlueskySession();
    }
    if (session) {
      await oauth.ensureBackendSession(session);
    }
    return session || null;
  } catch (error) {
    console.warn('Could not initialize Bluesky OAuth session', error);
    return null;
  }
}

const state = {
  strategies: [],
  feedList: null,
  statusEl: null,
  authHintEl: null,
  scopeSelect: null,
  sortSelect: null,
  session: null,
  requestId: 0,
};

function normalizeVisibility(value) {
  if (window?.NVCInventoryStore?.normalizeVisibility) {
    return window.NVCInventoryStore.normalizeVisibility(value);
  }
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ['public', 'followers', 'private'].includes(normalized) ? normalized : 'private';
}

function formatVisibility(value) {
  const normalized = normalizeVisibility(value);
  if (normalized === 'public') return 'Public';
  if (normalized === 'followers') return 'Followers only';
  return 'Private';
}

function formatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (error) {
    return '';
  }
}

function setStatus(message) {
  if (!state.statusEl) return;
  state.statusEl.textContent = message || '';
}

function setAuthHint(session) {
  if (!state.authHintEl) return;
  state.authHintEl.textContent = session?.did
    ? ''
    : 'Following requires Bluesky sign-in in Menu → Account & data.';
}

function setScopeAvailability(session) {
  if (!state.scopeSelect) return;
  const followsOption = state.scopeSelect.querySelector('option[value="follows"]');
  if (!session?.did) {
    if (state.scopeSelect.value === 'follows') {
      state.scopeSelect.value = 'public';
    }
    if (followsOption) followsOption.disabled = true;
  } else if (followsOption) {
    followsOption.disabled = false;
  }
}

function normalizeStrategyNeeds(strategy) {
  const needs =
    (Array.isArray(strategy?.needIds) && strategy.needIds) ||
    (Array.isArray(strategy?.supportsNeeds) && strategy.supportsNeeds) ||
    (Array.isArray(strategy?.needs) && strategy.needs) ||
    [];
  const normalized = needs
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'object') return item.title || item.slug || '';
      return '';
    })
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function renderFeed(strategies) {
  if (!state.feedList) return;
  state.feedList.textContent = '';

  if (!Array.isArray(strategies) || !strategies.length) {
    setStatus('No shared strategies found for this view yet.');
    return;
  }

  setStatus('');

  strategies.forEach((strategy) => {
    const card = document.createElement('article');
    card.className = 'strategy-card';
    card.dataset.strategyId = strategy.id;

    const header = document.createElement('header');
    header.className = 'strategy-card__header';

    const title = document.createElement('h3');
    title.className = 'strategy-card__title';
    title.textContent = strategy?.title || 'Untitled strategy';
    header.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'strategy-card__meta';
    const author = strategy?.author || {};
    const authorLabel = author.displayName || author.handle || author.did || 'Unknown author';
    const handleLabel = author.handle ? `@${author.handle}` : '';
    const timestamp = formatTimestamp(strategy?.createdAt);
    meta.textContent = timestamp
      ? `by ${authorLabel}${handleLabel ? ' (' + handleLabel + ')' : ''} · ${timestamp}`
      : `by ${authorLabel}${handleLabel ? ' (' + handleLabel + ')' : ''}`;
    header.appendChild(meta);

    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'strategy-card__body';
    const bodyText = document.createElement('p');
    bodyText.textContent = (strategy?.body || '').toString();
    body.appendChild(bodyText);
    card.appendChild(body);

    const footer = document.createElement('footer');
    footer.className = 'strategy-card__footer';

    const visibilityBadge = document.createElement('span');
    visibilityBadge.className = 'strategy-card__badge';
    visibilityBadge.textContent = formatVisibility(strategy?.visibility);
    footer.appendChild(visibilityBadge);

    const needs = normalizeStrategyNeeds(strategy);
    if (needs.length) {
      const needsDetails = document.createElement('details');
      needsDetails.className = 'strategy-card__needs';
      const needsSummary = document.createElement('summary');
      needsSummary.textContent = 'Needs supported';
      needsDetails.appendChild(needsSummary);
      const needsList = document.createElement('ul');
      needsList.className = 'strategy-card__needs-list';
      needs.forEach((need) => {
        const item = document.createElement('li');
        item.textContent = need;
        needsList.appendChild(item);
      });
      needsDetails.appendChild(needsList);
      footer.appendChild(needsDetails);
    }

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'strategy-card__action';
    addButton.dataset.addToInventory = 'true';
    addButton.textContent = 'Save to inventory';
    addButton.addEventListener('click', () => {
      handleAddToInventory(strategy);
    });
    footer.appendChild(addButton);

    card.appendChild(footer);
    state.feedList.appendChild(card);
  });
}

function addStrategyLocally(strategy) {
  const store = window?.NVCInventoryStore;
  if (store?.addStrategyToSnapshot && store?.loadInventorySnapshot) {
    const snapshot = store.loadInventorySnapshot();
    return store.addStrategyToSnapshot(snapshot, strategy);
  }

  const fallback = Array.isArray(strategy?.needIds) ? strategy.needIds : [];
  const current = (() => {
    try {
      const raw = localStorage.getItem('nvcApp.inventory');
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  })();
  const entry = {
    id: `feed_${Date.now().toString(36)}`,
    title: strategy?.title || 'Untitled strategy',
    description: strategy?.body || '',
    needSlugs: fallback,
    needSlug: fallback[0] || '',
    tags: fallback,
    personal: false,
    strategySlug: strategy?.id ? String(strategy.id) : '',
    createdAt: new Date().toISOString(),
    visibility: normalizeVisibility(strategy?.visibility),
  };
  current.push(entry);
  try {
    localStorage.setItem('nvcApp.inventory', JSON.stringify(current));
  } catch (error) {
    // Ignore storage errors; the backend count update can still proceed.
  }
  return { snapshot: current, entry };
}

async function notifyBackendAdd(strategy) {
  if (!strategy?.id) return null;
  const res = await fetch(`${BACKEND_BASE_URL}/strategies/${strategy.id}/add-to-inventory`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.message || `Backend responded with ${res.status}`;
    throw new Error(message);
  }
  const data = await res.json();
  return data?.strategy || null;
}

async function handleAddToInventory(strategy) {
  addStrategyLocally(strategy);
  setStatus('Saved to your inventory.');

  let updated = null;
  try {
    updated = await notifyBackendAdd(strategy);
  } catch (error) {
    setStatus('Saved to your inventory. Shared add count could not be updated.');
  }

  const baseCount = Number.isFinite(strategy?.addCount)
    ? Number(strategy.addCount)
    : Number(strategy?.addCount || 0);
  const nextCount = Number.isFinite(updated?.addCount) ? Number(updated.addCount) : baseCount + 1;
  strategy.addCount = nextCount;
}

async function fetchAndRenderFeed() {
  const requestId = ++state.requestId;
  const scope = state.scopeSelect?.value || 'public';
  const sort = state.sortSelect?.value || 'recent';
  const params = new URLSearchParams({ scope, sort });
  setStatus('Loading…');
  let authFollowError = false;

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/strategies/feed?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-cache',
    });
    const data = await res.json();
    if (!res.ok || !data || data.status !== 'ok') {
      if (data?.message === 'auth_follow_fetch_failed') authFollowError = true;
      throw new Error(data?.message || 'Unable to load feed');
    }
    if (requestId !== state.requestId) return;

    state.strategies = Array.isArray(data.strategies) ? data.strategies : [];
    renderFeed(state.strategies);
  } catch (error) {
    if (requestId !== state.requestId) return;
    console.error('Error loading strategy feed', error);
    if (authFollowError) {
      setStatus('Your Bluesky session needs attention. Sign in again in Menu → Account & data.');
    } else {
      setStatus('Unable to load shared strategies right now.');
    }
    if (state.feedList) state.feedList.textContent = '';
  }
}

function publishGlobalSession(session) {
  const normalized = session?.did
    ? { did: session.did, handle: session.handle || null }
    : null;
  const previous = window.allneedsSession || null;
  const changed = previous?.did !== normalized?.did || previous?.handle !== normalized?.handle;

  window.allneedsSession = normalized;
  if (!changed) return;

  window.dispatchEvent(new CustomEvent('allneeds:bsky-login-changed', {
    detail: {
      ...(normalized || {}),
      reason: normalized ? 'feed-restore' : 'feed-signout',
    },
  }));
}

function applySession(session, { publish = false } = {}) {
  state.session = session?.did ? session : null;
  setAuthHint(state.session);
  setScopeAvailability(state.session);
  if (publish) {
    publishGlobalSession(state.session);
  }
}

async function init() {
  state.feedList = document.querySelector('[data-feed-list]');
  state.statusEl = document.querySelector('[data-feed-status]');
  state.authHintEl = document.querySelector('[data-feed-auth-hint]');
  state.scopeSelect = document.getElementById('feed-scope-select');
  state.sortSelect = document.getElementById('feed-sort-select');

  if (document?.documentElement) {
    document.documentElement.dataset.strategyFeedVersion = FEED_ASSET_VERSION;
  }

  const session = await loadFeedSession();
  applySession(session, { publish: true });

  state.scopeSelect?.addEventListener('change', () => {
    setScopeAvailability(state.session);
    fetchAndRenderFeed();
  });
  state.sortSelect?.addEventListener('change', fetchAndRenderFeed);

  window.addEventListener('allneeds:bsky-login-changed', (event) => {
    applySession(event?.detail || window.allneedsSession || null);
    fetchAndRenderFeed();
  });

  await fetchAndRenderFeed();
}

// Module scripts run after the document has been parsed. Start the visible Feed
// immediately while the legacy shared controller downloads in parallel. The
// top-level await keeps DOMContentLoaded from firing until inventory.js has
// registered its existing DOMContentLoaded initializer.
const inventoryRuntimeReady = ensureInventoryClassicRuntime();
init();
await inventoryRuntimeReady;
