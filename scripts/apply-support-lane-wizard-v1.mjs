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

// Scope Support Lane-only layout refinements.
html = replaceOnce(
  html,
  '<body data-base-path="../">',
  '<body class="alexithymia-support-page" data-base-path="../">',
  'Support Lane body class'
);

// Keep the breathing controls concise on narrow screens while preserving meaning for assistive tech.
html = replaceOnce(
  html,
  `                <button class="support-button support-button--ghost" type="button" data-action="breathing-skip">\n                  Skip to body check-in\n                </button>`,
  `                <button\n                  class="support-button support-button--ghost"\n                  type="button"\n                  data-action="breathing-skip"\n                  aria-label="Skip breathing and continue to the body check-in"\n                >\n                  Skip breathing\n                </button>`,
  'breathing skip button'
);

// The one-step lane should not instruct users to scroll to already-revealed future cards.
html = html.replace(/\n\s*<p class="support-scroll-hint" aria-hidden="true">[^<]*<\/p>/g, '');

// Add the controls that the existing step-navigation code already expects.
const compassAnchor = `            </div>\n          </article>\n\n          <article class="support-step support-step--has-next is-hidden" data-step="library">`;
const compassNav = `            </div>\n            <div class="support-step__nav" data-step-cta>\n              <button class="support-button support-button--ghost" type="button" data-step-back>Back</button>\n              <div class="support-step__nav-primary">\n                <button class="support-button support-button--ghost" type="button" data-step-skip>I'm not sure</button>\n                <button class="support-button" type="button" data-step-next>Continue</button>\n              </div>\n            </div>\n          </article>\n\n          <article class="support-step support-step--has-next is-hidden" data-step="library">`;
html = replaceOnce(html, compassAnchor, compassNav, 'compass navigation');

const libraryAnchor = `            <div class="emotion-library" data-emotion-library>\n              <p class="support-note">Select an emotion above to load its details.</p>\n            </div>\n          </article>`;
const libraryNav = `            <div class="emotion-library" data-emotion-library>\n              <p class="support-note">Select an emotion above to load its details.</p>\n            </div>\n            <div class="support-step__nav" data-step-cta>\n              <button class="support-button support-button--ghost" type="button" data-step-back>Back</button>\n              <button class="support-button" type="button" data-step-next>Continue</button>\n            </div>\n          </article>`;
html = replaceOnce(html, libraryAnchor, libraryNav, 'library navigation');

const journalAnchor = `            >\n              Open full screen journal\n            </button>\n          </article>`;
const journalNav = `            >\n              Open full screen journal\n            </button>\n            <div class="support-step__nav" data-step-cta>\n              <button class="support-button support-button--ghost" type="button" data-step-back>Back</button>\n              <button class="support-button" type="button" data-step-next>Continue</button>\n            </div>\n          </article>`;
html = replaceOnce(html, journalAnchor, journalNav, 'journal navigation');

const regulationAnchor = `            <div class="regulation-card" data-regulation-card>\n              <p class="support-note">Suggestions will appear after you choose an emotion.</p>\n            </div>\n          </article>`;
const regulationNav = `            <div class="regulation-card" data-regulation-card>\n              <p class="support-note">Suggestions will appear after you choose an emotion.</p>\n            </div>\n            <div class="support-step__nav" data-step-cta>\n              <button class="support-button support-button--ghost" type="button" data-step-back>Back</button>\n              <button class="support-button" type="button" data-step-next>Continue</button>\n            </div>\n          </article>`;
html = replaceOnce(html, regulationAnchor, regulationNav, 'regulation navigation');

const communicationAnchor = `            <div class="communication-card" data-communication-card>\n              <p class="support-note">We will suggest a sentence once you pick an emotion.</p>\n            </div>\n          </article>`;
const communicationNav = `            <div class="communication-card" data-communication-card>\n              <p class="support-note">We will suggest a sentence once you pick an emotion.</p>\n            </div>\n            <div class="support-step__nav" data-step-cta>\n              <button class="support-button support-button--ghost" type="button" data-step-back>Back</button>\n              <button class="support-button" type="button" data-step-next>Finish</button>\n            </div>\n          </article>`;
html = replaceOnce(html, communicationAnchor, communicationNav, 'communication navigation');

const closingAnchor = `            <p>\n              You did courageous work by checking in. Emotional vocabulary grows with repetition. Return whenever you want a guide,\n              and celebrate every moment of connection you create with yourself.\n            </p>\n          </article>`;
const closingNav = `            <p>\n              You did courageous work by checking in. Emotional vocabulary grows with repetition. Return whenever you want a guide,\n              and celebrate every moment of connection you create with yourself.\n            </p>\n            <div class="support-step__nav support-step__nav--back-only" data-step-cta>\n              <button class="support-button support-button--ghost" type="button" data-step-back>Back</button>\n            </div>\n          </article>`;
html = replaceOnce(html, closingAnchor, closingNav, 'closing navigation');

