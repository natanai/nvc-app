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
      violations.push(`${relative}: missing normal Menu controller script`);
    }
    if (!html.includes('hasMissingVisiblePlacement')) {
      violations.push(`${relative}: nav prefill can reveal a board with an unplaced visible magnet`);
    }
  }

  assert.deepEqual(violations, []);

  const contrast = await fs.readFile(path.join(root, 'assets/js/ui/contrast.js'), 'utf8');
  assert.ok(!contrast.includes('loadSharedMoreNavigationBeforeMagnets'), 'Menu must not be parser-injected from contrast.js');
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

test('Menu information architecture separates destinations, actions, personal connection, and drill-in settings', async () => {
  const controller = await fs.readFile(path.join(root, 'scripts/inventory-core-shell.js'), 'utf8');

  assert.ok(controller.includes('>Explore<'), 'Menu should expose an Explore group');
  assert.ok(controller.includes('>Your practice<'), 'Menu should expose a Your practice group');
  assert.ok(controller.includes('>Discover<'), 'Menu should expose a Discover group');
  assert.ok(controller.includes('Account &amp; data'), 'Menu should expose Account & data');
  assert.ok(controller.includes('data-menu-drill="${MENU_ACCOUNT_VIEW}"'), 'Account & data should be a drill-in control');
  assert.ok(controller.includes('inventory-more-menu__disclosure'), 'drill-in control should carry the disclosure affordance');
  assert.ok(controller.includes('Customize…'), 'Customizer should read as an action that opens another interface');
  assert.ok(!controller.includes('Explore what is present now, or return to the practices you build over time.'), 'Menu root should not explain itself with unnecessary helper copy');

  const discoverIndex = controller.indexOf('id="nav-more-discover-heading"');
  const settingsIndex = controller.indexOf('id="nav-more-settings-heading"');
  const personalIndex = controller.indexOf('id="nav-more-personal-heading"');
  assert.ok(discoverIndex >= 0 && settingsIndex > discoverIndex && personalIndex > settingsIndex,
    'personal sharing should live after app navigation/settings rather than inside Discover');
  assert.ok(controller.includes('data-menu-personal-section hidden'), 'personal section should stay absent unless the Inventory share action is available');
  assert.ok(controller.includes('>From Nat<'), 'personal sharing should retain its intentionally personal framing');

  assert.ok(!controller.includes('goToInventoryCommand'), 'Menu must not navigate to Inventory and then issue a remote command');
  assert.ok(!controller.includes('openInventoryPanel'), 'Menu must not manipulate an Inventory panel after navigation');
  assert.ok(!controller.includes('scrollIntoView'), 'global Menu must not rely on brittle cross-page scroll targets');
  assert.ok(!controller.includes('NAV_LAYOUT_KEY'), 'Menu controller must not own or reset saved magnet positions');
  assert.ok(!controller.includes('migrateSharedNav'), 'obsolete navigation migration logic should not remain in the controller');
});

test('Account & data reuses existing allneeds capabilities instead of duplicating them', async () => {
  const controller = await fs.readFile(path.join(root, 'scripts/inventory-core-shell.js'), 'utf8');
  const inventory = await fs.readFile(path.join(root, 'scripts/inventory.js'), 'utf8');
  const bluesky = await fs.readFile(path.join(root, 'scripts/inventory-bluesky.js'), 'utf8');

  assert.ok(controller.includes('id="inventory-export"'), 'Menu should expose the existing backup trigger ID');
  assert.ok(controller.includes('id="inventory-import-trigger"'), 'Menu should expose the existing restore trigger ID');
  assert.ok(controller.includes('id="inventory-import"'), 'Menu should expose the existing restore file input ID');
  assert.ok(controller.includes('data-backend-save-button'), 'Menu should expose the existing backend save contract');
  assert.ok(controller.includes('data-backend-load-button'), 'Menu should expose the existing backend load contract');
  assert.ok(controller.includes('id="bluesky-auth-button"'), 'Menu should expose the existing Bluesky auth contract');

  assert.ok(inventory.includes("document.getElementById('inventory-export')"), 'existing inventory controller should remain the backup implementation');
  assert.ok(inventory.includes("document.getElementById('inventory-import-trigger')"), 'existing inventory controller should remain the restore implementation');
  assert.ok(inventory.includes("document.querySelectorAll('[data-support-journal-open]')"), 'existing journal trigger architecture should remain reusable');

  assert.ok(bluesky.includes("document.readyState === 'loading'"), 'Bluesky module should initialize both before and after DOMContentLoaded');
  assert.ok(bluesky.includes('let initialized = false'), 'Bluesky module should guard duplicate initialization');
});

