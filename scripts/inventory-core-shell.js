const MENU_ID = 'nav-more-menu';
const MENU_MAGNET_ID = 'nav-menu';
const NAV_SETTINGS_KEY = 'nvcApp.navSettings';
const NAV_LAYOUT_KEY = 'magnetPositions:site-nav';
const NAV_MIGRATION_KEY = 'allneeds.navMore.v1';
const CORE_ORDER = [
  'nav-menu',
  'nav-home',
  'nav-observations',
  'nav-feelings',
  'nav-needs',
  'nav-customizer',
];

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

function isInventoryWorkspace(rootUrl) {
  try {
    const inventoryUrl = new URL('inventory/', rootUrl);
    const current = new URL(window.location.href);
    return current.pathname.replace(/index\.html$/i, '') === inventoryUrl.pathname;
  } catch (error) {
    return /\/inventory\/(?:index\.html)?$/i.test(window.location.pathname || '');
  }
}

function createMenuMagnet() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pill magnet site-nav__magnet site-nav__magnet--menu';
  button.dataset.magnetId = MENU_MAGNET_ID;
  button.setAttribute('aria-label', 'Open More menu');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', MENU_ID);
  button.innerHTML = `
    <svg class="site-nav__menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16M4 12h16M4 17h16"></path>
    </svg>
    <span class="site-nav__magnet-label visually-hidden">More</span>`;
  return button;
}

