const INVENTORY_PATH_RE = /\/inventory\/(?:index\.html)?$/i;
const MENU_ID = 'inventory-more-menu';
const MENU_MAGNET_ID = 'nav-menu';

function isInventoryWorkspace() {
  return typeof window !== 'undefined' && INVENTORY_PATH_RE.test(window.location?.pathname || '');
}

function menuMarkup() {
  return `
    <div class="inventory-more-menu__inner">
      <header class="inventory-more-menu__header">
        <div>
          <p class="inventory-more-menu__eyebrow">allneeds.app</p>
          <h2 class="inventory-more-menu__title">More</h2>
          <p class="inventory-more-menu__intro">Extra tools and settings. Your main navigation stays on the magnet board.</p>
        </div>
        <button class="inventory-more-menu__close" type="button" aria-label="Close More menu">×</button>
      </header>

      <section class="inventory-more-menu__section" aria-labelledby="inventory-more-tools-heading">
        <h3 id="inventory-more-tools-heading" class="inventory-more-menu__section-title">More tools</h3>
        <a class="inventory-more-menu__row" href="../alexithymia-support/">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Guided support</span>
            <span class="inventory-more-menu__row-note">A step-by-step check-in</span>
          </span>
          <span aria-hidden="true">›</span>
        </a>
        <a class="inventory-more-menu__row" href="../feelings/body-cues/">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Body cues</span>
            <span class="inventory-more-menu__row-note">Start with what you notice in your body</span>
          </span>
          <span aria-hidden="true">›</span>
        </a>
        <a class="inventory-more-menu__row" href="../faux-feelings/">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Faux feelings</span>
            <span class="inventory-more-menu__row-note">Trace evaluative language toward feelings and needs</span>
          </span>
          <span aria-hidden="true">›</span>
        </a>
      </section>

      <section class="inventory-more-menu__section" aria-labelledby="inventory-more-reflect-heading">
        <h3 id="inventory-more-reflect-heading" class="inventory-more-menu__section-title">Reflect &amp; discover</h3>
        <a class="inventory-more-menu__row" href="./journal/">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Journal history</span>
            <span class="inventory-more-menu__row-note">Review previous check-ins and patterns</span>
          </span>
          <span aria-hidden="true">›</span>
        </a>
        <a class="inventory-more-menu__row" href="../feed/">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Shared strategies</span>
            <span class="inventory-more-menu__row-note">Browse strategies other people have shared</span>
          </span>
          <span aria-hidden="true">›</span>
        </a>
      </section>

      <section class="inventory-more-menu__section" aria-labelledby="inventory-more-inventory-heading">
        <h3 id="inventory-more-inventory-heading" class="inventory-more-menu__section-title">Inventory tools</h3>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="add-strategy">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Add a strategy</span>
            <span class="inventory-more-menu__row-note">Open the personal strategy form</span>
          </span>
          <span aria-hidden="true">＋</span>
        </button>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="sync">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Sync &amp; account</span>
            <span class="inventory-more-menu__row-note">Open optional Bluesky profile sync</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="backup">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Backup &amp; restore</span>
            <span class="inventory-more-menu__row-note">Export or import your local data</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <section class="inventory-more-menu__section" aria-labelledby="inventory-more-settings-heading">
        <h3 id="inventory-more-settings-heading" class="inventory-more-menu__section-title">Settings</h3>
        <button class="inventory-more-menu__row inventory-more-menu__button" type="button" data-core-command="customizer">
          <span class="inventory-more-menu__row-copy">
            <span class="inventory-more-menu__row-title">Appearance &amp; navigation</span>
            <span class="inventory-more-menu__row-note">Open the existing Customizer</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </section>
    </div>`;
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

function proxyLegacyControl(selector) {
  const control = document.querySelector(selector);
  if (control instanceof HTMLElement) {
    control.click();
    return true;
  }
  return false;
}

function afterMenuClose(callback) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback);
  });
}

function openSettingsPanel(selector) {
  const panel = document.querySelector(selector);
  if (!(panel instanceof HTMLElement)) {
    return false;
  }
  if (panel instanceof HTMLDetailsElement) {
    panel.open = true;
  }
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

function prepareInventoryUtilities() {
  const main = document.querySelector('.inventory-main');
  const syncPanel = document.querySelector('.inventory-bluesky-panel');
  if (syncPanel && main) {
    syncPanel.id = 'inventory-sync-settings';
    syncPanel.classList.add('inventory-settings-panel');
    main.appendChild(syncPanel);
  }

  const backup = document.querySelector('.inventory-actions--collapsible');
  if (backup) {
    backup.id = 'inventory-backup-settings';
  }

  // These destinations remain available as tangible navigation objects or in
  // the More magnet. Removing the duplicate header promotions lets Inventory
  // begin with the workspace itself.
  document.querySelector('.inventory-journal-button')?.remove();
  document.querySelector('.inventory-shared-button')?.remove();
}

function initInventoryMoreMagnet() {
  if (!isInventoryWorkspace()) {
    return false;
  }

  const nav = document.querySelector('[data-magnet-root][data-magnet-key="site-nav"]');
  const board = nav?.querySelector('[data-magnet-board]');
  if (!nav || !board) {
    return false;
  }

  let menuMagnet = board.querySelector(`[data-magnet-id="${MENU_MAGNET_ID}"]`);
  if (!(menuMagnet instanceof HTMLElement)) {
    menuMagnet = createMenuMagnet();
    const homeMagnet = board.querySelector('[data-magnet-id="nav-home"]');
    if (homeMagnet?.nextSibling) {
      board.insertBefore(menuMagnet, homeMagnet.nextSibling);
    } else if (homeMagnet) {
      board.appendChild(menuMagnet);
    } else {
      board.insertBefore(menuMagnet, board.firstChild);
    }
  }

  let menu = document.getElementById(MENU_ID);
  if (!(menu instanceof HTMLElement)) {
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'inventory-more-menu';
    menu.setAttribute('popover', 'auto');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'More tools and settings');
    menu.innerHTML = menuMarkup();
    nav.appendChild(menu);
  }

  if (typeof menu.showPopover !== 'function') {
    menu.hidden = true;
  }

  prepareInventoryUtilities();

  const closeButton = menu.querySelector('.inventory-more-menu__close');

  menuMagnet.addEventListener('click', () => {
    if (isMenuOpen(menu)) {
      closeMenu(menu, menuMagnet);
    } else {
      openMenu(menu, menuMagnet);
    }
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
        if (command === 'customizer') {
          proxyLegacyControl('.site-nav [data-palette-toggle]');
          return;
        }
        if (command === 'add-strategy') {
          const addButton = document.querySelector('.inventory-header [data-inventory-form-open]');
          if (addButton instanceof HTMLElement) {
            addButton.click();
          }
          return;
        }
        if (command === 'sync') {
          openSettingsPanel('#inventory-sync-settings');
          return;
        }
        if (command === 'backup') {
          openSettingsPanel('#inventory-backup-settings');
        }
      });
    });
  });

  return true;
}

// Module scripts execute after the page markup has been parsed but before
// DOMContentLoaded in the normal build. Mount immediately so magnets.js sees
// the Menu magnet as part of the real board from its first measurement.
if (!initInventoryMoreMagnet() && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInventoryMoreMagnet, { once: true });
}
