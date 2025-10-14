import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataPath = join(rootDir, 'data', 'index.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const themePreloadScript = (basePath) => {
  const contrastSrc = `${basePath}assets/js/ui/contrast.js`;
  return String.raw`    <script src="${contrastSrc}"></script>
    <script>
      (function() {
        const STORAGE_KEY = 'nvcApp.theme';
        const HIGH_CONTRAST_KEY = 'themeHighContrast';
        const VAR_MAP = {
          plum: '--plum',
          lavender: '--lavender',
          ink: '--ink',
          inkSoft: '--ink-soft',
          rose: '--rose',
          mint: '--mint',
          gold: '--gold',
          sky: '--sky',
          outline: '--outline',
        };
        const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
        const HIGH_CONTRAST_TEXT = '#10121C';
        const HIGH_CONTRAST_TEXT_SOFT = '#343852';
        const HIGH_CONTRAST_OUTLINE = '#05060C';
        const HIGH_CONTRAST_MIN_RATIO = 9;
        const HIGH_CONTRAST_ACCENT_RATIO = 10;
        const HIGH_CONTRAST_CHIP_RATIO = 11;
        const HIGH_CONTRAST_ADJUST_STEP = 8;
        const root = document.documentElement;
        if (!root) {
          return;
        }
        function readStorageValue(key) {
          if (!key) {
            return '';
          }
          let storedValue = '';
          let storageError = null;
          try {
            if (window.localStorage) {
              const candidate = localStorage.getItem(key);
              if (typeof candidate === 'string' && candidate) {
                return candidate;
              }
              if (typeof candidate === 'string') {
                storedValue = candidate;
              }
            }
          } catch (error) {
            storageError = error;
          }
          try {
            if (window.sessionStorage) {
              const candidate = sessionStorage.getItem(key);
              if (typeof candidate === 'string' && candidate) {
                return candidate;
              }
              if (!storedValue && typeof candidate === 'string') {
                storedValue = candidate;
              }
            }
          } catch (error) {
            if (!storageError) {
              storageError = error;
            }
          }
          if (!storedValue && storageError && typeof console !== 'undefined' && console.warn) {
            console.warn('Unable to access theme storage', storageError);
          }
          return storedValue || '';
        }
        function normalizeHex(value) {
          if (typeof value !== 'string') {
            return '';
          }
          const trimmed = value.trim();
          if (!trimmed) {
            return '';
          }
          const prefixed = trimmed.startsWith('#') ? trimmed : '#' + trimmed;
          return HEX_PATTERN.test(prefixed) ? prefixed.toUpperCase() : '';
        }

        function readPaletteVar(varName) {
          const direct = normalizeHex(root.style.getPropertyValue(varName));
          if (direct) {
            return direct;
          }
          try {
            const computed = getComputedStyle(root).getPropertyValue(varName);
            return normalizeHex(computed);
          } catch (error) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('Unable to read palette color', varName, error);
            }
          }
          return '';
        }

        function ensureHighContrastColor(value, targetRatio) {
          const base = normalizeHex(value);
          if (!base) {
            return '';
          }
          const adjust = window.NVCContrast?.adjustLightness;
          const getRatio = window.NVCContrast?.getContrastRatio;
          if (typeof adjust !== 'function' || typeof getRatio !== 'function') {
            return base;
          }
          let current = base;
          let attempts = 0;
          const desired = typeof targetRatio === 'number' ? targetRatio : HIGH_CONTRAST_MIN_RATIO;
          try {
            let ratio = getRatio(current, HIGH_CONTRAST_TEXT);
            while (ratio < desired && attempts < 12) {
              const next = adjust(current, HIGH_CONTRAST_ADJUST_STEP);
              if (!next || next === current) {
                break;
              }
              const normalized = normalizeHex(next);
              current = normalized || current;
              ratio = getRatio(current, HIGH_CONTRAST_TEXT);
              attempts += 1;
            }
          } catch (error) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('Unable to adjust color for high contrast', error);
            }
            return base;
          }
          return current;
        }

        function readStoredThemePayload() {
          const raw = readStorageValue(STORAGE_KEY);
          if (!raw) {
            return null;
          }
          try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
          } catch (error) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('Unable to parse saved theme', error);
            }
            return null;
          }
        }

        let applied = false;
        try {
          const parsed = readStoredThemePayload();
          if (parsed && typeof parsed === 'object' && parsed.values && typeof parsed.values === 'object') {
            for (const [key, varName] of Object.entries(VAR_MAP)) {
              let value = parsed.values[key];
              if (typeof value !== 'string') {
                continue;
              }
              value = value.trim();
              if (!value) {
                continue;
              }
              if (!value.startsWith('#')) {
                value = '#' + value;
              }
              if (!HEX_PATTERN.test(value)) {
                continue;
              }
              root.style.setProperty(varName, value.toUpperCase());
              applied = true;
            }
            const roundnessRaw =
              typeof parsed.roundness === 'number' ? parsed.roundness : Number(parsed.roundness);
            if (!Number.isNaN(roundnessRaw)) {
              const clampedRoundness = Math.min(200, Math.max(0, Math.round(roundnessRaw)));
              root.style.setProperty('--corner-scale', String(clampedRoundness / 100));
              applied = true;
            }
          }
        } catch (error) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Unable to preapply theme', error);
          }
        }

        try {
          if (!root.style.getPropertyValue('--btn-bg')) {
            const roseValue = root.style.getPropertyValue('--rose').trim();
            if (roseValue) {
              root.style.setProperty('--btn-bg', roseValue);
            } else {
              root.style.setProperty('--btn-bg', '#FFB3CB');
            }
          }
          root.style.setProperty('--btn-fg', '#111111');
          root.style.setProperty('--chip-fg', '#111111');

          const highContrastPreference = readStorageValue(HIGH_CONTRAST_KEY);
          const highContrastEnabled = highContrastPreference === '1';
          if (highContrastEnabled) {
            try {
              const plumValue = ensureHighContrastColor(readPaletteVar('--plum'), HIGH_CONTRAST_MIN_RATIO);
              if (plumValue) {
                root.style.setProperty('--plum', plumValue);
              }
              const lavenderValue = ensureHighContrastColor(readPaletteVar('--lavender'), HIGH_CONTRAST_ACCENT_RATIO);
              if (lavenderValue) {
                root.style.setProperty('--lavender', lavenderValue);
              }
              const roseValue = ensureHighContrastColor(readPaletteVar('--rose'), HIGH_CONTRAST_ACCENT_RATIO);
              if (roseValue) {
                root.style.setProperty('--rose', roseValue);
              }
              const mintValue = ensureHighContrastColor(readPaletteVar('--mint'), HIGH_CONTRAST_ACCENT_RATIO);
              if (mintValue) {
                root.style.setProperty('--mint', mintValue);
              }
              const goldValue = ensureHighContrastColor(readPaletteVar('--gold'), HIGH_CONTRAST_ACCENT_RATIO);
              if (goldValue) {
                root.style.setProperty('--gold', goldValue);
              }
              const skyValue = ensureHighContrastColor(readPaletteVar('--sky'), HIGH_CONTRAST_CHIP_RATIO);
              if (skyValue) {
                root.style.setProperty('--sky', skyValue);
                root.style.setProperty('--chip-bg', skyValue);
              }
              root.style.setProperty('--ink', HIGH_CONTRAST_TEXT);
              root.style.setProperty('--ink-soft', HIGH_CONTRAST_TEXT_SOFT);
              root.style.setProperty('--outline', HIGH_CONTRAST_OUTLINE);
              root.style.setProperty('--chip-fg', HIGH_CONTRAST_TEXT);
              root.style.setProperty('--btn-fg', HIGH_CONTRAST_TEXT);
              const buttonSource = roseValue || plumValue || skyValue;
              const buttonBg = ensureHighContrastColor(buttonSource, HIGH_CONTRAST_ACCENT_RATIO);
              if (buttonBg) {
                root.style.setProperty('--btn-bg', buttonBg);
              }
              root.style.setProperty('--shadow', 'color-mix(in srgb, ' + HIGH_CONTRAST_OUTLINE + ' 75%, transparent)');
              root.setAttribute('data-theme-contrast', 'high');
              applied = true;
            } catch (error) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('Unable to apply high contrast', error);
              }
            }
          } else {
            root.style.setProperty('--shadow', 'color-mix(in srgb, var(--outline) 55%, transparent)');
            root.removeAttribute('data-theme-contrast');
            root.style.removeProperty('--chip-bg');
            root.style.setProperty('--btn-fg', '#111111');
            root.style.setProperty('--chip-fg', '#111111');
          }

          if (window.NVCContrast && typeof window.NVCContrast.autoContrast === 'function') {
            try {
              const ratio = window.NVCContrast.autoContrast('--btn-bg', '--btn-fg');
              if (typeof ratio === 'number') {
                applied = true;
              }
            } catch (error) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('Unable to auto-adjust button contrast', error);
              }
            }
          }

          if (applied) {
            root.setAttribute('data-theme-preapplied', 'true');
          }
        } catch (error) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Unable to apply prepaint adjustments', error);
          }
        }
      })();
    </script>`;
};

