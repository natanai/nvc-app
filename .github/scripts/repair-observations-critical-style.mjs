import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const write = (relativePath, content) => writeFileSync(join(root, relativePath), content);
const replaceOnce = (source, needle, replacement, label) => {
  if (!source.includes(needle)) throw new Error(`Unable to find ${label}`);
  return source.replace(needle, replacement);
};

// Recover the accepted Observations route-critical first-paint CSS from the
// last known-good canary parent. The previous migration incorrectly treated
// the entire inline style block as navigation-only and therefore removed the
// route's own critical styling.
const GOOD_OBSERVATIONS_COMMIT = '1a375059ed6026e71f81d163317eb25fc4c5167c';
const priorHtml = execFileSync('git', ['show', `${GOOD_OBSERVATIONS_COMMIT}:observations/index.html`], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
const styleStart = priorHtml.indexOf('<style>:root {');
const styleEnd = priorHtml.indexOf('</style>', styleStart);
if (styleStart < 0 || styleEnd < 0) throw new Error('Unable to isolate prior Observations first-paint style block');
const styleBody = priorHtml.slice(styleStart + '<style>'.length, styleEnd);
const routeStart = styleBody.indexOf('\n  .observations-page {');
if (routeStart < 0) throw new Error('Unable to isolate Observations route-critical CSS');
const observationsCriticalCss = styleBody.slice(routeStart + 1).trim() + '\n';
if (!observationsCriticalCss.includes('.observation-editor__card')) {
  throw new Error('Recovered route-critical CSS is incomplete');
}
if (!observationsCriticalCss.includes('.observation-suggestions__actions')) {
  throw new Error('Recovered route-critical CSS is missing suggestion layout rules');
}
write('styles/observations-critical.css', observationsCriticalCss);

// Compose shared navigation critical CSS with route-critical Observations CSS
// at build time. Both are source-owned files; no runtime repair is involved.
const guidePath = 'scripts/observation-guide.mjs';
let guide = read(guidePath);
guide = replaceOnce(
  guide,
  "const navCriticalCssPath = join(rootDir, 'styles', 'nav-critical.css');\n",
  "const navCriticalCssPath = join(rootDir, 'styles', 'nav-critical.css');\nconst observationsCriticalCssPath = join(rootDir, 'styles', 'observations-critical.css');\n",
  'Observations critical CSS path anchor',
);
guide = replaceOnce(
  guide,
  "  const navCriticalCss = readFileSync(navCriticalCssPath, 'utf8').trim();\n  updated = replaceOwnedRegion(\n    updated,\n    SHARED_NAV_CRITICAL_START,\n    SHARED_NAV_CRITICAL_END,\n    `<style>${navCriticalCss}</style>`,\n    'shared navigation critical CSS',\n  );",
  "  const navCriticalCss = readFileSync(navCriticalCssPath, 'utf8').trim();\n  const observationsCriticalCss = readFileSync(observationsCriticalCssPath, 'utf8').trim();\n  updated = replaceOwnedRegion(\n    updated,\n    SHARED_NAV_CRITICAL_START,\n    SHARED_NAV_CRITICAL_END,\n    `<style>${navCriticalCss}\\n${observationsCriticalCss}</style>`,\n    'shared navigation plus Observations critical CSS',\n  );",
  'Observations critical composition block',
);
write(guidePath, guide);

// Rehydrate the committed hand-owned route through the same compiler-owned
// marker, restoring its intended layout while retaining the responsive nav
// prefill and the canonical nav-critical CSS.
let observations = read('observations/index.html');
const regionStart = '<!-- shared-nav-critical:start -->';
const regionEnd = '<!-- shared-nav-critical:end -->';
const startIndex = observations.indexOf(regionStart);
const endIndex = observations.indexOf(regionEnd);
if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
  throw new Error('Observations critical ownership markers are missing');
}
const navCriticalCss = read('styles/nav-critical.css').trim();
const composed = `${regionStart}\n<style>${navCriticalCss}\n${observationsCriticalCss.trim()}</style>\n${regionEnd}`;
observations = observations.slice(0, startIndex) + composed + observations.slice(endIndex + regionEnd.length);
write('observations/index.html', observations);

// Strengthen the permanent first-paint regression: the route must carry both
// the shared nav-critical source and its own route-critical source.
const magnetTestPath = 'tests/magnet-prepaint.test.mjs';
let magnetTest = read(magnetTestPath);
magnetTest = replaceOnce(
  magnetTest,
  "  const [html, criticalCss] = await Promise.all([\n    read('observations/index.html'),\n    read('styles/nav-critical.css'),\n  ]);",
  "  const [html, criticalCss, observationsCriticalCss] = await Promise.all([\n    read('observations/index.html'),\n    read('styles/nav-critical.css'),\n    read('styles/observations-critical.css'),\n  ]);",
  'Observations magnet test file reads',
);
magnetTest = replaceOnce(
  magnetTest,
  "  assert.ok(html.includes(`<style>${criticalCss.trim()}</style>`));",
  "  assert.ok(html.includes(`<style>${criticalCss.trim()}\\n${observationsCriticalCss.trim()}</style>`));\n  assert.ok(observationsCriticalCss.includes('.observations-page'));\n  assert.ok(observationsCriticalCss.includes('.observation-editor__card'));\n  assert.ok(observationsCriticalCss.includes('.observation-suggestions__actions'));",
  'Observations critical CSS assertion',
);
write(magnetTestPath, magnetTest);

// Keep contributor/researcher documentation aligned with the actual owner.
const readmePath = 'README.md';
let readme = read(readmePath);
readme = replaceOnce(
  readme,
  'the Observations compiler synchronizes its inline first-paint navigation CSS from `styles/nav-critical.css` and its prefill from the same shared renderer, preventing the hand-owned route from drifting into a second startup contract.',
  'the Observations compiler composes shared navigation first-paint CSS from `styles/nav-critical.css` with route-critical Observations layout from `styles/observations-critical.css`, while its prefill comes from the same shared renderer. This keeps the hand-owned route aligned without deleting its own first-paint layout contract.',
  'README Observations ownership sentence',
);
readme = replaceOnce(
  readme,
  '├── styles.css                 # shared base styling',
  '├── styles.css                 # shared base styling\n├── styles/observations-critical.css # Observations route-critical first-paint layout',
  'README project structure styles entry',
);
write(readmePath, readme);

console.log('Restored canonical Observations route-critical first-paint ownership.');
