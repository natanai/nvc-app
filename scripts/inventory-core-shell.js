const MENU_ID = 'nav-more-menu';
const MENU_MAGNET_ID = 'nav-menu';
const MENU_ROOT_VIEW = 'root';
const MENU_ACCOUNT_VIEW = 'account-data';
const TAP_MOVE_THRESHOLD = 10;

function getNav() {
  return document.querySelector('[data-magnet-root][data-magnet-key="site-nav"]');
}

function getSiteRootUrl(nav) {
  const home = nav?.querySelector('[data-magnet-id="nav-home"]');
  const href = home?.getAttribute('href') || './';
  try {
    return new URL(href, window.location.href);
  } catch (error) {
    return new URL('./', window.location.href);
  }
}

function toSiteUrl(rootUrl, path = '') {
  return new URL(path, rootUrl).href;
}

function getMagnetHref(nav, rootUrl, magnetId, fallbackPath) {
  const magnet = nav?.querySelector(`[data-magnet-id="${magnetId}"]`);
  const href = magnet?.getAttribute('href');
  if (href) {
    try {
      return new URL(href, window.location.href).href;
    } catch (error) {
      // Fall through to the resilient canonical fallback.
    }
  }
  return toSiteUrl(rootUrl, fallbackPath);
}

function isInventoryWorkspace(rootUrl) {
  try {
    const inventoryUrl = new URL('inventory/', rootUrl);
    const current = new URL(window.location.href);
    return current.pathname.replace(/index\.html$/i, '') === inventoryUrl.pathname;
  } catch (error) {
    return /\/inventory\/(?:index\.html)?$/i.test(window.location.pathname || '');
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function directRow({ href, label, note = '', current = false, badge = '' }) {
  return `
    <a class="inventory-more-menu__row${current ? ' is-current' : ''}" href="${escapeHtml(href)}"${current ? ' aria-current="page"' : ''}>
      <span class="inventory-more-menu__row-copy">
        <span class="inventory-more-menu__row-title">${escapeHtml(label)}</span>
        ${note ? `<span class="inventory-more-menu__row-note">${escapeHtml(note)}</span>` : ''}
      </span>
      ${badge ? `<span class="inventory-more-menu__badge" ${badge === 'inventory-count' ? 'data-menu-inventory-count hidden' : ''}>${badge === 'inventory-count' ? '' : escapeHtml(badge)}</span>` : ''}
    </a>`;
}

function currentPath() {
  try {
    return new URL(window.location.href).pathname.replace(/index\.html$/i, '').replace(/\/{2,}/g, '/');
  } catch (error) {
    return window.location.pathname || '/';
  }
}

function pathMatches(url) {
  try {
    const target = new URL(url, window.location.href).pathname.replace(/index\.html$/i, '').replace(/\/{2,}/g, '/');
    return target === currentPath();
  } catch (error) {
    return false;
  }
}

function menuMarkup(nav, rootUrl) {
  // Existing magnets are the source of truth for destinations that already
  // exist in site navigation. Fallbacks are only for defensive resilience.
  const urls = {
    home: getMagnetHref(nav, rootUrl, 'nav-home', ''),
    observations: getMagnetHref(nav, rootUrl, 'nav-observations', 'observations/'),
    feelings: getMagnetHref(nav, rootUrl, 'nav-feelings', 'feelings/'),
    needs: getMagnetHref(nav, rootUrl, 'nav-needs', 'needs/'),
    bodyCues: getMagnetHref(nav, rootUrl, 'nav-body-cues', 'feelings/body-cues/'),
    fauxFeelings: getMagnetHref(nav, rootUrl, 'nav-faux-feelings', 'faux-feelings/'),
    inventory: getMagnetHref(nav, rootUrl, 'nav-inventory', 'inventory/'),
    journalHistory: getMagnetHref(nav, rootUrl, 'nav-journal-dashboard', 'inventory/journal/'),
    guided: toSiteUrl(rootUrl, 'alexithymia-support/'),
    shared: toSiteUrl(rootUrl, 'feed/'),
  };

  return `
    <div class="inventory-more-menu__inner">
      <section class="inventory-more-menu__view" data-menu-view="${MENU_ROOT_VIEW}">
        <header class="inventory-more-menu__header">
          <div>
            <p class="inventory-more-menu__eyebrow">allneeds.app</p>
            <h2 class="inventory-more-menu__title">Menu</h2>
          </div>
          <button class="inventory-more-menu__close" type="button" aria-label="Close menu">×</button>
        </header>

        <nav aria-label="allneeds.app menu">
          <section class="inventory-more-menu__section" aria-labelledby="nav-more-explore-heading">
            <h3 id="nav-more-explore-heading" class="inventory-more-menu__section-title">Explore</h3>
            ${directRow({ href: urls.home, label: 'Home', current: pathMatches(urls.home) })}
            ${directRow({ href: urls.observations, label: 'Observations', current: pathMatches(urls.observations) })}
            ${directRow({ href: urls.feelings, label: 'Feelings', current: pathMatches(urls.feelings) })}
            ${directRow({ href: urls.needs, label: 'Needs', current: pathMatches(urls.needs) })}
            ${directRow({ href: urls.bodyCues, label: 'Body cues', current: pathMatches(urls.bodyCues) })}
            ${directRow({ href: urls.fauxFeelings, label: 'Faux feelings', current: pathMatches(urls.fauxFeelings) })}
            ${directRow({ href: urls.guided, label: 'Guided check-in', note: 'Start with what you can notice', current: pathMatches(urls.guided) })}
          </section>

          <section class="inventory-more-menu__section" aria-labelledby="nav-more-practice-heading">
            <h3 id="nav-more-practice-heading" class="inventory-more-menu__section-title">Your practice</h3>
            ${directRow({ href: urls.inventory, label: 'Strategy inventory', note: 'Your personal library of what helps', current: pathMatches(urls.inventory), badge: 'inventory-count' })}
            <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-support-journal-open data-menu-action="journal">
              <span class="inventory-more-menu__row-copy">
                <span class="inventory-more-menu__row-title">Journal</span>
                <span class="inventory-more-menu__row-note">Check in with what is present now</span>
              </span>
            </button>
            ${directRow({ href: urls.journalHistory, label: 'Journal history', current: pathMatches(urls.journalHistory) })}
          </section>

          <section class="inventory-more-menu__section" aria-labelledby="nav-more-discover-heading">
            <h3 id="nav-more-discover-heading" class="inventory-more-menu__section-title">Discover</h3>
            ${directRow({ href: urls.shared, label: 'Shared strategies', note: 'Ideas other people have chosen to share', current: pathMatches(urls.shared) })}
          </section>

          <section class="inventory-more-menu__section" aria-labelledby="nav-more-settings-heading">
            <h3 id="nav-more-settings-heading" class="inventory-more-menu__section-title">Settings</h3>
            <button class="inventory-more-menu__row inventory-more-menu__button inventory-more-menu__row--drill" type="button" data-menu-drill="${MENU_ACCOUNT_VIEW}">
              <span class="inventory-more-menu__row-copy">
                <span class="inventory-more-menu__row-title">Account &amp; data</span>
                <span class="inventory-more-menu__row-note" data-menu-account-status>Stored on this device</span>
              </span>
              <span class="inventory-more-menu__disclosure" aria-hidden="true">›</span>
            </button>
            <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-menu-action="customizer">
              <span class="inventory-more-menu__row-copy">
                <span class="inventory-more-menu__row-title">Customize…</span>
                <span class="inventory-more-menu__row-note">Appearance and navigation magnets</span>
              </span>
            </button>
          </section>

          <section class="inventory-more-menu__section inventory-more-menu__section--personal" data-menu-personal-section aria-labelledby="nav-more-personal-heading">
            <h3 id="nav-more-personal-heading" class="inventory-more-menu__section-title">From Nat</h3>
            <div class="inventory-more-menu__personal-card">
              <p class="inventory-more-menu__personal-copy">If something you saved feels worth sharing, I’d genuinely love to see it.</p>
              <button type="button" class="inventory-more-menu__personal-share" data-menu-action="share-with-nat">Share your strategies with Nat…</button>
              <p class="inventory-more-menu__personal-copy" data-menu-personal-status aria-live="polite" hidden></p>
              <button type="button" class="inventory-more-menu__account-action inventory-more-menu__account-action--secondary" data-menu-action="email-nat" hidden>Start email to Nat</button>
            </div>
          </section>
        </nav>
      </section>

      <section class="inventory-more-menu__view" data-menu-view="${MENU_ACCOUNT_VIEW}" hidden>
        <header class="inventory-more-menu__subheader">
          <button class="inventory-more-menu__back" type="button" data-menu-back aria-label="Back to Menu">
            <span aria-hidden="true">‹</span><span>Menu</span>
          </button>
          <button class="inventory-more-menu__close" type="button" aria-label="Close menu">×</button>
        </header>

        <div class="inventory-more-menu__account-heading">
          <p class="inventory-more-menu__eyebrow">Settings</p>
          <h2 class="inventory-more-menu__title">Account &amp; data</h2>
          <p class="inventory-more-menu__intro">Your data stays on this device unless you choose to sync or back it up.</p>
        </div>

        <section class="inventory-more-menu__system-section" aria-labelledby="menu-account-heading">
          <h3 id="menu-account-heading" class="inventory-more-menu__section-title">Account</h3>
          <div class="inventory-auth-panel inventory-more-menu__system-card" aria-label="Bluesky sign-in">
            <div class="inventory-more-menu__system-heading">
              <h4 class="inventory-more-menu__system-title">Bluesky</h4>
              <p class="inventory-more-menu__system-copy">Optional sign-in for a profile snapshot you can use across browsers and devices.</p>
            </div>
            <div class="inventory-auth-panel__field" data-bluesky-handle-field>
              <label for="bluesky-handle-input">Bluesky handle</label>
              <input id="bluesky-handle-input" type="text" autocomplete="username" placeholder="yourname.bsky.social" />
            </div>
            <button id="bluesky-auth-button" type="button" class="inventory-button inventory-button--compact inventory-more-menu__account-action inventory-more-menu__account-action--primary">
              <span class="inventory-button__text">Sign in</span>
            </button>
            <p id="bluesky-auth-status-text" class="inventory-auth-panel__status-text" aria-live="polite"></p>
            <p class="inventory-more-menu__privacy-note">Your password stays with Bluesky.</p>
          </div>

          <div class="inventory-backend-sync inventory-more-menu__system-card" aria-labelledby="menu-sync-heading">
            <div class="inventory-more-menu__system-heading">
              <h4 id="menu-sync-heading" class="inventory-more-menu__system-title">Profile snapshot</h4>
              <p class="inventory-more-menu__system-copy">Save this browser’s allneeds data to your profile, or load your saved profile here.</p>
            </div>
            <div class="inventory-backend-sync__buttons inventory-more-menu__action-pair">
              <button type="button" data-backend-save-button class="inventory-more-menu__account-action inventory-more-menu__account-action--primary">
                <span class="inventory-button__text">Save this browser</span>
              </button>
              <button type="button" data-backend-load-button class="inventory-more-menu__account-action inventory-more-menu__account-action--secondary">
                <span class="inventory-button__text">Load saved profile</span>
              </button>
            </div>
            <div class="inventory-backend-sync__status" data-backend-sync-status aria-live="polite"></div>
            <p class="inventory-more-menu__caution">Loading replaces this browser’s current allneeds data.</p>
          </div>
        </section>

        <section class="inventory-more-menu__system-section" aria-labelledby="menu-backup-heading">
          <h3 id="menu-backup-heading" class="inventory-more-menu__section-title">This device</h3>
          <div class="inventory-more-menu__system-card">
            <div class="inventory-more-menu__system-heading">
              <h4 class="inventory-more-menu__system-title">Backup &amp; restore</h4>
              <p class="inventory-more-menu__system-copy">Download a backup file, or restore one to this browser.</p>
            </div>
            <div class="inventory-more-menu__action-pair">
              <button type="button" id="inventory-export" class="inventory-more-menu__account-action inventory-more-menu__account-action--primary" aria-label="Download an allneeds backup">
                <span class="inventory-button__text">Download backup</span>
              </button>
              <button type="button" id="inventory-import-trigger" class="inventory-more-menu__account-action inventory-more-menu__account-action--secondary" aria-label="Restore allneeds data from backup">
                <span class="inventory-button__text">Restore backup</span>
              </button>
              <input type="file" id="inventory-import" accept="application/json,.json,text/csv,.csv" hidden />
            </div>
            <p class="inventory-more-menu__caution">Restoring replaces this browser’s current allneeds data.</p>
          </div>
        </section>
      </section>
    </div>`;
}

function closeMenu(menu, menuMagnet, { restoreFocus = true } = {}) {
  if (!menu) return;
  if (typeof menu.hidePopover === 'function') {
    try {
      menu.hidePopover();
    } catch (error) {
      // Already closed.
    }
  } else {
    menu.removeAttribute('data-open');
    menu.hidden = true;
  }
  menuMagnet?.setAttribute('aria-expanded', 'false');
  if (restoreFocus && menuMagnet instanceof HTMLElement) {
    window.requestAnimationFrame(() => menuMagnet.focus({ preventScroll: true }));
  }
}

function showMenuView(menu, viewName, { focus = true } = {}) {
  if (!menu) return;
  const views = Array.from(menu.querySelectorAll('[data-menu-view]'));
  views.forEach((view) => {
    const active = view.getAttribute('data-menu-view') === viewName;
    view.hidden = !active;
  });
  menu.dataset.menuView = viewName;
  if (!focus) return;
  const target = viewName === MENU_ROOT_VIEW
    ? menu.querySelector('[data-menu-view="root"] .inventory-more-menu__close')
    : menu.querySelector('[data-menu-view="account-data"] [data-menu-back]');
  if (target instanceof HTMLElement) {
    window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }
}

function openMenu(menu, menuMagnet) {
  if (!menu) return;
  showMenuView(menu, MENU_ROOT_VIEW, { focus: false });
  if (typeof menu.showPopover === 'function') {
    menu.showPopover();
  } else {
    menu.hidden = false;
    menu.setAttribute('data-open', 'true');
  }
  menuMagnet?.setAttribute('aria-expanded', 'true');
  const closeButton = menu.querySelector('[data-menu-view="root"] .inventory-more-menu__close');
  if (closeButton instanceof HTMLElement) {
    window.requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
  }
}

function isMenuOpen(menu) {
  if (!menu) return false;
  if (typeof menu.showPopover === 'function' && typeof menu.matches === 'function') {
    try {
      return menu.matches(':popover-open');
    } catch (error) {
      return false;
    }
  }
  return menu.getAttribute('data-open') === 'true';
}

function toggleMenu(menu, menuMagnet) {
  if (isMenuOpen(menu)) closeMenu(menu, menuMagnet);
  else openMenu(menu, menuMagnet);
}

function prepareInventoryExperience(rootUrl) {
  if (!isInventoryWorkspace(rootUrl)) return;

  const emailButton = document.querySelector('#inventory-email-personal');
  if (emailButton instanceof HTMLElement) {
    emailButton.remove();
  }

  const inventoryMessage = document.querySelector('.inventory-main > .inventory-actions [data-inventory-message]');
  if (inventoryMessage instanceof HTMLElement) {
    inventoryMessage.remove();
    inventoryMessage.classList.add('inventory-page__status');
    const main = document.querySelector('.inventory-main');
    if (main instanceof HTMLElement) main.prepend(inventoryMessage);
  }

  document.querySelector('.inventory-header .inventory-journal-button')?.remove();
  document.querySelector('.inventory-header .inventory-shared-button')?.remove();
  document.querySelector('.inventory-bluesky-panel')?.remove();
  document.querySelector('.inventory-main > .inventory-actions')?.remove();
}

function triggerCustomizer() {
  const control = document.querySelector('.site-nav [data-palette-toggle]');
  if (!(control instanceof HTMLElement)) return false;
  control.click();
  return true;
}

function syncInventoryCount(menu, nav) {
  const source = nav?.querySelector('[data-inventory-count]');
  const target = menu?.querySelector('[data-menu-inventory-count]');
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return;

  const update = () => {
    const value = (source.textContent || '').trim();
    target.textContent = value;
    target.hidden = source.hidden || !value;
    target.setAttribute('aria-label', value ? `${value} saved` : '');
  };
  update();

  const observer = new MutationObserver(update);
  observer.observe(source, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
}

function syncAccountStatus(menu) {
  const status = menu?.querySelector('[data-menu-account-status]');
  if (!(status instanceof HTMLElement)) return;

  const update = (session = window.allneedsSession) => {
    const handle = session?.handle || session?.preferred_username || session?.username || '';
    status.textContent = handle ? `Signed in as @${String(handle).replace(/^@/, '')}` : 'Stored on this device';
  };

  update();
  window.addEventListener('allneeds:bsky-login-changed', (event) => update(event?.detail || window.allneedsSession));
}

function ensureBlueskyModule(rootUrl) {
  if (document.querySelector('script[src*="inventory-bluesky.js"]')) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = toSiteUrl(rootUrl, 'scripts/inventory-bluesky.js?v=2026-08-19-menu');
  script.dataset.menuBlueskyModule = 'true';
  document.body.appendChild(script);
}

function invokeInventoryControl(name, ...args) {
  const fn = typeof window !== 'undefined' ? window[name] : null;
  if (typeof fn !== 'function') {
    console.warn(`Account & data action unavailable: ${name}`);
    return false;
  }
  fn(...args);
  return true;
}

function setAccountDataStatus(menu, message) {
  if (!message) return;
  if (invokeInventoryControl('setBackendStatusMessage', message)) return;
  const status = menu?.querySelector('[data-backend-sync-status]');
  if (status instanceof HTMLElement) status.textContent = message;
}

function setupAccountDataControls(menu) {
  if (!(menu instanceof HTMLElement)) return;

  const exportButton = menu.querySelector('#inventory-export');
  if (exportButton instanceof HTMLElement && exportButton.dataset.accountDataBound !== 'true') {
    exportButton.dataset.accountDataBound = 'true';
    exportButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      invokeInventoryControl('handleExportInventory');
    });
  }

  const importTrigger = menu.querySelector('#inventory-import-trigger');
  const importInput = menu.querySelector('#inventory-import');
  if (
    importTrigger instanceof HTMLElement &&
    importInput instanceof HTMLInputElement &&
    importTrigger.dataset.accountDataBound !== 'true'
  ) {
    importTrigger.dataset.accountDataBound = 'true';
    importTrigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      importInput.click();
    });
    importInput.addEventListener('change', (event) => {
      event.stopImmediatePropagation();
      const file = event.target?.files?.[0];
      if (!file) return;
      invokeInventoryControl('handleImportInventory', file);
      importInput.value = '';
    });
  }

  const backendSaveButton = menu.querySelector('[data-backend-save-button]');
  if (backendSaveButton instanceof HTMLElement && backendSaveButton.dataset.accountDataBound !== 'true') {
    backendSaveButton.dataset.accountDataBound = 'true';
    backendSaveButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (backendSaveButton.getAttribute('aria-disabled') === 'true') {
        setAccountDataStatus(menu, 'Sign in with Bluesky in Account & data to save to your profile.');
        return;
      }
      invokeInventoryControl('saveSnapshotToBackend');
    });
  }

  const backendLoadButton = menu.querySelector('[data-backend-load-button]');
  if (backendLoadButton instanceof HTMLElement && backendLoadButton.dataset.accountDataBound !== 'true') {
    backendLoadButton.dataset.accountDataBound = 'true';
    backendLoadButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (backendLoadButton.getAttribute('aria-disabled') === 'true') {
        setAccountDataStatus(menu, 'Sign in with Bluesky in Account & data to load your profile.');
        return;
      }
      invokeInventoryControl('loadSnapshotFromBackend');
    });
  }
}