const directoriesToReset = ['situations', 'feelings', 'needs', 'inventory'];
for (const dir of directoriesToReset) {
  rmSync(join(rootDir, dir), { recursive: true, force: true });
}

function basePathFromDepth(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

function normalizeScripts(scripts) {
  const baseScripts = [
    { src: 'assets/js/journal/store.js', module: true },
    { src: 'scripts/inventory.js', defer: true },
  ];
  const entries = [...baseScripts, ...scripts];
  const seen = new Set();
  const normalized = [];
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    const resolved =
      typeof entry === 'string'
        ? { src: entry, type: undefined, defer: true, async: false, nomodule: false }
        : {
            src: entry.src,
            type: entry.module ? 'module' : entry.type,
            defer: entry.defer ?? (!entry.module && entry.type !== 'module'),
            async: entry.async ?? false,
            nomodule: entry.nomodule ?? false,
            crossOrigin: entry.crossOrigin ?? entry.crossorigin,
            integrity: entry.integrity,
            referrerPolicy: entry.referrerPolicy ?? entry.referrerpolicy,
          };
    if (!resolved.src) {
      continue;
    }
    const key = `${resolved.src}|${resolved.type ?? ''}|${resolved.defer ? 'd' : ''}|${
      resolved.async ? 'a' : ''
    }|${resolved.nomodule ? 'n' : ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(resolved);
  }
  return normalized;
}

function htmlPage({
  title,
  depth,
  breadcrumbs = [],
  main,
  description = '',
  scripts = [],
  mainAttributes = '',
  activeNav,
}) {
  const basePath = basePathFromDepth(depth);
  const cssHref = `${basePath}styles.css`;
  const headDescription =
    description ||
    'Map situations, feelings, and needs with retro magnet play, journaling tools, and a shareable strategy inventory inspired by NeedShare.';

  const breadcrumbHtml = breadcrumbs.length
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          ${breadcrumbs
            .map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const labelContent = crumb.html || escapeHtml(crumb.label ?? '');
              if (isLast || !crumb.href) {
                return `<li aria-current="page">${labelContent}</li>`;
              }
              return `<li><a href="${crumb.href}">${labelContent}</a></li>`;
            })
            .join('')}
        </ol>
      </nav>`
    : '';

  const scriptEntries = normalizeScripts(scripts);
  const scriptsHtml = scriptEntries
    .map((script) => {
      const attrs = [`src="${basePath}${script.src}"`];
      if (script.type) {
        attrs.push(`type="${script.type}"`);
      }
      if (script.defer) {
        attrs.push('defer');
      }
      if (script.async) {
        attrs.push('async');
      }
      if (script.nomodule) {
        attrs.push('nomodule');
      }
      if (script.crossOrigin) {
        attrs.push(`crossorigin="${script.crossOrigin}"`);
      }
      if (script.integrity) {
        attrs.push(`integrity="${script.integrity}"`);
      }
      if (script.referrerPolicy) {
        attrs.push(`referrerpolicy="${script.referrerPolicy}"`);
      }
      return `    <script ${attrs.join(' ')}></script>`;
    })
    .join('\n');
  const navHtml = renderNav(basePath, activeNav);
  const mainAttrs = mainAttributes ? ` ${mainAttributes}` : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} • NeedShare Explorer</title>
    <meta name="description" content="${escapeHtml(headDescription)}" />
    <link rel="icon" type="image/svg+xml" href="${basePath}icons/main.svg" />
    <meta property="og:image" content="${basePath}icons/main.svg" />
    <meta name="twitter:image" content="${basePath}icons/main.svg" />
    ${themePreloadScript(basePath)}
    <link rel="stylesheet" href="${cssHref}" />
  </head>
  <body data-base-path="${basePath}">
    <a href="#main" class="skip-link">Skip to content</a>
    <div class="page-wrapper">
      ${navHtml}
      ${breadcrumbHtml}
      <main id="main" class="page" role="main"${mainAttrs}>
        ${main}
      </main>
    </div>
${scriptsHtml ? `${scriptsHtml}\n` : ''}  </body>
</html>
`;
}

function renderNav(basePath, activeNav) {
  const activeAttr = (key) => (activeNav === key ? ' aria-current="page"' : '');
  const homeHref = basePath || './';
  return `<nav class="site-nav" aria-label="Primary">
        <div class="site-nav__row site-nav__row--primary">
          <a class="site-nav__link site-nav__link--home" href="${homeHref}"${activeAttr('home')}>
            <img
              class="site-nav__icon"
              src="${basePath}icons/home-8bit.svg"
              alt=""
              aria-hidden="true"
            />
            <span class="visually-hidden">Home</span>
          </a>
          <button
            class="site-nav__link site-nav__link--customizer"
            type="button"
            data-palette-toggle
            aria-haspopup="dialog"
            aria-expanded="false"
          >
            <span class="site-nav__glyph" aria-hidden="true">+</span>
            <span class="visually-hidden">Customizer</span>
          </button>
          <div class="site-nav__journal" data-support-journal data-journal-overlay>
            <button
              class="site-nav__link site-nav__link--journal"
              type="button"
              data-support-journal-open
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-controls="global-support-journal-layer"
            >
              <span class="site-nav__icon site-nav__icon--journal" aria-hidden="true"></span>
              <span class="site-nav__label">Journal</span>
            </button>
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
                    >
                      Journal
                    </h3>
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
          <a class="site-nav__link site-nav__link--inventory" href="${basePath}inventory/"${activeAttr('inventory')}>
            Inventory
            <span class="site-nav__count" data-inventory-count hidden></span>
          </a>
        </div>
        <div class="site-nav__row site-nav__row--secondary">
          <a class="site-nav__link" href="${basePath}situations/"${activeAttr('situations')}>Situations</a>
          <a class="site-nav__link" href="${basePath}feelings/"${activeAttr('feelings')}>Feelings</a>
          <a class="site-nav__link" href="${basePath}needs/"${activeAttr('needs')}>Needs</a>
        </div>
      </nav>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeContributorName(value) {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'placeholder' ? trimmed : '';
}

function sanitizeLocation(value) {
  if (!value) {
    return '';
  }
  return value.trim();
}

function writePage(relativePath, html) {
  const outputPath = join(rootDir, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html.trimStart());
}

function renderStrategyForm({
  formId,
  idPrefix,
  submitLabel,
  titleLabel = 'Strategy name',
  descriptionLabel = 'Strategy details',
  descriptionRequired = true,
  includeNeedSelect = true,
  includePlaceholderOption = false,
  defaultNeedSlug = '',
  includeContactFields = false,
  includeMessage = false,
  notice = '',
}) {
  const needOptions = data.needs
    .map(
      (need) =>
        `<option value="${escapeHtml(need.slug)}"${
          need.slug === defaultNeedSlug ? ' selected' : ''
        }>${escapeHtml(need.title)}</option>`
    )
    .join('');

  const placeholderOption = includePlaceholderOption
    ? `<option value="" disabled${defaultNeedSlug ? '' : ' selected'}>Select a need</option>`
    : '';

  const needField = includeNeedSelect
    ? `
        <div class="strategy-form__field">
          <label for="${idPrefix}-need">Primary need</label>
          <div class="strategy-card strategy-card--input">
            <select id="${idPrefix}-need" name="need" required>
              ${placeholderOption}
              ${needOptions}
            </select>
          </div>
        </div>`
    : '';

  const contactFields = includeContactFields
    ? `
        <div class="strategy-form__row">
          <div class="strategy-form__field">
            <label for="${idPrefix}-name">First name (optional)</label>
            <div class="strategy-card strategy-card--input">
              <input id="${idPrefix}-name" name="name" type="text" />
            </div>
          </div>
          <div class="strategy-form__field">
            <label for="${idPrefix}-location">Location (optional)</label>
            <div class="strategy-card strategy-card--input">
              <input id="${idPrefix}-location" name="location" type="text" />
            </div>
          </div>
        </div>`
    : '';

  const message = includeMessage
    ? `
      <p class="strategy-form__message" data-form-message hidden aria-live="polite"></p>`
    : '';

  const noticeMarkup = notice ? `
      ${notice}` : '';

  const descriptionRequiredAttr = descriptionRequired ? ' required' : '';

  return `
      <div class="strategy-form__container" data-strategy-form-container>
        <div class="strategy-card strategy-card--form">
          <form id="${formId}" class="strategy-form" data-strategy-form>
            <div class="strategy-form__field">
              <label for="${idPrefix}-title">${escapeHtml(titleLabel)}</label>
              <div class="strategy-card strategy-card--input">
                <input id="${idPrefix}-title" name="title" type="text" required />
              </div>
            </div>
            <div class="strategy-form__field">
              <label for="${idPrefix}-description">${escapeHtml(descriptionLabel)}</label>
              <div class="strategy-card strategy-card--input">
                <textarea id="${idPrefix}-description" name="description" rows="4"${descriptionRequiredAttr}></textarea>
              </div>
            </div>
            ${needField}
            ${contactFields}
            <div class="strategy-card__actions strategy-form__actions">
              <button type="submit" class="strategy-form__submit strategy-card__save">${escapeHtml(submitLabel)}</button>
            </div>
          </form>
        </div>
        ${noticeMarkup}
        ${message}
      </div>`;
}

function renderHome() {
  const basePath = basePathFromDepth(0);
  const iconMap = {
    situations: `${basePath}icons/door-situations.svg`,
    feelings: `${basePath}icons/door-feelings.svg`,
    needs: `${basePath}icons/door-needs.svg`,
  };
  const cards = ['situations', 'feelings', 'needs']
    .map((type) => {
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const icon = iconMap[type]
        ? `                <img class="door-card__icon" src="${iconMap[type]}" alt="" aria-hidden="true" loading="lazy" />\n`
        : '';
      const doorMarkup = `              <span class="door-card__door" aria-hidden="true">\n${icon}              </span>\n              <span class="door-card__label">${label}</span>`;

      if (type === 'feelings') {
        const supportHref = `${basePath}alexithymia-support/`;
        return `          <div class="door-card door-card--${type}">
            <a class="door-card__link" href="${type}/">
${doorMarkup}
            </a>
            <a class="door-card__support" href="${supportHref}">Alexithymia support</a>
          </div>`;
      }

      return `          <div class="door-card door-card--${type}">
            <a class="door-card__link" href="${type}/">
${doorMarkup}
            </a>
          </div>`;
    })
    .join('\n');

  const main = `
      <section class="home-doorways" aria-labelledby="doorwaysTitle">
        <h1 id="doorwaysTitle" class="visually-hidden">Choose a doorway</h1>
        <p class="home-doorways__prompt">Step through a doorway to begin exploring.</p>
        <div class="door-grid">
${cards}
        </div>
        <p class="home-doorways__support-note">
          <a href="${basePath}alexithymia-support/">Alexithymia Support</a>
        </p>
      </section>
    `;

  const html = htmlPage({
    title: 'Home',
    depth: 0,
    main,
    description:
      'Explore situations, feelings, and needs with cross-linked magnets, journal prompts, and strategy inventory tools inspired by NeedShare.',
    activeNav: 'home',
  });

  writePage('index.html', html);
}

function renderCategory(type, items) {
  const title = type.charAt(0).toUpperCase() + type.slice(1);
  const escapedTitle = escapeHtml(title);
  const lowerTitle = escapeHtml(title.toLowerCase());
  const description = type === 'situations'
    ? 'Situations (sometimes called evaluations or faux-feelings) are often the first stories that surface. Follow them to the feelings and needs underneath.'
    : type === 'feelings'
    ? 'Need a softer on-ramp? Try the guided lane and journaling tools that support emotional awareness.'
    : '';

  const supportLinks =
    type === 'feelings'
      ? `<div class="support-actions">
          <a class="support-button" href="../alexithymia-support/">Open Alexithymia Support lane</a>
          <a class="support-button support-button--ghost" href="../inventory/#journal-dashboard">Visit your journal dashboard</a>
        </div>`
      : '';

  const magnets = items
    .map(
      (item) =>
        `<a class="pill magnet" data-magnet-id="${type}-${item.slug}" href="${item.slug}/">${escapeHtml(
          item.title,
        )}</a>`,
    )
    .join('');

  const main = `
      <header class="page-header">
        <h1 class="page-title">${escapedTitle}</h1>
        ${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ''}${
          supportLinks ? `\n        ${supportLinks}` : ''
        }
      </header>
      <section aria-labelledby="${type}-list" class="pill-section magnet-section" data-magnet-root>
        <div class="magnet-section__header">
          <h2 id="${type}-list" class="section-title">${escapedTitle} directory</h2>
          <button type="button" class="shuffle-button" data-magnet-shuffle>Shuffle magnets</button>
        </div>
        <div class="magnet-search" data-magnet-search>
          <label class="magnet-search__field">
            <span class="magnet-search__label visually-hidden">Search ${lowerTitle}</span>
            <input
              type="search"
              name="${type}-search"
              class="magnet-search__input"
              placeholder="Search ${lowerTitle}"
              autocomplete="off"
              data-magnet-search-input
            >
          </label>
          <div class="magnet-search__results" data-magnet-search-results aria-live="polite" hidden>
            <p class="magnet-search__count" data-magnet-search-count hidden>No matches yet.</p>
            <div class="magnet-search__list" data-magnet-search-list></div>
          </div>
        </div>
        <div class="magnet-board-wrapper">
          <div class="pill-grid magnet-board" data-magnet-board>
            ${magnets}
          </div>
          <label class="magnet-play-toggle" data-magnet-toggle data-state="on">
            <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Disable magnet physics" checked>
            <span class="magnet-play-toggle__track" aria-hidden="true">
              <span class="magnet-play-toggle__thumb"></span>
            </span>
            <span class="visually-hidden magnet-play-toggle__sr-state">Physics is on</span>
          </label>
        </div>
      </section>
    `;

  const html = htmlPage({
    title,
    depth: 1,
    breadcrumbs: [
      { label: 'Home', href: '../' },
      { label: title }
    ],
    main,
    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],
    activeNav: type,
  });

  writePage(`${type}/index.html`, html);
}

