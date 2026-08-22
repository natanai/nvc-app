from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'styles/nav-critical.css',
    """html {
  scrollbar-gutter: auto;
  background: linear-gradient(135deg, color-mix(in srgb, var(--plum) 65%, #000 5%) 0%,
      color-mix(in srgb, var(--plum) 55%, #fff 20%) 60%,
      color-mix(in srgb, var(--plum) 45%, #fff 35%) 100%);
  background-attachment: fixed;
}""",
    """html {
  scrollbar-gutter: auto;
}""",
)
replace_once(
    'styles/nav-critical.css',
    """.magnet-board:not([data-ready='1']) .magnet {
  position: absolute;
  touch-action: none;
  transition: none;
  visibility: hidden;
}

""",
    '',
)

replace_once(
    'styles.css',
    """  mix-blend-mode: normal;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(0);
}""",
    """  mix-blend-mode: normal;
}""",
)

replace_once(
    'scripts/magnets.js',
    """const applyMagnetDecorations = (element, index) => {
  element.classList.add('magnet');
  element.style.order = String(index);
  if (!element.style.getPropertyValue('--magnet-tilt').trim()) {
    const tilt = randomFrom(TILT_OPTIONS);
    element.style.setProperty('--magnet-tilt', `${tilt}deg`);
  }
  if (!element.style.getPropertyValue('--magnet-offset').trim()) {
    const offset = randomFrom(OFFSET_OPTIONS);
    element.style.setProperty('--magnet-offset', `${offset}px`);
  }
};""",
    """const applyMagnetDecorations = (element, index) => {
  element.classList.add('magnet');
  element.style.order = String(index);
  const tilt = randomFrom(TILT_OPTIONS);
  const offset = randomFrom(OFFSET_OPTIONS);
  element.style.setProperty('--magnet-tilt', `${tilt}deg`);
  element.style.setProperty('--magnet-offset', `${offset}px`);
};""",
)

replace_once(
    'tests/shared-nav-menu.test.mjs',
    """  assert.ok(critical.includes('.site-nav__magnet--menu {'), 'Menu must have critical prepaint styling');
  assert.ok(critical.includes(".magnet-board:not([data-ready='1']) .magnet"), 'critical nav CSS must hide unpositioned magnets');""",
    """  assert.ok(critical.includes('.site-nav__magnet--menu {'), 'Menu must have critical prepaint styling');
  assert.ok(!critical.includes(".magnet-board:not([data-ready='1']) .magnet"), 'critical nav CSS must not gate the whole magnet board on JavaScript readiness');""",
)

compiler = Path('scripts/build-pages.mjs')
text = compiler.read_text()

decoration_owner = """const HUB_MAGNET_TILT_OPTIONS = [-2, -1, 0, 1, 2];
const HUB_MAGNET_OFFSET_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];

const stableHubMagnetDecorationStyle = (magnetId) => {
  let hash = 2166136261;
  const value = String(magnetId || '');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const tilt = HUB_MAGNET_TILT_OPTIONS[hash % HUB_MAGNET_TILT_OPTIONS.length];
  const offsetHash = Math.imul(hash ^ 0x9e3779b9, 2654435761) >>> 0;
  const offset = HUB_MAGNET_OFFSET_OPTIONS[offsetHash % HUB_MAGNET_OFFSET_OPTIONS.length];
  return `--magnet-tilt: ${tilt}deg; --magnet-offset: ${offset}px;`;
};

"""
if text.count(decoration_owner) != 1:
    raise SystemExit('build-pages: deterministic hub decoration owner did not match exactly once')
text = text.replace(decoration_owner, '', 1)

signature = 'const magnetPrefillScript = (storageKey, includeDecoration = false) => String.raw`'
if text.count(signature) != 1:
    raise SystemExit('build-pages: prefill signature did not match exactly once')
text = text.replace(signature, 'const magnetPrefillScript = (storageKey) => String.raw`', 1)

decorated_transform = """${includeDecoration
              ? "            el.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) translateY(calc(var(--magnet-offset, 0px) + var(--magnet-hover-offset, 0px))) rotate(var(--magnet-tilt, 0))';"
              : "            el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';"}"""
plain_transform = "            el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';"
if text.count(decorated_transform) != 1:
    raise SystemExit('build-pages: decorated prepaint transform did not match exactly once')
text = text.replace(decorated_transform, plain_transform, 1)

old_magnets = """  const magnets = items
  .map((item) => {
    const label = escapeHtml(item.title);
    const magnetId = `${type}-${item.slug}`;
    const decorationStyle = stableHubMagnetDecorationStyle(magnetId);
    return `<a class="pill magnet" data-magnet-id="${magnetId}" style="${decorationStyle}" href="${item.slug}/"><span class="magnet__label">${label}</span></a>`;
  })
  .join('');"""
new_magnets = """  const magnets = items
  .map((item) => {
    const label = escapeHtml(item.title);
    return `<a class="pill magnet" data-magnet-id="${type}-${item.slug}" href="${item.slug}/"><span class="magnet__label">${label}</span></a>`;
  })
  .join('');"""
if text.count(old_magnets) != 1:
    raise SystemExit('build-pages: generated hub magnet markup did not match exactly once')
text = text.replace(old_magnets, new_magnets, 1)

hub_prefill = "${magnetPrefillScript(type + '-hub-v4', true)}\n"
if text.count(hub_prefill) != 1:
    raise SystemExit('build-pages: hub prefill call did not match exactly once')
text = text.replace(hub_prefill, '', 1)
compiler.write_text(text)

Path('tests/magnet-prepaint.test.mjs').write_text("""import test from 'node:test';
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
  const compiler = await read('scripts/build-pages.mjs');
  assert.ok(compiler.includes('const magnetPrefillScript = (storageKey) => String.raw`'));
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
  for (const relativePath of ['feelings/index.html', 'feelings/afraid/index.html', 'needs/index.html']) {
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
""")