function readNavSettings() {
  const storages = [];
  try {
    if (window.localStorage) storages.push(window.localStorage);
  } catch (error) {
    // Ignore unavailable storage.
  }
  try {
    if (window.sessionStorage) storages.push(window.sessionStorage);
  } catch (error) {
    // Ignore unavailable storage.
  }

  for (const storage of storages) {
    try {
      const raw = storage.getItem(NAV_SETTINGS_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (error) {
      // Try the next storage source.
    }
  }
  return {};
}

function writeNavSettings(settings) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(NAV_SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch (error) {
    // Navigation still works without persisted preferences.
  }
}

function setMagnetVisible(magnet, visible) {
  if (!(magnet instanceof HTMLElement)) return;

  if (visible) {
    magnet.removeAttribute('data-nav-hidden');
    magnet.removeAttribute('aria-hidden');
    if (magnet.dataset.navStoredTabIndex != null) {
      const stored = magnet.dataset.navStoredTabIndex;
      if (stored) {
        magnet.setAttribute('tabindex', stored);
      } else {
        magnet.removeAttribute('tabindex');
      }
      delete magnet.dataset.navStoredTabIndex;
    } else {
      magnet.removeAttribute('tabindex');
    }
    return;
  }

  if (magnet.dataset.navStoredTabIndex == null) {
    magnet.dataset.navStoredTabIndex = magnet.getAttribute('tabindex') || '';
  }
  magnet.setAttribute('tabindex', '-1');
  magnet.setAttribute('data-nav-hidden', 'true');
  magnet.setAttribute('aria-hidden', 'true');
}

function migrateSharedNav(nav) {
  let migrated = false;
  try {
    migrated = window.localStorage?.getItem(NAV_MIGRATION_KEY) === '1';
  } catch (error) {
    // Treat inaccessible storage like a fresh session.
  }

  const settings = readNavSettings();
  settings.enabled = settings.enabled && typeof settings.enabled === 'object'
    ? { ...settings.enabled }
    : {};

  if (!migrated) {
    // The new core board intentionally keeps the immediate self-investigation
    // doors tangible. Inventory and Journal remain first-class destinations in
    // More and can still be re-enabled as magnets through the Customizer.
    settings.enabled.home = true;
    settings.enabled.customizer = true;
    settings.enabled.observations = true;
    settings.enabled.feelings = true;
    settings.enabled.needs = true;
    settings.enabled.journal = false;
    settings.enabled.inventory = false;
    settings.updatedAt = Date.now();
    writeNavSettings(settings);

    // Existing saved layouts predate nav-menu. Clearing only the shared nav
    // positions forces one canonical repack; the newly packed board is then
    // persisted under the same site-nav key and restored on every page.
    try {
      window.localStorage?.removeItem(NAV_LAYOUT_KEY);
      window.localStorage?.setItem(NAV_MIGRATION_KEY, '1');
    } catch (error) {
      // A fresh in-memory pack still occurs when storage is unavailable.
    }
  }

  const enabled = settings.enabled || {};
  const journal = nav.querySelector('[data-magnet-id="nav-journal"]');
  const inventory = nav.querySelector('[data-magnet-id="nav-inventory"]');
  setMagnetVisible(journal, enabled.journal === true);
  setMagnetVisible(inventory, enabled.inventory === true);
}

function enforceCanonicalDomOrder(board) {
  if (!board) return;
  const original = Array.from(board.querySelectorAll('.magnet'));
  const moved = new Set();

  CORE_ORDER.forEach((id) => {
    const magnet = board.querySelector(`[data-magnet-id="${id}"]`);
    if (!magnet) return;
    board.appendChild(magnet);
    moved.add(magnet);
  });

  original.forEach((magnet) => {
    if (!moved.has(magnet)) {
      board.appendChild(magnet);
    }
  });
}

function menuMarkup(rootUrl) {
  const inventoryHref = toSiteUrl(rootUrl, 'inventory/');
  const journalHistoryHref = toSiteUrl(rootUrl, 'inventory/journal/');
  const supportHref = toSiteUrl(rootUrl, 'alexithymia-support/');
  const bodyCuesHref = toSiteUrl(rootUrl, 'feelings/body-cues/');
  const fauxFeelingsHref = toSiteUrl(rootUrl, 'faux-feelings/');
  const sharedHref = toSiteUrl(rootUrl, 'feed/');

  return `
    <div class="inventory-more-menu__inner">
      <header class="inventory-more-menu__header">
        <div>
          <p class="inventory-more-menu__eyebrow">allneeds.app</p>
          <h2 class="inventory-more-menu__title">More</h2>
          <p class="inventory-more-menu__intro">Your navigation magnets stay present. This drawer holds deeper tools and settings.</p>
        </div>
        <button class="inventory-more-menu__close" type="button" aria-label="Close More menu">×</button>
      </header>

      <section class="inventory-more-menu__section" aria-labelledby="nav-more-core-heading">
        <h3 id="nav-more-core-heading" class="inventory-more-menu__section-title">Your tools</h3>
        <a class="inventory-more-menu__row" href="${inventoryHref}">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Strategy inventory</span>
            <span class="inventory-more-menu__row-note">Your saved ways to care for your needs</span>
          </span>
          <span aria-hidden="true">›</span>
        </a>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="journal">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Journal</span>
            <span class="inventory-more-menu__row-note">Log what is present right now</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="add-strategy">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Add a strategy</span>
            <span class="inventory-more-menu__row-note">Add something that helps tend to a need</span>
          </span>
          <span aria-hidden="true">＋</span>
        </button>
      </section>

      <section class="inventory-more-menu__section" aria-labelledby="nav-more-checkin-heading">
        <h3 id="nav-more-checkin-heading" class="inventory-more-menu__section-title">Check in</h3>
        <a class="inventory-more-menu__row" href="${supportHref}">
          <span class="inventory-more-menu__row-copy"><span class="inventory-more-menu__row-title">Guided support</span><span class="inventory-more-menu__row-note">A step-by-step check-in</span></span><span aria-hidden="true">›</span>
        </a>
        <a class="inventory-more-menu__row" href="${bodyCuesHref}">
          <span class="inventory-more-menu__row-copy"><span class="inventory-more-menu__row-title">Body cues</span><span class="inventory-more-menu__row-note">Start with what you notice in your body</span></span><span aria-hidden="true">›</span>
        </a>
      </section>

      <section class="inventory-more-menu__section" aria-labelledby="nav-more-explore-heading">
        <h3 id="nav-more-explore-heading" class="inventory-more-menu__section-title">Explore &amp; reflect</h3>
        <a class="inventory-more-menu__row" href="${fauxFeelingsHref}"><span class="inventory-more-menu__row-title">Faux feelings</span><span aria-hidden="true">›</span></a>
        <a class="inventory-more-menu__row" href="${journalHistoryHref}"><span class="inventory-more-menu__row-title">Journal history</span><span aria-hidden="true">›</span></a>
        <a class="inventory-more-menu__row" href="${sharedHref}"><span class="inventory-more-menu__row-title">Shared strategies</span><span aria-hidden="true">›</span></a>
      </section>

      <section class="inventory-more-menu__section" aria-labelledby="nav-more-settings-heading">
        <h3 id="nav-more-settings-heading" class="inventory-more-menu__section-title">Settings</h3>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="customizer">
          <span class="inventory-more-menu__row-copy"><span class="inventory-more-menu__row-title">Appearance &amp; navigation</span><span class="inventory-more-menu__row-note">Open the Customizer</span></span><span aria-hidden="true">›</span>
        </button>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="sync">
          <span class="inventory-more-menu__row-title">Sync &amp; account</span><span aria-hidden="true">›</span>
        </button>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="backup">
          <span class="inventory-more-menu__row-title">Backup &amp; restore</span><span aria-hidden="true">›</span>
        </button>
      </section>
    </div>`;
}

function closeMenu(menu, menuMagnet) {
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
}

function openMenu(menu, menuMagnet) {
  if (!menu) return;
  if (typeof menu.showPopover === 'function') {
    menu.showPopover();
  } else {
    menu.hidden = false;
    menu.setAttribute('data-open', 'true');
  }
  menuMagnet?.setAttribute('aria-expanded', 'true');
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

function proxyMagnet(selector) {
  const control = document.querySelector(selector);
  if (control instanceof HTMLElement) {
    control.click();
    return true;
  }
  return false;
}

function afterMenuClose(callback) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
}

function prepareInventoryUtilities(rootUrl) {
  if (!isInventoryWorkspace(rootUrl)) return;

  const main = document.querySelector('.inventory-main');
  const syncPanel = document.querySelector('.inventory-bluesky-panel');
  if (syncPanel && main) {
    syncPanel.id = 'inventory-sync-settings';
    syncPanel.classList.add('inventory-settings-panel');
    main.appendChild(syncPanel);
  }

  const backup = document.querySelector('.inventory-actions--collapsible');
  if (backup) backup.id = 'inventory-backup-settings';

  document.querySelector('.inventory-journal-button')?.remove();
  document.querySelector('.inventory-shared-button')?.remove();
}

function openInventoryPanel(selector) {
  const panel = document.querySelector(selector);
  if (!(panel instanceof HTMLElement)) return false;
  if (panel instanceof HTMLDetailsElement) panel.open = true;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

function goToInventoryCommand(rootUrl, key, value) {
  const url = new URL('inventory/', rootUrl);
  url.searchParams.set(key, value);
  window.location.href = url.href;
}

function handleInventoryArrival(rootUrl) {
  if (!isInventoryWorkspace(rootUrl)) return;
  const params = new URL(window.location.href).searchParams;
  const action = params.get('action');
  const settings = params.get('settings');
  if (!action && !settings) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (action === 'add-strategy') {
        const add = document.querySelector('.inventory-header [data-inventory-form-open]');
        if (add instanceof HTMLElement) add.click();
      } else if (settings === 'sync') {
        openInventoryPanel('#inventory-sync-settings');
      } else if (settings === 'backup') {
        openInventoryPanel('#inventory-backup-settings');
      }
    });
  });
}