function renderSituation(item) {
  const main = `
      <header class="page-header">
        <h1 class="page-title">Situation: ${escapeHtml(item.title)}</h1>
      </header>
      ${renderPillGroup('Feelings', item.feelings, 'feelings')}
      ${renderPillGroup('Needs', item.needs, 'needs')}
    `;

  const html = htmlPage({
    title: `Situation: ${item.title}`,
    depth: 2,
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Situations', href: '../' },
      { label: item.title }
    ],
    main,
    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],
    activeNav: 'situations',
  });

  writePage(`situations/${item.slug}/index.html`, html);
}

function renderFeeling(item) {
  const inferencePanelId = `reverse-inference-panel-${slugify(item.slug)}`;
  const inferenceSection = `
      <section class="feeling-inference-wrapper" data-reverse-inference-container hidden>
        <button type="button" class="feeling-inference-toggle" data-reverse-inference-toggle aria-expanded="false" aria-controls="${inferencePanelId}" disabled>
          <span class="feeling-inference-toggle__copy">
            <span class="feeling-inference-toggle__badge">Alexithymia support</span>
            <span class="feeling-inference-toggle__label">How this feeling might be inferred</span>
          </span>
        </button>
        <div id="${inferencePanelId}" class="feeling-inference-panel" data-reverse-inference-panel hidden>
          <section class="feeling-inference" data-reverse-inference hidden></section>
        </div>
      </section>`;
  const needsSection = renderPillGroup('Related needs', item.needs, 'needs');

  const main = `
      <header class="page-header">
        <h1 class="page-title">Feeling: ${escapeHtml(item.title)}</h1>
      </header>
      ${inferenceSection}
      ${needsSection}
    `;

  const html = htmlPage({
    title: `Feeling: ${item.title}`,
    depth: 2,
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Feelings', href: '../' },
      { label: item.title }
    ],
    main,
    scripts: [
      { src: 'scripts/magnets.js', type: 'module' },
      { src: 'scripts/feeling-reverse-inference.js', type: 'module' },
    ],
    mainAttributes: ` data-feeling-slug="${escapeHtml(item.slug)}"`,
    activeNav: 'feelings',
  });

  writePage(`feelings/${item.slug}/index.html`, html);
}

