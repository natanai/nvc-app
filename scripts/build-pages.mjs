import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataPath = join(rootDir, 'data', 'index.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const categoryIcons = {
  situations: '⚡',
  feelings: '💖',
  needs: '🌱',
};

const directoriesToReset = ['situations', 'feelings', 'needs', 'inventory'];
for (const dir of directoriesToReset) {
  rmSync(join(rootDir, dir), { recursive: true, force: true });
}

function basePathFromDepth(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
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
  const headDescription = description ||
    'Browse situations, feelings, and needs in a retro strategy finder inspired by Need Share.';

  const breadcrumbHtml = breadcrumbs.length
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          ${breadcrumbs
            .map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              if (isLast || !crumb.href) {
                return `<li aria-current="page">${escapeHtml(crumb.label)}</li>`;
              }
              return `<li><a href="${crumb.href}">${escapeHtml(crumb.label)}</a></li>`;
            })
            .join('')}
        </ol>
      </nav>`
    : '';

  const scriptSources = Array.from(new Set(['scripts/inventory.js', ...scripts]));
  const scriptsHtml = scriptSources
    .map((src) => `    <script src="${basePath}${src}" defer></script>`)
    .join('\n');
  const navHtml = renderNav(basePath);
  const mainAttrs = mainAttributes ? ` ${mainAttributes}` : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} • NeedShare Magnet Explorer</title>
    <meta name="description" content="${escapeHtml(headDescription)}" />
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
          <select id="${idPrefix}-need" name="need" required>
            ${placeholderOption}
            ${needOptions}
          </select>
        </div>`
    : '';

  const contactFields = includeContactFields
    ? `
        <div class="strategy-form__row">
          <div class="strategy-form__field">
            <label for="${idPrefix}-name">First name (optional)</label>
            <input id="${idPrefix}-name" name="name" type="text" />
          </div>
          <div class="strategy-form__field">
            <label for="${idPrefix}-location">Location (optional)</label>
            <input id="${idPrefix}-location" name="location" type="text" />
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
        <form id="${formId}" class="strategy-form" data-strategy-form>
          <div class="strategy-form__field">
            <label for="${idPrefix}-title">${escapeHtml(titleLabel)}</label>
            <input id="${idPrefix}-title" name="title" type="text" required />
          </div>
          <div class="strategy-form__field">
            <label for="${idPrefix}-description">${escapeHtml(descriptionLabel)}</label>
            <div class="strategy-card strategy-card--input">
              <textarea id="${idPrefix}-description" name="description" rows="4"${descriptionRequiredAttr}></textarea>
            </div>
          </div>
          ${needField}
          ${contactFields}
          <div class="strategy-form__actions">
            <button type="submit" class="strategy-form__submit inventory-button">${escapeHtml(submitLabel)}</button>
          </div>
        </form>${message}
      </div>`;
}

function renderHome() {
  const cards = ['situations', 'feelings', 'needs']
    .map((type) => {
      const icon = categoryIcons[type];
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      return `<a class="category-card" href="${type}/">
          <span class="category-card__icon" aria-hidden="true">${icon}</span>
          <span class="category-card__label">${label}</span>
        </a>`;
    })
    .join('');

  const main = `
      <header class="page-header home-header">
        <h1 class="page-title">NeedShare Magnet Explorer</h1>
        <p class="page-subtitle">Follow a thread of care through situations, feelings, and needs.</p>
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
    description: 'Explore situations, feelings, and needs with cross-linked strategies inspired by Need Share.'
  });

  writePage('index.html', html);
}

function renderCategory(type, items) {
  const title = type.charAt(0).toUpperCase() + type.slice(1);
  const description = type === 'situations'
    ? 'Situations (sometimes called evaluations or faux-feelings) are often the first stories that surface. Follow them to the feelings and needs underneath.'
    : '';

  const pills = items
    .map((item) => `<a class="pill" href="${item.slug}/">${escapeHtml(item.title)}</a>`)
    .join('');

  const main = `
      <header class="page-header">
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ''}
      </header>
      <section aria-labelledby="${type}-list" class="pill-section">
        <h2 id="${type}-list" class="section-title">${escapeHtml(title)} directory</h2>
        <div class="pill-grid">
          ${pills}
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
    scripts: ['scripts/magnets.js'],
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
    scripts: ['scripts/magnets.js'],
  });

  writePage(`situations/${item.slug}/index.html`, html);
}

function renderFeeling(item) {
  const main = `
      <header class="page-header">
        <h1 class="page-title">Feeling: ${escapeHtml(item.title)}</h1>
      </header>
      ${renderPillGroup('Situations', item.situations, 'situations')}
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
    scripts: ['scripts/magnets.js'],
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
              .map(
                (strategy) => {
                  const tags = strategy.needs?.map((need) => need.slug).join('|') || '';
                  return `
                  <article class="strategy-card" data-strategy-slug="${escapeHtml(strategy.slug)}" data-strategy-tags="${escapeHtml(tags)}">
                    <h3 class="strategy-card__title">${escapeHtml(strategy.title)}</h3>
                    <p class="strategy-card__description">${escapeHtml(strategy.description)}</p>
                    <div class="strategy-card__actions">
                      <button type="button" class="strategy-card__save">+ Save to inventory</button>
                    </div>
                  </article>
                `;
                }
              )
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
    submitLabel: 'Save to inventory',
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
        <h2 id="suggestion-heading" class="section-title">Share a strategy</h2>
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
        <p class="page-description">Collect strategies you love and track how each need is supported.</p>
      </header>
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
            aria-controls="inventory-list-panel"
          >
            Show your saved strategies
          </button>
        </div>
        <div class="inventory-list-panel" data-inventory-panel hidden id="inventory-list-panel">
          <div class="inventory-list__header">
            <h3 id="inventory-list-heading" class="section-title">Your strategies</h3>
            <p class="inventory-list__hint">Grouped by need so you can spot any empty sections.</p>
          </div>
          <div id="inventory-list" class="inventory-list"></div>
        </div>
      </section>
      <section class="inventory-form" aria-labelledby="inventory-form-heading">
        <h2 id="inventory-form-heading" class="section-title">Add a personal strategy</h2>
        ${personalStrategyForm}
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

function renderPillGroup(label, items, type) {
  if (!items || items.length === 0) {
    return '';
  }

  const pills = items
    .map((item) => `<a class="pill" href="../../${type}/${item.slug}/">${escapeHtml(item.title)}</a>`)
    .join('');

  return `<section class="pill-section" aria-labelledby="${slugify(label)}-heading">
      <h2 id="${slugify(label)}-heading" class="section-title">${escapeHtml(label)}</h2>
      <div class="pill-grid">
        ${pills}
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
