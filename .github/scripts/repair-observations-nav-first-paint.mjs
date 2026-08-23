import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const write = (relativePath, content) => writeFileSync(join(root, relativePath), content);

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Unable to find ${label}`);
  }
  return source.replace(needle, replacement);
}

// Extract the existing byte-stable inline nav-prefill renderer into a shared
// build-time owner. Browser behavior does not change on generated pages.
const buildPath = 'scripts/build-pages.mjs';
let buildPages = read(buildPath);
const navStart = buildPages.indexOf("const NAV_MAGNET_STORAGE_KEY = 'site-nav';");
const navEnd = buildPages.indexOf('const navVisibilityBootstrapScript', navStart);
if (navStart < 0 || navEnd < 0 || navEnd <= navStart) {
  throw new Error('Unable to isolate navigation prefill source in scripts/build-pages.mjs');
}
const navBlock = buildPages.slice(navStart, navEnd);
for (const required of [
  'const magnetPrefillScript = (storageKey) => String.raw`',
  "var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';",
  "var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;",
  "var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';",
]) {
  if (!navBlock.includes(required)) throw new Error(`Navigation prefill source is missing: ${required}`);
}
const navModule = navBlock
  .replace("const NAV_MAGNET_STORAGE_KEY = 'site-nav';", "export const NAV_MAGNET_STORAGE_KEY = 'site-nav';")
  .replace('const magnetPrefillScript = (storageKey) => String.raw`', 'export const magnetPrefillScript = (storageKey) => String.raw`')
  .trimEnd() + '\n';
write('scripts/nav-prepaint.mjs', navModule);

buildPages = buildPages.replace(navBlock, '');
buildPages = replaceOnce(
  buildPages,
  "import { updateObservationGuidePage } from './observation-guide.mjs';\n",
  "import { updateObservationGuidePage } from './observation-guide.mjs';\nimport { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';\n",
  'build-pages observation-guide import',
);
write(buildPath, buildPages);

// Make the existing Observations compiler own the shared first-paint regions.
const guidePath = 'scripts/observation-guide.mjs';
let guide = read(guidePath);
guide = replaceOnce(
  guide,
  "import { fileURLToPath } from 'url';\n",
  "import { fileURLToPath } from 'url';\nimport { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';\n",
  'observation-guide import anchor',
);
guide = replaceOnce(
  guide,
  "const pagePath = join(rootDir, 'observations', 'index.html');\n",
  [
    "const pagePath = join(rootDir, 'observations', 'index.html');",
    "const navCriticalCssPath = join(rootDir, 'styles', 'nav-critical.css');",
    "const SHARED_NAV_CRITICAL_START = '<!-- shared-nav-critical:start -->';",
    "const SHARED_NAV_CRITICAL_END = '<!-- shared-nav-critical:end -->';",
    "const SHARED_NAV_PREFILL_START = '<!-- shared-nav-prefill:start -->';",
    "const SHARED_NAV_PREFILL_END = '<!-- shared-nav-prefill:end -->';",
    '',
  ].join('\n'),
  'observation page path',
);
guide = replaceOnce(
  guide,
  "const END_MARKER = '<!-- observation-guide:end -->';\n",
  [
    "const END_MARKER = '<!-- observation-guide:end -->';",
    '',
    'function replaceOwnedRegion(html, startMarker, endMarker, content, label) {',
    '  const startIndex = html.indexOf(startMarker);',
    '  const endIndex = html.indexOf(endMarker);',
    '  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {',
    '    throw new Error(`Unable to locate ${label} ownership markers in observations/index.html`);',
    '  }',
    '  const before = html.slice(0, startIndex + startMarker.length);',
    '  const after = html.slice(endIndex);',
    '  return `${before}\\n${content.trim()}\\n${after}`;',
    '}',
    '',
  ].join('\n'),
  'observation guide marker anchor',
);
guide = replaceOnce(
  guide,
  [
    '  const updated = `${before}${content}${after}`;',
    '  writeFileSync(pagePath, updated);',
  ].join('\n'),
  [
    '  let updated = `${before}${content}${after}`;',
    "  const navCriticalCss = readFileSync(navCriticalCssPath, 'utf8').trim();",
    '  updated = replaceOwnedRegion(',
    '    updated,',
    '    SHARED_NAV_CRITICAL_START,',
    '    SHARED_NAV_CRITICAL_END,',
    '    `<style>${navCriticalCss}</style>`,',
    "    'shared navigation critical CSS',",
    '  );',
    '  updated = replaceOwnedRegion(',
    '    updated,',
    '    SHARED_NAV_PREFILL_START,',
    '    SHARED_NAV_PREFILL_END,',
    '    magnetPrefillScript(NAV_MAGNET_STORAGE_KEY),',
    "    'shared navigation prefill',",
    '  );',
    '  writeFileSync(pagePath, updated);',
  ].join('\n'),
  'observation guide write block',
);
write(guidePath, guide);