function setupPersonalShareControls(menu) {
  if (!(menu instanceof HTMLElement)) return;

  const shareButton = menu.querySelector('[data-menu-action="share-with-nat"]');
  const emailButton = menu.querySelector('[data-menu-action="email-nat"]');
  const status = menu.querySelector('[data-menu-personal-status]');

  const setStatus = (message) => {
    if (!(status instanceof HTMLElement)) return;
    status.textContent = message || '';
    status.hidden = !message;
  };

  if (shareButton instanceof HTMLElement && shareButton.dataset.personalShareBound !== 'true') {
    shareButton.dataset.personalShareBound = 'true';
    shareButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const buildPayload = typeof window !== 'undefined' ? window.buildPersonalStrategiesExportPayload : null;
      if (typeof buildPayload !== 'function') {
        setStatus('Sharing is unavailable right now.');
        return;
      }

      let strategies = [];
      try {
        const payload = buildPayload();
        strategies = Array.isArray(payload?.personalStrategies) ? payload.personalStrategies : [];
      } catch (error) {
        console.warn('Unable to prepare personal strategies for sharing', error);
        setStatus('Couldn’t prepare your strategies right now.');
        return;
      }

      if (!strategies.length) {
        setStatus('Add a personal strategy first, then come back here to share it.');
        if (emailButton instanceof HTMLElement) emailButton.hidden = true;
        return;
      }

      if (!invokeInventoryControl('handleEmailPersonalStrategies')) {
        setStatus('Couldn’t prepare your strategies right now.');
        return;
      }

      setStatus('Your strategies file downloaded. Attach it to the email to Nat.');
      if (emailButton instanceof HTMLElement) emailButton.hidden = false;
    });
  }

  if (emailButton instanceof HTMLElement && emailButton.dataset.personalShareBound !== 'true') {
    emailButton.dataset.personalShareBound = 'true';
    emailButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      invokeInventoryControl('openPersonalStrategiesEmailDraft');
    });
  }
}

