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

test('canonical page compiler owns one reusable saved-layout prepaint helper', async () => {
  const compiler = await read('scripts/build-pages.mjs');

  assert.ok(
    compiler.includes('const magnetPrefillScript = (storageKey, includeDecoration = false) => String.raw`'),
    'saved-layout prepaint should have one generic compiler owner with an opt-in final-pose path',
  );
  assert.ok(
    compiler.includes("const prefill = magnetPrefillScript(NAV_MAGNET_STORAGE_KEY);"),
    'navigation should continue using the existing prepaint output',
  );
  assert.ok(
    compiler.includes("magnetPrefillScript(type + '-hub-v4', true)"),
    'category hubs should opt into visually final prepaint transforms',
  );
  assert.ok(compiler.includes('stableHubMagnetDecorationStyle'), 'generated hubs should own deterministic handmade pose values');
  assert.ok(!compiler.includes('const navPrefillScript ='), 'nav-only duplicate prefill owner should be gone');
});

test('saved category-hub layouts are visually final before the normal magnet module can reveal them', async () => {
  for (const [relativePath, storageKey] of HUBS) {
    const html = await read(relativePath);
    const rootMarker = `data-magnet-key="${storageKey}"`;
    const storageMarker = `magnetPositions:${storageKey}`;
    const moduleMarker = 'scripts/magnets.js';

    const rootAt = html.indexOf(rootMarker);
    const storageAt = html.indexOf(storageMarker, rootAt);
    const moduleAt = html.indexOf(moduleMarker, storageAt);

    assert.ok(rootAt >= 0, `${relativePath} should contain its canonical magnet root`);
    assert.ok(storageAt > rootAt, `${relativePath} should preapply its saved localStorage layout after the board markup exists`);
    assert.ok(moduleAt > storageAt, `${relativePath} should restore saved coordinates before loading the normal magnet module`);
    assert.ok(html.includes('--magnet-tilt:'), `${relativePath} should author stable tilt before runtime hydration`);
    assert.ok(html.includes('--magnet-offset:'), `${relativePath} should author stable offset before runtime hydration`);

    const prefillSlice = html.slice(storageAt, moduleAt);
    assert.ok(prefillSlice.includes("board.dataset.ready = '1'"), `${relativePath} should reveal the board from the prepaint restore`);
    assert.ok(prefillSlice.includes('hasMissingVisiblePlacement'), `${relativePath} should fail closed when saved layout does not cover every visible magnet`);
    assert.ok(prefillSlice.includes('translateY(calc(var(--magnet-offset, 0px)'), `${relativePath} should include the authored vertical pose in first visible transform`);
    assert.ok(prefillSlice.includes('rotate(var(--magnet-tilt, 0))'), `${relativePath} should include the authored tilt in first visible transform`);
  }
});

test('normal magnet hydration preserves compiler-authored hub pose values', async () => {
  const runtime = await read('scripts/magnets.js');
  assert.ok(runtime.includes("if (!element.style.getPropertyValue('--magnet-tilt').trim())"));
  assert.ok(runtime.includes("if (!element.style.getPropertyValue('--magnet-offset').trim())"));
});

test('unrestored boards remain hidden rather than flashing a temporary seed layout', async () => {
  const criticalCss = await read('styles/nav-critical.css');
  assert.ok(
    criticalCss.includes(".magnet-board:not([data-ready='1']) .magnet"),
    'critical CSS should keep a board gated until either prepaint restore or normal initialization is ready',
  );
  assert.ok(criticalCss.includes('visibility: hidden;'));
});

test('mobile scrolling avoids known repaint triggers around illustrated feeling magnets', async () => {
  const styles = await read('styles.css');
  assert.ok(styles.includes('@media (hover: none) and (pointer: coarse)'));
  assert.ok(styles.includes('background-attachment: scroll;'), 'touch-first devices should not keep the fixed root background during momentum scrolling');

  const artStart = styles.indexOf(".magnet[data-magnet-id^='feelings-']::after");
  assert.ok(artStart >= 0, 'Feeling illustration pseudo-element should remain explicitly owned');
  const artBlock = styles.slice(artStart, styles.indexOf('}', artStart) + 1);
  assert.ok(artBlock.includes('-webkit-backface-visibility: hidden;'));
  assert.ok(artBlock.includes('backface-visibility: hidden;'));
  assert.ok(artBlock.includes('transform: translateZ(0);'));
});