function renderNeed(item, strategyLookup) {
  const strategies = item.strategies
    .map((strategy) => strategyLookup.get(strategy.slug))
    .filter(Boolean);

  const hasPrefix = item.title.toLowerCase().startsWith('need for ');
  const displayTitle = hasPrefix ? item.title.replace(/^Need for\s*/i, '') : item.title;
  const fullTitle = `Need for ${displayTitle}`;

  const strategiesHtml = strategies.length
    ? `<section class="strategy-section" aria-labelledby="strategy-heading">
          <h2 id="strategy-heading" class="section-title">Strategies</h2>
          <div class="strategy-list">
            ${strategies
              .map((strategy) => {
                const tags = strategy.needs?.map((need) => need.slug).join('|') || '';
                const firstName = sanitizeContributorName(strategy.firstName);
                const location = sanitizeLocation(strategy.location);
                const contributorParts = [];
                if (firstName) {
                  contributorParts.push(firstName);
                }
                if (location) {
                  contributorParts.push(location);
                }
                const contributorText = contributorParts.map((part) => escapeHtml(part)).join(' • ');
                const contributorHtml = contributorText
                  ? `<p class="strategy-card__meta">${contributorText}</p>`
                  : '';
                const dataAttrs = [
                  `data-strategy-slug="${escapeHtml(strategy.slug)}"`,
                  `data-strategy-tags="${escapeHtml(tags)}"`,
                ];
                if (firstName) {
                  dataAttrs.push(`data-first-name="${escapeHtml(firstName)}"`);
                }
                if (location) {
                  dataAttrs.push(`data-location="${escapeHtml(location)}"`);
                }
                const dataAttrString = dataAttrs.length ? ` ${dataAttrs.join(' ')}` : '';
                return `
                  <article class="strategy-card"${dataAttrString}>
                    <h3 class="strategy-card__title">${escapeHtml(strategy.title)}</h3>
                    <p class="strategy-card__description">${escapeHtml(strategy.description)}</p>
                    ${contributorHtml}
                    <div class="strategy-card__actions">
                      <button type="button" class="strategy-card__save">+ Save to inventory</button>
                    </div>
                  </article>
                `;
              })
              .join('')}
          </div>
          <p class="inventory-feedback" data-inventory-feedback hidden></p>
        </section>`
    : `<section class="strategy-section" aria-labelledby="strategy-heading">
          <h2 id="strategy-heading" class="section-title">Strategies</h2>
          <p class="empty-state">Strategies for this need are coming soon.</p>
        </section>`;

  const descriptionHtml = item.description
    ? `<p class="page-description">${escapeHtml(item.description)}</p>`
    : '';

  const quickAddHtml = `
      <div class="strategy-quick-actions">
        <a class="strategy-quick-actions__link" href="#suggestion-form">
          <span class="strategy-quick-actions__icon" aria-hidden="true">+</span>
          <span>Add personal strategy</span>
        </a>
      </div>`;

  const suggestionNotice =
    '<p class="strategy-form__notice">Personal strategies you add stay on this browser. Visit the <a href="../../inventory/">inventory screen</a> to export them if you would like a backup.</p>';

  const suggestionForm = renderStrategyForm({
    formId: 'suggestion-form',
    idPrefix: 'suggestion',
    submitLabel: '+ Save to inventory',
    titleLabel: 'Strategy name',
    descriptionLabel: 'Strategy details',
    defaultNeedSlug: item.slug,
    includeContactFields: true,
    includeMessage: true,
    notice: suggestionNotice,
  });

  const main = `
      <header class="page-header">
        <h1 class="page-title">${escapeHtml(fullTitle)}</h1>
        ${descriptionHtml}
      </header>
      ${quickAddHtml}
      ${strategiesHtml}
      <section class="suggestion" aria-labelledby="suggestion-heading">
        <h2 id="suggestion-heading" class="section-title">Add a strategy</h2>
        ${suggestionForm}
      </section>
    `;

  const html = htmlPage({
    title: fullTitle,
    depth: 2,
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Needs', href: '../' },
      { label: item.title }
    ],
    main,
    scripts: [],
    mainAttributes: `data-need-slug="${escapeHtml(item.slug)}" data-need-name="${escapeHtml(displayTitle)}" data-need-title="${escapeHtml(fullTitle)}"`,
    activeNav: 'needs',
  });

  writePage(`needs/${item.slug}/index.html`, html);
}

