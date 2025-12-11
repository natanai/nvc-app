const BACKEND_BASE_URL = 'https://allneeds-backend.natanai.workers.dev';

function describeStrategyVisibility(value) {
  switch ((value || '').toString().trim().toLowerCase()) {
    case 'public':
      return 'Visible to everyone';
    case 'followers':
      return 'Visible to followers';
    case 'private':
      return 'Private to you';
    default:
      return '';
  }
}

function formatAuthor(strategy) {
  const author = strategy && strategy.author ? strategy.author : {};
  return author.displayName || author.handle || author.did || 'Unknown author';
}

function renderStrategies(container, strategies, emptyMessage) {
  if (!container) {
    return;
  }
  container.textContent = '';

  if (!Array.isArray(strategies) || !strategies.length) {
    if (emptyMessage) {
      container.textContent = emptyMessage;
    }
    return;
  }

  const list = document.createElement('div');
  list.className = 'inventory-social-strategies__items';

  strategies.forEach((strategy) => {
    const card = document.createElement('article');
    card.className = 'inventory-social-strategies__item';

    const heading = document.createElement('h3');
    heading.textContent = strategy?.title || '(no title)';
    card.appendChild(heading);

    const meta = document.createElement('p');
    meta.className = 'inventory-social-strategies__meta';
    meta.textContent = `Shared by ${formatAuthor(strategy)}`;
    card.appendChild(meta);

    const visibilityLabel = describeStrategyVisibility(strategy?.visibility);
    if (visibilityLabel) {
      const visibility = document.createElement('p');
      visibility.className = 'inventory-social-strategies__meta';
      visibility.textContent = visibilityLabel;
      card.appendChild(visibility);
    }

    const body = document.createElement('p');
    body.className = 'inventory-social-strategies__body';
    const bodyText = (strategy?.body || '').toString();
    body.textContent = bodyText.length > 220 ? `${bodyText.slice(0, 220)}…` : bodyText;
    card.appendChild(body);

    if (Array.isArray(strategy?.needIds) && strategy.needIds.length) {
      const needs = document.createElement('p');
      needs.className = 'inventory-social-strategies__needs';
      needs.textContent = `Needs: ${strategy.needIds.join(', ')}`;
      card.appendChild(needs);
    }

    list.appendChild(card);
  });

  container.appendChild(list);
}

async function fetchStrategies({ did, audience }) {
  const params = new URLSearchParams();
  if (did) {
    params.set('did', did);
  }
  if (audience) {
    params.set('audience', audience);
  }

  const url = `${BACKEND_BASE_URL}/api/feed/strategies?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !data || data.status !== 'ok') {
    const message = data && data.message ? data.message : 'Unknown error';
    throw new Error(message);
  }
  return Array.isArray(data.strategies) ? data.strategies : [];
}

function setStatus(target, message, type = 'info') {
  if (!target) return;
  target.textContent = message || '';
  target.dataset.statusType = type;
}

function getCurrentDid() {
  const session = typeof window !== 'undefined' ? window.allneedsSession : null;
  return session?.did || null;
}

function updateSessionStatus() {
  const did = getCurrentDid();
  const statusEl = document.querySelector('[data-session-status]');
  if (!statusEl) return;
  if (did) {
    statusEl.textContent = `Signed in as ${window.allneedsSession?.handle ? `@${window.allneedsSession.handle}` : did}`;
  } else {
    statusEl.textContent = 'Not linked to Bluesky yet.';
  }
}

async function refreshFollowingFeed() {
  const did = getCurrentDid();
  const container = document.querySelector('[data-feed-list="following"]');
  const status = document.querySelector('[data-feed-status="following"]');

  if (!container) return;
  container.textContent = '';

  if (!did) {
    setStatus(status, 'Link a Bluesky account above to see strategies from people you follow.', 'warning');
    return;
  }

  setStatus(status, 'Loading strategies from people you follow…');
  try {
    const strategies = await fetchStrategies({ did, audience: 'following' });
    renderStrategies(container, strategies, 'No shared strategies from people you follow yet.');
    setStatus(status, strategies.length ? '' : 'No shared strategies from people you follow yet.');
  } catch (error) {
    console.error('Unable to load following feed', error);
    setStatus(status, 'Error loading following feed.', 'error');
  }
}

async function refreshPublicFeed() {
  const container = document.querySelector('[data-feed-list="public"]');
  const status = document.querySelector('[data-feed-status="public"]');
  if (!container) return;
  container.textContent = '';

  setStatus(status, 'Loading public strategies…');
  try {
    const strategies = await fetchStrategies({ audience: 'public' });
    renderStrategies(container, strategies, 'No public strategies have been shared yet.');
    setStatus(status, strategies.length ? '' : 'No public strategies have been shared yet.');
  } catch (error) {
    console.error('Unable to load public feed', error);
    setStatus(status, 'Error loading public feed.', 'error');
  }
}

function wireFeedControls() {
  const refreshFollowing = document.querySelector('[data-feed-refresh="following"]');
  const refreshPublic = document.querySelector('[data-feed-refresh="public"]');
  if (refreshFollowing) {
    refreshFollowing.addEventListener('click', (event) => {
      event.preventDefault();
      refreshFollowingFeed();
    });
  }
  if (refreshPublic) {
    refreshPublic.addEventListener('click', (event) => {
      event.preventDefault();
      refreshPublicFeed();
    });
  }
}

function initializeFeedPage() {
  updateSessionStatus();
  wireFeedControls();
  refreshFollowingFeed();
  refreshPublicFeed();
}

document.addEventListener('DOMContentLoaded', initializeFeedPage);

if (typeof window !== 'undefined') {
  window.addEventListener('allneeds:bsky-login-changed', () => {
    updateSessionStatus();
    refreshFollowingFeed();
  });
}
