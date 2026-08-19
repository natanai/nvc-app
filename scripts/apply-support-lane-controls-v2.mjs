import { readFileSync, writeFileSync } from 'node:fs';

const htmlPath = 'alexithymia-support/index.html';
const jsPath = 'scripts/alexithymia-support.js';

let html = readFileSync(htmlPath, 'utf8');
let js = readFileSync(jsPath, 'utf8');

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing ${label} anchor`);
  return source.replace(from, to);
}

// Primary progression should stay explicit; symbols are accents, not replacements.
html = replaceOnce(
  html,
  '<button class="support-button support-button--icon-label" type="button" data-action="start" data-support-icon="next">Begin</button>',
  '<button class="support-button support-button--continue" type="button" data-action="start">Begin <span class="support-button__symbol" aria-hidden="true">→</span></button>',
  'intro begin control'
);

const breathingOld = `              <div class="breathing-card__actions">\n                <button class="support-button support-button--icon-only support-button--round" type="button" data-action="breathing-start" data-support-icon="play" aria-label="Start breathing" title="Start breathing"></button>\n                <button\n                  class="support-button support-button--ghost support-button--icon-only support-button--round"\n                  type="button"\n                  data-action="breathing-skip"\n                  data-support-icon="skip"\n                  aria-label="Skip breathing and continue to the body check-in"\n                  title="Skip breathing"\n                ></button>\n              </div>`;
const breathingNew = `              <div class="breathing-card__actions">\n                <button class="support-button support-button--breathing-action" type="button" data-action="breathing-start" aria-label="Start breathing">\n                  <span class="support-button__symbol" aria-hidden="true">▶</span><span>Start</span>\n                </button>\n                <button\n                  class="support-button support-button--ghost support-button--breathing-action"\n                  type="button"\n                  data-action="breathing-skip"\n                  aria-label="Skip breathing and continue to the body check-in"\n                >\n                  <span>Skip</span><span class="support-button__symbol" aria-hidden="true">→</span>\n                </button>\n              </div>`;
html = replaceOnce(html, breathingOld, breathingNew, 'breathing controls');

const bodyActionsOld = `              <div class="sensation-actions">\n                <button class="support-button support-button--icon-label" type="button" data-action="sensation-submit" data-support-icon="spark">Emotions</button>\n                <button class="support-button support-button--ghost support-button--icon-only" type="button" data-action="sensation-clear" data-support-icon="reset" aria-label="Clear choices" title="Clear choices"></button>\n              </div>\n              <div class="sensation-actions sensation-actions--secondary">\n                <button\n                  class="support-button support-button--ghost support-button--icon-label"\n                  type="button"\n                  data-action="sensation-next"\n                  data-support-icon="compass"\n                  aria-label="Skip the body check-in and use the emotion compass"\n                >Compass</button>\n              </div>`;
const bodyActionsNew = `              <div class="sensation-actions sensation-actions--progress">\n                <button class="support-button support-button--continue" type="button" data-action="sensation-submit">\n                  <span>Continue</span><span class="support-button__symbol" aria-hidden="true">→</span>\n                </button>\n                <button class="support-button support-button--ghost support-button--reset" type="button" data-action="sensation-clear" aria-label="Clear body choices" title="Clear body choices">\n                  <span aria-hidden="true">↺</span>\n                </button>\n              </div>`;
html = replaceOnce(html, bodyActionsOld, bodyActionsNew, 'body progress controls');

const backOld = '<button class="support-button support-button--ghost support-button--icon-only support-step__nav-icon" type="button" data-step-back data-support-icon="back" aria-label="Back" title="Back"></button>';
const backNew = '<button class="support-button support-button--ghost support-button--nav" type="button" data-step-back><span class="support-button__symbol" aria-hidden="true">←</span><span>Back</span></button>';
if (!html.includes(backOld)) throw new Error('Missing Back icon controls');
html = html.replaceAll(backOld, backNew);

const nextOld = '<button class="support-button support-button--icon-only support-step__nav-icon" type="button" data-step-next data-support-icon="next" aria-label="Continue" title="Continue"></button>';
const nextNew = '<button class="support-button support-button--continue support-button--nav" type="button" data-step-next><span>Continue</span><span class="support-button__symbol" aria-hidden="true">→</span></button>';
if (!html.includes(nextOld)) throw new Error('Missing Continue icon controls');
html = html.replaceAll(nextOld, nextNew);

html = replaceOnce(
  html,
  '<button class="support-button support-button--ghost support-button--icon-label" type="button" data-step-skip data-support-icon="skip">Not sure</button>',
  '<button class="support-button support-button--ghost support-button--nav" type="button" data-step-skip>Not sure</button>',
  'compass not-sure control'
);

html = replaceOnce(
  html,
  '<button class="support-button support-button--icon-only support-step__nav-icon" type="button" data-step-next data-support-icon="check" aria-label="Finish" title="Finish"></button>',
  '<button class="support-button support-button--continue support-button--nav" type="button" data-step-next><span>Finish</span><span class="support-button__symbol" aria-hidden="true">✓</span></button>',
  'Finish control'
);

// Keep Journal as a concise icon+word action; it is not the lane's progression control.
html = html.replace(
  'class="support-button"\n              type="button"\n              data-support-journal-open',
  'class="support-button support-button--icon-label"\n              type="button"\n              data-support-journal-open'
);

// Replace the V1 symbol treatment with a calmer, legibility-first V2 treatment.
const marker = '/* Support Lane symbolic controls v1 */';
const markerIndex = html.indexOf(marker);
if (markerIndex < 0) throw new Error('Missing Support Lane symbolic controls v1 marker');
const styleEnd = html.indexOf('</style>', markerIndex);
if (styleEnd < 0) throw new Error('Could not locate Support Lane inline style end');
const css = `/* Support Lane control hierarchy v2 */
.alexithymia-support-page .support-button__symbol {
  display: inline-block;
  flex: 0 0 auto;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI Symbol', sans-serif;
  font-size: 1.05em;
  font-weight: 800;
  line-height: 1;
}

