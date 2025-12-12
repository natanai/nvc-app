import {
  initBlueskyOAuth,
  getCurrentBlueskySession,
  ensureBackendSession,
} from '../inventory/bluesky-oauth.js';

const state = {
  container: null,
  list: null,
  status: null,
  hint: null,
  scopeSelect: null,
  loadButton: null,
  needSlug: '',
  session: null,
  strategies: [],
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
  if (state.status) {
    state.status.textContent = message || '';
  }
}

function setAuthHint(session) {
  if (!state.hint) return;
  if (session && session.did) {
    state.hint.textContent =
      'Signed in via Bluesky. You can see strategies shared by accounts you follow and add them to your inventory.';
  } else {
    state.hint.textContent =
      'You’re currently signed out. You can still browse public strategies. Sign in on the Inventory page to see people you follow.';
  }
}

function syncScopeAvailability() {
  if (!state.scopeSelect) return;
  const followsOption = state.scopeSelect.querySelector('option[value="follows"]');
  if (state.session && state.session.did) {
    if (followsOption) followsOption.disabled = false;
    if (!state.scopeSelect.value) {
      state.scopeSelect.value = 'follows';
    }
    return;
  }

  if (followsOption) followsOption.disabled = true;
  state.scopeSelect.value = 'public';
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
    setStatus('Added locally, but could not update the shared count (you might be signed out).');
  }

  const baseCount = Number.isFinite(strategy?.addCount)
    ? Number(strategy.addCount)
    : Number(strategy?.addCount || 0);
  const nextCount = Number.isFinite(updated?.addCount) ? Number(updated.addCount) : baseCount + 1;
  strategy.addCount = nextCount;
}

function renderStrategies(strategies) {
  if (!state.list) return;
  state.list.textContent = '';

  if (!Array.isArray(strategies) || !strategies.length) {
    setStatus('No shared strategies yet for this need.');
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

    state.list.appendChild(card);
  });
}

function resolveNeedSlug(container) {
  if (container?.dataset?.needSlug) {
    return container.dataset.needSlug;
  }
  const main = document.querySelector('[data-need-slug]');
  if (main?.dataset?.needSlug) {
    return main.dataset.needSlug;
  }
  const pathParts = window.location?.pathname?.split('/') || [];
  return pathParts.filter(Boolean).pop() || '';
}

function getScope() {
  const value = state.scopeSelect?.value || 'public';
  if (value === 'follows' && !(state.session && state.session.did)) {
    setStatus('Sign in with Bluesky to load strategies from people you follow. Showing public strategies instead.');
    state.scopeSelect.value = 'public';
    return 'public';
  }
  return value;
}

async function fetchNeedFeed() {
  const scope = getScope();
  if (!state.needSlug) {
    setStatus('Missing need context for this page.');
    return;
  }

  setStatus('Loading shared strategies...');

  if (state.session?.did) {
    try {
      await ensureBackendSession(state.session);
    } catch (error) {
      // ignore backend session errors; public scope will still work
    }
  }

  const params = new URLSearchParams({ scope, need: state.needSlug });

  try {
    const res = await fetch(`/api/strategies/feed?${params.toString()}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data || data.status !== 'ok') {
      throw new Error(data?.message || 'Unable to load shared strategies');
    }
    state.strategies = Array.isArray(data.strategies) ? data.strategies : [];
    renderStrategies(state.strategies);
    if (!state.strategies.length) {
      setStatus('No shared strategies yet for this need.');
    }
  } catch (error) {
    console.error('Error loading need strategy feed', error);
    setStatus('Unable to load shared strategies right now. Please try again later.');
    if (state.list) {
      state.list.textContent = '';
    }
  }
}

function bindEvents() {
  if (state.loadButton) {
    state.loadButton.addEventListener('click', fetchNeedFeed);
  }
  if (state.scopeSelect) {
    state.scopeSelect.addEventListener('change', () => {
      if (state.scopeSelect.value === 'follows' && !(state.session && state.session.did)) {
        setStatus('Sign in with Bluesky to use the "people you follow" filter.');
        state.scopeSelect.value = 'public';
      } else {
        setStatus('');
      }
    });
  }
}

async function initAuth() {
  const session = getCurrentBlueskySession();
  state.session = session || null;
  syncScopeAvailability();
  setAuthHint(state.session);

  try {
    const restored = await initBlueskyOAuth();
    state.session = restored || state.session;
    syncScopeAvailability();
    setAuthHint(state.session);
    if (state.session?.did) {
      await ensureBackendSession(state.session);
    }
  } catch (error) {
    console.warn('Unable to initialize Bluesky session for need feed', error);
  }
}

function initNeedFeed() {
  if (typeof document === 'undefined') return;
  const container = document.querySelector('[data-need-feed]');
  if (!container) return;

  state.container = container;
  state.list = container.querySelector('[data-need-feed-list]');
  state.status = container.querySelector('[data-need-feed-status]');
  state.hint = document.querySelector('[data-need-feed-auth-hint]');
  state.scopeSelect = document.querySelector('[data-need-feed-scope]');
  state.loadButton = document.querySelector('[data-need-feed-button]');
  state.needSlug = resolveNeedSlug(container);

  syncScopeAvailability();
  setAuthHint(state.session);
  bindEvents();
  initAuth();
}

initNeedFeed();
