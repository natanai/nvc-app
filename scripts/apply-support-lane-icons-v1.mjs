import { readFileSync, writeFileSync } from 'node:fs';

const htmlPath = 'alexithymia-support/index.html';
const jsPath = 'scripts/alexithymia-support.js';
const cssPath = 'styles.css';

let html = readFileSync(htmlPath, 'utf8');
let js = readFileSync(jsPath, 'utf8');
let css = readFileSync(cssPath, 'utf8');

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Missing ${label} anchor`);
  }
  return source.replace(from, to);
}

// Static Support Lane controls: keep meaning in accessible names while reducing visible copy.
html = replaceOnce(
  html,
  '<button class="support-button" type="button" data-action="start">Begin check-in</button>',
  '<button class="support-button support-button--icon-label" type="button" data-action="start" data-support-icon="next">Begin</button>',
  'intro start control'
);

html = replaceOnce(
  html,
  '<button class="support-button" type="button" data-action="breathing-start">Start breathing</button>',
  '<button class="support-button support-button--icon-only support-button--round" type="button" data-action="breathing-start" data-support-icon="play" aria-label="Start breathing" title="Start breathing"></button>',
  'breathing start control'
);

html = replaceOnce(
  html,
  `                <button\n                  class="support-button support-button--ghost"\n                  type="button"\n                  data-action="breathing-skip"\n                  aria-label="Skip breathing and continue to the body check-in"\n                >\n                  Skip breathing\n                </button>`,
  `                <button\n                  class="support-button support-button--ghost support-button--icon-only support-button--round"\n                  type="button"\n                  data-action="breathing-skip"\n                  data-support-icon="skip"\n                  aria-label="Skip breathing and continue to the body check-in"\n                  title="Skip breathing"\n                ></button>`,
  'breathing skip control'
);

html = replaceOnce(
  html,
  '<button class="support-button" type="button" data-action="sensation-submit">See possible emotions</button>',
  '<button class="support-button support-button--icon-label" type="button" data-action="sensation-submit" data-support-icon="spark">Emotions</button>',
  'body emotion control'
);

html = replaceOnce(
  html,
  '<button class="support-button support-button--ghost" type="button" data-action="sensation-clear">Clear choices</button>',
  '<button class="support-button support-button--ghost support-button--icon-only" type="button" data-action="sensation-clear" data-support-icon="reset" aria-label="Clear choices" title="Clear choices"></button>',
  'body clear control'
);

html = replaceOnce(
  html,
  `                <button class="support-button support-button--ghost" type="button" data-action="sensation-next">\n                  I'm not sure — skip to the compass\n                </button>`,
  `                <button\n                  class="support-button support-button--ghost support-button--icon-label"\n                  type="button"\n                  data-action="sensation-next"\n                  data-support-icon="compass"\n                  aria-label="Skip the body check-in and use the emotion compass"\n                >Compass</button>`,
  'body compass control'
);

// Shared step navigation uses familiar icon-only arrows/checks; nuanced skip keeps a short label.
html = html.replaceAll(
  '<button class="support-button support-button--ghost" type="button" data-step-back>Back</button>',
  '<button class="support-button support-button--ghost support-button--icon-only support-step__nav-icon" type="button" data-step-back data-support-icon="back" aria-label="Back" title="Back"></button>'
);
html = html.replaceAll(
  '<button class="support-button" type="button" data-step-next>Continue</button>',
  '<button class="support-button support-button--icon-only support-step__nav-icon" type="button" data-step-next data-support-icon="next" aria-label="Continue" title="Continue"></button>'
);
html = replaceOnce(
  html,
  '<button class="support-button support-button--ghost" type="button" data-step-skip>I\'m not sure</button>',
  '<button class="support-button support-button--ghost support-button--icon-label" type="button" data-step-skip data-support-icon="skip">Not sure</button>',
  'compass skip control'
);
html = replaceOnce(
  html,
  '<button class="support-button" type="button" data-step-next>Finish</button>',
  '<button class="support-button support-button--icon-only support-step__nav-icon" type="button" data-step-next data-support-icon="check" aria-label="Finish" title="Finish"></button>',
  'finish control'
);

