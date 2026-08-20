from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, pattern, replacement, label, flags=0):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label} replacement, got {count}")
    return updated


# 1) Make the page generator emit the complete Body Cues initial UI.
build_path = ROOT / "scripts" / "build-pages.mjs"
build = build_path.read_text()
needle = "const data = indexData;\n"
if "const bodyRegionsPath = join(rootDir, 'data', 'body-regions.json');" not in build:
    if needle not in build:
        raise RuntimeError("Could not find build data initialization")
    build = build.replace(
        needle,
        needle
        + "const bodyRegionsPath = join(rootDir, 'data', 'body-regions.json');\n"
        + "const bodyRegions = JSON.parse(readFileSync(bodyRegionsPath, 'utf8'));\n",
        1,
    )

replacement = r'''function renderBodyCueControls() {
  return bodyRegions
    .map((region) => {
      const options = Array.isArray(region.options) ? region.options : [];
      const optionMarkup = options
        .map((option) => {
          const title = escapeHtml(option.title || '');
          const optionId = escapeHtml(option.id || '');
          const note = option.note
            ? `\n              <p class="body-cues-tool__option-note">${escapeHtml(option.note)}</p>`
            : '';
          return `
            <div class="body-cues-tool__option" data-option-id="${optionId}">
              <div class="body-cues-tool__option-header">
                <h4 class="body-cues-tool__option-title">${title}</h4>
                <span class="body-cues-tool__option-value">Off</span>
              </div>${note}
              <div class="body-cues-tool__slider-wrapper">
                <input
                  class="body-cues-tool__slider"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value="0"
                  style="--cue-progress: 0%;"
                  aria-label="${title} intensity"
                  aria-valuetext="Off"
                >
                <div class="body-cues-tool__slider-scale" aria-hidden="true">
                  <span>Off</span><span>Hint</span><span>Noticeable</span><span>Strong</span>
                </div>
              </div>
            </div>`;
        })
        .join('');

      return `
        <section class="body-cues-tool__region" data-region-id="${escapeHtml(region.id || '')}">
          <header class="body-cues-tool__region-header">
            <h3 class="body-cues-tool__region-title">${escapeHtml(region.label || '')}</h3>
            ${region.prompt ? `<p class="body-cues-tool__region-prompt">${escapeHtml(region.prompt)}</p>` : ''}
          </header>
          <div class="body-cues-tool__options">${optionMarkup}
          </div>
        </section>`;
    })
    .join('');
}

function renderBodyCuesPage() {
  const bodyCuesStyles = `    <link rel="preload" href="../../styles/body-cues.css" as="style" />
    <link rel="stylesheet" href="../../styles/body-cues.css" />
    <link rel="stylesheet" href="../../styles/body-cues-mobile.css" media="(max-width: 640px)" />`;

  const main = `
      <section class="body-cues-tool" data-body-cues-root>
        <h1 class="visually-hidden">Body Cues explorer</h1>

        <section class="body-cues-tool__summary-panel" data-pinned="true" aria-labelledby="body-cues-magnets-heading">
          <section class="body-cues-tool__magnets">
            <div class="magnet-search__results body-cues-tool__magnet-panel">
              <div class="body-cues-tool__magnet-header">
                <h2 id="body-cues-magnets-heading">Possible feelings</h2>
                <p class="body-cues-tool__magnet-subtitle" aria-live="polite" data-body-cues-live>Adjust a cue below to see possible feelings.</p>
              </div>
              <div class="body-cues-tool__magnet-container" data-body-cues-magnets data-empty="true" data-expanded="false" aria-live="polite">
                <p class="body-cues-tool__empty" data-body-cues-empty>
                  Start with one cue below. As you adjust its intensity, the strongest feeling matches will appear here.
                </p>
              </div>
              <button type="button" class="body-cues-tool__result-toggle" data-body-cues-result-toggle aria-expanded="false" hidden>Show more matches</button>
            </div>
            <p class="body-cues-tool__error" data-body-cues-error hidden>
              We couldn't load the body cues data. Check your connection and try again.
            </p>
          </section>

          <div class="body-cues-tool__actions">
            <button type="button" class="body-cues-tool__pin-toggle" data-body-cues-pin-toggle aria-pressed="true" aria-label="Unpin possible feelings" title="Unpin possible feelings">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"></path>
                <path d="M12 14v7"></path>
                <path class="body-cues-tool__pin-slash" d="M4 4l16 16"></path>
              </svg>
            </button>
            <button type="button" class="body-cues-tool__reset" data-body-cues-reset aria-label="Reset all cues">Reset</button>
          </div>
        </section>

        <section class="body-cues-tool__slider-panel" aria-labelledby="body-cues-sliders-heading">
          <div class="body-cues-tool__slider-header">
            <h2 id="body-cues-sliders-heading">Body cues</h2>
            <p class="body-cues-tool__instructions">Move a slider only when a cue fits. Leave everything else off.</p>
            <p class="body-cues-tool__active-count" data-body-cues-active-count>0 cues selected</p>
          </div>

          <div class="body-cues-tool__controls-shell" data-body-cues-controls-shell data-scrollable="false" data-scroll-position="none">
            <section class="body-cues-tool__controls" data-body-cues-controls aria-label="Body cue sliders">${renderBodyCueControls()}
            </section>
            <span class="body-cues-tool__scroll-fade body-cues-tool__scroll-fade--top" aria-hidden="true"></span>
            <span class="body-cues-tool__scroll-fade body-cues-tool__scroll-fade--bottom" aria-hidden="true"></span>
            <span class="body-cues-tool__scroll-more" aria-hidden="true">More cues below ↓</span>
          </div>
        </section>
      </section>
    `;

  const html = htmlPage({
    title: 'Body Cues explorer',
    depth: 2,
    description:
      'Describe the body sensations you notice to surface likely feelings and save insights to your strategy inventory. Everything stays on your device in localStorage with import and export controls.',
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Feelings', href: '../' },
      { label: 'Body Cues' },
    ],
    main,
    headExtras: bodyCuesStyles,
    scripts: [{ src: 'scripts/body-cues-tool.js', type: 'module' }],
    activeNav: 'feelings',
    mainClass: 'page body-cues-page',
    canonicalPath: 'feelings/body-cues/',
  });

  writePage('feelings/body-cues/index.html', html);
}

function renderFauxFeeling'''