function initSharedMoreMagnet() {
  const nav = getNav();
  const board = nav?.querySelector('[data-magnet-board]');
  if (!nav || !board) return false;

  let menuMagnet = board.querySelector(`[data-magnet-id="${MENU_MAGNET_ID}"]`);
  if (!(menuMagnet instanceof HTMLElement)) {
    menuMagnet = createMenuMagnet();
    const home = board.querySelector('[data-magnet-id="nav-home"]');
    board.insertBefore(menuMagnet, home || board.firstChild);
  }

  migrateSharedNav(nav);
  enforceCanonicalDomOrder(board);

  const rootUrl = getSiteRootUrl(nav);
  prepareInventoryUtilities(rootUrl);

  let menu = document.getElementById(MENU_ID);
  if (!(menu instanceof HTMLElement)) {
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'inventory-more-menu';
    menu.setAttribute('popover', 'auto');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'More tools and settings');
    menu.innerHTML = menuMarkup(rootUrl);
    nav.appendChild(menu);
  }

  if (typeof menu.showPopover !== 'function') menu.hidden = true;

  const closeButton = menu.querySelector('.inventory-more-menu__close');
  menuMagnet.addEventListener('click', () => {
    if (isMenuOpen(menu)) closeMenu(menu, menuMagnet);
    else openMenu(menu, menuMagnet);
  });
  closeButton?.addEventListener('click', () => closeMenu(menu, menuMagnet));
  menu.addEventListener('toggle', () => {
    menuMagnet.setAttribute('aria-expanded', isMenuOpen(menu) ? 'true' : 'false');
  });
  menu.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', () => closeMenu(menu, menuMagnet));
  });

  menu.querySelectorAll('[data-core-command]').forEach((button) => {
    button.addEventListener('click', () => {
      const command = button.getAttribute('data-core-command');
      closeMenu(menu, menuMagnet);

      afterMenuClose(() => {
        if (command === 'journal') {
          proxyMagnet('.site-nav [data-magnet-id="nav-journal"]');
          return;
        }
        if (command === 'customizer') {
          proxyMagnet('.site-nav [data-magnet-id="nav-customizer"]');
          return;
        }
        if (command === 'add-strategy') {
          if (isInventoryWorkspace(rootUrl)) {
            const add = document.querySelector('.inventory-header [data-inventory-form-open]');
            if (add instanceof HTMLElement) add.click();
          } else {
            goToInventoryCommand(rootUrl, 'action', 'add-strategy');
          }
          return;
        }
        if (command === 'sync') {
          if (!openInventoryPanel('#inventory-sync-settings')) {
            goToInventoryCommand(rootUrl, 'settings', 'sync');
          }
          return;
        }
        if (command === 'backup' && !openInventoryPanel('#inventory-backup-settings')) {
          goToInventoryCommand(rootUrl, 'settings', 'backup');
        }
      });
    });
  });

  handleInventoryArrival(rootUrl);
  return true;
}

// Loaded before the shared magnet module. Deferred execution means the page DOM
// already exists, so nav-menu becomes a real board child before magnets.js takes
// its first measurement on every route.
if (!initSharedMoreMagnet() && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSharedMoreMagnet, { once: true });
}