.alexithymia-support-page .support-button--continue,
.alexithymia-support-page .support-button--nav,
.alexithymia-support-page .support-button--breathing-action,
.alexithymia-support-page .support-button--icon-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.alexithymia-support-page .support-button[data-support-icon='journal']::before,
.alexithymia-support-page .support-button[data-support-icon='check']::before {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  min-width: 1.1em;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI Symbol', sans-serif;
  font-size: 1.02em;
  font-weight: 800;
  line-height: 1;
}

.alexithymia-support-page [data-support-icon='journal']::before { content: '▤'; }
.alexithymia-support-page [data-support-icon='check']::before { content: '✓'; }

.alexithymia-support-page .breathing-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.alexithymia-support-page .breathing-card__actions .support-button {
  width: 100%;
  min-height: 48px;
  padding-inline: 0.75rem;
}

.alexithymia-support-page .sensation-region-list {
  gap: clamp(0.65rem, 2vw, 0.9rem);
}

.alexithymia-support-page .sensation-region {
  gap: 0.45rem;
  padding: clamp(0.75rem, 2vw, 0.95rem);
}

.alexithymia-support-page .sensation-region__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.65rem;
}

.alexithymia-support-page .sensation-region__meta {
  min-width: 0;
}

.alexithymia-support-page .sensation-region__toggle {
  width: 46px;
  min-width: 46px;
  height: 46px;
  min-height: 46px;
  margin: 0;
  padding: 0;
  border-radius: var(--radius-circle);
  box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 24%, transparent);
}

.alexithymia-support-page .sensation-region__toggle::before {
  content: '+';
  display: block;
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1;
}

.alexithymia-support-page .sensation-region__toggle[aria-expanded='true']::before {
  content: '−';
}

.alexithymia-support-page .sensation-region__toggle[data-region-completed='true'][aria-expanded='false']::before {
  content: '✓';
  font-size: 1.2rem;
}