// Restore the lane's intended one-step-at-a-time contract.
const revealFn = `  function revealStep(key) {\n    const step = steps[key];\n    if (!step || !step.classList.contains('is-hidden')) return;\n    step.classList.remove('is-hidden');\n  }`;
const showOnlyFn = `  function showOnlyStep(key) {\n    const active = steps[key];\n    if (!active) return;\n    Object.entries(steps).forEach(([stepKey, node]) => {\n      if (!node) return;\n      const isActive = stepKey === key;\n      node.classList.toggle('is-hidden', !isActive);\n      node.classList.toggle('step-current', isActive);\n    });\n  }`;
js = replaceOnce(js, revealFn, showOnlyFn, 'revealStep function');

const goToOld = `  function goToStep(key, options = {}) {\n    const step = steps[key];\n    if (!step) return;\n    revealStep(key);\n    state.activeStep = key;\n    document.querySelectorAll('.support-step.step-current').forEach((node) => {\n      node.classList.remove('step-current');\n    });\n    step.classList.add('step-current');\n    updateStepControls();`;
const goToNew = `  function goToStep(key, options = {}) {\n    const step = steps[key];\n    if (!step) return;\n    state.activeStep = key;\n    showOnlyStep(key);\n    updateStepControls();`;
js = replaceOnce(js, goToOld, goToNew, 'goToStep implementation');

// Do not show the next card underneath a running breathing exercise.
js = replaceOnce(
  js,
  `    revealStep('body');\n    updateStepControls();\n    if (breathingTimer) {`,
  `    if (breathingTimer) {`,
  'breathing pre-reveal'
);

// Compass matches should populate invisibly; the user decides when to continue.
js = replaceOnce(
  js,
  `    updateCandidateSnapshot();\n    revealStep('library');\n    updateStepControls();\n  }`,
  `    updateCandidateSnapshot();\n    updateStepControls();\n  }`,
  'library pre-reveal from compass'
);

// Choosing an emotion prepares later steps without revealing the rest of the journey at once.
js = replaceOnce(
  js,
  `    revealStep('journal');\n    revealStep('regulation');\n    revealStep('communication');\n    revealStep('closing');\n    renderRegulationCard(emotion);`,
  `    renderRegulationCard(emotion);`,
  'later-step pre-reveals'
);

// Make the dormant next controls reflect whether the current guided task is complete.
const nextControlOld = `    if (nextButton) {\n      const hideNext = index >= STEP_SEQUENCE.length - 1;\n      nextButton.hidden = hideNext;\n      setControlButtonState(nextButton, hideNext);\n    }`;
const nextControlNew = `    if (nextButton) {\n      const hideNext = index >= STEP_SEQUENCE.length - 1;\n      const waitingForCompass = state.activeStep === 'compass' && !state.compassTouched;\n      const waitingForEmotion = state.activeStep === 'library' && !state.selectedEmotion;\n      nextButton.hidden = hideNext;\n      setControlButtonState(nextButton, hideNext || waitingForCompass || waitingForEmotion);\n    }`;
js = replaceOnce(js, nextControlOld, nextControlNew, 'next button state');

// Enable Compass Continue as soon as the person intentionally moves the compass.
js = replaceOnce(
  js,
  `    if (detail.userTriggered) {\n      state.compassTouched = true;\n    }`,
  `    if (detail.userTriggered) {\n      state.compassTouched = true;\n      updateStepControls();\n    }`,
  'compass touched state'
);

// Ensure initial DOM state follows the same one-step contract.
js = replaceOnce(
  js,
  `  function init() {\n    const initialStepElement = steps[state.activeStep];\n    initialStepElement?.classList.add('step-current');`,
  `  function init() {\n    showOnlyStep(state.activeStep);`,
  'initial step state'
);

// Keep the changing breathing status terse so it cannot reflow the whole card every second.
js = replaceOnce(
  js,
  `      const label = BREATH_PATTERN_LABELS[state.preferredBreathPattern] || 'guided breath';\n      breathingDisplay.textContent = \`Press start to try a \${label.toLowerCase()} (~30 seconds).\`;`,
  `      breathingDisplay.textContent = 'Press start for a 30-second guided breath.';`,
  'breathing reset copy'
);
js = replaceOnce(
  js,
  `    breathingDisplay.textContent = \`\${label}: \${sequence[phaseIndex].label} • \${remaining}s\`;`,
  `    breathingDisplay.textContent = \`\${sequence[phaseIndex].label} • \${remaining}s\`;`,
  'initial breathing phase copy'
);
js = js.replace(
  `      breathingDisplay.textContent = \`\${label}: \${sequence[phaseIndex].label} • \${remaining}s\`;`,
  `      breathingDisplay.textContent = \`\${sequence[phaseIndex].label} • \${remaining}s\`;`
);
js = replaceOnce(
  js,
  `        breathingDisplay.textContent = \`\${label} complete. Ready for the body check-in when it feels right.\`;`,
  `        breathingDisplay.textContent = 'Breathing complete. Ready for the body check-in.';`,
  'breathing completion copy'
);

