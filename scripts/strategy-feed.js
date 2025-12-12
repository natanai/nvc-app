import {
  initBlueskyOAuth,
  getCurrentBlueskySession,
  ensureBackendSession,
} from '../inventory/bluesky-oauth.js';

const state = {
  strategies: [],
  feedList: null,
  statusEl: null,
  authHintEl: null,
  scopeSelect: null,
  sortSelect: null,
  loadButton: null,
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
      'Signed in via Bluesky. You can see strategies shared by accounts you follow and add them to your inventory.';
  } else {
    state.authHintEl.textContent =
      'You’re currently signed out. You can still browse public strategies, but to see strategies from people you follow and to track “add” counts, sign in with Bluesky on the Inventory page.';
  }
}

function renderFeed(strategies, { sort } = {}) {
  if (!state.feedList) return;
  state.feedList.textContent = '';

  const currentSort = sort || state.sortSelect?.value || 'recent';

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
    visibilityBadge.textContent = `Visibility: ${formatVisibility(strategy?.visibility)}`;
    footer.appendChild(visibilityBadge);

    if (currentSort === 'popular') {
      const addCountBadge = document.createElement('span');
      addCountBadge.className = 'strategy-card__badge';
      addCountBadge.textContent = 'Trending';
      footer.appendChild(addCountBadge);
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
  const res = await fetch(`/api/strategies/${strategy.id}/add-to-inventory`, {
    method: 'POST',
    credentials: 'include',
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
    const res = await fetch(`/api/strategies/feed?${params.toString()}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data || data.status !== 'ok') {
      throw new Error(data?.message || 'Unable to load feed');
    }
    state.strategies = Array.isArray(data.strategies) ? data.strategies : [];
    renderFeed(state.strategies, { sort });
    if (!state.strategies.length) {
      setStatus('No strategies found for this filter yet.');
    }
  } catch (error) {
    console.error('Error loading strategy feed', error);
    setStatus('Unable to load the strategy feed right now. Please try again later.');
    if (state.feedList) {
      state.feedList.textContent = '';
    }
  }
}

function handleFilterChange() {
  setStatus('Filters changed. Click "Load strategies" to refresh, or confirm to reload now.');

  if (window.confirm('Apply these filters and reload the strategy feed now?')) {
    fetchAndRenderFeed();
  }
}

async function init() {
  state.feedList = document.querySelector('[data-feed-list]');
  state.statusEl = document.querySelector('[data-feed-status]');
  state.authHintEl = document.querySelector('[data-feed-auth-hint]');
  state.scopeSelect = document.getElementById('feed-scope-select');
  state.sortSelect = document.getElementById('feed-sort-select');
  state.loadButton = document.getElementById('feed-load-button');

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

  setAuthHint(session || null);
  setStatus('Choose your filters, then select "Load strategies" to see the feed.');

  if (state.scopeSelect) {
    state.scopeSelect.addEventListener('change', handleFilterChange);
  }
  if (state.sortSelect) {
    state.sortSelect.addEventListener('change', handleFilterChange);
  }

  if (state.loadButton) {
    state.loadButton.addEventListener('click', fetchAndRenderFeed);
  }
}

document.addEventListener('DOMContentLoaded', init);
