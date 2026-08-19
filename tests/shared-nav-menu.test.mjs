import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function collectHtml(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collectHtml(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

test('shared Menu magnet uses the established prepaint nav contract', async () => {
  const htmlFiles = await collectHtml(root);
  const violations = [];

  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf8');
    if (!html.includes('data-magnet-key="site-nav"')) continue;
    const relative = path.relative(root, file);
    const menuIndex = html.indexOf('data-magnet-id="nav-menu"');
    const homeIndex = html.indexOf('data-magnet-id="nav-home"');
    const inventoryIndex = html.indexOf('data-magnet-id="nav-inventory"');

    if (menuIndex < 0) violations.push(`${relative}: missing static nav-menu`);
    if (homeIndex < 0) violations.push(`${relative}: missing nav-home`);
    if (menuIndex >= 0 && homeIndex >= 0 && menuIndex > homeIndex) {
      violations.push(`${relative}: nav-menu must precede nav-home in the canonical DOM order`);
    }
    if (inventoryIndex < 0) violations.push(`${relative}: missing Inventory magnet`);
    if (!html.includes('scripts/inventory-core-shell.js')) {
      violations.push(`${relative}: missing normal More controller script`);
    }
    if (!html.includes('hasMissingVisiblePlacement')) {
      violations.push(`${relative}: nav prefill can reveal a board with an unplaced visible magnet`);
    }
  }

  assert.deepEqual(violations, []);

  const contrast = await fs.readFile(path.join(root, 'assets/js/ui/contrast.js'), 'utf8');
  assert.ok(!contrast.includes('loadSharedMoreNavigationBeforeMagnets'), 'More must not be parser-injected from contrast.js');
  assert.ok(contrast.includes('loadBodyCuesStylesBeforePaint();'), 'Body Cues prepaint loader must remain intact');

  const magnets = await fs.readFile(path.join(root, 'scripts/magnets.js'), 'utf8');
  assert.ok(magnets.includes('hasMissingVisibleNavMagnet'), 'nav engine must reseed when a visible magnet is absent from saved state');
  const order = magnets.indexOf("'nav-menu'");
  const home = magnets.indexOf("'nav-home'", order);
  const observations = magnets.indexOf("'nav-observations'", home);
  const feelings = magnets.indexOf("'nav-feelings'", observations);
  const needs = magnets.indexOf("'nav-needs'", feelings);
  const inventory = magnets.indexOf("'nav-inventory'", needs);
  const customizer = magnets.indexOf("'nav-customizer'", inventory);
  assert.ok(order >= 0 && home > order && observations > home && feelings > observations && needs > feelings && inventory > needs && customizer > inventory,
    'canonical mobile order must be Menu → Home → Observations → Feelings → Needs → Inventory → Customizer');

  const critical = await fs.readFile(path.join(root, 'styles/nav-critical.css'), 'utf8');
  assert.ok(critical.includes('.site-nav__magnet--menu {'), 'Menu must have critical prepaint styling');
  assert.ok(critical.includes(".magnet-board:not([data-ready='1']) .magnet"), 'critical nav CSS must hide unpositioned magnets');

  const styles = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
  assert.ok(styles.includes('100svh - clamp(7rem, 22vw, 10rem)'), 'mobile Customizer must respect Safari safe viewport height');
});
