import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value);

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index === -1) {
    throw new Error(`Missing migration anchor: ${label}`);
  }
  if (source.indexOf(before, index + before.length) !== -1) {
    throw new Error(`Migration anchor is not unique: ${label}`);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let build = read('scripts/build-pages.mjs');

build = replaceOnce(
  build,
  'function normalizeScripts(scripts, options = {}) {',
  `const shellRuntimeLoaderScript = Object.freeze({\n  src: 'scripts/shell-runtime-loader.js',\n  defer: true,\n  beforeBase: true,\n});\n\nfunction normalizeScripts(scripts, options = {}) {`,
  'shared intent-loader descriptor',
);

build = replaceOnce(
  build,
  "    scripts: [{ src: 'scripts/shell-runtime-loader.js', defer: true, beforeBase: true }],\n    activeNav: 'home',",
  "    scripts: [shellRuntimeLoaderScript],\n    activeNav: 'home',",
  'Home uses shared intent-loader descriptor',
);

build = replaceOnce(
  build,
  "    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],\n    activeNav: type,\n    canonicalPath: `${type}/`,\n  });",
  "    scripts: [shellRuntimeLoaderScript, { src: 'scripts/magnets.js', type: 'module' }],\n    activeNav: type,\n    canonicalPath: `${type}/`,\n    includeInventoryRuntime: false,\n  });",
  'category hubs intent-load Inventory runtime',
);

build = replaceOnce(
  build,
  "    scripts: [\n      { src: 'scripts/magnets.js', type: 'module' },\n      { src: 'scripts/feeling-reverse-inference.js', type: 'module' },\n    ],\n    mainAttributes: ` data-feeling-slug=\\\"${escapeHtml(item.slug)}\\\"`,\n    activeNav: 'feelings',\n    canonicalPath: `feelings/${item.slug}/`,\n    description: item.description,\n  });",
  "    scripts: [\n      shellRuntimeLoaderScript,\n      { src: 'scripts/magnets.js', type: 'module' },\n      { src: 'scripts/feeling-reverse-inference.js', type: 'module' },\n    ],\n    mainAttributes: ` data-feeling-slug=\\\"${escapeHtml(item.slug)}\\\"`,\n    activeNav: 'feelings',\n    canonicalPath: `feelings/${item.slug}/`,\n    description: item.description,\n    includeInventoryRuntime: false,\n  });",
  'Feeling detail intent-load Inventory runtime',
);

build = replaceOnce(
  build,
  "    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],\n    activeNav: 'faux-feelings',\n    canonicalPath: `faux-feelings/${item.slug}/`,\n  });",
  "    scripts: [shellRuntimeLoaderScript, { src: 'scripts/magnets.js', type: 'module' }],\n    activeNav: 'faux-feelings',\n    canonicalPath: `faux-feelings/${item.slug}/`,\n    includeInventoryRuntime: false,\n  });",
  'Faux-feeling detail intent-load Inventory runtime',
);

build = replaceOnce(
  build,
  "    headExtras: bodyCuesStyles,\n    scripts: [{ src: 'scripts/body-cues-tool.js', type: 'module' }],\n    activeNav: 'feelings',\n    mainClass: 'page body-cues-page',\n    canonicalPath: 'feelings/body-cues/',\n  });",
  "    headExtras: bodyCuesStyles,\n    scripts: [shellRuntimeLoaderScript, { src: 'scripts/body-cues-tool.js', type: 'module' }],\n    activeNav: 'feelings',\n    mainClass: 'page body-cues-page',\n    canonicalPath: 'feelings/body-cues/',\n    includeInventoryRuntime: false,\n  });",
  'Body Cues intent-load Inventory runtime',
);

write('scripts/build-pages.mjs', build);

let routeTest = read('tests/route-runtime-ownership.test.mjs');
const oldCandidateTest = `test('candidate content classes stay unchanged until their explicit browser-audited migration', async () => {\n  const [feeling, fauxFeeling] = await Promise.all([\n    read('feelings/afraid/index.html'),\n    read('faux-feelings/abandoned/index.html'),\n  ]);\n\n  assert.ok(hasInventoryScript(feeling, '../../scripts/inventory.js'), 'Feeling details must not be bulk-deferred before Home acceptance');\n  assert.ok(hasInventoryScript(fauxFeeling, '../../scripts/inventory.js'), 'Faux-feeling details must not be bulk-deferred before Home acceptance');\n});\n`;
const newCandidateTest = `test('post-Bedrock content canaries keep route features eager while intent-loading the shared controller', async () => {\n  const [feelingsIndex, needsIndex, fauxIndex, feeling, fauxFeeling, bodyCues] = await Promise.all([\n    read('feelings/index.html'),\n    read('needs/index.html'),\n    read('faux-feelings/index.html'),\n    read('feelings/afraid/index.html'),\n    read('faux-feelings/abandoned/index.html'),\n    read('feelings/body-cues/index.html'),\n  ]);\n\n  const lazyFixtures = [\n    ['Feelings index', feelingsIndex, '../scripts/inventory.js', '../scripts/shell-runtime-loader.js'],\n    ['Needs index', needsIndex, '../scripts/inventory.js', '../scripts/shell-runtime-loader.js'],\n    ['Faux-feelings index', fauxIndex, '../scripts/inventory.js', '../scripts/shell-runtime-loader.js'],\n    ['Feeling detail', feeling, '../../scripts/inventory.js', '../../scripts/shell-runtime-loader.js'],\n    ['Faux-feeling detail', fauxFeeling, '../../scripts/inventory.js', '../../scripts/shell-runtime-loader.js'],\n    ['Body Cues', bodyCues, '../../scripts/inventory.js', '../../scripts/shell-runtime-loader.js'],\n  ];\n\n  for (const [label, html, inventorySrc, loaderSrc] of lazyFixtures) {\n    assert.ok(!hasInventoryScript(html, inventorySrc), \`${label} must keep the large shared controller off parser first load\`);\n    assert.ok(hasInventoryScript(html, loaderSrc), \`${label} must retain the shell intent loader\`);\n    assert.ok(html.includes('scripts/inventory-core-shell.js'), \`${label} must keep the shared Menu/navigation shell eager\`);\n    assert.ok(html.includes('scripts/magnets.js'), \`${label} must keep magnet interaction eager\`);\n  }\n\n  assert.ok(feeling.includes('scripts/feeling-reverse-inference.js'), 'Feeling reverse inference must remain an eager route-owned feature');\n  assert.ok(bodyCues.includes('scripts/body-cues-tool.js'), 'Body Cues interaction must remain an eager route-owned feature');\n});\n`;
routeTest = replaceOnce(routeTest, oldCandidateTest, newCandidateTest, 'route-runtime canary contract');
write('tests/route-runtime-ownership.test.mjs', routeTest);

console.log('Immediate-response v1 canonical source migration applied.');