html = replaceOnce(
  html,
  `            >\n              Open full screen journal\n            </button>`,
  `              data-support-icon="journal"\n              class="support-button support-button--icon-label"\n            >\n              Journal\n            </button>`,
  'journal open control'
);

// Dynamic body-region cards: remove repetitive filler and make expansion a compact icon control.
js = replaceOnce(
  js,
  `    if (!selections.length) {\n      const fallback =\n        region.defaultSummary || region.summary.dataset.defaultSummary || 'We can check in here whenever you\\'re ready.';\n      region.summary.textContent = fallback;\n      region.summary.dataset.hasSelection = 'false';\n      return;\n    }`,
  `    if (!selections.length) {\n      region.summary.textContent = '';\n      region.summary.hidden = true;\n      region.summary.dataset.hasSelection = 'false';\n      return;\n    }`,
  'empty region summary behavior'
);
js = replaceOnce(
  js,
  `    const display = selections.slice(0, 3).join(', ');\n    region.summary.textContent = selections.length === 1 ? \`Noticing: \${display}.\` : \`Noticing: \${display}\${\n      selections.length > 3 ? '…' : ''\n    }.\`;\n    region.summary.dataset.hasSelection = 'true';`,
  `    const display = selections.slice(0, 3).join(', ');\n    region.summary.hidden = false;\n    region.summary.textContent = selections.length === 1 ? \`Noticing: \${display}.\` : \`Noticing: \${display}\${\n      selections.length > 3 ? '…' : ''\n    }.\`;\n    region.summary.dataset.hasSelection = 'true';`,
  'selected region summary behavior'
);

js = replaceOnce(
  js,
  `  function setRegionToggleState(regionId, { completed = false } = {}) {\n    const region = regionElements.get(regionId);\n    if (!region?.toggle) {\n      return;\n    }\n    region.toggle.textContent = completed ? region.toggleCompletedLabel : region.toggleDefaultLabel;\n    region.toggle.dataset.regionCompleted = completed ? 'true' : 'false';\n  }`,
  `  function setRegionToggleState(regionId, { completed = false } = {}) {\n    const region = regionElements.get(regionId);\n    if (!region?.toggle) {\n      return;\n    }\n    region.toggle.dataset.regionCompleted = completed ? 'true' : 'false';\n    const label = completed ? \`Review \${region.label} check-in\` : \`Check in: \${region.label}\`;\n    region.toggle.setAttribute('aria-label', label);\n    region.toggle.title = label;\n  }`,
  'region toggle state'
);

js = replaceOnce(
  js,
  `      const summary = document.createElement('p');\n      summary.className = 'sensation-region__summary';\n      summary.dataset.hasSelection = 'false';\n      const defaultSummary = 'We can check in here whenever you\\'re ready.';\n      summary.dataset.defaultSummary = defaultSummary;\n      summary.textContent = defaultSummary;\n      meta.appendChild(summary);`,
  `      const summary = document.createElement('p');\n      summary.className = 'sensation-region__summary';\n      summary.dataset.hasSelection = 'false';\n      summary.dataset.defaultSummary = '';\n      summary.textContent = '';\n      summary.hidden = true;\n      meta.appendChild(summary);`,
  'region default summary'
);

js = replaceOnce(
  js,
  `      const toggle = document.createElement('button');\n      toggle.type = 'button';\n      toggle.className = 'support-button support-button--ghost sensation-region__toggle';\n      toggle.dataset.regionToggle = region.id;\n      toggle.setAttribute('aria-expanded', 'false');\n      toggle.setAttribute('aria-controls', detailsId);\n      toggle.textContent = 'Check in';\n      header.appendChild(toggle);`,
  `      const toggle = document.createElement('button');\n      toggle.type = 'button';\n      toggle.className = 'support-button support-button--ghost sensation-region__toggle';\n      toggle.dataset.regionToggle = region.id;\n      toggle.dataset.regionCompleted = 'false';\n      toggle.setAttribute('aria-expanded', 'false');\n      toggle.setAttribute('aria-controls', detailsId);\n      toggle.setAttribute('aria-label', \`Check in: \${region.label}\`);\n      toggle.title = \`Check in: \${region.label}\`;\n      header.appendChild(toggle);`,
  'region toggle markup'
);