build = replace_once(
    build,
    r"function renderBodyCuesPage\(\) \{[\s\S]*?\n\}\n\nfunction renderFauxFeeling",
    replacement,
    "renderBodyCuesPage",
)
build_path.write_text(build)


# 2) Change the browser module from renderer to hydrator. It may update UI only
# after user interaction/data arrival; it no longer decides the first paint.
tool_path = ROOT / "scripts" / "body-cues-tool.js"
tool = tool_path.read_text()
tool = tool.replace("  BODY_REGIONS,\n", "", 1)
tool = tool.replace("const ENHANCEMENT_STYLESHEET_ID = 'body-cues-enhancements';\n", "", 1)
tool = replace_once(
    tool,
    r"\nfunction loadEnhancementStyles\(\) \{[\s\S]*?\n\}\n\nfunction getCanonicalSlugMap",
    "\nfunction getCanonicalSlugMap",
    "runtime stylesheet loader",
)

hydrate = r'''function hydrateControls(root) {
  const containers = Array.from(root.querySelectorAll('.body-cues-tool__option[data-option-id]'));
  containers.forEach((container) => {
    const optionId = container.dataset.optionId;
    const slider = container.querySelector('.body-cues-tool__slider');
    const valueLabel = container.querySelector('.body-cues-tool__option-value');
    if (!optionId || !(slider instanceof HTMLInputElement) || !valueLabel) {
      return;
    }

    slider.addEventListener('input', (event) => {
      onSliderInput(optionId, event?.target?.value || '0');
    });
    slider.addEventListener('change', (event) => {
      onSliderInput(optionId, event?.target?.value || '0', { commit: true });
    });

    sliderStates.set(optionId, { slider, label: valueLabel, container });
  });
}

function getFeelingLabel'''
tool = replace_once(
    tool,
    r"function createSlider\(option\) \{[\s\S]*?\n\}\n\nfunction buildControls\(root\) \{[\s\S]*?\n\}\n\nfunction getFeelingLabel",
    hydrate,
    "slider renderer",
)

result_toggle = r'''function setupResultToggle(root) {
  const toggle = root.querySelector('[data-body-cues-result-toggle]');
  if (!toggle || !state.magnetContainer) {
    return;
  }

  toggle.addEventListener('click', () => {
    if (isMobileResultsLayout()) {
      return;
    }
    state.resultsExpanded = !state.resultsExpanded;
    updateMagnets(state.lastResults);
    if (state.headingLiveRegion && state.lastResults.length) {
      const shown = Math.min(getVisibleResultLimit(), state.lastResults.length);
      state.headingLiveRegion.textContent = `${shown} strongest ${shown === 1 ? 'match' : 'matches'} shown`;
    }
  });
  state.resultToggle = toggle;
}

function setupPinToggle'''
tool = replace_once(
    tool,
    r"function setupResultToggle\(root\) \{[\s\S]*?\n\}\n\nfunction setupPinToggle",
    result_toggle,
    "result-toggle renderer",
)

