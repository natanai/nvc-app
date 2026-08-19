const INVENTORY_PATH_RE = /\/inventory\/(?:index\.html)?$/i;

function isInventoryWorkspace() {
  return typeof window !== 'undefined' && INVENTORY_PATH_RE.test(window.location?.pathname || '');
}

function menuMarkup() {
  return `
    <div class="inventory-app-shell__bar">
      <button class="inventory-app-shell__menu-button" type="button" aria-label="Open app menu" aria-expanded="false" aria-controls="inventory-app-menu">
        <svg class="inventory-app-shell__menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7h16M4 12h16M4 17h16"></path>
        </svg>
      </button>
      <a class="inventory-app-shell__brand" href="../" aria-label="Home — choose a doorway">allneeds.app</a>
      <button class="inventory-app-shell__journal-button" type="button" aria-label="Open journal">
        <img class="inventory-app-shell__journal-icon" src="../icons/journal-32bit.svg" alt="" aria-hidden="true" />
      </button>
    </div>

    <div id="inventory-app-menu" class="inventory-app-menu" popover="auto" aria-label="App menu">
      <div class="inventory-app-menu__inner">
        <header class="inventory-app-menu__header">
          <div>
            <p class="inventory-app-menu__eyebrow">allneeds.app</p>
            <h2 class="inventory-app-menu__title">Menu</h2>
          </div>
          <button class="inventory-app-menu__close" type="button" aria-label="Close app menu">×</button>
        </header>

        <a class="inventory-app-menu__home" href="../">
          <span class="inventory-app-menu__home-copy">
            <span class="inventory-app-menu__home-title">Home</span>
            <span class="inventory-app-menu__home-note">Choose Observations, Feelings, or Needs</span>
          </span>
          <span aria-hidden="true">›</span>
        </a>

        <section class="inventory-app-menu__section inventory-app-menu__section--inventory" aria-labelledby="inventory-menu-inventory-heading">
          <h3 id="inventory-menu-inventory-heading" class="inventory-app-menu__section-title">My inventory</h3>
          <a class="inventory-app-menu__primary" href="./" aria-current="page">
            <span class="inventory-app-menu__row-copy">
              <span class="inventory-app-menu__row-title">Strategy inventory</span>
              <span class="inventory-app-menu__row-note">Your saved ways to care for your needs</span>
            </span>
            <span aria-hidden="true">›</span>
          </a>
          <button class="inventory-app-menu__button" type="button" data-core-command="add-strategy">
            <span class="inventory-app-menu__row-title">Add a strategy</span>
            <span aria-hidden="true">＋</span>
          </button>
        </section>

        <section class="inventory-app-menu__section" aria-labelledby="inventory-menu-checkin-heading">
          <h3 id="inventory-menu-checkin-heading" class="inventory-app-menu__section-title">Check in</h3>
          <a class="inventory-app-menu__row" href="../alexithymia-support/"><span class="inventory-app-menu__row-title">Guided support</span><span aria-hidden="true">›</span></a>
          <a class="inventory-app-menu__row" href="../feelings/body-cues/"><span class="inventory-app-menu__row-title">Body cues</span><span aria-hidden="true">›</span></a>
          <a class="inventory-app-menu__row" href="../observations/"><span class="inventory-app-menu__row-title">Observations</span><span aria-hidden="true">›</span></a>
        </section>

        <section class="inventory-app-menu__section" aria-labelledby="inventory-menu-explore-heading">
          <h3 id="inventory-menu-explore-heading" class="inventory-app-menu__section-title">Explore</h3>
          <a class="inventory-app-menu__row" href="../feelings/"><span class="inventory-app-menu__row-title">Feelings</span><span aria-hidden="true">›</span></a>
          <a class="inventory-app-menu__row" href="../needs/"><span class="inventory-app-menu__row-title">Needs</span><span aria-hidden="true">›</span></a>
          <a class="inventory-app-menu__row" href="../faux-feelings/"><span class="inventory-app-menu__row-title">Faux feelings</span><span aria-hidden="true">›</span></a>
        </section>

        <section class="inventory-app-menu__section" aria-labelledby="inventory-menu-reflect-heading">
          <h3 id="inventory-menu-reflect-heading" class="inventory-app-menu__section-title">Reflect &amp; discover</h3>
          <button class="inventory-app-menu__button" type="button" data-core-command="journal"><span class="inventory-app-menu__row-title">Journal</span><span aria-hidden="true">›</span></button>
          <a class="inventory-app-menu__row" href="./journal/"><span class="inventory-app-menu__row-title">Journal history</span><span aria-hidden="true">›</span></a>
          <a class="inventory-app-menu__row" href="../feed/"><span class="inventory-app-menu__row-title">Shared strategies</span><span aria-hidden="true">›</span></a>
        </section>

        <details class="inventory-app-menu__settings">
          <summary><span>Settings</span><span class="inventory-app-menu__settings-chevron" aria-hidden="true">›</span></summary>
          <div class="inventory-app-menu__settings-body">
            <button class="inventory-app-menu__button" type="button" data-core-command="customizer">
              <span class="inventory-app-menu__row-copy">
                <span class="inventory-app-menu__row-title">Appearance &amp; navigation</span>
                <span class="inventory-app-menu__row-note">Open the Customizer</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
            <a class="inventory-app-menu__row" href="#inventory-sync-settings"><span class="inventory-app-menu__row-title">Sync &amp; account</span><span aria-hidden="true">›</span></a>
            <a class="inventory-app-menu__row" href="#inventory-backup-settings"><span class="inventory-app-menu__row-title">Backup &amp; restore</span><span aria-hidden="true">›</span></a>
          </div>
        </details>
      </div>
    </div>`;
}

