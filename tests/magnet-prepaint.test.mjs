import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const HUBS = [
  ['feelings/index.html', 'feelings-hub-v4'],
  ['needs/index.html', 'needs-hub-v4'],
  ['faux-feelings/index.html', 'faux-feelings-hub-v4'],
];

test('navigation alone keeps the lightweight saved-layout prepaint path', async () => {
  const [compiler, prepaint] = await Promise.all([read('scripts/build-pages.mjs'), read('scripts/nav-prepaint.mjs')]);
  assert.ok(compiler.includes("import { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } from './nav-prepaint.mjs';"));
  assert.ok(prepaint.includes('export const magnetPrefillScript = (storageKey) => String.raw`'));
  assert.ok(compiler.includes('const prefill = magnetPrefillScript(NAV_MAGNET_STORAGE_KEY);'));
  assert.ok(!compiler.includes("magnetPrefillScript(type + '-hub-v4'"));
  assert.ok(!compiler.includes('stableHubMagnetDecorationStyle'));
});

test('category hubs paint normally and let the magnet runtime restore their state', async () => {
  for (const [relativePath, storageKey] of HUBS) {
    const html = await read(relativePath);
    assert.ok(html.includes(`data-magnet-key="${storageKey}"`));
    assert.ok(!html.includes(`magnetPositions:${storageKey}`), `${relativePath} should not inline a second hub restore owner`);
  }
});

test('critical paint never gates all magnets on JavaScript readiness', async () => {
  const criticalCss = await read('styles/nav-critical.css');
  assert.ok(!criticalCss.includes(".magnet-board:not([data-ready='1']) .magnet"));
  for (const relativePath of ['feelings/index.html', 'feelings/afraid/index.html', 'needs/index.html']) {
    const html = await read(relativePath);
    assert.ok(!html.includes(".magnet-board:not([data-ready='1']) .magnet"), `${relativePath} must not inline the readiness visibility gate`);
  }
});

test('critical paint never installs a fixed root background on mobile', async () => {
  const criticalCss = await read('styles/nav-critical.css');
  assert.ok(!criticalCss.includes('background-attachment: fixed'));
  for (const relativePath of ['feelings/index.html', 'feelings/afraid/index.html', 'needs/index.html', 'observations/index.html']) {
    const html = await read(relativePath);
    assert.ok(!html.includes('background-attachment: fixed'), `${relativePath} must not inline the mobile repaint trigger`);
  }
});

test('Feeling art uses the normal paint path without a compensating compositor layer', async () => {
  const styles = await read('styles.css');
  const artStart = styles.indexOf(".magnet[data-magnet-id^='feelings-']::after");
  assert.ok(artStart >= 0);
  const artBlock = styles.slice(artStart, styles.indexOf('}', artStart) + 1);
  assert.ok(!artBlock.includes('backface-visibility'));
  assert.ok(!artBlock.includes('translateZ(0)'));
});

test('magnet runtime remains the single owner of handmade tilt and offset', async () => {
  const runtime = await read('scripts/magnets.js');
  assert.ok(runtime.includes('const tilt = randomFrom(TILT_OPTIONS);'));
  assert.ok(runtime.includes('const offset = randomFrom(OFFSET_OPTIONS);'));
  assert.ok(!runtime.includes("element.style.getPropertyValue('--magnet-tilt')"));
  assert.ok(!runtime.includes("element.style.getPropertyValue('--magnet-offset')"));
});

test('Observations compiles the same responsive navigation first-paint contract as generated pages', async () => {
  const [html, criticalCss, observationsCss] = await Promise.all([
    read('observations/index.html'),
    read('styles/nav-critical.css'),
    read('styles/observations.css'),
  ]);
  const { NAV_MAGNET_STORAGE_KEY, magnetPrefillScript } = await import('../scripts/nav-prepaint.mjs');
  assert.ok(html.includes('<!-- shared-nav-critical:start -->'));
  assert.ok(html.includes('<!-- shared-nav-critical:end -->'));
  assert.ok(html.includes(`<style>${criticalCss.trim()}</style>`));
  assert.ok(html.includes('<link rel="stylesheet" href="../styles/observations.css" />'));
  assert.ok(observationsCss.includes('.observations-page'));
  assert.ok(observationsCss.includes('.observation-editor__card'));
  assert.ok(observationsCss.includes('.observation-suggestions__actions'));
  assert.ok(html.includes('<!-- shared-nav-prefill:start -->'));
  assert.ok(html.includes('<!-- shared-nav-prefill:end -->'));
  assert.ok(html.includes(magnetPrefillScript(NAV_MAGNET_STORAGE_KEY).trim()));
  assert.ok(html.includes("var LEGACY_STORAGE_KEY = 'magnetPositions:site-nav';"));
  assert.ok(html.includes("var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;"));
  assert.ok(!html.includes("var STORAGE_KEY = 'magnetPositions:site-nav';"));
});
