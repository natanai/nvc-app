import { readFileSync, writeFileSync } from 'fs';

const path = new URL('./build-pages.mjs', import.meta.url);
let source = readFileSync(path, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function replaceOnce(input, search, replacement, label) {
  const first = input.indexOf(search);
  assert(first !== -1, `Missing ${label}`);
  assert(input.indexOf(search, first + search.length) === -1, `Expected one ${label}`);
  return input.slice(0, first) + replacement + input.slice(first + search.length);
}

// 1) Keep the legacy magnet renderer intact, but use a dedicated shell only on
// the root Inventory workspace. Other routes remain unchanged in this first slice.
const observationImport = "import { updateObservationGuidePage } from './observation-guide.mjs';";
source = replaceOnce(
  source,
  observationImport,
  `${observationImport}\nimport { renderInventoryAppShell } from './render-inventory-app-shell.mjs';`,
  'observation guide import'
);

source = replaceOnce(
  source,
  '  const navHtml = renderNav(basePath, activeNav, navOptions);',
  "  const navHtml = canonicalPathNormalized === '/inventory/'\n    ? renderInventoryAppShell(basePath)\n    : renderNav(basePath, activeNav, navOptions);",
  'nav renderer selection'
);

// 2) Inventory is the workspace. Journal, community discovery, sync, and backup
// remain available, but stop competing in the first viewport.
source = replaceOnce(
  source,
  '<h1 class="page-title">Strategy inventory</h1>',
  '<h1 class="page-title">My inventory</h1>',
  'Inventory page title'
);

const journalButtonPattern = /\n\s*<a class="inventory-journal-button" href="\.\/journal\/">[\s\S]*?<\/a>/;
assert(journalButtonPattern.test(source), 'Missing Inventory header Journal button');
source = source.replace(journalButtonPattern, '');

const sharedButtonPattern = /\n\s*<a class="inventory-shared-button" href="\.\.\/feed\/">[\s\S]*?<\/a>/;
assert(sharedButtonPattern.test(source), 'Missing Inventory header Shared Strategies button');
source = source.replace(sharedButtonPattern, '');

source = replaceOnce(
  source,
  "'Use the export tools above whenever you would like a backup.'",
  "'Use Backup & restore whenever you would like a backup.'",
  'Inventory backup notice'
);

// 3) Move Bluesky sync out of the header and into the lower settings/utility
// area. The details content and all of its existing hooks are preserved verbatim.
const blueskyPattern = /\n\s*<details class="inventory-bluesky-panel">[\s\S]*?\n\s*<\/details>/;
const blueskyMatch = source.match(blueskyPattern);
assert(blueskyMatch, 'Missing Inventory Bluesky panel');
let blueskyBlock = blueskyMatch[0];
source = source.replace(blueskyPattern, '');
blueskyBlock = blueskyBlock.replace(
  '<details class="inventory-bluesky-panel">',
  '<details id="inventory-sync-settings" class="inventory-bluesky-panel inventory-settings-panel">'
);

source = replaceOnce(
  source,
  '<details class="inventory-actions inventory-actions--collapsible">',
  '<details id="inventory-backup-settings" class="inventory-actions inventory-actions--collapsible">',
  'Backup & restore details'
);

const inventoryMainTail = `          \${personalStrategyForm}\n          </div>\n        </details>\n      </section>\n    \`;`;
assert(source.includes(inventoryMainTail), 'Missing Inventory main tail');
source = source.replace(
  inventoryMainTail,
  `          \${personalStrategyForm}\n          </div>\n        </details>\n\n${blueskyBlock}\n      </section>\n    \`;`
);

// 4) Load the prototype shell stylesheet from the generated Inventory head so
// the shell is styled before first paint. Keep the existing sync styles too.
source = replaceOnce(
  source,
  '    headExtras: blueskyPanelStyles,',
  '    headExtras: `${blueskyPanelStyles}\\n    <link rel="stylesheet" href="../styles/inventory-core-shell.css" />`,',
  'Inventory headExtras'
);

// Structural safety checks before writing anything.
assert(source.includes("canonicalPathNormalized === '/inventory/'"), 'Inventory shell route guard missing');
assert(source.includes('renderInventoryAppShell(basePath)'), 'Inventory shell call missing');
assert(source.includes('id="inventory-sync-settings"'), 'Sync settings anchor missing');
assert(source.includes('id="inventory-backup-settings"'), 'Backup settings anchor missing');
assert(!source.includes('<a class="inventory-journal-button" href="./journal/">'), 'Old Inventory Journal header action remains');
assert(!source.includes('<a class="inventory-shared-button" href="../feed/">'), 'Old Inventory Shared header action remains');

writeFileSync(path, source);
console.log('Inventory core shell integration applied to build-pages.mjs');