// Declare the two currently hand-copied Observations regions as compiler-owned.
let observations = read('observations/index.html');
if (!observations.includes('<!-- shared-nav-critical:start -->')) {
  const start = observations.indexOf('<style>:root {');
  const close = observations.indexOf('</style>', start);
  if (start < 0 || close < 0) throw new Error('Unable to isolate Observations critical nav CSS');
  const end = close + '</style>'.length;
  const block = observations.slice(start, end);
  observations = observations.slice(0, start)
    + '<!-- shared-nav-critical:start -->\n'
    + block
    + '\n<!-- shared-nav-critical:end -->'
    + observations.slice(end);
}
if (!observations.includes('<!-- shared-nav-prefill:start -->')) {
  const legacyNeedle = "var STORAGE_KEY = 'magnetPositions:site-nav';";
  const responsiveNeedle = "var LEGACY_STORAGE_KEY = 'magnetPositions:site-nav';";
  const position = observations.includes(legacyNeedle)
    ? observations.indexOf(legacyNeedle)
    : observations.indexOf(responsiveNeedle);
  if (position < 0) throw new Error('Unable to find Observations navigation prefill');
  const start = observations.lastIndexOf('<script>', position);
  const close = observations.indexOf('</script>', position);
  if (start < 0 || close < 0) throw new Error('Unable to isolate Observations navigation prefill script');
  const end = close + '</script>'.length;
  const block = observations.slice(start, end);
  observations = observations.slice(0, start)
    + '<!-- shared-nav-prefill:start -->\n'
    + block
    + '\n<!-- shared-nav-prefill:end -->'
    + observations.slice(end);
}
write('observations/index.html', observations);

// Update the established Bedrock tests to assert the new shared owner and the
// Observations first-paint contract rather than creating a parallel test path.
const bedrockPath = 'tests/bedrock-state-contract.test.mjs';
let bedrock = read(bedrockPath);
bedrock = replaceOnce(
  bedrock,
  '  const [inventory, magnetPhysics, magnetRuntime, buildPages, inventoryHtml, needsHtml] = await Promise.all([',
  '  const [inventory, magnetPhysics, magnetRuntime, buildPages, navPrepaint, inventoryHtml, needsHtml, observationsHtml] = await Promise.all([',
  'Bedrock state promise destructuring',
);
bedrock = replaceOnce(
  bedrock,
  "    read('scripts/build-pages.mjs'),\n    read('inventory/index.html'),\n    read('needs/index.html'),",
  "    read('scripts/build-pages.mjs'),\n    read('scripts/nav-prepaint.mjs'),\n    read('inventory/index.html'),\n    read('needs/index.html'),\n    read('observations/index.html'),",
  'Bedrock state file reads',
);
bedrock = replaceOnce(
  bedrock,
  [
    "  assert.ok(buildPages.includes(\"const NAV_MAGNET_STORAGE_KEY = 'site-nav';\"));",
    "  assert.ok(buildPages.includes('const magnetPrefillScript = (storageKey) => String.raw`'));",
    "  assert.ok(buildPages.includes(\"var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';\"));",
    "  assert.ok(buildPages.includes(\"var bucket = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';\"));",
    "  assert.ok(buildPages.includes(\"var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;\"));",
    "  assert.ok(buildPages.includes(\"var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';\"));",
  ].join('\n'),
  [
    "  assert.ok(buildPages.includes(\"import { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';\"));",
    "  assert.ok(navPrepaint.includes(\"export const NAV_MAGNET_STORAGE_KEY = 'site-nav';\"));",
    "  assert.ok(navPrepaint.includes('export const magnetPrefillScript = (storageKey) => String.raw`'));",
    "  assert.ok(navPrepaint.includes(\"var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';\"));",
    "  assert.ok(navPrepaint.includes(\"var bucket = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';\"));",
    "  assert.ok(navPrepaint.includes(\"var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;\"));",
    "  assert.ok(navPrepaint.includes(\"var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';\"));",
  ].join('\n'),
  'Bedrock state prepaint assertions',
);
bedrock = replaceOnce(
  bedrock,
  '  for (const html of [inventoryHtml, needsHtml]) {',
  '  for (const html of [inventoryHtml, needsHtml, observationsHtml]) {',
  'Bedrock state generated HTML loop',
);
write(bedrockPath, bedrock);

