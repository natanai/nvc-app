from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


# Move top-level imports into parser-visible HTML while preserving their cascade order.
replace_once(
    'styles.css',
    """@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;600&family=Manrope:wght@500;600;700&display=swap');
@import url('styles/feelings-magnet-icons.css');
@import url('styles/needs-magnet-icons.css');
@import url('styles/shared-density.css');
@import url('styles/inventory-core-shell.css');

""",
    '',
)
# This late import is invalid/dormant because it occurs after ordinary rules.
# Generated pages already receive repaired nav-critical CSS from the compiler.
replace_once(
    'styles.css',
    "@import url('./styles/nav-critical.css');\n\n",
    '',
)

# Keep the existing styles.css preload exactly where it is. Replace only the
# main stylesheet line with the formerly imported dependencies followed by the
# main stylesheet, preserving the established cascade order.
replace_once(
    'scripts/build-pages.mjs',
    '    <link rel="stylesheet" href="${cssHref}" fetchpriority="high" />${extraHead}',
    """    <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;600&amp;family=Manrope:wght@500;600;700&amp;display=swap\" />
    <link rel=\"stylesheet\" href=\"${basePath}styles/feelings-magnet-icons.css\" />
    <link rel=\"stylesheet\" href=\"${basePath}styles/needs-magnet-icons.css\" />
    <link rel=\"stylesheet\" href=\"${basePath}styles/shared-density.css\" />
    <link rel=\"stylesheet\" href=\"${basePath}styles/inventory-core-shell.css\" />
    <link rel=\"stylesheet\" href=\"${cssHref}\" fetchpriority=\"high\" />${extraHead}""",
)

# The Emotions Wheel is the explicit standalone HTML surface outside the page compiler.
replace_once(
    'feelings/emotions-wheel/index.html',
    '    <link rel="stylesheet" href="../../styles.css" />',
    """    <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;600&amp;family=Manrope:wght@500;600;700&amp;display=swap\" />
    <link rel=\"stylesheet\" href=\"../../styles/feelings-magnet-icons.css\" />
    <link rel=\"stylesheet\" href=\"../../styles/needs-magnet-icons.css\" />
    <link rel=\"stylesheet\" href=\"../../styles/shared-density.css\" />
    <link rel=\"stylesheet\" href=\"../../styles/inventory-core-shell.css\" />
    <link rel=\"stylesheet\" href=\"../../styles.css\" />""",
)

Path('tests/css-load-graph.test.mjs').write_text("""import test from 'node:test';
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

test('shared styles are parser-discovered directly with the established cascade order', async () => {
  const styles = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
  assert.ok(!styles.includes('@import'), 'styles.css must not hide shared dependencies behind nested @import discovery');

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
    if (mainIndex <= indices.at(-1)) {
      failures.push(`${relative}: main styles.css must follow shared dependencies`);
    }
  }
  assert.ok(checked >= 181, `expected all styles.css surfaces, checked ${checked}`);
  assert.equal(failures.length, 0, `CSS load-graph exceptions:\n${failures.join('\\n')}`);
});

test('page compiler owns the generated shared stylesheet graph and standalone wheel mirrors it explicitly', async () => {
  const [compiler, wheel] = await Promise.all([
    fs.readFile(path.join(root, 'scripts/build-pages.mjs'), 'utf8'),
    fs.readFile(path.join(root, 'feelings/emotions-wheel/index.html'), 'utf8'),
  ]);
  const compilerIndices = [];
  for (const dependency of LOCAL_DEPENDENCIES) {
    const index = compiler.indexOf(dependency);
    assert.ok(index >= 0, `compiler missing ${dependency}`);
    compilerIndices.push(index);
    assert.ok(wheel.includes(`href="../../${dependency}"`));
  }
  for (let index = 1; index < compilerIndices.length; index += 1) {
    assert.ok(compilerIndices[index] > compilerIndices[index - 1], 'compiler changed shared stylesheet cascade order');
  }
  assert.ok(compiler.includes('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible'));
  assert.ok(wheel.includes('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible'));
});
""")

package_path = Path('package.json')
package = package_path.read_text()
needle = 'tests/shared-density-polish.test.mjs tests/journal-load-graph.test.mjs'
replacement = 'tests/shared-density-polish.test.mjs tests/css-load-graph.test.mjs tests/journal-load-graph.test.mjs'
if package.count(needle) != 1:
    raise SystemExit(f'package.json: expected one CSS test insertion point, found {package.count(needle)}')
package_path.write_text(package.replace(needle, replacement, 1))

# Update the old contract to assert direct parser discovery instead of the former top-level import chain.
shared_test = Path('tests/shared-density-polish.test.mjs')
text = shared_test.read_text()
old_contract = """  const densityImport = \"@import url('styles/shared-density.css');\";
  const shellImport = \"@import url('styles/inventory-core-shell.css');\";
  const densityIndex = styles.indexOf(densityImport);
  const shellIndex = styles.indexOf(shellImport);
  assert.ok(densityIndex >= 0, 'styles.css should discover shared-density.css directly');
  assert.ok(shellIndex > densityIndex, 'shared density must retain its cascade position before the shell');
  assert.ok(!shell.includes(\"@import url('shared-density.css');\"), 'inventory-core-shell.css must not create a serial CSS discovery chain');"""
new_contract = """  assert.ok(!styles.includes('@import'), 'styles.css should not own nested stylesheet discovery');
  assert.ok(!shell.includes(\"@import url('shared-density.css');\"), 'inventory-core-shell.css must not create a serial CSS discovery chain');"""
if text.count(old_contract) != 1:
    raise SystemExit('tests/shared-density-polish.test.mjs: stale discovery contract did not match exactly once')
shared_test.write_text(text.replace(old_contract, new_contract, 1))
