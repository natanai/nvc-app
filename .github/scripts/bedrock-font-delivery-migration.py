from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FONT_HOST = 'https://fonts.googleapis.com'
FONT_FILE_HOST = 'https://fonts.gstatic.com'
FONT_MARKER = 'href="https://fonts.googleapis.com/css2?'


def insert_preconnects(text: str, label: str) -> str:
    if FONT_MARKER not in text:
        return text
    if (
        'rel="preconnect" href="https://fonts.googleapis.com"' in text
        and 'rel="preconnect" href="https://fonts.gstatic.com"' in text
    ):
        return text

    marker_index = text.index(FONT_MARKER)
    link_start = text.rfind('<link', 0, marker_index)
    if link_start < 0:
        raise RuntimeError(f'{label}: unable to locate Google Fonts link start')
    line_start = text.rfind('\n', 0, link_start) + 1
    indent = text[line_start:link_start]
    preconnects = (
        f'{indent}<link rel="preconnect" href="{FONT_HOST}" />\n'
        f'{indent}<link rel="preconnect" href="{FONT_FILE_HOST}" crossorigin />\n'
    )
    return text[:line_start] + preconnects + text[line_start:]


compiler = ROOT / 'scripts' / 'build-pages.mjs'
compiler_text = compiler.read_text(encoding='utf-8')
compiler_next = insert_preconnects(compiler_text, 'scripts/build-pages.mjs')
if compiler_next == compiler_text:
    raise RuntimeError('scripts/build-pages.mjs did not require the font preconnect migration')
compiler.write_text(compiler_next, encoding='utf-8')

html_changed = []
for path in sorted(ROOT.rglob('*.html')):
    if any(part in {'.git', 'node_modules'} for part in path.parts):
        continue
    text = path.read_text(encoding='utf-8')
    if FONT_MARKER not in text:
        continue
    next_text = insert_preconnects(text, str(path.relative_to(ROOT)))
    if next_text != text:
        path.write_text(next_text, encoding='utf-8')
        html_changed.append(str(path.relative_to(ROOT)))

if not html_changed:
    raise RuntimeError('No committed HTML files required font preconnect migration')

package_path = ROOT / 'package.json'
package_text = package_path.read_text(encoding='utf-8')
needle = '    "test:performance": "node --test tests/performance-budget.test.mjs",\n'
replacement = needle + '    "test:delivery": "node --test tests/font-delivery.test.mjs",\n'
if '"test:delivery"' not in package_text:
    if needle not in package_text:
        raise RuntimeError('package.json performance-test anchor not found')
    package_text = package_text.replace(needle, replacement, 1)
    package_path.write_text(package_text, encoding='utf-8')

test_path = ROOT / 'tests' / 'font-delivery.test.mjs'
test_path.write_text(r'''import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?';
const CSS_PRECONNECT = '<link rel="preconnect" href="https://fonts.googleapis.com"';
const FILE_PRECONNECT = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin';

function collectHtml(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...collectHtml(path));
    else if (stat.isFile() && path.endsWith('.html')) files.push(path);
  }
  return files;
}

test('every Google Fonts consumer warms both required origins before requesting font CSS', () => {
  const consumers = collectHtml(root).filter((path) => readFileSync(path, 'utf8').includes(FONT_STYLESHEET));
  assert.ok(consumers.length >= 180, `expected the app shell to expose Google Fonts broadly; found ${consumers.length} consumers`);

  for (const path of consumers) {
    const html = readFileSync(path, 'utf8');
    const label = relative(root, path);
    const cssPreconnectIndex = html.indexOf(CSS_PRECONNECT);
    const filePreconnectIndex = html.indexOf(FILE_PRECONNECT);
    const stylesheetIndex = html.indexOf(FONT_STYLESHEET);

    assert.ok(cssPreconnectIndex >= 0, `${label} must preconnect to fonts.googleapis.com`);
    assert.ok(filePreconnectIndex >= 0, `${label} must preconnect to fonts.gstatic.com with crossorigin`);
    assert.ok(cssPreconnectIndex < stylesheetIndex, `${label} must warm fonts.googleapis.com before the stylesheet request`);
    assert.ok(filePreconnectIndex < stylesheetIndex, `${label} must warm fonts.gstatic.com before the stylesheet request`);
    assert.equal(html.split(CSS_PRECONNECT).length - 1, 1, `${label} should own one Google Fonts CSS preconnect`);
    assert.equal(html.split(FILE_PRECONNECT).length - 1, 1, `${label} should own one Google Fonts file preconnect`);
  }
});

test('the canonical page compiler owns the same font connection warm-up', () => {
  const source = readFileSync(join(root, 'scripts', 'build-pages.mjs'), 'utf8');
  const cssPreconnectIndex = source.indexOf(CSS_PRECONNECT);
  const filePreconnectIndex = source.indexOf(FILE_PRECONNECT);
  const stylesheetIndex = source.indexOf(FONT_STYLESHEET);

  assert.ok(cssPreconnectIndex >= 0, 'build-pages.mjs must emit the fonts.googleapis.com preconnect');
  assert.ok(filePreconnectIndex >= 0, 'build-pages.mjs must emit the fonts.gstatic.com preconnect');
  assert.ok(cssPreconnectIndex < stylesheetIndex, 'compiler must emit CSS-origin preconnect before Google Fonts CSS');
  assert.ok(filePreconnectIndex < stylesheetIndex, 'compiler must emit font-origin preconnect before Google Fonts CSS');
});
''', encoding='utf-8')

print(f'Prepared font delivery ownership for {len(html_changed)} HTML files.')