js = replaceOnce(
  js,
  `      const closeButton = document.createElement('button');\n      closeButton.type = 'button';\n      closeButton.className = 'support-button support-button--ghost sensation-region__close';\n      closeButton.dataset.regionClose = region.id;\n      closeButton.textContent = 'Done with this area';\n      details.appendChild(closeButton);`,
  `      const closeButton = document.createElement('button');\n      closeButton.type = 'button';\n      closeButton.className = 'support-button support-button--ghost support-button--icon-label sensation-region__close';\n      closeButton.dataset.regionClose = region.id;\n      closeButton.dataset.supportIcon = 'check';\n      closeButton.textContent = 'Done';\n      details.appendChild(closeButton);`,
  'region close control'
);

js = replaceOnce(
  js,
  `      regionElements.set(region.id, {\n        element: section,\n        summary,\n        label: region.label,\n        toggle,\n        details,\n        defaultSummary,\n        toggleDefaultLabel: 'Check in',\n        toggleCompletedLabel: 'Completed',\n      });`,
  `      regionElements.set(region.id, {\n        element: section,\n        summary,\n        label: region.label,\n        toggle,\n        details,\n      });`,
  'region element registry'
);

js = replaceOnce(
  js,
  `    if (region.toggle) {\n      region.toggle.setAttribute('aria-expanded', 'false');\n      if (returnFocus) {`,
  `    if (region.toggle) {\n      region.toggle.setAttribute('aria-expanded', 'false');\n      const completed = region.toggle.dataset.regionCompleted === 'true';\n      const label = completed ? \`Review \${region.label} check-in\` : \`Check in: \${region.label}\`;\n      region.toggle.setAttribute('aria-label', label);\n      region.toggle.title = label;\n      if (returnFocus) {`,
  'collapsed region accessible label'
);

js = replaceOnce(
  js,
  `    if (region.toggle) {\n      region.toggle.setAttribute('aria-expanded', 'true');\n    }`,
  `    if (region.toggle) {\n      region.toggle.setAttribute('aria-expanded', 'true');\n      const label = \`Close \${region.label} check-in\`;\n      region.toggle.setAttribute('aria-label', label);\n      region.toggle.title = label;\n    }`,
  'expanded region accessible label'
);

