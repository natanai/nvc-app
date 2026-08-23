import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');

test('expanded phone navigation reserves a stable canvas for every enabled magnet', () => {
  const critical = read('styles/nav-critical.css');
  assert.match(
    critical,
    /\.site-nav\[data-nav-expanded='true'\] \.site-nav__board \{[\s\S]*?min-height: clamp\(20rem, 105vw, 23rem\);/,
  );
  assert.match(critical, /normalized user[\s\S]*positions restore against the same usable aspect ratio/);
});

test('Customizer has one persistent in-panel close control', () => {
  const css = read('styles.css');
  const runtime = read('scripts/inventory.js');

  assert.match(css, /\.palette-corner\.is-open \.palette-corner__toggle \{[\s\S]*?visibility: hidden;/);
  assert.match(css, /\.palette-form__close \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/);
  assert.ok(runtime.includes('panel.append(header, panelScroll);'));
  assert.equal(runtime.includes('form.appendChild(header);'), false);
});

test('scrolling shared overlays keep dismissal controls available', () => {
  const shared = read('styles.css');
  const menu = read('styles/inventory-core-shell.css');
  const observations = read('styles/observations.css');

  assert.match(
    menu,
    /\.inventory-more-menu__header,[\s\S]*?\.inventory-more-menu__subheader \{[\s\S]*?position: sticky;[\s\S]*?top: 0;/,
  );
  assert.match(shared, /\.evidence-popover__dialog \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\);/);
  assert.match(shared, /\.evidence-popover__body \{[\s\S]*?overflow-y: auto;/);
  assert.match(shared, /\.feeling-inference__popover-close \{[\s\S]*?position: sticky;[\s\S]*?min-height: 44px;/);
  assert.match(observations, /\.observation-info-dialog__sheet \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\);/);
  assert.match(shared, /\.support-journal__header \{[\s\S]*?position: sticky;/);
});
