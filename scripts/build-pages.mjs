import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataPath = join(rootDir, 'data', 'index.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const categoryIcons = {
  situations: 'icons/map-8bit.svg',
  feelings: 'icons/feelings-8bit.svg',
  needs: 'icons/needs-8bit.svg',
};

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
        const root = document.documentElement;
        if (!root) {
          return;
        }
        let applied = false;
        try {
          const stored = window.localStorage ? localStorage.getItem(STORAGE_KEY) : null;
          if (stored) {
            const parsed = JSON.parse(stored);
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

          const highContrastEnabled = window.localStorage ? localStorage.getItem(HIGH_CONTRAST_KEY) === '1' : false;
          if (highContrastEnabled) {
            try {
              if (window.NVCContrast && typeof window.NVCContrast.adjustLightness === 'function') {
                const inkValue = root.style.getPropertyValue('--ink').trim();
                if (inkValue) {
                  const darkerInk = window.NVCContrast.adjustLightness(inkValue, -20);
                  if (darkerInk) {
                    root.style.setProperty('--ink', darkerInk);
                  }
                }
              }
            } catch (error) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('Unable to adjust ink for high contrast', error);
              }
            }
            root.style.setProperty('--shadow', 'color-mix(in srgb, var(--outline) 70%, transparent)');
            applied = true;
          } else {
            root.style.setProperty('--shadow', 'color-mix(in srgb, var(--outline) 55%, transparent)');
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
  const baseScripts = [{ src: 'scripts/inventory.js', defer: true }];
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
  const navHtml = renderNav(basePath);
  const mainAttrs = mainAttributes ? ` ${mainAttributes}` : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} • NeedShare Explorer</title>
    <meta name="description" content="${escapeHtml(headDescription)}" />
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

function renderNav(basePath) {
  const homeHref = basePath || './';
  return `<nav class="site-nav" aria-label="Primary">
        <a class="site-nav__link" href="${homeHref}">Home</a>
        <a class="site-nav__link" href="${basePath}situations/">Situations</a>
        <a class="site-nav__link" href="${basePath}feelings/">Feelings</a>
        <a class="site-nav__link" href="${basePath}needs/">Needs</a>
        <a class="site-nav__link site-nav__link--inventory" href="${basePath}inventory/">
          Inventory
          <span class="site-nav__count" data-inventory-count hidden>0</span>
        </a>
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
        ${message}
      </div>`;
}

function renderHome() {
  const basePath = basePathFromDepth(0);
  const cards = ['situations', 'feelings', 'needs']
    .map((type) => {
      const icon = `${basePath}${categoryIcons[type]}`;
      const label = type.charAt(0).toUpperCase() + type.slice(1);

      if (type === 'feelings') {
        const supportHref = `${basePath}alexithymia-support/`;
        return `          <div class="category-card category-card--with-tag">
            <a class="category-card__link" href="${type}/">
              <img class="category-card__icon" src="${icon}" alt="" aria-hidden="true" />
              <span class="category-card__label">${label}</span>
            </a>
            <a class="category-card__tag" href="${supportHref}" aria-label="Alexithymia support">+ support</a>
          </div>`;
      }

      return `          <a class="category-card" href="${type}/">
            <img class="category-card__icon" src="${icon}" alt="" aria-hidden="true" />
            <span class="category-card__label">${label}</span>
          </a>`;
    })
    .join('\n');

  const main = `
      <header class="page-header home-header">
        <h1 class="page-title">NeedShare Explorer</h1>
        <p class="page-subtitle">Follow a thread of care through situations, feelings, needs, and strategies.</p>
      </header>
      <section class="category-section" aria-labelledby="categorySectionTitle">
        <div class="category-section__intro">
          <h2 id="categorySectionTitle">Start exploring</h2>
          <p>Choose a doorway to begin. Each path connects you with the needs underneath.</p>
        </div>
        <div class="category-grid">
${cards}
        </div>
      </section>
    `;

  const html = htmlPage({
    title: 'Home',
    depth: 0,
    main,
    description:
      'Explore situations, feelings, and needs with cross-linked magnets, journal prompts, and strategy inventory tools inspired by NeedShare.'
  });

  writePage('index.html', html);
}

