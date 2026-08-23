import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
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
