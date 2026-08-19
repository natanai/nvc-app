import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing anchor: ${label}`);
  const next = source.replace(from, to);
  if (next === source) throw new Error(`Replacement did not change: ${label}`);
  return next;
}

// 1) Shared Journal viewport: prefer the dynamic viewport. The later svh
// overrides made the dialog shorter than the currently visible viewport after
// iOS Safari collapsed its browser chrome.
const stylesPath = 'styles.css';
let styles = readFileSync(stylesPath, 'utf8');
const svhBlocks = [
`@supports (height: 100svh) {
  .support-journal__open {
    top: calc(100svh - clamp(5rem, 16vw, 6rem));
  }

  .support-journal__dialog {
    min-height: 100svh;
    height: 100svh;
    max-height: 100svh;
  }
}

`,
`  @supports (height: 100svh) {
    .support-journal__dialog {
      min-height: 100svh;
      height: 100svh;
      max-height: 100svh;
      width: min(92svh, 560px);
      max-width: min(92svh, 560px);
    }
  }
`,
];
for (const [index, block] of svhBlocks.entries()) {
  styles = replaceOnce(styles, block, '', `support journal svh override ${index + 1}`);
}
if (!styles.includes('min-height: 100dvh;') || !styles.includes('height: 100dvh;')) {
  throw new Error('Expected dynamic viewport Journal sizing to remain.');
}
writeFileSync(stylesPath, styles);

// 2) Support Lane script: delete the obsolete page-local overlay controller.
// inventory.js already owns every [data-support-journal-open] trigger and the
// single global [data-journal-overlay] container.
const scriptPath = 'scripts/alexithymia-support.js';
let script = readFileSync(scriptPath, 'utf8');
script = replaceOnce(
  script,
`  let supportJournalOpenLink = null;
  let supportJournalContainer = null;
  let supportJournalLayer = null;
  let supportJournalDialog = null;
  let supportJournalOpenButton = null;
  let supportJournalCloseButton = null;
  let supportJournalTitle = null;
  let supportJournalHeading = null;
  let supportJournalOverlayOpen = false;
  let evidencePopover = null;`,
`  let supportJournalOpenLink = null;
  let evidencePopover = null;`,
  'obsolete Support overlay declarations'
);
script = replaceOnce(
  script,
`  supportJournalOpenLink = journalStep?.querySelector('[data-journal-open-link]');
  supportJournalContainer = journalStep?.querySelector('[data-support-journal]') || null;
  supportJournalLayer = supportJournalContainer?.querySelector('[data-support-journal-layer]') || null;
  supportJournalDialog = supportJournalContainer?.querySelector('[data-support-journal-dialog]') || null;
  supportJournalOpenButton = supportJournalContainer?.querySelector('[data-support-journal-open]') || null;
  supportJournalCloseButton = supportJournalContainer?.querySelector('[data-support-journal-close]') || null;
  supportJournalTitle = journalStep?.querySelector('#support-journal-title') || null;
  supportJournalHeading = supportJournalContainer?.querySelector('[data-support-journal-heading]') || null;
  if (supportJournalHeading && supportJournalTitle?.textContent) {
    supportJournalHeading.textContent = supportJournalTitle.textContent.trim();
  }

  setupSupportJournalOverlay();