function closeMenu(menu, menuButton) {
  if (!menu) return;
  if (typeof menu.hidePopover === 'function') {
    try {
      menu.hidePopover();
    } catch (error) {
      // Ignore a no-op hide when the popover is already closed.
    }
  } else {
    menu.removeAttribute('data-open');
    menu.hidden = true;
  }
  menuButton?.setAttribute('aria-expanded', 'false');
}

function openMenu(menu, menuButton) {
  if (!menu) return;
  if (typeof menu.showPopover === 'function') {
    menu.showPopover();
  } else {
    menu.hidden = false;
    menu.setAttribute('data-open', 'true');
  }
  menuButton?.setAttribute('aria-expanded', 'true');
}

function proxyLegacyControl(selector) {
  const control = document.querySelector(selector);
  if (control instanceof HTMLElement) {
    control.click();
    return true;
  }
  return false;
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

  const title = document.querySelector('.inventory-header .page-title');
  if (title) {
    title.textContent = 'My inventory';
  }

  document.querySelector('.inventory-journal-button')?.remove();
  document.querySelector('.inventory-shared-button')?.remove();
}

function initInventoryCoreShell() {
  if (!isInventoryWorkspace() || document.querySelector('.inventory-app-shell')) {
    return;
  }

  const wrapper = document.querySelector('.page-wrapper');
  const legacyNav = wrapper?.querySelector(':scope > .site-nav');
  if (!wrapper || !legacyNav) {
    return;
  }

  const shell = document.createElement('nav');
  shell.className = 'inventory-app-shell';
  shell.setAttribute('aria-label', 'Application');
  shell.innerHTML = menuMarkup();
  wrapper.insertBefore(shell, legacyNav);

  prepareInventoryUtilities();

  const menu = shell.querySelector('#inventory-app-menu');
  const menuButton = shell.querySelector('.inventory-app-shell__menu-button');
  const closeButton = shell.querySelector('.inventory-app-menu__close');
  const journalButton = shell.querySelector('.inventory-app-shell__journal-button');

  if (menu && typeof menu.showPopover !== 'function') {
    menu.hidden = true;
  }

  menuButton?.addEventListener('click', () => {
    const isOpen = typeof menu?.matches === 'function' && menu.matches(':popover-open');
    const fallbackOpen = menu?.getAttribute('data-open') === 'true';
    if (isOpen || fallbackOpen) {
      closeMenu(menu, menuButton);
    } else {
      openMenu(menu, menuButton);
    }
  });

  closeButton?.addEventListener('click', () => closeMenu(menu, menuButton));
  menu?.addEventListener('toggle', () => {
    const open = menu.matches(':popover-open');
    menuButton?.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  journalButton?.addEventListener('click', () => {
    proxyLegacyControl('.site-nav [data-support-journal-open]');
  });

  shell.querySelectorAll('[data-core-command]').forEach((button) => {
    button.addEventListener('click', () => {
      const command = button.getAttribute('data-core-command');
      closeMenu(menu, menuButton);

      if (command === 'journal') {
        proxyLegacyControl('.site-nav [data-support-journal-open]');
        return;
      }
      if (command === 'customizer') {
        proxyLegacyControl('.site-nav [data-palette-toggle]');
        return;
      }
      if (command === 'add-strategy') {
        const addButton = document.querySelector('.inventory-header [data-inventory-form-open]');
        if (addButton instanceof HTMLElement) {
          addButton.click();
        }
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInventoryCoreShell, { once: true });
} else {
  initInventoryCoreShell();
}
