import './inventory.js?v=2026-08-19-feed-ui';

import {
  initBlueskyOAuth,
  getCurrentBlueskySession,
  ensureBackendSession,
  BACKEND_BASE_URL,
} from './bluesky-oauth.js?v=2024-07-11';

const FEED_ASSET_VERSION = '2026-08-19-feed-first';

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

function prepareFeedUi() {
  const title = document.querySelector('#main .page-title');
  if (title) title.textContent = 'Shared strategies';

  document.querySelectorAll('#main .inventory-header .page-description').forEach((node) => node.remove());
  document.querySelector('#main .feed-controls > .section-heading')?.remove();
  document.querySelectorAll(
    '#main .feed-action-hint, #main .feed-follows-status, #main [data-feed-follows-check], #main [data-feed-fetch]',
  ).forEach((node) => node.remove());
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

function applySession(session) {
  state.session = session?.did ? session : null;
  setAuthHint(state.session);
  setScopeAvailability(state.session);
}

async function init() {
  prepareFeedUi();

  state.feedList = document.querySelector('[data-feed-list]');
  state.statusEl = document.querySelector('[data-feed-status]');
  state.authHintEl = document.querySelector('[data-feed-auth-hint]');
  state.scopeSelect = document.getElementById('feed-scope-select');
  state.sortSelect = document.getElementById('feed-sort-select');

  if (document?.documentElement) {
    document.documentElement.dataset.strategyFeedVersion = FEED_ASSET_VERSION;
  }

  let session = null;
  try {
    session = await initBlueskyOAuth();
    if (session) await ensureBackendSession(session);
  } catch (error) {
    console.warn('Could not initialize Bluesky OAuth session', error);
  }

  if (!session) {
    try {
      session = getCurrentBlueskySession();
    } catch (error) {
      session = null;
    }
  }

  applySession(session);

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
