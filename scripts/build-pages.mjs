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

const directoriesToReset = ['situations', 'feelings', 'needs'];
for (const dir of directoriesToReset) {
  rmSync(join(rootDir, dir), { recursive: true, force: true });
}

function basePathFromDepth(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

function htmlPage({ title, depth, breadcrumbs = [], main, description = '', scripts = [] }) {
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

  const scriptsHtml = scripts
    .map((src) => `    <script src="${basePath}${src}" defer></script>`)
    .join('\n');
  const scriptsBlock = scripts.length ? `${scriptsHtml}\n` : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} • NeedShare Magnet Explorer</title>
    <meta name="description" content="${escapeHtml(headDescription)}" />
    <link rel="stylesheet" href="${cssHref}" />
  </head>
  <body>
    <a href="#main" class="skip-link">Skip to content</a>
    <div class="page-wrapper">
      ${breadcrumbHtml}
      <main id="main" class="page" role="main">
        ${main}
      </main>
    </div>
${scriptsBlock}  </body>
</html>
`;
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

  const strategiesHtml = strategies.length
    ? `<section class="strategy-section" aria-labelledby="strategy-heading">
          <h2 id="strategy-heading" class="section-title">Strategies</h2>
          <div class="strategy-list">
            ${strategies
              .map(
                (strategy) => `
                  <article class="strategy-card">
                    <h3 class="strategy-card__title">${escapeHtml(strategy.title)}</h3>
                    <p class="strategy-card__description">${escapeHtml(strategy.description)}</p>
                  </article>
                `
              )
              .join('')}
          </div>
        </section>`
    : `<section class="strategy-section" aria-labelledby="strategy-heading">
          <h2 id="strategy-heading" class="section-title">Strategies</h2>
          <p class="empty-state">Strategies for this need are coming soon.</p>
        </section>`;

  const descriptionHtml = item.description
    ? `<p class="page-description">${escapeHtml(item.description)}</p>`
    : '';

  const hasPrefix = item.title.toLowerCase().startsWith('need for ');
  const fullTitle = hasPrefix ? item.title : `Need for ${item.title}`;

  const needOptions = data.needs
    .map((need) => `<option value="${escapeHtml(need.slug)}">${escapeHtml(need.title)}</option>`)
    .join('');

  const main = `
      <header class="page-header">
        <h1 class="page-title">${escapeHtml(fullTitle)}</h1>
        ${descriptionHtml}
      </header>
      ${strategiesHtml}
      <section class="suggestion" aria-labelledby="suggestion-heading">
        <h2 id="suggestion-heading" class="section-title">Share a strategy</h2>
        <form id="suggestion-form" class="suggestion-form">
          <label for="strategy">Your strategy</label>
          <textarea id="strategy" name="strategy" required></textarea>
          <label for="tags">Needs this strategy supports</label>
          <select id="tags" name="tags" multiple>
            ${needOptions}
          </select>
          <label for="name">First name (optional)</label>
          <input id="name" name="name" />
          <label for="location">Location (optional)</label>
          <input id="location" name="location" />
          <button type="submit">Submit</button>
        </form>
        <p class="form-message" hidden></p>
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
    scripts: ['scripts/submit.js'],
  });

  writePage(`needs/${item.slug}/index.html`, html);
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