if (js.includes('revealStep(')) {
  throw new Error('A revealStep call remains after one-step conversion');
}

const supportCssMarker = '/* Support Lane wizard stability v1 */';
if (!css.includes(supportCssMarker)) {
  css += `\n\n${supportCssMarker}\n.alexithymia-support-page .support-flow {\n  gap: 0;\n  padding-bottom: 1rem;\n}\n\n.alexithymia-support-page .support-step {\n  scroll-margin-top: clamp(1rem, 9vh, 4.5rem);\n}\n\n.alexithymia-support-page .support-step--has-next {\n  padding-bottom: clamp(1.25rem, 3vw, 1.75rem);\n}\n\n.alexithymia-support-page .breathing-card__prompt {\n  display: grid;\n  align-content: center;\n  min-block-size: 3em;\n  line-height: 1.4;\n  text-wrap: pretty;\n}\n\n.alexithymia-support-page .support-step__nav {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 0.65rem;\n  padding-top: 0.8rem;\n  border-top: 1px solid color-mix(in srgb, var(--outline) 18%, transparent);\n}\n\n.alexithymia-support-page .support-step__nav-primary {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  gap: 0.55rem;\n  margin-left: auto;\n}\n\n.alexithymia-support-page .support-step__nav--back-only {\n  justify-content: flex-start;\n}\n\n.alexithymia-support-page .support-step__nav .support-button {\n  width: auto;\n  min-width: 44px;\n  margin: 0;\n}\n\n.alexithymia-support-page .support-step__nav .support-button--ghost {\n  box-shadow: 0 4px 0 color-mix(in srgb, var(--outline) 18%, transparent);\n}\n\n.alexithymia-support-page .support-step__nav .support-button:disabled {\n  opacity: 0.5;\n  transform: none;\n  box-shadow: none;\n  cursor: default;\n}\n\n@media (max-width: 640px) {\n  .alexithymia-support-page .support-step {\n    gap: 0.8rem;\n    padding: 1rem;\n  }\n\n  .alexithymia-support-page .support-step--has-next {\n    padding-bottom: 1rem;\n  }\n\n  .alexithymia-support-page .breathing-card {\n    gap: 0.8rem;\n    padding: 0.9rem;\n  }\n\n  .alexithymia-support-page .breathing-card__prompt {\n    min-block-size: 2.8em;\n    font-size: 0.95rem;\n  }\n\n  .alexithymia-support-page .breathing-card__actions {\n    gap: 0.6rem;\n  }\n\n  .alexithymia-support-page .support-step__nav {\n    align-items: stretch;\n  }\n\n  .alexithymia-support-page .support-step__nav-primary {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    flex: 1 1 auto;\n  }\n\n  .alexithymia-support-page .support-step__nav-primary .support-button {\n    width: 100%;\n    padding-inline: 0.65rem;\n  }\n}\n`;
}

writeFileSync(htmlPath, html);
writeFileSync(jsPath, js);
writeFileSync(cssPath, css);

// Focused structural checks.
const finalHtml = readFileSync(htmlPath, 'utf8');
const finalJs = readFileSync(jsPath, 'utf8');
const finalCss = readFileSync(cssPath, 'utf8');

if ((finalHtml.match(/class="support-step/g) || []).length !== 9) {
  throw new Error('Support Lane no longer has exactly nine steps');
}
if (finalHtml.includes('support-scroll-hint')) {
  throw new Error('Legacy scroll hints remain');
}
if ((finalHtml.match(/data-step-cta/g) || []).length !== 6) {
  throw new Error('Expected six manual step-navigation groups');
}
if (!finalJs.includes('function showOnlyStep(key)') || finalJs.includes('revealStep(')) {
  throw new Error('One-step visibility contract was not installed cleanly');
}
if (!finalJs.includes("state.activeStep === 'library' && !state.selectedEmotion")) {
  throw new Error('Library Continue is not guarded by emotion selection');
}
if (!finalJs.includes("state.activeStep === 'compass' && !state.compassTouched")) {
  throw new Error('Compass Continue is not guarded by interaction');
}
if (!finalCss.includes(supportCssMarker)) {
  throw new Error('Support Lane stability CSS missing');
}

console.log('Support Lane wizard v1 applied and structurally verified.');
