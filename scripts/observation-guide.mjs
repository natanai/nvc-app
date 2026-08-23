import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataPath = join(rootDir, 'data', 'observation-guide.json');
const pagePath = join(rootDir, 'observations', 'index.html');
const navCriticalCssPath = join(rootDir, 'styles', 'nav-critical.css');
const observationsCriticalCssPath = join(rootDir, 'styles', 'observations-critical.css');
const SHARED_NAV_CRITICAL_START = '<!-- shared-nav-critical:start -->';
const SHARED_NAV_CRITICAL_END = '<!-- shared-nav-critical:end -->';
const SHARED_NAV_PREFILL_START = '<!-- shared-nav-prefill:start -->';
const SHARED_NAV_PREFILL_END = '<!-- shared-nav-prefill:end -->';

const START_MARKER = '<!-- observation-guide:start -->';
const END_MARKER = '<!-- observation-guide:end -->';

function replaceOwnedRegion(html, startMarker, endMarker, content, label) {
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Unable to locate ${label} ownership markers in observations/index.html`);
  }
  const before = html.slice(0, startIndex + startMarker.length);
  const after = html.slice(endIndex);
  return `${before}\n${content.trim()}\n${after}`;
}

export function readObservationGuideData() {
  const raw = readFileSync(dataPath, 'utf8');
  return JSON.parse(raw);
}

export function renderObservationGuide(data) {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const summary = data.summary || {};
  const intro = data.intro || {};
  const desktop = data.desktop || {};
  const desktopSections = Array.isArray(desktop.sections) ? desktop.sections : [];
  const mobile = data.mobile || {};

  const introParagraphs = Array.isArray(intro.paragraphs)
    ? intro.paragraphs.map(text => `              <p>${text}</p>`).join('\n')
    : '';

  const desktopMarkup = renderObservationGuideDesktop(desktopSections);
  const mobileMarkup = renderObservationGuideMobile(mobile);

  return `          <summary class="observation-guide__toggle">
            <span class="observation-guide__toggle-text">
              <span class="observation-guide__eyebrow">${summary.eyebrow || ''}</span>
              <span class="observation-guide__toggle-title">${summary.title || ''}</span>
            </span>
            <span class="observation-guide__toggle-icon" aria-hidden="true">+</span>
          </summary>
          <div class="observation-guide__card" role="group" aria-labelledby="observation-guide-title">
            <header class="observation-guide__intro">
              <p class="observation-guide__eyebrow">${intro.eyebrow || ''}</p>
              <h2 id="observation-guide-title" class="observation-guide__title">
                ${intro.title || ''}
              </h2>
${introParagraphs}
            </header>
${desktopMarkup}
${mobileMarkup}
          </div>`;
}

function renderObservationGuideDesktop(sections) {
  if (!Array.isArray(sections) || !sections.length) {
    return '';
  }

  const nav = renderObservationGuideNav(sections);
  const sectionsMarkup = renderObservationGuideSections(sections);

  return `            <div class="observation-guide__desktop">
${nav}
${sectionsMarkup}
            </div>`;
}

function renderObservationGuideMobile(config) {
  if (!config || typeof config !== 'object') {
    return '';
  }

  const sections = Array.isArray(config.sections) ? config.sections : [];
  if (!sections.length) {
    return '';
  }

  const eyebrow = config.eyebrow ? `              <p class="observation-guide__mobile-eyebrow">${config.eyebrow}</p>` : '';
  const title = config.title ? `              <h3 class="observation-guide__mobile-title">${config.title}</h3>` : '';
  const introParagraphs = Array.isArray(config.intro)
    ? config.intro.map(text => `              <p class="observation-guide__mobile-intro-text">${text}</p>`).join('\n')
    : '';

  const introMarkup = eyebrow || title || introParagraphs
    ? `            <div class="observation-guide__mobile-intro">
${eyebrow}
${title}
${introParagraphs}
            </div>`
    : '';

  const panels = sections
    .map((section, index) => renderMobilePanel(section, index === 0))
    .filter(Boolean)
    .join('\n');

  const footerContent = renderContentItems(config.footer, 14);
  const footer = footerContent
    ? `            <div class="observation-guide__mobile-footer">
${footerContent}
            </div>`
    : '';

  return `            <div class="observation-guide__mobile" data-observation-guide-mobile>
${introMarkup}
${panels}
${footer}
            </div>`;
}

function renderMobilePanel(section, isFirst) {
  if (!section || typeof section !== 'object') {
    return '';
  }

  const idAttr = section.id ? ` id="${section.id}"` : '';
  const isOpen = typeof section.defaultOpen === 'boolean' ? section.defaultOpen : isFirst;
  const openAttr = isOpen ? ' open' : '';
  const eyebrow = section.eyebrow
    ? `                  <span class="observation-guide__mobile-summary-eyebrow">${section.eyebrow}</span>\n`
    : '';
  const title = section.title
    ? `                  <span class="observation-guide__mobile-summary-title">${section.title}</span>\n`
    : '';
  const description = section.description
    ? `                  <span class="observation-guide__mobile-summary-description">${section.description}</span>\n`
    : '';
  const content = renderContentItems(section.content, 18);
  const body = content
    ? `                <div class="observation-guide__mobile-content">
${content}
                </div>`
    : '';

  return `              <details class="observation-guide__mobile-panel"${idAttr}${openAttr}>
                <summary class="observation-guide__mobile-summary">
${eyebrow}${title}${description}                </summary>
${body}
              </details>`;
}

function renderObservationGuideNav(sections) {
  if (!Array.isArray(sections) || !sections.length) {
    return '            <nav class="observation-guide__nav" aria-label="Observation guide sections" role="tablist"></nav>';
  }

  const links = sections
    .map((section, index) => {
      const isActive = index === 0;
      const tabId = resolveTabId(section.id);
      const tabIndexAttr = isActive ? '' : '\n                tabindex="-1"';
      const classes = `observation-guide__tab${isActive ? ' is-active' : ''}`;
      const ariaSelected = isActive ? 'true' : 'false';
      return `              <a
                class="${classes}"
                href="#${section.id}"
                role="tab"
                aria-selected="${ariaSelected}"
                aria-controls="${section.id}"
                id="${tabId}"
                data-guide-target="${section.id}"${tabIndexAttr}
              >
                <span class="observation-guide__tab-label">${section.label || ''}</span>
              </a>`;
    })
    .join('\n');

  return `            <nav class="observation-guide__nav" aria-label="Observation guide sections" role="tablist">
${links}
            </nav>`;
}

function renderObservationGuideSections(sections) {
  if (!Array.isArray(sections) || !sections.length) {
    return '            <div class="observation-guide__sections"></div>';
  }

  const panels = sections
    .map((section, index) => {
      const isActive = index === 0;
      const tabId = resolveTabId(section.id);
      const classes = `observation-guide__section${isActive ? ' is-active' : ''}`;
      const tabIndex = isActive ? '0' : '-1';
      const contentClass = section.contentClass || 'observation-guide__section-content';
      const contentMarkup = renderSectionContent(section.content, contentClass);
      return `              <section
                class="${classes}"
                id="${section.id}"
                role="tabpanel"
                aria-labelledby="${tabId}"
                tabindex="${tabIndex}"
                data-guide-section
              >
                <h3 class="observation-guide__section-title">${section.title || ''}</h3>
${contentMarkup}
              </section>`;
    })
    .join('\n');

  return `            <div class="observation-guide__sections">
${panels}
            </div>`;
}

function renderSectionContent(content, contentClass) {
  const body = renderContentItems(content, 18);
  return `                <div class="${contentClass}">
${body}
                </div>`;
}

function renderContentItems(content, indent) {
  const items = Array.isArray(content) ? content : [];
  return items.map(item => renderContentItem(item, indent)).filter(Boolean).join('\n');
}

function renderContentItem(item, indent) {
  const spaces = ' '.repeat(indent);
  if (!item) {
    return '';
  }

  if (typeof item === 'string') {
    return `${spaces}${item}`;
  }

  switch (item.type) {
    case 'paragraph':
      return `${spaces}<p>${item.text || ''}</p>`;
    case 'list':
      return renderList(item, indent);
    case 'callout':
      return `${spaces}<p class="observation-guide__callout">${item.html || ''}</p>`;
    case 'examples':
      return renderExamples(Array.isArray(item.items) ? item.items : [], indent);
    default:
      if (item.html) {
        return `${spaces}${item.html}`;
      }
      return '';
  }
}

function renderList(list, indent) {
  if (!list || !Array.isArray(list.items)) {
    return '';
  }
  const tag = list.style === 'ordered' ? 'ol' : 'ul';
  const spaces = ' '.repeat(indent);
  const itemIndent = indent + 2;
  const items = list.items
    .map(item => renderListItem(item, itemIndent))
    .filter(Boolean)
    .join('\n');
  return `${spaces}<${tag}>
${items}
${spaces}</${tag}>`;
}

function renderListItem(item, indent) {
  const spaces = ' '.repeat(indent);
  if (typeof item === 'string') {
    return `${spaces}<li>${item}</li>`;
  }
  if (!item || typeof item !== 'object') {
    return '';
  }
  const text = item.text || '';
  const hasChildren = item.children && Array.isArray(item.children.items) && item.children.items.length > 0;
  if (!hasChildren) {
    return `${spaces}<li>${text}</li>`;
  }
  const childList = renderList(item.children, indent + 2);
  const textLine = text ? `${' '.repeat(indent + 2)}${text}\n` : '';
  return `${spaces}<li>
${textLine}${childList}
${spaces}</li>`;
}

function renderExamples(items, indent) {
  const spaces = ' '.repeat(indent);
  const containerIndent = ' '.repeat(indent + 2);
  const detailIndent = ' '.repeat(indent + 4);
  const entries = items
    .map(example => {
      if (!example) {
        return '';
      }
      const evaluation = example.evaluation || '';
      const observation = example.observation || '';
      const why = example.why || '';
      return `${containerIndent}<div>
${detailIndent}<dt>Evaluation: “${evaluation}”</dt>
${detailIndent}<dd>Observation: “${observation}” Why it works: ${why}</dd>
${containerIndent}</div>`;
    })
    .filter(Boolean)
    .join('\n');
  return `${spaces}<dl>
${entries}
${spaces}</dl>`;
}

function resolveTabId(sectionId = '') {
  const suffix = sectionId.startsWith('observation-guide-')
    ? sectionId.slice('observation-guide-'.length)
    : sectionId;
  return `observation-guide-tab-${suffix || 'section'}`;
}

export function updateObservationGuidePage() {
  const html = readFileSync(pagePath, 'utf8');
  const data = readObservationGuideData();
  const markup = renderObservationGuide(data);

  const startIndex = html.indexOf(START_MARKER);
  const endIndex = html.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('Unable to locate observation guide markers in observations/index.html');
  }

  const before = html.slice(0, startIndex + START_MARKER.length);
  const after = html.slice(endIndex);
  const content = `\n${markup}\n          `;
  let updated = `${before}${content}${after}`;
  const navCriticalCss = readFileSync(navCriticalCssPath, 'utf8').trim();
  const observationsCriticalCss = readFileSync(observationsCriticalCssPath, 'utf8').trim();
  updated = replaceOwnedRegion(
    updated,
    SHARED_NAV_CRITICAL_START,
    SHARED_NAV_CRITICAL_END,
    `<style>${navCriticalCss}\n${observationsCriticalCss}</style>`,
    'shared navigation plus Observations critical CSS',
  );
  updated = replaceOwnedRegion(
    updated,
    SHARED_NAV_PREFILL_START,
    SHARED_NAV_PREFILL_END,
    magnetPrefillScript(NAV_MAGNET_STORAGE_KEY),
    'shared navigation prefill',
  );
  writeFileSync(pagePath, updated);
}