function renderInventoryPage() {
  const inventoryFormNotice =
    '<p class="strategy-form__notice">Personal strategies you add stay on this browser. Use the export tools above whenever you would like a backup.</p>';

  const personalStrategyForm = renderStrategyForm({
    formId: 'inventory-form',
    idPrefix: 'inventory',
    submitLabel: 'Add to inventory',
    titleLabel: 'Strategy name',
    descriptionLabel: 'How do you put it into practice?',
    includePlaceholderOption: true,
    notice: inventoryFormNotice,
  });

  const main = `
      <header class="page-header inventory-header">
        <div class="inventory-header__layout">
          <div class="inventory-header__content">
            <div class="inventory-header__title-row">
              <h1 class="page-title">Strategy inventory</h1>
              <a class="inventory-journal-button" href="./journal/">
                <img
                  src="../icons/journal-32bit.svg"
                  class="inventory-journal-button__icon"
                  alt=""
                  aria-hidden="true"
                />
                <span class="inventory-journal-button__label">Journal</span>
              </a>
            </div>
            <p class="page-description">
              Collect strategies you love, then visit the journal to follow how your feelings and needs shift over time.
            </p>
            <div class="strategy-quick-actions inventory-header__quick-actions">
              <a class="strategy-quick-actions__link" href="#inventory-form">
                <span class="strategy-quick-actions__icon" aria-hidden="true">+</span>
                <span>Add personal strategy</span>
              </a>
              <a
                class="strategy-quick-actions__link strategy-quick-actions__link--secondary"
                href="#strategies-list"
                data-jump-to-strategies
                aria-controls="strategies-list"
                aria-expanded="false"
              >
                <span class="strategy-quick-actions__icon" aria-hidden="true">⇣</span>
                <span>Review saved strategies</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <section class="inventory-main" aria-labelledby="inventory-overview-heading">
        <section class="inventory-actions" aria-labelledby="inventory-actions-heading">
          <div class="inventory-actions__header">
            <h2 id="inventory-actions-heading" class="section-title">Save your progress</h2>
            <p class="inventory-actions__hint">Export a CSV backup or import one you created earlier.</p>
          </div>
          <div class="inventory-actions__buttons">
            <button
              type="button"
              id="inventory-export"
              class="inventory-button inventory-button--compact"
              aria-label="Export CSV"
            >
              <span class="inventory-button__glyph" aria-hidden="true">⤓</span>
              <span class="inventory-button__text">Export CSV</span>
            </button>
            <button
              type="button"
              id="inventory-import-trigger"
              class="inventory-button inventory-button--ghost inventory-button--compact"
              aria-label="Import CSV"
            >
              <span class="inventory-button__glyph" aria-hidden="true">⤒</span>
              <span class="inventory-button__text">Import CSV</span>
            </button>
            <input type="file" id="inventory-import" accept=".csv,text/csv" hidden />
          </div>
          <p class="inventory-message" data-inventory-message hidden aria-live="polite"></p>
        </section>

        <section class="inventory-overview" aria-labelledby="inventory-overview-heading">
          <div class="inventory-overview__header">
            <h2 id="inventory-overview-heading" class="section-title">Need coverage & saved strategies</h2>
            <p class="inventory-overview__hint">Use the board to spot needs that are still waiting for care and review what you've saved.</p>
          </div>
          <div class="inventory-overview__tools">
            <div class="inventory-summary__filters" role="group" aria-label="Filter needs coverage list">
              <button
                type="button"
                class="inventory-summary__filter-button"
                data-summary-filter="all"
                aria-pressed="true"
                title="Show all needs"
              >
                <span aria-hidden="true">◎</span>
                <span class="visually-hidden">Show all needs</span>
              </button>
              <button
                type="button"
                class="inventory-summary__filter-button"
                data-summary-filter="missing"
                aria-pressed="false"
                title="Show needs with no coverage"
              >
                <span aria-hidden="true">!</span>
                <span class="visually-hidden">Show needs with no coverage</span>
              </button>
              <button
                type="button"
                class="inventory-summary__filter-button"
                data-summary-filter="ready"
                aria-pressed="false"
                title="Show needs with coverage"
              >
                <span aria-hidden="true">✓</span>
                <span class="visually-hidden">Show needs with coverage</span>
              </button>
              <button
                type="button"
                class="inventory-summary__filter-button"
                data-summary-filter="none"
                aria-pressed="false"
                title="Hide all needs"
              >
                <span aria-hidden="true">⊘</span>
                <span class="visually-hidden">Hide all needs</span>
              </button>
            </div>
          </div>
          <div id="inventory-summary" class="inventory-summary"></div>
          <div class="inventory-list__toggle">
            <button
              type="button"
              class="inventory-button"
              data-inventory-toggle
              aria-expanded="false"
              aria-controls="strategies-list"
            >
              Show your saved strategies
            </button>
          </div>
          <div
            class="inventory-list-panel inventory-list-panel--hidden"
            id="strategies-list"
            data-strategies-container
            hidden
            aria-labelledby="inventory-list-heading"
          >
            <div class="inventory-list__header">
              <h3 id="inventory-list-heading" class="section-title" tabindex="-1">Saved strategies by need</h3>
              <p class="inventory-list__hint">
                Expand a need to review strategies you have saved and make updates.
              </p>
            </div>
            <div id="inventory-list" class="inventory-list"></div>
          </div>
        </section>

        <section class="inventory-form" aria-labelledby="inventory-form-heading">
          <h2 id="inventory-form-heading" class="section-title">Add a personal strategy</h2>
          ${personalStrategyForm}
        </section>
      </section>
    `;

  const html = htmlPage({
    title: 'Inventory',
    depth: 1,
    breadcrumbs: [
      { label: 'Home', href: '../' },
      { label: 'Inventory' },
    ],
    main,
    activeNav: 'inventory',
  });

  writePage('inventory/index.html', html);
}

