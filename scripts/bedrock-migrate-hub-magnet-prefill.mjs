import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/build-pages.mjs';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one source match, found ${count}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  'generalize prefill function name',
  'const navPrefillScript = () => String.raw`',
  'const magnetPrefillScript = (storageKey) => String.raw`',
);

replaceOnce(
  'generalize prefill root selector',
  'var root = document.querySelector(\'[data-magnet-root][data-magnet-key="${NAV_MAGNET_STORAGE_KEY}"]\');',
  'var root = document.querySelector(\'[data-magnet-root][data-magnet-key="${storageKey}"]\');',
);

replaceOnce(
  'generalize prefill storage key',
  "var STORAGE_KEY = 'magnetPositions:${NAV_MAGNET_STORAGE_KEY}';",
  "var STORAGE_KEY = 'magnetPositions:${storageKey}';",
);

replaceOnce(
  'keep nav on generic prefill owner',
  'const prefill = navPrefillScript();',
  'const prefill = magnetPrefillScript(NAV_MAGNET_STORAGE_KEY);',
);

const categoryClose = `      </section>\n    \`;`;
const categoryCloseWithPrefill = `      </section>\n\${magnetPrefillScript(type + '-hub-v4')}\n    \`;`;

const renderCategoryStart = source.indexOf('function renderCategory(type, items) {');
const renderBodyCuesStart = source.indexOf('function renderBodyCueControls() {');
if (renderCategoryStart < 0 || renderBodyCuesStart < 0 || renderBodyCuesStart <= renderCategoryStart) {
  throw new Error('Unable to isolate renderCategory for hub prefill insertion.');
}

const beforeCategory = source.slice(0, renderCategoryStart);
let category = source.slice(renderCategoryStart, renderBodyCuesStart);
const afterCategory = source.slice(renderBodyCuesStart);
const closeCount = category.split(categoryClose).length - 1;
if (closeCount !== 1) {
  throw new Error(`hub prefill insertion: expected one category section close, found ${closeCount}`);
}
category = category.replace(categoryClose, categoryCloseWithPrefill);
source = beforeCategory + category + afterCategory;

if (source.includes('navPrefillScript')) {
  throw new Error('Legacy navPrefillScript reference remains after migration.');
}
if (!source.includes("magnetPrefillScript(type + '-hub-v4')")) {
  throw new Error('Category hub prefill call was not inserted.');
}

writeFileSync(path, source);