.alexithymia-support-page .sensation-actions--progress {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px;
  gap: 0.6rem;
  align-items: stretch;
  margin-top: 0.9rem;
}

.alexithymia-support-page .sensation-actions--progress .support-button--continue {
  width: 100%;
}

.alexithymia-support-page .support-button--reset {
  width: 48px;
  min-width: 48px;
  height: 48px;
  min-height: 48px;
  padding: 0;
  border-radius: var(--radius-circle);
  font-size: 1.1rem;
}

.alexithymia-support-page .support-step__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
}

.alexithymia-support-page .support-step__nav-primary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-left: auto;
}

.alexithymia-support-page .support-step__nav .support-button {
  width: auto;
  min-height: 46px;
  padding: 0.5rem 0.8rem;
  font-size: 0.78rem;
  white-space: nowrap;
}

.alexithymia-support-page .support-step__nav .support-button--continue {
  min-width: 7.5rem;
}

.alexithymia-support-page .support-step__nav .support-button:disabled {
  opacity: 0.46;
}

@media (max-width: 640px) {
  .alexithymia-support-page .sensation-region__title {
    font-size: 1rem;
  }

  .alexithymia-support-page .support-step__nav {
    gap: 0.45rem;
  }

  .alexithymia-support-page .support-step__nav-primary {
    gap: 0.4rem;
  }

  .alexithymia-support-page .support-step__nav .support-button {
    padding-inline: 0.65rem;
    letter-spacing: 0.025em;
  }

  .alexithymia-support-page .support-step__nav .support-button--continue {
    min-width: 6.8rem;
  }
}`;
html = html.slice(0, markerIndex) + css + '\n    ' + html.slice(styleEnd);

// Remove the dead alternate body-skip path. The primary Continue path already handles
// both selected and unselected body states and advances to the compass.
js = replaceOnce(
  js,
  `      case 'body':\n        if (skip) {\n          goToStep('compass');\n        } else {\n          handleSensationSubmit();\n        }\n        break;`,
  `      case 'body':\n        handleSensationSubmit();\n        break;`,
  'body advance branch'
);

js = replaceOnce(
  js,
  `  function handleSensationSkip() {\n    finishGuidedScan();\n    goToStep('compass');\n  }\n\n`,
  '',
  'dead sensation skip handler'
);

js = replaceOnce(
  js,
  `    const sensationSubmit = document.querySelector('[data-action="sensation-submit"]');\n    const sensationClear = document.querySelector('[data-action="sensation-clear"]');\n    const sensationNext = document.querySelector('[data-action="sensation-next"]');\n    sensationSubmit?.addEventListener('click', handleSensationSubmit);\n    sensationClear?.addEventListener('click', handleSensationClear);\n    sensationNext?.addEventListener('click', handleSensationSkip);`,
  `    const sensationSubmit = document.querySelector('[data-action="sensation-submit"]');\n    const sensationClear = document.querySelector('[data-action="sensation-clear"]');\n    sensationSubmit?.addEventListener('click', handleSensationSubmit);\n    sensationClear?.addEventListener('click', handleSensationClear);`,
  'body action bindings'
);

writeFileSync(htmlPath, html);
writeFileSync(jsPath, js);

const finalHtml = readFileSync(htmlPath, 'utf8');
const finalJs = readFileSync(jsPath, 'utf8');
if (!finalHtml.includes('Support Lane control hierarchy v2')) throw new Error('V2 Support CSS missing');
if (!finalHtml.includes('data-action="sensation-submit"')) throw new Error('Body Continue action missing');
if (finalHtml.includes('data-action="sensation-next"')) throw new Error('Redundant Compass body action still present');
if (finalJs.includes('finishGuidedScan()')) throw new Error('Dangling finishGuidedScan call remains');
if (finalJs.includes('handleSensationSkip')) throw new Error('Dead sensation skip handler remains');
if (!finalHtml.includes('<span>Continue</span><span class="support-button__symbol" aria-hidden="true">→</span>')) throw new Error('Visible Continue controls missing');
console.log('Support Lane control hierarchy v2 applied.');