function renderCategory(type, items) {
  const title = type.charAt(0).toUpperCase() + type.slice(1);
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
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ''}${
          supportLinks ? `\n        ${supportLinks}` : ''
        }
      </header>
      <section aria-labelledby="${type}-list" class="pill-section magnet-section" data-magnet-root>
        <div class="magnet-section__header">
          <h2 id="${type}-list" class="section-title">${escapeHtml(title)} directory</h2>
          <button type="button" class="shuffle-button" data-magnet-shuffle>Shuffle magnets</button>
        </div>
        <div class="magnet-board-wrapper">
          <div class="pill-grid magnet-board" data-magnet-board>
            ${magnets}
          </div>
          <button type="button" class="magnet-play-toggle" data-magnet-toggle aria-pressed="false">+ Play with</button>
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
  });

  writePage(`situations/${item.slug}/index.html`, html);
}

function renderFeeling(item) {
  const main = `
      <header class="page-header">
        <h1 class="page-title">Feeling: ${escapeHtml(item.title)}</h1>
      </header>
      ${renderPillGroup('Needs', item.needs, 'needs')}
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
    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],
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

  const suggestionForm = renderStrategyForm({
    formId: 'suggestion-form',
    idPrefix: 'suggestion',
    submitLabel: '+ Save to inventory',
    titleLabel: 'Strategy name',
    descriptionLabel: 'Strategy details',
    defaultNeedSlug: item.slug,
    includeContactFields: true,
    includeMessage: true,
  });

  const main = `
      <header class="page-header">
        <h1 class="page-title">${escapeHtml(fullTitle)}</h1>
        ${descriptionHtml}
      </header>
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
  });

  writePage(`needs/${item.slug}/index.html`, html);
}

