const SPA_STATE_KEY = '__nvcSpa';
const SUPPORTED = typeof window !== 'undefined'
  && typeof window.history !== 'undefined'
  && typeof window.history.pushState === 'function'
  && typeof window.fetch === 'function';
const HAS_ABORT_CONTROLLER = typeof window !== 'undefined'
  && typeof window.AbortController === 'function';

const FALLBACK_REL_VALUES = new Set(['external', 'download', 'noopener', 'noreferrer']);

let activeController = null;

function createSpaState(url) {
  return { [SPA_STATE_KEY]: true, url };
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl, window.location.href);
    const path = url.pathname || '/';
    if (/index\.html$/i.test(path)) {
      const normalizedPath = path.replace(/index\.html$/i, '');
      url.pathname = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
    }
    if (!url.pathname) {
      url.pathname = '/';
    }
    return url.href;
  } catch (error) {
    return rawUrl;
  }
}

function ensureInitialHistoryState() {
  if (!SUPPORTED) {
    return;
  }
  const current = normalizeUrl(window.location.href);
  const state = window.history.state;
  if (!state || state[SPA_STATE_KEY] !== true || state.url !== current) {
    window.history.replaceState(createSpaState(current), document.title, current);
  }
}

function isModifiedEvent(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function allowsClientSideNavigation(anchor) {
  if (!anchor) {
    return false;
  }
  const targetAttr = anchor.getAttribute('target');
  if (targetAttr && targetAttr.toLowerCase() !== '_self') {
    return false;
  }
  if (anchor.hasAttribute('download')) {
    return false;
  }
  if (anchor.dataset && (anchor.dataset.spaIgnore === 'true' || anchor.dataset.spaIgnore === '1')) {
    return false;
  }
  const rel = anchor.getAttribute('rel');
  if (rel) {
    const tokens = rel.split(/\s+/);
    if (tokens.some((token) => FALLBACK_REL_VALUES.has(token.toLowerCase()))) {
      return false;
    }
  }
  const rawHref = anchor.getAttribute('href');
  if (!rawHref || rawHref.trim() === '' || rawHref.startsWith('#')) {
    return false;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawHref) && !/^https?:/i.test(rawHref)) {
    return false;
  }
  if (/^javascript:/i.test(rawHref)) {
    return false;
  }
  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return false;
    }
    if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) {
      return false;
    }
  } catch (error) {
    return false;
  }
  return true;
}

async function fetchDocument(url, signal) {
  const options = {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'X-Requested-With': 'spa',
    },
  };
  if (signal) {
    options.signal = signal;
  }
  const response = await window.fetch(url, options);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.text();
}

function renderHtml(html) {
  document.open('text/html', 'replace');
  document.write(html);
  document.close();
}

async function navigateTo(targetUrl, { historyMode = 'push' } = {}) {
  if (!SUPPORTED) {
    window.location.href = targetUrl;
    return;
  }

  const normalizedTarget = normalizeUrl(targetUrl);
  const normalizedCurrent = normalizeUrl(window.location.href);

  if (normalizedTarget === normalizedCurrent) {
    return;
  }

  if (HAS_ABORT_CONTROLLER && activeController) {
    try {
      activeController.abort();
    } catch (error) {
      // Ignore abort errors
    }
    activeController = null;
  } else {
    activeController = null;
  }

  const controller = HAS_ABORT_CONTROLLER ? new AbortController() : null;
  activeController = controller;

  try {
    const html = await fetchDocument(normalizedTarget, controller ? controller.signal : undefined);
    if (controller && controller.signal.aborted) {
      return;
    }
    if (historyMode === 'replace') {
      window.history.replaceState(createSpaState(normalizedTarget), document.title, normalizedTarget);
    } else if (historyMode === 'push') {
      window.history.pushState(createSpaState(normalizedTarget), document.title, normalizedTarget);
    }
    activeController = null;
    renderHtml(html);
  } catch (error) {
    const aborted = Boolean(controller && controller.signal && controller.signal.aborted);
    activeController = null;
    if (!aborted) {
      window.location.href = targetUrl;
    }
  }
}

function handleDocumentClick(event) {
  if (event.defaultPrevented || event.button !== 0 || isModifiedEvent(event) || !SUPPORTED) {
    return;
  }
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!anchor) {
    return;
  }
  if (!allowsClientSideNavigation(anchor)) {
    return;
  }
  let target;
  try {
    target = new URL(anchor.href, window.location.href).href;
  } catch (error) {
    return;
  }
  event.preventDefault();
  navigateTo(target, { historyMode: 'push' });
}

function handlePopState(event) {
  if (!SUPPORTED) {
    return;
  }
  const state = event.state;
  if (state && state[SPA_STATE_KEY] === true && typeof state.url === 'string') {
    navigateTo(state.url, { historyMode: 'replace' });
  } else {
    navigateTo(window.location.href, { historyMode: 'replace' });
  }
}

if (SUPPORTED) {
  ensureInitialHistoryState();
  window.addEventListener('popstate', handlePopState);
  document.addEventListener('click', handleDocumentClick);
}
