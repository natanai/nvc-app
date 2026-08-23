import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const write = (relativePath, content) => writeFileSync(join(root, relativePath), content);
const requireIncludes = (source, needle, label) => {
  if (!source.includes(needle)) {
    throw new Error(`Unable to find ${label}: ${needle}`);
  }
};

// 1. Extract the existing inline nav-prefill renderer without changing its bytes.
// It becomes a build-time shared owner used by both generated pages and the
// hand-owned Observations surface.
const buildPath = 'scripts/build-pages.mjs';
let buildPages = read(buildPath);
const navBlockStart = buildPages.indexOf("const NAV_MAGNET_STORAGE_KEY = 'site-nav';");
const navBlockEnd = buildPages.indexOf('const navVisibilityBootstrapScript', navBlockStart);
if (navBlockStart < 0 || navBlockEnd < 0 || navBlockEnd <= navBlockStart) {
  throw new Error('Unable to isolate the canonical navigation prefill block in scripts/build-pages.mjs');
}
const navBlock = buildPages.slice(navBlockStart, navBlockEnd);
requireIncludes(navBlock, 'const magnetPrefillScript = (storageKey) => String.raw`', 'magnetPrefillScript renderer');
requireIncludes(navBlock, "var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';", 'responsive legacy key');
requireIncludes(navBlock, "var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;", 'responsive storage bucket');

const navModule = navBlock
  .replace("const NAV_MAGNET_STORAGE_KEY = 'site-nav';", "export const NAV_MAGNET_STORAGE_KEY = 'site-nav';")
  .replace('const magnetPrefillScript = (storageKey) => String.raw`', 'export const magnetPrefillScript = (storageKey) => String.raw`')
  .trimEnd() + '\n';
write('scripts/nav-prepaint.mjs', navModule);

buildPages = buildPages.replace(navBlock, '');
const buildImportAnchor = "import { updateObservationGuidePage } from './observation-guide.mjs';\n";
requireIncludes(buildPages, buildImportAnchor, 'build-pages observation-guide import');
if (!buildPages.includes("from './nav-prepaint.mjs'")) {
  buildPages = buildPages.replace(
    buildImportAnchor,
    buildImportAnchor + "import { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';\n",
  );
}
write(buildPath, buildPages);

// 2. Give the existing Observations compiler explicit ownership of the two
// shared navigation first-paint regions. This avoids another hand-maintained
// copy drifting away from styles/nav-critical.css or the responsive prefill.
const guidePath = 'scripts/observation-guide.mjs';
let guide = read(guidePath);
const guideImportAnchor = "import { fileURLToPath } from 'url';\n";
requireIncludes(guide, guideImportAnchor, 'observation-guide import anchor');
if (!guide.includes("from './nav-prepaint.mjs'")) {
  guide = guide.replace(
    guideImportAnchor,
    guideImportAnchor + "import { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';\n",
  );
}

const pagePathAnchor = "const pagePath = join(rootDir, 'observations', 'index.html');\n";
requireIncludes(guide, pagePathAnchor, 'observation page path');
if (!guide.includes('SHARED_NAV_CRITICAL_START')) {
  guide = guide.replace(
    pagePathAnchor,
    pagePathAnchor +
      "const navCriticalCssPath = join(rootDir, 'styles', 'nav-critical.css');\n" +
      "const SHARED_NAV_CRITICAL_START = '<!-- shared-nav-critical:start -->';\n" +
      "const SHARED_NAV_CRITICAL_END = '<!-- shared-nav-critical:end -->';\n" +
      "const SHARED_NAV_PREFILL_START = '<!-- shared-nav-prefill:start -->';\n" +
      "const SHARED_NAV_PREFILL_END = '<!-- shared-nav-prefill:end -->';\n",
  );
}

const guideMarkerAnchor = "const END_MARKER = '<!-- observation-guide:end -->';\n";
requireIncludes(guide, guideMarkerAnchor, 'observation guide marker anchor');
if (!guide.includes('function replaceOwnedRegion(')) {
  guide = guide.replace(
    guideMarkerAnchor,
    guideMarkerAnchor + `\nfunction replaceOwnedRegion(html, startMarker, endMarker, content, label) {\n  const startIndex = html.indexOf(startMarker);\n  const endIndex = html.indexOf(endMarker);\n  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {\n    throw new Error(\`Unable to locate \${label} ownership markers in observations/index.html\`);\n  }\n  const before = html.slice(0, startIndex + startMarker.length);\n  const after = html.slice(endIndex);\n  return \`\${before}\\n\${content.trim()}\\n\${after}\`;\n}\n`,
  );
}

