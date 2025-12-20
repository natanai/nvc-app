import {
  initBlueskyOAuth,
  getCurrentBlueskySession,
  ensureBackendSession,
  BACKEND_BASE_URL,
} from './bluesky-oauth.js?v=2024-07-11';

// Updating this string forces cache-busting when referenced from feed/index.html.
const FEED_ASSET_VERSION = '2024-10-06';

const state = {
  strategies: [],
  feedList: null,
  statusEl: null,
  authHintEl: null,
  scopeSelect: null,
  sortSelect: null,
  fetchButton: null,
  debugButton: null,
  debugStatusEl: null,
  session: null,
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
  if (session && session.did) {
    state.authHintEl.textContent =
      'Signed in via Bluesky. You can see strategies shared by accounts you follow and add them to your inventory. If your Bluesky account hides your follows from logged-out viewers, the feed may need authenticated access.';
  } else {
    state.authHintEl.textContent =
      'You’re currently signed out. You can still browse public strategies, but to see strategies from people you follow, sign in with Bluesky on the Inventory page. If your Bluesky account hides your follows from logged-out viewers, the follows feed won’t load.';
  }
}

function setScopeAvailability(session) {
  if (!state.scopeSelect) return;
  const followsOption = state.scopeSelect.querySelector('option[value="follows"]');
  if (!session || !session.did) {
    if (state.scopeSelect.value === 'follows') {
      state.scopeSelect.value = 'public';
    }
    if (followsOption) {
      followsOption.disabled = true;
    }
  } else if (followsOption) {
    followsOption.disabled = false;
  }
}

function setFilterHint(message) {
  setStatus(message || 'Choose filters, then click “Pull strategies” to load the feed.');
}

function setDebugStatus(message) {
  if (!state.debugStatusEl) return;
  state.debugStatusEl.textContent = message || '';
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
    setStatus('No strategies found for this filter yet.');
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
    addButton.textContent = 'Add to inventory';
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
    // ignore storage errors
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
  setStatus('Added to your local inventory.');

  let updated = null;
  try {
    updated = await notifyBackendAdd(strategy);
  } catch (error) {
    setStatus(
      'Added to your local inventory, but couldn’t update shared “add” count (you might be signed out).',
    );
  }

  const baseCount = Number.isFinite(strategy?.addCount)
    ? Number(strategy.addCount)
    : Number(strategy?.addCount || 0);
  const nextCount = Number.isFinite(updated?.addCount) ? Number(updated.addCount) : baseCount + 1;
  strategy.addCount = nextCount;
}

async function fetchAndRenderFeed() {
  const scope = state.scopeSelect?.value || 'public';
  const sort = state.sortSelect?.value || 'recent';
  const params = new URLSearchParams({ scope, sort });
  setStatus('Loading strategies...');

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/strategies/feed?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-cache',
    });
    const data = await res.json();
    if (!res.ok || !data || data.status !== 'ok') {
      throw new Error(data?.message || 'Unable to load feed');
    }
    state.strategies = Array.isArray(data.strategies) ? data.strategies : [];
    renderFeed(state.strategies);
    if (!state.strategies.length) {
      setStatus('No strategies found for this filter yet.');
    }
  } catch (error) {
    console.error('Error loading strategy feed', error);
    if (error?.message === 'follow_visibility_blocked') {
      setStatus(
        'Your Bluesky account may hide follows from logged-out viewers. Enable logged-out visibility in Bluesky or use the debug gear to check authenticated access.',
      );
    } else {
      setStatus('Unable to load the strategy feed right now. Please try again later.');
    }
    if (state.feedList) {
      state.feedList.textContent = '';
    }
  }
}

async function runFollowDiagnostic() {
  setDebugStatus('Checking Bluesky follow access...');
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/bluesky/follows/diagnostic`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.status !== 'ok') {
      if (data?.message === 'follow_visibility_blocked' || data?.visibilityBlocked) {
        setDebugStatus(
          'Bluesky follow visibility is blocked for logged-out viewers. Enable logged-out visibility in Bluesky settings or re-authenticate.',
        );
        return;
      }
      throw new Error(data?.message || 'Unable to check follow access.');
    }
    const sourceLabel = data.source === 'authenticated' ? 'authenticated' : 'public';
    setDebugStatus(
      `Follow check succeeded via ${sourceLabel} access. Found ${data.followCount} follow(s).`,
    );
  } catch (error) {
    console.error('Error running follow diagnostic', error);
    setDebugStatus('Unable to check follow access right now. Please try again later.');
  }
}

async function init() {
  state.feedList = document.querySelector('[data-feed-list]');
  state.statusEl = document.querySelector('[data-feed-status]');
  state.authHintEl = document.querySelector('[data-feed-auth-hint]');
  state.scopeSelect = document.getElementById('feed-scope-select');
  state.sortSelect = document.getElementById('feed-sort-select');
  state.fetchButton = document.querySelector('[data-feed-fetch]');
  state.debugButton = document.querySelector('[data-feed-debug]');
  state.debugStatusEl = document.querySelector('[data-feed-debug-status]');

  if (document?.documentElement) {
    document.documentElement.dataset.strategyFeedVersion = FEED_ASSET_VERSION;
  }

  let session = null;
  try {
    session = await initBlueskyOAuth();
    if (session) {
      await ensureBackendSession(session);
    }
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

  state.session = session || null;
  setAuthHint(state.session);
  setScopeAvailability(state.session);
  setFilterHint();

  const updateHint = () => {
    setFilterHint();
  };

  if (state.scopeSelect) {
    state.scopeSelect.addEventListener('change', () => {
      if (!state.session?.did && state.scopeSelect.value === 'follows') {
        state.scopeSelect.value = 'public';
      }
      setScopeAvailability(state.session);
      updateHint();
    });
  }
  if (state.sortSelect) {
    state.sortSelect.addEventListener('change', updateHint);
  }
  if (state.fetchButton) {
    state.fetchButton.addEventListener('click', fetchAndRenderFeed);
  }
  if (state.debugButton) {
    state.debugButton.addEventListener('click', runFollowDiagnostic);
  }
}

document.addEventListener('DOMContentLoaded', init);