const marker = '/* Support Lane symbolic controls v1 */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.alexithymia-support-page .support-button[data-support-icon],\n.alexithymia-support-page .support-button--icon-label {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 0.5rem;\n}\n\n.alexithymia-support-page .support-button[data-support-icon]::before,\n.alexithymia-support-page .support-button--icon-label[data-support-icon]::before,\n.alexithymia-support-page .sensation-region__toggle::before {\n  display: inline-grid;\n  place-items: center;\n  flex: 0 0 auto;\n  min-width: 1.15em;\n  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI Symbol', sans-serif;\n  font-size: 1.05em;\n  font-weight: 800;\n  line-height: 1;\n}\n\n.alexithymia-support-page [data-support-icon='play']::before { content: '▶'; }\n.alexithymia-support-page [data-support-icon='skip']::before { content: '»'; }\n.alexithymia-support-page [data-support-icon='back']::before { content: '←'; }\n.alexithymia-support-page [data-support-icon='next']::before { content: '→'; }\n.alexithymia-support-page [data-support-icon='check']::before { content: '✓'; }\n.alexithymia-support-page [data-support-icon='reset']::before { content: '↺'; }\n.alexithymia-support-page [data-support-icon='spark']::before { content: '✦'; }\n.alexithymia-support-page [data-support-icon='compass']::before { content: '⌖'; }\n.alexithymia-support-page [data-support-icon='journal']::before { content: '▤'; }\n\n.alexithymia-support-page .support-button--icon-only {\n  width: 3.2rem;\n  min-width: 3.2rem;\n  height: 3.2rem;\n  min-height: 3.2rem;\n  padding: 0;\n  aspect-ratio: 1;\n}\n\n.alexithymia-support-page .support-button--round,\n.alexithymia-support-page .support-step__nav-icon {\n  border-radius: var(--radius-circle);\n}\n\n.alexithymia-support-page .breathing-card__actions {\n  display: flex;\n  flex-direction: row;\n  justify-content: center;\n  align-items: center;\n  gap: 0.8rem;\n}\n\n.alexithymia-support-page .breathing-card__actions .support-button {\n  width: 3.6rem;\n  min-width: 3.6rem;\n  height: 3.6rem;\n  min-height: 3.6rem;\n  padding: 0;\n}\n\n.alexithymia-support-page .sensation-region__header {\n  align-items: center;\n}\n\n.alexithymia-support-page .sensation-region__toggle {\n  width: 3rem;\n  min-width: 3rem;\n  height: 3rem;\n  min-height: 3rem;\n  padding: 0;\n  border-radius: var(--radius-circle);\n  flex: 0 0 auto;\n}\n\n.alexithymia-support-page .sensation-region__toggle::before {\n  content: '+';\n  font-size: 1.45rem;\n}\n\n.alexithymia-support-page .sensation-region__toggle[aria-expanded='true']::before {\n  content: '−';\n}\n\n.alexithymia-support-page .sensation-region__toggle[data-region-completed='true'][aria-expanded='false']::before {\n  content: '✓';\n  font-size: 1.15rem;\n}\n\n.alexithymia-support-page .sensation-actions {\n  align-items: center;\n}\n\n.alexithymia-support-page .sensation-actions:not(.sensation-actions--secondary) {\n  grid-template-columns: minmax(0, 1fr) auto;\n}\n\n.alexithymia-support-page .sensation-actions .support-button--icon-only {\n  width: 3.25rem;\n  min-width: 3.25rem;\n}\n\n.alexithymia-support-page .sensation-actions--secondary .support-button {\n  width: auto;\n  justify-self: start;\n}\n\n@media (max-width: 640px) {\n  .alexithymia-support-page .support-step__nav {\n    align-items: center;\n  }\n\n  .alexithymia-support-page .support-step__nav-primary {\n    display: flex;\n    flex: 0 1 auto;\n    align-items: center;\n  }\n\n  .alexithymia-support-page .support-step__nav-primary .support-button {\n    width: auto;\n  }\n\n  .alexithymia-support-page .sensation-region {\n    padding-block: 0.8rem;\n  }\n\n  .alexithymia-support-page .sensation-region__header {\n    grid-template-columns: minmax(0, 1fr) auto;\n    gap: 0.65rem;\n  }\n}\n`;
}

writeFileSync(htmlPath, html);
writeFileSync(jsPath, js);
writeFileSync(cssPath, css);

// Focused structural checks.
const finalHtml = readFileSync(htmlPath, 'utf8');
const finalJs = readFileSync(jsPath, 'utf8');
const finalCss = readFileSync(cssPath, 'utf8');

if (!finalHtml.includes('data-support-icon="play"') || !finalHtml.includes('data-support-icon="compass"')) {
  throw new Error('Support Lane symbolic controls were not added');
}
if (!finalHtml.includes('aria-label="Clear choices"') || !finalHtml.includes('aria-label="Continue"')) {
  throw new Error('Icon-only controls are missing accessible labels');
}
if (finalHtml.includes('See possible emotions') || finalHtml.includes("I'm not sure — skip to the compass")) {
  throw new Error('Long body-step action copy remains');
}
if (finalJs.includes("toggle.textContent = 'Check in'")) {
  throw new Error('Repeated region Check in text remains');
}
if (finalJs.includes("We can check in here whenever you're ready.")) {
  throw new Error('Repeated empty-region filler remains');
}
if (!finalJs.includes("region.summary.hidden = true") || !finalJs.includes("region.summary.hidden = false")) {
  throw new Error('Region summary visibility behavior is incomplete');
}
if (!finalCss.includes(marker) || !finalCss.includes("data-region-completed='true'")) {
  throw new Error('Scoped symbolic-control styles are missing');
}

console.log('Support Lane symbolic controls v1 integrated.');