const updatedGuideAnchor = "  const updated = `${before}${content}${after}`;\n  writeFileSync(pagePath, updated);\n";
requireIncludes(guide, updatedGuideAnchor, 'observation guide write block');
guide = guide.replace(
  updatedGuideAnchor,
  `  let updated = \`${before}\${content}\${after}\`;\n  const navCriticalCss = readFileSync(navCriticalCssPath, 'utf8').trim();\n  updated = replaceOwnedRegion(\n    updated,\n    SHARED_NAV_CRITICAL_START,\n    SHARED_NAV_CRITICAL_END,\n    \`<style>\${navCriticalCss}</style>\`,\n    'shared navigation critical CSS',\n  );\n  updated = replaceOwnedRegion(\n    updated,\n    SHARED_NAV_PREFILL_START,\n    SHARED_NAV_PREFILL_END,\n    magnetPrefillScript(NAV_MAGNET_STORAGE_KEY),\n    'shared navigation prefill',\n  );\n  writeFileSync(pagePath, updated);\n`,
);
write(guidePath, guide);

// 3. Mark the two currently hand-copied regions in Observations so the normal
// page compiler owns them from this point forward. The subsequent canonical
// build rewrites the contents from the shared sources above.
const observationsPath = 'observations/index.html';
let observations = read(observationsPath);
if (!observations.includes('<!-- shared-nav-critical:start -->')) {
  const criticalStart = observations.indexOf('<style>:root {');
  const criticalEnd = observations.indexOf('</style>', criticalStart);
  if (criticalStart < 0 || criticalEnd < 0) {
    throw new Error('Unable to find the Observations inline navigation critical style block');
  }
  const end = criticalEnd + '</style>'.length;
  const block = observations.slice(criticalStart, end);
  observations = observations.slice(0, criticalStart) +
    '<!-- shared-nav-critical:start -->\n' + block + '\n<!-- shared-nav-critical:end -->' +
    observations.slice(end);
}

if (!observations.includes('<!-- shared-nav-prefill:start -->')) {
  const legacyNeedle = "var STORAGE_KEY = 'magnetPositions:site-nav';";
  const responsiveNeedle = "var LEGACY_STORAGE_KEY = 'magnetPositions:site-nav';";
  const needleIndex = observations.includes(legacyNeedle)
    ? observations.indexOf(legacyNeedle)
    : observations.indexOf(responsiveNeedle);
  if (needleIndex < 0) {
    throw new Error('Unable to find the Observations navigation prefill script');
  }
  const scriptStart = observations.lastIndexOf('<script>', needleIndex);
  const scriptEndIndex = observations.indexOf('</script>', needleIndex);
  if (scriptStart < 0 || scriptEndIndex < 0) {
    throw new Error('Unable to isolate the Observations navigation prefill script block');
  }
  const scriptEnd = scriptEndIndex + '</script>'.length;
  const block = observations.slice(scriptStart, scriptEnd);
  observations = observations.slice(0, scriptStart) +
    '<!-- shared-nav-prefill:start -->\n' + block + '\n<!-- shared-nav-prefill:end -->' +
    observations.slice(scriptEnd);
}
write(observationsPath, observations);

// 4. Update the existing Bedrock state and magnet first-paint contracts rather
// than creating a parallel test family.
const bedrockTestPath = 'tests/bedrock-state-contract.test.mjs';
let bedrockTest = read(bedrockTestPath);
bedrockTest = bedrockTest.replace(
  '  const [inventory, magnetPhysics, magnetRuntime, buildPages, inventoryHtml, needsHtml] = await Promise.all([',
  '  const [inventory, magnetPhysics, magnetRuntime, buildPages, navPrepaint, inventoryHtml, needsHtml, observationsHtml] = await Promise.all([',
);
bedrockTest = bedrockTest.replace(
  "    read('scripts/build-pages.mjs'),\n    read('inventory/index.html'),\n    read('needs/index.html'),",
  "    read('scripts/build-pages.mjs'),\n    read('scripts/nav-prepaint.mjs'),\n    read('inventory/index.html'),\n    read('needs/index.html'),\n    read('observations/index.html'),",
);
bedrockTest = bedrockTest.replace(
  "  assert.ok(buildPages.includes(\"const NAV_MAGNET_STORAGE_KEY = 'site-nav';\"));\n  assert.ok(buildPages.includes('const magnetPrefillScript = (storageKey) => String.raw`'));\n  assert.ok(buildPages.includes(\"var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';\"));\n  assert.ok(buildPages.includes(\"var bucket = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';\"));\n  assert.ok(buildPages.includes(\"var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;\"));\n  assert.ok(buildPages.includes(\"var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';\"));",
  "  assert.ok(buildPages.includes(\"import { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';\"));\n  assert.ok(navPrepaint.includes(\"export const NAV_MAGNET_STORAGE_KEY = 'site-nav';\"));\n  assert.ok(navPrepaint.includes('export const magnetPrefillScript = (storageKey) => String.raw`'));\n  assert.ok(navPrepaint.includes(\"var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';\"));\n  assert.ok(navPrepaint.includes(\"var bucket = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';\"));\n  assert.ok(navPrepaint.includes(\"var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;\"));\n  assert.ok(navPrepaint.includes(\"var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';\"));",
);
bedrockTest = bedrockTest.replace(
  '  for (const html of [inventoryHtml, needsHtml]) {',
  '  for (const html of [inventoryHtml, needsHtml, observationsHtml]) {',
);
write(bedrockTestPath, bedrockTest);