const magnetPath = 'tests/magnet-prepaint.test.mjs';
let magnet = read(magnetPath);
magnet = replaceOnce(
  magnet,
  "  const compiler = await read('scripts/build-pages.mjs');\n  assert.ok(compiler.includes('const magnetPrefillScript = (storageKey) => String.raw`'));",
  "  const [compiler, prepaint] = await Promise.all([read('scripts/build-pages.mjs'), read('scripts/nav-prepaint.mjs')]);\n  assert.ok(compiler.includes(\"import { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';\"));\n  assert.ok(prepaint.includes('export const magnetPrefillScript = (storageKey) => String.raw`'));",
  'magnet prepaint compiler assertions',
);
magnet = replaceOnce(
  magnet,
  "  for (const relativePath of ['feelings/index.html', 'feelings/afraid/index.html', 'needs/index.html']) {\n    const html = await read(relativePath);\n    assert.ok(!html.includes('background-attachment: fixed'), `${relativePath} must not inline the mobile repaint trigger`);\n  }",
  "  for (const relativePath of ['feelings/index.html', 'feelings/afraid/index.html', 'needs/index.html', 'observations/index.html']) {\n    const html = await read(relativePath);\n    assert.ok(!html.includes('background-attachment: fixed'), `${relativePath} must not inline the mobile repaint trigger`);\n  }",
  'mobile repaint route list',
);
if (!magnet.includes('Observations compiles the same responsive navigation first-paint contract')) {
  magnet = magnet.trimEnd() + [
    '',
    '',
    "test('Observations compiles the same responsive navigation first-paint contract as generated pages', async () => {",
    '  const [html, criticalCss] = await Promise.all([',
    "    read('observations/index.html'),",
    "    read('styles/nav-critical.css'),",
    '  ]);',
    "  const { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } = await import('../scripts/nav-prepaint.mjs');",
    "  assert.ok(html.includes('<!-- shared-nav-critical:start -->'));",
    "  assert.ok(html.includes('<!-- shared-nav-critical:end -->'));",
    '  assert.ok(html.includes(`<style>${criticalCss.trim()}</style>`));',
    "  assert.ok(html.includes('<!-- shared-nav-prefill:start -->'));",
    "  assert.ok(html.includes('<!-- shared-nav-prefill:end -->'));",
    '  assert.ok(html.includes(magnetPrefillScript(NAV_MAGNET_STORAGE_KEY).trim()));',
    "  assert.ok(html.includes(\"var LEGACY_STORAGE_KEY = 'magnetPositions:site-nav';\"));",
    "  assert.ok(html.includes(\"var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;\"));",
    "  assert.ok(!html.includes(\"var STORAGE_KEY = 'magnetPositions:site-nav';\"));",
    '});',
    '',
  ].join('\n');
}
write(magnetPath, magnet);

// Document the new canonical owner for contributors and researchers.
let readme = read('README.md');
const statusNeedle = '- category hubs paint normally and let the existing magnet runtime own saved-position restoration and handmade tilt/offset. Navigation alone retains the established lightweight saved-layout prepaint path. Permanent regressions forbid the global JavaScript-readiness visibility gate, mobile fixed-root-background trigger, and compensating Feeling-art compositor hack that were identified during Bedrock phone testing.';
readme = replaceOnce(
  readme,
  statusNeedle,
  statusNeedle + ' `scripts/nav-prepaint.mjs` is the shared build-time owner for that responsive navigation prefill; the Observations compiler synchronizes its inline first-paint navigation CSS from `styles/nav-critical.css` and its prefill from the same shared renderer, preventing the hand-owned route from drifting into a second startup contract.',
  'README navigation ownership paragraph',
);
readme = replaceOnce(
  readme,
  "    ├── build-pages.mjs         # canonical page compiler\n    ├── strategy-deck.js",
  "    ├── build-pages.mjs         # canonical page compiler\n    ├── nav-prepaint.mjs        # shared build-time responsive navigation prefill owner\n    ├── strategy-deck.js",
  'README project structure',
);
write('README.md', readme);

console.log('Canonical Observations navigation first-paint ownership migration staged.');
