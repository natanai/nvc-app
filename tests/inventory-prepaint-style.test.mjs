import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const contrast = readFileSync(join(root, 'assets/js/ui/contrast.js'), 'utf8');
const inventoryModule = readFileSync(join(root, 'scripts/inventory-bluesky.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  contrast.includes("if (!/\\/inventory\\/(?:index\\.html)?$/i.test(pathname))"),
  'Pre-paint bootstrap must target the Inventory page.'
);
assert(
  contrast.includes('document.write('),
  'Inventory stylesheet must be inserted synchronously during head parsing.'
);
assert(
  contrast.includes('../styles/inventory.css'),
  'Pre-paint bootstrap must reference the Inventory stylesheet.'
);
assert(
  !inventoryModule.includes('loadInventoryPageStyles'),
  'Inventory module must not inject page styles after first paint.'
);

console.log('Inventory pre-paint stylesheet checks passed.');