pin_toggle = r'''function setupPinToggle(root) {
  const summaryPanel = root.querySelector('.body-cues-tool__summary-panel');
  const toggle = root.querySelector('[data-body-cues-pin-toggle]');
  if (!summaryPanel || !toggle) {
    return;
  }

  state.resultsPinned = summaryPanel.dataset.pinned !== 'false';
  const syncToggle = () => {
    summaryPanel.dataset.pinned = String(state.resultsPinned);
    toggle.setAttribute('aria-pressed', String(state.resultsPinned));
    const label = state.resultsPinned ? 'Unpin possible feelings' : 'Pin possible feelings';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  };

  syncToggle();
  toggle.addEventListener('click', () => {
    state.resultsPinned = !state.resultsPinned;
    syncToggle();
    if (state.resultsPinned) {
      resetMobileResultsScroll();
    }
  });

  state.pinToggle = toggle;
}

function setupControlsScrollAffordance'''
tool = replace_once(
    tool,
    r"function setupPinToggle\(root\) \{[\s\S]*?\n\}\n\nfunction enhanceStructure\(root\) \{[\s\S]*?\n\}\n\nfunction setupControlsScrollAffordance",
    pin_toggle,
    "pin/enhance runtime renderers",
)

tool = tool.replace("  loadEnhancementStyles();\n\n", "", 1)
tool = tool.replace(
    "  const resetButton = root.querySelector('[data-body-cues-reset]');\n",
    "  const resetButton = root.querySelector('[data-body-cues-reset]');\n  state.activeCueCount = root.querySelector('[data-body-cues-active-count]');\n",
    1,
)
tool = tool.replace("  enhanceStructure(root);\n", "", 1)
tool = tool.replace("  buildControls(state.controlsRoot);\n", "  hydrateControls(state.controlsRoot);\n", 1)
tool_path.write_text(tool)


# 3) Repair desktop flex sizing without touching the protected mobile stylesheet.
css_path = ROOT / "styles" / "body-cues.css"
css = css_path.read_text()
desktop_marker = "@media (min-width: 900px) {\n  .body-cues-page .body-cues-tool {"
if "@media (min-width: 900px)" not in css:
    raise RuntimeError("Desktop Body Cues media query not found")
if "flex-shrink: 0;" not in css:
    insertion = "@media (min-width: 900px) {\n  .body-cues-page .body-cues-tool__region {\n    flex-shrink: 0;\n  }\n\n  .body-cues-page .body-cues-tool {"
    if desktop_marker not in css:
        raise RuntimeError("Desktop Body Cues grid marker not found")
    css = css.replace(desktop_marker, insertion, 1)
css_path.write_text(css)


# 4) Keep the static-first contract explicit so this regression cannot silently return.
test_path = ROOT / "tests" / "body-cues-static-first.test.mjs"
test_path.write_text(r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../feelings/body-cues/index.html', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../scripts/body-cues-tool.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/body-cues.css', import.meta.url), 'utf8');
const mobileCss = readFileSync(new URL('../styles/body-cues-mobile.css', import.meta.url), 'utf8');

assert.match(html, /styles\/body-cues\.css/);
assert.match(html, /styles\/body-cues-mobile\.css[^>]*media="\(max-width: 640px\)"/);
assert.match(html, /<h2 id="body-cues-magnets-heading">Possible feelings<\/h2>/);
assert.match(html, /data-body-cues-active-count>0 cues selected/);
assert.match(html, /data-body-cues-pin-toggle/);
assert.match(html, /class="body-cues-tool__option" data-option-id=/);
assert.match(html, /class="body-cues-tool__slider"[\s\S]*?aria-valuetext="Off"/);

assert.doesNotMatch(runtime, /loadEnhancementStyles/);
assert.doesNotMatch(runtime, /body-cues-enhancements/);
assert.doesNotMatch(runtime, /createElement\(['"]link['"]\)/);
assert.doesNotMatch(runtime, /function enhanceStructure/);
assert.doesNotMatch(runtime, /function createSlider/);
assert.match(runtime, /function hydrateControls/);

assert.match(css, /@media \(min-width: 900px\)[\s\S]*?\.body-cues-page \.body-cues-tool__region \{[\s\S]*?flex-shrink: 0;/);
assert.match(mobileCss, /@media \(max-width: 640px\)/);

console.log('Body Cues static-first regression checks passed.');
''')

print("Body Cues static-first source patch applied")