function renderInventoryJournalPage(needsList = []) {
  const needsDataset = needsList
    .map((need) => ({ slug: need.slug, title: need.title }))
    .filter((item) => item.slug && item.title);
  const needsJson = JSON.stringify(needsDataset);
  const main = `
      <header class="page-header journal-page-header">
        <div class="journal-page-title-row">
          <h1 class="page-title visually-hidden">Journal</h1>
          <div class="journal-page-title-row__actions">
            <button
              type="button"
              class="journal-fullscreen-button journal-fullscreen-button--spotlight"
              data-support-journal-open
              aria-expanded="false"
              aria-controls="global-support-journal-layer"
            >
              <span class="journal-fullscreen-button__icon" aria-hidden="true"></span>
              <span class="journal-fullscreen-button__text">
                <span class="journal-fullscreen-button__title">Open full screen journal</span>
              </span>
            </button>
          </div>
        </div>
        <p class="page-description journal-page-description">
          Log feelings, needs, and notes from any check-in. Entries are stored locally so you can review patterns privately or
          export them when you're ready.
        </p>
      </header>
      <section class="journal-page" data-inventory-section="journal">
        <div class="journal-overview-grid">
          <section class="journal-actions journal-panel" aria-labelledby="journal-actions-heading">
            <div class="journal-actions__header">
              <h2 id="journal-actions-heading" class="section-title">Back up or restore your journal</h2>
              <p class="journal-actions__hint">Export JSON to keep a private copy or import a file you previously saved.</p>
            </div>
            <div class="journal-actions__buttons">
              <button type="button" id="journal-export" class="inventory-button">Export journal</button>
              <button type="button" id="journal-import-trigger" class="inventory-button inventory-button--ghost">Import journal</button>
              <input type="file" id="journal-import" accept="application/json,.json" hidden />
            </div>
            <p class="journal-message" data-journal-message hidden aria-live="polite"></p>
          </section>

          <section class="journal-summary-section journal-panel" aria-labelledby="journal-summary-heading">
            <div class="journal-summary__header">
              <h2 id="journal-summary-heading" class="section-title">Trends at a glance</h2>
              <button
                type="button"
                class="inventory-button inventory-button--ghost"
                data-journal-summary-toggle
                aria-expanded="true"
              >
                Hide summary
              </button>
            </div>
            <div class="journal-summary" data-journal-summary></div>
          </section>
        </div>

        <section class="journal-history-section journal-panel journal-panel--history" aria-labelledby="journal-history-heading">
          <div class="journal-history-section__header">
            <h2 id="journal-history-heading" class="section-title">Journal history</h2>
            <p class="journal-actions__hint">Search entries, focus on a tag, or sort by intensity to notice patterns.</p>
          </div>
          <form class="journal-filters" data-journal-filters>
            <div class="journal-filters__field">
              <label for="journal-filter-search">Search notes</label>
              <input id="journal-filter-search" name="search" type="search" placeholder="Search text" />
            </div>
            <div class="journal-filters__field">
              <label for="journal-filter-tag">Filter tags</label>
              <input id="journal-filter-tag" name="tag" type="text" placeholder="e.g. work" />
            </div>
            <div class="journal-filters__field">
              <label for="journal-filter-sort">Sort order</label>
              <select id="journal-filter-sort" name="sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="intensity-high">Highest intensity</option>
                <option value="intensity-low">Lowest intensity</option>
              </select>
            </div>
            <div class="journal-filters__actions">
              <button type="button" class="inventory-button inventory-button--ghost" data-journal-filters-reset>Reset filters</button>
            </div>
          </form>
          <p class="journal-empty" data-journal-empty hidden>Save entries to see them listed here.</p>
          <div class="journal-history journal-history--cards" data-journal-history></div>
        </section>

        <details class="journal-inline-fallback" data-journal-inline-fallback>
          <summary class="journal-inline-fallback__summary">
            <span class="journal-inline-fallback__summary-text">Full screen journal unavailable? Use the legacy inline form.</span>
          </summary>
          <div class="journal-inline-fallback__body">
            <p class="journal-inline-fallback__note">
              The full screen journal above is the best experience&mdash;it's roomier, faster, and stays current with
              new features. This legacy form is more constrained and less polished, so only use it if the primary
              journal will not load.
            </p>
            <div class="journal-inline-container journal-panel journal-panel--form-shell" data-journal-inline-container>
              <section class="journal-form-section" aria-labelledby="journal-form-heading">
                <div class="journal-form-section__header">
                  <h2 id="journal-form-heading" class="section-title">Log a new entry</h2>
                  <p class="journal-form-section__hint">Tag what's present right now. Unsure of the feeling? Leave it blank and lean on the notes.</p>
                </div>
                <div class="journal-module" data-journal-module data-journal-variant="inventory" data-journal-id-prefix="journal">
                  <noscript>
                    <p class="journal-status">Enable JavaScript to use the journal form.</p>
                  </noscript>
                </div>
              </section>
            </div>
          </div>
        </details>
      </section>
      <script type="application/json" id="journal-needs-data">${escapeHtml(needsJson)}</script>
    `;

  const html = htmlPage({
    title: 'Journal',
    depth: 2,
    description: 'Log feelings, needs, and reflections in a dedicated journal dashboard for your strategy inventory.',
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Inventory', href: '../' },
      {
        html: '<span class="breadcrumbs__label"><img src="../../icons/journal-32bit.svg" class="journal-label-icon" alt="" aria-hidden="true" /> Journal</span>',
      },
    ],
    main,
    mainAttributes: 'data-page-id="inventory-journal"',
    scripts: [
      { src: 'assets/js/journal/store.js', type: 'module' },
      { src: 'assets/js/journal/module.js', type: 'module' },
      { src: 'scripts/inventory.js', defer: true },
    ],
    activeNav: 'inventory',
  });

  writePage('inventory/journal/index.html', html);
}