function renderInventoryPage() {
  const personalStrategyForm = renderStrategyForm({
    formId: 'inventory-form',
    idPrefix: 'inventory',
    submitLabel: 'Add to inventory',
    titleLabel: 'Strategy name',
    descriptionLabel: 'How do you put it into practice?',
    includePlaceholderOption: true,
  });

  const main = `
      <header class="page-header inventory-header">
        <h1 class="page-title">Strategy inventory</h1>
        <p class="page-description">
          Collect strategies you love, then visit the journal to follow how your feelings and needs shift over time.
        </p>
      </header>

      <section class="inventory-journal-callout" aria-label="Journal tools">
        <a class="inventory-journal-card" href="./journal/">
          <span class="inventory-journal-card__header">
            <img
              src="../icons/journal.svg"
              class="inventory-journal-card__icon"
              alt=""
              aria-hidden="true"
            />
            <span class="inventory-journal-card__label">Journal</span>
          </span>
          <span class="inventory-journal-card__description">
            Log emotions, needs, and notes on a dedicated page designed for reflection.
          </span>
        </a>
        <p class="inventory-journal-callout__hint">Your journal stays on this device unless you export it.</p>
      </section>

      <section class="inventory-main" aria-labelledby="inventory-overview-heading">
        <section class="inventory-actions" aria-labelledby="inventory-actions-heading">
          <div class="inventory-actions__header">
            <h2 id="inventory-actions-heading" class="section-title">Save your progress</h2>
            <p class="inventory-actions__hint">Export a CSV backup or import one you created earlier.</p>
          </div>
          <div class="inventory-actions__buttons">
            <button type="button" id="inventory-export" class="inventory-button">Export CSV</button>
            <button type="button" id="inventory-import-trigger" class="inventory-button">Import CSV</button>
            <input type="file" id="inventory-import" accept=".csv,text/csv" hidden />
          </div>
          <p class="inventory-message" data-inventory-message hidden aria-live="polite"></p>
        </section>

        <section class="inventory-overview" aria-labelledby="inventory-overview-heading">
          <div class="inventory-overview__header">
            <h2 id="inventory-overview-heading" class="section-title">Need coverage & saved strategies</h2>
            <p class="inventory-overview__hint">Use the board to spot needs that are still waiting for care and review what you've saved.</p>
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
              <h3 id="inventory-list-heading" class="section-title">Saved strategies by need</h3>
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
  });

  writePage('inventory/index.html', html);
}

function renderInventoryJournalPage() {
  const main = `
      <header class="page-header journal-page-header">
        <h1 class="page-title journal-page-title">
          <img src="../../icons/journal.svg" class="journal-page-title__icon" alt="" aria-hidden="true" />
          Journal
        </h1>
        <p class="page-description journal-page-description">
          Log feelings, needs, and notes from any check-in. Entries are stored locally so you can review patterns privately or
          export them when you're ready.
        </p>
      </header>
      <section class="journal-page" data-inventory-section="journal">
        <section class="journal-actions" aria-labelledby="journal-actions-heading">
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

        <section class="journal-form-section" aria-labelledby="journal-form-heading">
          <div class="journal-form-section__header">
            <h2 id="journal-form-heading" class="section-title">Log a new entry</h2>
            <p class="journal-form-section__hint">Tag what's present right now. Unsure of the feeling? Leave it blank and lean on the notes.</p>
          </div>
          <form class="inventory-journal-form" data-journal-form>
            <div class="inventory-journal-form__grid">
              <div class="inventory-journal-form__field">
                <label for="journal-emotion">Emotion (optional)</label>
                <input id="journal-emotion" name="emotion" type="text" autocomplete="off" />
                <p class="journal-field-hint">Use any word that fits or return later to update it.</p>
              </div>
              <div class="inventory-journal-form__field inventory-journal-form__field--intensity">
                <label for="journal-intensity">Intensity</label>
                <div class="inventory-journal-form__intensity">
                  <input id="journal-intensity" name="intensity" type="range" min="1" max="10" value="5" />
                  <output for="journal-intensity" data-journal-intensity-display>5/10</output>
                </div>
                <p class="journal-field-hint">Slide to note how strong the feeling is.</p>
              </div>
              <div class="inventory-journal-form__field">
                <label for="journal-needs">Related needs</label>
                <select id="journal-needs" name="needs" multiple></select>
                <p class="journal-field-hint">Pick one or more needs that connect. Leave empty if you're not sure yet.</p>
              </div>
              <div class="inventory-journal-form__field">
                <label for="journal-tags">Tags (optional)</label>
                <input id="journal-tags" name="tags" type="text" placeholder="work, weekend, boundaries" />
                <p class="journal-field-hint">Separate tags with commas. They'll help you filter later.</p>
              </div>
              <div class="inventory-journal-form__field inventory-journal-form__field--wide">
                <label for="journal-notes">Reflection</label>
                <textarea id="journal-notes" name="notes" rows="5" placeholder="What happened? What did you notice in your body? What need wants attention?"></textarea>
              </div>
            </div>
            <aside class="journal-prompts">
              <p>Need a nudge?</p>
              <ul>
                <li>What sensations stood out in your body?</li>
                <li>What need might be shining through or feeling tender?</li>
                <li>What support, boundary, or self-care step sounds kind?</li>
              </ul>
            </aside>
            <div class="inventory-journal-form__actions">
              <p class="journal-status" data-journal-status aria-live="polite"></p>
              <button type="button" class="inventory-button inventory-button--ghost" data-journal-clear>Clear form</button>
              <button type="submit" class="inventory-button">Save entry</button>
            </div>
          </form>
        </section>

        <section class="journal-summary-section" aria-labelledby="journal-summary-heading">
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

        <section class="journal-history-section" aria-labelledby="journal-history-heading">
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
      </section>
    `;

  const html = htmlPage({
    title: 'Journal',
    depth: 2,
    description: 'Log feelings, needs, and reflections in a dedicated journal dashboard for your strategy inventory.',
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Inventory', href: '../' },
      {
        html: '<span class="breadcrumbs__label"><img src="../../icons/journal.svg" class="journal-label-icon" alt="" aria-hidden="true" /> Journal</span>',
      },
    ],
    main,
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
        <button type="button" class="magnet-play-toggle" data-magnet-toggle aria-pressed="false">+ Play with</button>
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
  renderInventoryJournalPage();

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