const magnetTestPath = 'tests/magnet-prepaint.test.mjs';
let magnetTest = read(magnetTestPath);
magnetTest = magnetTest.replace(
  "  const compiler = await read('scripts/build-pages.mjs');\n  assert.ok(compiler.includes('const magnetPrefillScript = (storageKey) => String.raw`'));",
  "  const [compiler, prepaint] = await Promise.all([read('scripts/build-pages.mjs'), read('scripts/nav-prepaint.mjs')]);\n  assert.ok(compiler.includes(\"import { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';\"));\n  assert.ok(prepaint.includes('export const magnetPrefillScript = (storageKey) => String.raw`'));",
);
magnetTest = magnetTest.replace(
  "  for (const relativePath of ['feelings/index.html', 'feelings/afraid/index.html', 'needs/index.html']) {\n    const html = await read(relativePath);\n    assert.ok(!html.includes('background-attachment: fixed'), `${relativePath} must not inline the mobile repaint trigger`);\n  }",
  "  for (const relativePath of ['feelings/index.html', 'feelings/afraid/index.html', 'needs/index.html', 'observations/index.html']) {\n    const html = await read(relativePath);\n    assert.ok(!html.includes('background-attachment: fixed'), `${relativePath} must not inline the mobile repaint trigger`);\n  }",
);
const observationContract = `\n\ntest('Observations compiles the same responsive navigation first-paint contract as generated pages', async () => {\n  const [html, criticalCss] = await Promise.all([\n    read('observations/index.html'),\n    read('styles/nav-critical.css'),\n  ]);\n  const { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } = await import('../scripts/nav-prepaint.mjs');\n  assert.ok(html.includes('<!-- shared-nav-critical:start -->'));\n  assert.ok(html.includes('<!-- shared-nav-critical:end -->'));\n  assert.ok(html.includes(\`<style>\${criticalCss.trim()}</style>\`));\n  assert.ok(html.includes('<!-- shared-nav-prefill:start -->'));\n  assert.ok(html.includes('<!-- shared-nav-prefill:end -->'));\n  assert.ok(html.includes(magnetPrefillScript(NAV_MAGNET_STORAGE_KEY).trim()));\n  assert.ok(html.includes(\"var LEGACY_STORAGE_KEY = 'magnetPositions:site-nav';\"));\n  assert.ok(html.includes(\"var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;\"));\n  assert.ok(!html.includes(\"var STORAGE_KEY = 'magnetPositions:site-nav';\"));\n});\n`;
if (!magnetTest.includes("Observations compiles the same responsive navigation first-paint contract")) {
  magnetTest = magnetTest.trimEnd() + observationContract;
}
write(magnetTestPath, magnetTest);

// 5. Keep contributor/researcher documentation aligned with the new owner.
const readmePath = 'README.md';
let readme = read(readmePath);
const statusNeedle = '- category hubs paint normally and let the existing magnet runtime own saved-position restoration and handmade tilt/offset. Navigation alone retains the established lightweight saved-layout prepaint path. Permanent regressions forbid the global JavaScript-readiness visibility gate, mobile fixed-root-background trigger, and compensating Feeling-art compositor hack that were identified during Bedrock phone testing.';
requireIncludes(readme, statusNeedle, 'README navigation ownership status');
readme = readme.replace(
  statusNeedle,
  statusNeedle + ' `scripts/nav-prepaint.mjs` is the shared build-time owner for that responsive navigation prefill; the Observations compiler synchronizes its inline first-paint navigation CSS from `styles/nav-critical.css` and its prefill from the same shared renderer, preventing the hand-owned route from drifting into a second startup contract.',
);
const structureNeedle = "    ├── build-pages.mjs         # canonical page compiler\n    ├── strategy-deck.js";
requireIncludes(readme, structureNeedle, 'README project structure build-pages entry');
readme = readme.replace(
  structureNeedle,
  "    ├── build-pages.mjs         # canonical page compiler\n    ├── nav-prepaint.mjs        # shared build-time responsive navigation prefill owner\n    ├── strategy-deck.js",
);
write(readmePath, readme);

console.log('Canonical Observations navigation first-paint ownership migration staged.');