test('Account & data uses compact menu-native labels and explicit data direction', async () => {
  const controller = await fs.readFile(path.join(root, 'scripts/inventory-core-shell.js'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/inventory-core-shell.css'), 'utf8');

  assert.ok(controller.includes('Save this browser'), 'profile save should state which side of the sync is being saved');
  assert.ok(controller.includes('Load saved profile'), 'profile load should state what is being loaded');
  assert.ok(controller.includes('Download backup'), 'backup should use a concise file-oriented label');
  assert.ok(controller.includes('Restore backup'), 'restore should use a concise paired label');
  assert.ok(controller.includes('Loading replaces this browser’s current allneeds data.'), 'profile load should state its replacement behavior');
  assert.ok(controller.includes('Restoring replaces this browser’s current allneeds data.'), 'backup restore should state its replacement behavior');
  assert.ok(!controller.includes('Back Up Allneeds Data…'), 'legacy full-page backup label should not remain in the Menu');
  assert.ok(css.includes('.inventory-more-menu__action-pair'), 'paired data actions should have a menu-native layout');
  assert.ok(css.includes('.inventory-more-menu__account-action'), 'Account & data should use menu-native action styling');
});

test('Account & data actions are bound by the global Menu controller, not Inventory page presence', async () => {
  const controller = await fs.readFile(path.join(root, 'scripts/inventory-core-shell.js'), 'utf8');
  const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');

  assert.ok(controller.includes('function setupAccountDataControls(menu)'), 'Menu should own a global Account & data initializer');
  assert.ok(controller.includes('setupAccountDataControls(menu);'), 'global Menu initialization must bind Account & data on every page');
  assert.ok(controller.includes("invokeInventoryControl('handleExportInventory')"), 'backup should call the canonical inventory export implementation');
  assert.ok(controller.includes("invokeInventoryControl('handleImportInventory', file)"), 'restore should call the canonical inventory import implementation');
  assert.ok(controller.includes("invokeInventoryControl('saveSnapshotToBackend')"), 'profile save should call the canonical backend snapshot implementation');
  assert.ok(controller.includes("invokeInventoryControl('loadSnapshotFromBackend')"), 'profile load should call the canonical backend snapshot implementation');
  assert.ok(controller.includes('event.stopImmediatePropagation();'), 'Menu-owned controls should prevent legacy Inventory-only listeners from double-firing');

  const inventoryScript = home.indexOf('<script src="scripts/inventory.js" defer></script>');
  const menuScript = home.indexOf('<script defer src="scripts/inventory-core-shell.js"></script>');
  assert.ok(inventoryScript >= 0 && menuScript > inventoryScript,
    'classic inventory implementation must load before the Menu controller that binds its global actions');
  assert.ok(!home.includes('id="inventory-list"'), 'regression fixture should be a non-Inventory page');
});

test('Inventory keeps system management out of its primary workspace', async () => {
  const controller = await fs.readFile(path.join(root, 'scripts/inventory-core-shell.js'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/inventory-core-shell.css'), 'utf8');

  assert.ok(controller.includes("document.querySelector('.inventory-bluesky-panel')?.remove()"), 'old Bluesky panel should leave the Inventory workspace');
  assert.ok(controller.includes("document.querySelector('.inventory-main > .inventory-actions')?.remove()"), 'old backup/import section should leave the Inventory workspace');
  assert.ok(controller.includes("document.querySelector('.inventory-header .inventory-shared-button')?.remove()"), 'Shared strategies should not compete with Inventory in its header');

  assert.ok(css.includes('.inventory-page .inventory-main > .inventory-actions'), 'system controls should be hidden before JS to prevent flash');
  assert.ok(css.includes('inset: auto 0 0 0;'), 'mobile Menu should present as a lightweight bottom sheet');
});

test('Menu activation remains reliable when magnet physics suppresses synthetic clicks', async () => {
  const controller = await fs.readFile(path.join(root, 'scripts/inventory-core-shell.js'), 'utf8');
  assert.ok(controller.includes("menuMagnet.addEventListener('pointerup'"), 'Menu should respond to a deliberate pointer release');
  assert.ok(controller.includes('TAP_MOVE_THRESHOLD'), 'Menu should distinguish a tap from a drag');
  assert.ok(controller.includes("menuMagnet.addEventListener('keydown'"), 'Menu should retain keyboard activation independent of click suppression');
});

test('strategy feed participates in the shared UI architecture and mobile app surface', async () => {
  const feed = await fs.readFile(path.join(root, 'scripts/strategy-feed.js'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/inventory-core-shell.css'), 'utf8');

  assert.ok(feed.startsWith("import './inventory.js"), 'Feed should initialize the existing shared Customizer, Journal, and data controller instead of duplicating handlers');
  assert.ok(feed.includes('Menu → Account & data'), 'Feed sign-in guidance should point to the current Account & data location');
  assert.ok(!feed.includes('sign in with Bluesky on the Inventory page'), 'Feed should not send account management back to Inventory');
  assert.ok(css.includes('body:has(#main [data-feed-list]) #main.page'), 'Feed should use the same full-bleed mobile app-surface direction as Inventory');
});