function renderPillGroup(label, items, type) {
  if (!items || items.length === 0) {
    return '';
  }

  const magnets = items
    .map(
      (item) =>
        `<a class="pill magnet" data-magnet-id="${type}-${item.slug}" href="../../${type}/${item.slug}/">${escapeHtml(
          item.title,
        )}</a>`,
    )
    .join('');

  return `<section class="pill-section magnet-section" aria-labelledby="${slugify(label)}-heading" data-magnet-root>
      <div class="magnet-section__header">
        <h2 id="${slugify(label)}-heading" class="section-title">${escapeHtml(label)}</h2>
        <button type="button" class="shuffle-button" data-magnet-shuffle>Shuffle magnets</button>
      </div>
      <div class="magnet-board-wrapper">
        <div class="pill-grid magnet-board" data-magnet-board>
          ${magnets}
        </div>
        <label class="magnet-play-toggle" data-magnet-toggle data-state="on">
          <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Disable magnet physics" checked>
          <span class="magnet-play-toggle__track" aria-hidden="true">
            <span class="magnet-play-toggle__thumb"></span>
          </span>
          <span class="visually-hidden magnet-play-toggle__sr-state">Physics is on</span>
        </label>
      </div>
    </section>`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function build() {
  renderHome();
  renderCategory('situations', data.situations);
  renderCategory('feelings', data.feelings);
  renderCategory('needs', data.needs);
  renderInventoryPage();
  renderInventoryJournalPage(data.needs);

  const strategyLookup = new Map(data.strategies.map((strategy) => [strategy.slug, strategy]));

  for (const situation of data.situations) {
    renderSituation(situation);
  }

  for (const feeling of data.feelings) {
    renderFeeling(feeling);
  }

  for (const need of data.needs) {
    renderNeed(need, strategyLookup);
  }
}

build();
