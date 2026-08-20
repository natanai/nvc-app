import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function read(path) {
  return readFileSync(join(rootDir, path), 'utf8');
}

function collectFiles(target, extensions, output = []) {
  if (!existsSync(target)) return output;
  const stats = statSync(target);
  if (stats.isFile()) {
    if (extensions.some((extension) => target.endsWith(extension))) output.push(target);
    return output;
  }
  for (const entry of readdirSync(target)) {
    collectFiles(join(target, entry), extensions, output);
  }
  return output;
}

// Visible first-paint styling must be parser/build owned, never appended by JS.
const runtimeRoots = [join(rootDir, 'scripts'), join(rootDir, 'assets', 'js')];
const runtimeFiles = runtimeRoots.flatMap((root) => collectFiles(root, ['.js', '.mjs']));
const styleInjectionViolations = [];

for (const file of runtimeFiles) {
  const source = readFileSync(file, 'utf8');
  const createsStylesheetLink =
    /createElement\(\s*['"]link['"]\s*\)/.test(source)
    && /\.rel\s*=\s*['"]stylesheet['"]/.test(source);
  const writesStylesheet = /document\.write\([\s\S]*?stylesheet/.test(source);
  if (createsStylesheetLink || writesStylesheet) {
    styleInjectionViolations.push(relative(rootDir, file).replaceAll('\\', '/'));
  }
}

assert.deepEqual(
  styleInjectionViolations,
  [],
  `Runtime stylesheet injection is forbidden. Move presentation to generated HTML/CSS: ${styleInjectionViolations.join(', ')}`,
);

const bodyCuesRuntime = read('scripts/body-cues-tool.js');
assert.ok(!bodyCuesRuntime.includes('loadEnhancementStyles'), 'Body Cues must not load its stylesheet at runtime.');
assert.ok(!bodyCuesRuntime.includes('buildControls('), 'Body Cues initial controls must be generated statically.');

const inferenceRuntime = read('scripts/feeling-reverse-inference.js');
assert.ok(!inferenceRuntime.includes('loadPolishStyles'), 'Feeling inference CSS must be present before browser runtime.');

const bodyCuesHtml = read('feelings/body-cues/index.html');
assert.match(bodyCuesHtml, /styles\/body-cues\.css/);
assert.match(bodyCuesHtml, /styles\/body-cues-mobile\.css/);
assert.match(bodyCuesHtml, /data-option-id=/, 'Body Cues sliders must exist in initial HTML.');

const feelingHtml = read('feelings/calm/index.html');
assert.match(feelingHtml, /styles\/feeling-inference-mobile\.css/);
assert.match(feelingHtml, /class="feeling-inference-wrapper" data-reverse-inference-container(?:>|\s)/);
assert.doesNotMatch(
  feelingHtml,
  /class="feeling-inference-wrapper" data-reverse-inference-container hidden/,
  'Feeling inference disclosure must not appear after an async visual reveal.',
);

const inventoryHtml = read('inventory/index.html');
assert.match(inventoryHtml, /styles\/inventory-mobile\.css/);
assert.match(inventoryHtml, /inventory-page__status/);
assert.match(
  inventoryHtml,
  /id="inventory-email-personal"[\s\S]*?style="display: none"[\s\S]*?data-static-share-source/,
  'The inventory share action may be adopted into the hidden Menu at runtime, but its source must never enter first paint.',
);
assert.doesNotMatch(inventoryHtml, /class="inventory-bluesky-panel"/);
assert.doesNotMatch(inventoryHtml, /class="inventory-journal-button"/);
assert.doesNotMatch(inventoryHtml, /class="inventory-shared-button"/);
assert.doesNotMatch(inventoryHtml, /class="inventory-actions inventory-actions--collapsible"/);

const wheelHtml = read('feelings/emotions-wheel/index.html');
assert.match(wheelHtml, /<svg[\s>]/, 'Emotions wheel must be present in static HTML.');
assert.match(wheelHtml, /class="wheel-slice-link"/);
assert.doesNotMatch(wheelHtml, /createElementNS|buildWheel\s*\(/, 'Emotions wheel must not be assembled after page load.');
assert.match(wheelHtml, /data-magnet-key="site-nav"/, 'Emotions wheel should use the shared generated app shell.');

const packageJson = JSON.parse(read('package.json'));
assert.match(packageJson.scripts['build:pages'], /build-emotions-wheel\.mjs/);
assert.match(packageJson.scripts['build:pages'], /finalize-static-assets\.mjs/);

console.log(`Static-first architecture checks passed across ${runtimeFiles.length} runtime source files.`);
