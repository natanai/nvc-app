import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules', '.git', '.github', '.vscode']);
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;600&amp;family=Manrope:wght@500;600;700&amp;display=swap';
const LOCAL_DEPENDENCIES = [
  'styles/feelings-magnet-icons.css',
  'styles/needs-magnet-icons.css',
  'styles/shared-density.css',
  'styles/inventory-core-shell.css',
];

async function collectHtml(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) files.push(fullPath);
  }
  return files;
}

test('every styles.css consumer directly discovers shared dependencies in cascade order', async () => {
  const styles = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
  assert.ok(!styles.includes('@import'), 'styles.css must not hide dependencies behind nested @import discovery');

  const htmlFiles = await collectHtml(root);
  const failures = [];
  let checked = 0;
  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf8');
    const mainMatch = html.match(/<link rel="stylesheet" href="([^"]*styles[.]css)"(?: fetchpriority="high")? [/]>/)
      || html.match(/<link rel="stylesheet" href="([^"]*styles[.]css)" media="print" onload="this[.]media='all'" [/]>/);
    if (!mainMatch) continue;
    checked += 1;
    const relative = path.relative(root, file);
    const mainHref = mainMatch[1];
    const basePath = mainHref.slice(0, -'styles.css'.length);
    const expected = [FONT_HREF, ...LOCAL_DEPENDENCIES.map((dependency) => `${basePath}${dependency}`)];
    const indices = expected.map((href) => html.indexOf(`href="${href}"`));
    const missing = expected.filter((_, index) => indices[index] < 0);
    if (missing.length) {
      failures.push(`${relative}: missing ${missing.join(', ')}`);
      continue;
    }
    for (let index = 1; index < indices.length; index += 1) {
      if (indices[index] <= indices[index - 1]) {
        failures.push(`${relative}: shared stylesheet cascade order changed`);
        break;
      }
    }
    const mainIndex = html.indexOf(mainMatch[0]);
    if (mainIndex <= indices.at(-1)) failures.push(`${relative}: main styles.css must follow shared dependencies`);
  }
  assert.ok(checked >= 181, `expected all styles.css surfaces, checked ${checked}`);
  assert.equal(failures.length, 0, `CSS load-graph exceptions:
${failures.join('\n')}`);
});

test('generated and explicit blocking owners share the same dependency order', async () => {
  const [compiler, wheel, feed, observations] = await Promise.all([
    fs.readFile(path.join(root, 'scripts/build-pages.mjs'), 'utf8'),
    fs.readFile(path.join(root, 'feelings/emotions-wheel/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'feed/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'observations/index.html'), 'utf8'),
  ]);
  for (const dependency of LOCAL_DEPENDENCIES) {
    assert.ok(compiler.includes(dependency), `compiler missing ${dependency}`);
    assert.ok(wheel.includes(`href="../../${dependency}"`));
    assert.ok(feed.includes(`href="../${dependency}"`));
    assert.ok(observations.includes(`href="../${dependency}"`));
  }
  assert.ok(compiler.includes('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible'));
});

test('Alexithymia Support loads its final shared layout before eager interactive runtimes', async () => {
  const html = await fs.readFile(path.join(root, 'alexithymia-support/index.html'), 'utf8');
  const expectedHrefs = [FONT_HREF, ...LOCAL_DEPENDENCIES.map((dependency) => `../${dependency}`), '../styles.css'];
  for (const href of expectedHrefs) {
    assert.ok(
      html.includes(`<link rel="stylesheet" href="${href}"${href === '../styles.css' ? ' fetchpriority="high"' : ''} />`),
      `Alexithymia blocking graph missing ${href}`,
    );
  }
  assert.equal(html.includes('media="print" onload="this.media=\'all\'"'), false);
  assert.equal(html.includes('<noscript>'), false);
  assert.ok(html.indexOf('../styles.css') < html.indexOf('../scripts/magnets.js'));
});