function installReliableMenuActivation(menuMagnet, menu) {
  let pointerStart = null;
  let pointerActivatedAt = 0;

  menuMagnet.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  });

  menuMagnet.addEventListener('pointerup', (event) => {
    if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (distance > TAP_MOVE_THRESHOLD) return;
    pointerActivatedAt = performance.now();
    toggleMenu(menu, menuMagnet);
  });

  menuMagnet.addEventListener('pointercancel', () => {
    pointerStart = null;
  });

  menuMagnet.addEventListener('click', (event) => {
    if (performance.now() - pointerActivatedAt < 500) {
      event.preventDefault();
      return;
    }
    toggleMenu(menu, menuMagnet);
  });

  menuMagnet.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    pointerActivatedAt = performance.now();
    toggleMenu(menu, menuMagnet);
  });
}

function initSharedMoreMagnet() {
  const nav = getNav();
  const board = nav?.querySelector('[data-magnet-board]');
  if (!nav || !board) return false;

  const menuMagnet = board.querySelector(`[data-magnet-id="${MENU_MAGNET_ID}"]`);
  if (!(menuMagnet instanceof HTMLElement)) return false;

  menuMagnet.setAttribute('aria-label', 'Open menu');
  const hiddenLabel = menuMagnet.querySelector('.site-nav__magnet-label');
  if (hiddenLabel) hiddenLabel.textContent = 'Menu';

  const rootUrl = getSiteRootUrl(nav);
  prepareInventoryExperience(rootUrl);

  let menu = document.getElementById(MENU_ID);
  if (!(menu instanceof HTMLElement)) {
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'inventory-more-menu';
    menu.setAttribute('popover', 'auto');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'allneeds.app menu');
    menu.innerHTML = menuMarkup(nav, rootUrl);
    nav.appendChild(menu);
  }

  if (typeof menu.showPopover !== 'function') menu.hidden = true;

  syncInventoryCount(menu, nav);
  syncAccountStatus(menu);
  ensureBlueskyModule(rootUrl);
  setupAccountDataControls(menu);
  setupPersonalShareControls(menu);
  installReliableMenuActivation(menuMagnet, menu);

  menu.querySelectorAll('.inventory-more-menu__close').forEach((button) => {
    button.addEventListener('click', () => closeMenu(menu, menuMagnet));
  });

  menu.querySelector('[data-menu-drill="account-data"]')?.addEventListener('click', () => {
    showMenuView(menu, MENU_ACCOUNT_VIEW);
  });
  menu.querySelector('[data-menu-back]')?.addEventListener('click', () => {
    showMenuView(menu, MENU_ROOT_VIEW);
  });

  menu.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', () => closeMenu(menu, menuMagnet, { restoreFocus: false }));
  });

  menu.querySelector('[data-menu-action="journal"]')?.addEventListener('click', () => {
    closeMenu(menu, menuMagnet, { restoreFocus: false });
  });

  menu.querySelector('[data-menu-action="customizer"]')?.addEventListener('click', () => {
    closeMenu(menu, menuMagnet, { restoreFocus: false });
    window.requestAnimationFrame(() => triggerCustomizer());
  });

  menu.addEventListener('toggle', () => {
    const open = isMenuOpen(menu);
    menuMagnet.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) showMenuView(menu, MENU_ROOT_VIEW, { focus: false });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMenuOpen(menu) && typeof menu.hidePopover !== 'function') {
      closeMenu(menu, menuMagnet);
    }
  });

  return true;
}

if (!initSharedMoreMagnet() && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSharedMoreMagnet, { once: true });
}