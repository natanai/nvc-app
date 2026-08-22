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

build_path = Path('scripts/build-pages.mjs')
build = build_path.read_text()
old = """${criticalStyles ? `${criticalStyles}\\
` : ''}    <link rel=\"preload\" href=\"${cssHref}\" as=\"style\" />
    <link rel=\"stylesheet\" href=\"${cssHref}\" fetchpriority=\"high\" />${extraHead}"""
new = """${criticalStyles ? `${criticalStyles}\\
` : ''}    <link rel=\"preload\" href=\"${cssHref}\" as=\"style\" />
    <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;600&amp;family=Manrope:wght@500;600;700&amp;display=swap\" />
    <link rel=\"stylesheet\" href=\"${basePath}styles/feelings-magnet-icons.css\" />
    <link rel=\"stylesheet\" href=\"${basePath}styles/needs-magnet-icons.css\" />
    <link rel=\"stylesheet\" href=\"${basePath}styles/shared-density.css\" />
    <link rel=\"stylesheet\" href=\"${basePath}styles/inventory-core-shell.css\" />
    <link rel=\"stylesheet\" href=\"${cssHref}\" fetchpriority=\"high\" />${extraHead}"""
if build.count(old) != 1:
    raise SystemExit(f'scripts/build-pages.mjs: expected one shared stylesheet insertion point, found {build.count(old)}')
build_path.write_text(build.replace(old, new, 1))

# The Emotions Wheel is the single explicit standalone HTML surface outside the page compiler.
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
  let checked = 0;
  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf8');
    const mainMatch = html.match(/<link rel=\"stylesheet\" href=\"([^\"]*styles\.css)\"(?: fetchpriority=\"high\")? \/>/);
    if (!mainMatch) continue;
    checked += 1;
    const mainHref = mainMatch[1];
    const basePath = mainHref.slice(0, -'styles.css'.length);
    const indices = [html.indexOf(`href=\"${FONT_HREF}\"`)];
    for (const dependency of LOCAL_DEPENDENCIES) {
      indices.push(html.indexOf(`href=\"${basePath}${dependency}\"`));
    }
    const mainIndex = html.indexOf(mainMatch[0]);
    indices.forEach((index, position) => {
      assert.ok(index >= 0, `${path.relative(root, file)} missing shared stylesheet dependency ${position}`);
    });
    for (let index = 1; index < indices.length; index += 1) {
      assert.ok(indices[index] > indices[index - 1], `${path.relative(root, file)} changed shared stylesheet cascade order`);
    }
    assert.ok(mainIndex > indices.at(-1), `${path.relative(root, file)} must load main styles.css after shared dependencies`);
  }
  assert.ok(checked >= 181, `expected all app-shell plus standalone styles.css surfaces, checked ${checked}`);
});

test('page compiler owns the generated shared stylesheet graph and standalone wheel mirrors it explicitly', async () => {
  const [compiler, wheel] = await Promise.all([
    fs.readFile(path.join(root, 'scripts/build-pages.mjs'), 'utf8'),
    fs.readFile(path.join(root, 'feelings/emotions-wheel/index.html'), 'utf8'),
  ]);
  for (const dependency of LOCAL_DEPENDENCIES) {
    assert.ok(compiler.includes(`href=\\\"${'${basePath}'}${dependency}\\\"`));
    assert.ok(wheel.includes(`href=\"../../${dependency}\"`));
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