`,
`  supportJournalOpenLink = journalStep?.querySelector('[data-journal-open-link]');
`,
  'obsolete Support overlay setup'
);
const obsoleteStart = script.indexOf('  function enableSupportJournalDialogAttributes() {');
const obsoleteEnd = script.indexOf('  function getJournalStore() {', obsoleteStart);
if (obsoleteStart < 0 || obsoleteEnd < 0) {
  throw new Error('Could not isolate obsolete Support overlay functions.');
}
script = script.slice(0, obsoleteStart) + script.slice(obsoleteEnd);
for (const deadName of [
  'setupSupportJournalOverlay',
  'openSupportJournalOverlay',
  'supportJournalOverlayOpen',
  'supportJournalContainer',
  'supportJournalLayer',
]) {
  if (script.includes(deadName)) throw new Error(`Obsolete Support overlay code remains: ${deadName}`);
}
writeFileSync(scriptPath, script);

// 3) Support page: flatten the compass footer so Back + Continue are the
// primary navigation row and Not sure is a quieter fallback below on phones.
const pagePath = 'alexithymia-support/index.html';
let page = readFileSync(pagePath, 'utf8');
page = replaceOnce(
  page,
`            <div class="support-step__nav" data-step-cta>
              <button class="support-button support-button--ghost support-button--nav" type="button" data-step-back><span class="support-button__symbol" aria-hidden="true">←</span><span>Back</span></button>
              <div class="support-step__nav-primary">
                <button class="support-button support-button--ghost support-button--nav" type="button" data-step-skip>Not sure</button>
                <button class="support-button support-button--continue support-button--nav" type="button" data-step-next><span>Continue</span><span class="support-button__symbol" aria-hidden="true">→</span></button>
              </div>
            </div>`,
`            <div class="support-step__nav support-step__nav--compass" data-step-cta>
              <button class="support-button support-button--ghost support-button--nav" type="button" data-step-back><span class="support-button__symbol" aria-hidden="true">←</span><span>Back</span></button>
              <button class="support-button support-button--ghost support-button--nav support-button--not-sure" type="button" data-step-skip>Not sure</button>
              <button class="support-button support-button--continue support-button--nav" type="button" data-step-next><span>Continue</span><span class="support-button__symbol" aria-hidden="true">→</span></button>
            </div>`,
  'compass footer markup'
);

// The old helper class only existed to group Not sure + Continue. It is now
// unused, so remove its page-scoped rules rather than layering new overrides on
// top of dead layout code.
page = page.replace(
  /\n[ \t]*\.alexithymia-support-page \.support-step__nav-primary \{[^}]*\}\n/g,
  '\n'
);
if (page.includes('support-step__nav-primary')) {
  throw new Error('Old nested compass footer helper remains.');
}

const compassFooterStyles = `
    <style>
      /* Support Lane compass footer v3 */
      .alexithymia-support-page .support-step__nav--compass {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'back unsure next';
        align-items: center;
        gap: 0.55rem;
      }

      .alexithymia-support-page .support-step__nav--compass [data-step-back] {
        grid-area: back;
      }

      .alexithymia-support-page .support-step__nav--compass [data-step-skip] {
        grid-area: unsure;
        justify-self: center;
      }

      .alexithymia-support-page .support-step__nav--compass [data-step-next] {
        grid-area: next;
      }

      @media (max-width: 640px) {
        .alexithymia-support-page .support-step__nav--compass {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          grid-template-areas:
            'back next'
            'unsure unsure';
          gap: 0.55rem;
        }

        .alexithymia-support-page .support-step__nav--compass [data-step-back],
        .alexithymia-support-page .support-step__nav--compass [data-step-next] {
          width: 100%;
          min-width: 0;
        }

        .alexithymia-support-page .support-step__nav--compass .support-button--not-sure {
          justify-self: center;
          min-width: auto;
          padding: 0.42rem 0.9rem;
          border-width: 2px;
          box-shadow: none;
        }
      }
    </style>
`;
if (page.includes('Support Lane compass footer v3')) {
  throw new Error('Compass footer v3 styles already present unexpectedly.');
}
page = replaceOnce(page, '  </head>', `${compassFooterStyles}  </head>`, 'page head closing tag');

const openHookCount = (page.match(/data-support-journal-open/g) || []).length;
if (openHookCount < 2) {
  throw new Error('Expected both nav and Support Lane Journal triggers to use the shared hook.');
}
const overlayCount = (page.match(/data-journal-overlay(?:\s|>)/g) || []).length;
if (overlayCount !== 1) {
  throw new Error(`Expected exactly one global Journal overlay container, found ${overlayCount}.`);
}
writeFileSync(pagePath, page);

console.log('Support Journal root fix and compass footer cleanup applied.');
