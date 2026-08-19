export function renderInventoryAppShell(basePath = '') {
  const homeHref = basePath || './';

  return `<nav class="inventory-app-shell" aria-label="Application">
        <div class="inventory-app-shell__bar">
          <button
            class="inventory-app-shell__menu-button"
            type="button"
            popovertarget="inventory-app-menu"
            popovertargetaction="toggle"
            aria-label="Open app menu"
          >
            <svg class="inventory-app-shell__menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 7h16M4 12h16M4 17h16"></path>
            </svg>
          </button>

          <a class="inventory-app-shell__brand" href="${homeHref}" aria-label="Home — choose a doorway">allneeds.app</a>

          <button
            class="inventory-app-shell__journal-button"
            type="button"
            data-support-journal-open
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="global-support-journal-layer"
            aria-label="Open journal"
          >
            <img class="inventory-app-shell__journal-icon" src="${basePath}icons/journal-32bit.svg" alt="" aria-hidden="true" />
          </button>
        </div>

        <div id="inventory-app-menu" class="inventory-app-menu" popover="auto">
          <div class="inventory-app-menu__inner">
            <header class="inventory-app-menu__header">
              <div>
                <p class="inventory-app-menu__eyebrow">allneeds.app</p>
                <h2 class="inventory-app-menu__title">Menu</h2>
              </div>
              <button
                class="inventory-app-menu__close"
                type="button"
                popovertarget="inventory-app-menu"
                popovertargetaction="hide"
                aria-label="Close app menu"
              >×</button>
            </header>

            <a class="inventory-app-menu__home" href="${homeHref}">
              <span class="inventory-app-menu__home-copy">
                <span class="inventory-app-menu__home-title">Home</span>
                <span class="inventory-app-menu__home-note">Choose Observations, Feelings, or Needs</span>
              </span>
              <span aria-hidden="true">›</span>
            </a>

            <section class="inventory-app-menu__section inventory-app-menu__section--inventory" aria-labelledby="inventory-menu-inventory-heading">
              <h3 id="inventory-menu-inventory-heading" class="inventory-app-menu__section-title">My inventory</h3>
              <a class="inventory-app-menu__primary" href="${basePath}inventory/" aria-current="page">
                <span class="inventory-app-menu__row-copy">
                  <span class="inventory-app-menu__row-title">Strategy inventory</span>
                  <span class="inventory-app-menu__row-note">Your saved ways to care for your needs</span>
                </span>
                <span class="inventory-app-menu__count" data-inventory-count hidden></span>
              </a>
              <a class="inventory-app-menu__row" href="${basePath}inventory/#inventory-form" data-inventory-form-open>
                <span class="inventory-app-menu__row-title">Add a strategy</span>
                <span aria-hidden="true">＋</span>
              </a>
            </section>

            <section class="inventory-app-menu__section" aria-labelledby="inventory-menu-checkin-heading">
              <h3 id="inventory-menu-checkin-heading" class="inventory-app-menu__section-title">Check in</h3>
              <a class="inventory-app-menu__row" href="${basePath}alexithymia-support/">
                <span class="inventory-app-menu__row-title">Guided support</span><span aria-hidden="true">›</span>
              </a>
              <a class="inventory-app-menu__row" href="${basePath}feelings/body-cues/">
                <span class="inventory-app-menu__row-title">Body cues</span><span aria-hidden="true">›</span>
              </a>
              <a class="inventory-app-menu__row" href="${basePath}observations/">
                <span class="inventory-app-menu__row-title">Observations</span><span aria-hidden="true">›</span>
              </a>
            </section>

            <section class="inventory-app-menu__section" aria-labelledby="inventory-menu-explore-heading">
              <h3 id="inventory-menu-explore-heading" class="inventory-app-menu__section-title">Explore</h3>
              <a class="inventory-app-menu__row" href="${basePath}feelings/">
                <span class="inventory-app-menu__row-title">Feelings</span><span aria-hidden="true">›</span>
              </a>
              <a class="inventory-app-menu__row" href="${basePath}needs/">
                <span class="inventory-app-menu__row-title">Needs</span><span aria-hidden="true">›</span>
              </a>
              <a class="inventory-app-menu__row" href="${basePath}faux-feelings/">
                <span class="inventory-app-menu__row-title">Faux feelings</span><span aria-hidden="true">›</span>
              </a>
            </section>

            <section class="inventory-app-menu__section" aria-labelledby="inventory-menu-reflect-heading">
              <h3 id="inventory-menu-reflect-heading" class="inventory-app-menu__section-title">Reflect & discover</h3>
              <button
                class="inventory-app-menu__button"
                type="button"
                data-support-journal-open
                aria-haspopup="dialog"
                aria-expanded="false"
                aria-controls="global-support-journal-layer"
                popovertarget="inventory-app-menu"
                popovertargetaction="hide"
              >
                <span class="inventory-app-menu__row-title">Journal</span><span aria-hidden="true">›</span>
              </button>
              <a class="inventory-app-menu__row" href="${basePath}inventory/journal/">
                <span class="inventory-app-menu__row-title">Journal history</span><span aria-hidden="true">›</span>
              </a>
              <a class="inventory-app-menu__row" href="${basePath}feed/">
                <span class="inventory-app-menu__row-title">Shared strategies</span><span aria-hidden="true">›</span>
              </a>
            </section>

            <details class="inventory-app-menu__settings">
              <summary>
                <span>Settings</span>
                <span class="inventory-app-menu__settings-chevron" aria-hidden="true">›</span>
              </summary>
              <div class="inventory-app-menu__settings-body">
                <button
                  class="inventory-app-menu__button"
                  type="button"
                  data-palette-toggle
                  aria-haspopup="dialog"
                  aria-expanded="false"
                  popovertarget="inventory-app-menu"
                  popovertargetaction="hide"
                >
                  <span class="inventory-app-menu__row-copy">
                    <span class="inventory-app-menu__row-title">Appearance & navigation</span>
                    <span class="inventory-app-menu__row-note">Open the Customizer</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
                <a class="inventory-app-menu__row" href="${basePath}inventory/#inventory-sync-settings">
                  <span class="inventory-app-menu__row-title">Sync & account</span><span aria-hidden="true">›</span>
                </a>
                <a class="inventory-app-menu__row" href="${basePath}inventory/#inventory-backup-settings">
                  <span class="inventory-app-menu__row-title">Backup & restore</span><span aria-hidden="true">›</span>
                </a>
              </div>
            </details>
          </div>
        </div>

        <div class="site-nav__journal" data-support-journal data-journal-overlay>
          <div
            id="global-support-journal-layer"
            class="support-journal__layer"
            data-support-journal-layer
            data-state="closed"
            aria-hidden="true"
          >
            <div class="support-journal__dialog" data-support-journal-dialog tabindex="-1">
              <header class="support-journal__header">
                <div class="support-journal__titles">
                  <h3
                    class="support-journal__heading"
                    id="global-support-journal-heading"
                    data-support-journal-heading
                  >Journal</h3>
                </div>
                <button
                  class="support-journal__close"
                  type="button"
                  data-support-journal-close
                  aria-label="Close full screen journal"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </header>
              <div class="support-journal__body">
                <div class="support-journal__content">
                  <div data-journal-overlay-content></div>
                  <div class="journal-history-wrapper" data-journal-overlay-history></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>`;
}
