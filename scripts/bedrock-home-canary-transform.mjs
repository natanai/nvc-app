import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(text, oldText, newText, label) {
  const first = text.indexOf(oldText);
  const last = text.lastIndexOf(oldText);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one match`);
  }
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
}

function updateFile(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`${path}: transform made no change`);
  writeFileSync(path, after);
}

const loader = `const INVENTORY_STORAGE_KEY = 'nvcApp.inventory';
const INVENTORY_RUNTIME_WARM_SELECTOR = [
  '[data-shell-customizer-placeholder] .palette-corner__toggle',
  '[data-palette-toggle]',
  '[data-support-journal-open]',
  '[data-menu-drill="account-data"]',
  '[data-menu-action="share-with-nat"]',
  '#inventory-export',
  '#inventory-import-trigger',
  '[data-backend-save-button]',
  '[data-backend-load-button]',
].join(',');
const INVENTORY_RUNTIME_REPLAY_SELECTOR = [
  '[data-shell-customizer-placeholder] .palette-corner__toggle',
  '[data-palette-toggle]',
  '[data-support-journal-open]',
  '[data-menu-action="share-with-nat"]',
  '#inventory-export',
  '#inventory-import-trigger',
  '[data-backend-save-button]',
  '[data-backend-load-button]',
].join(',');

const loaderScript = document.currentScript;
const inventoryRuntimeUrl = new URL(
  './inventory.js?v=2026-08-21-home-canary',
  loaderScript?.src || document.baseURI,
).href;

let inventoryRuntimePromise = null;
let inventoryRuntimeReady = typeof window.handleExportInventory === 'function';

function readInventoryCount() {
  try {
    const raw = window.localStorage?.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (error) {
    return 0;
  }
}

function syncInventoryCount() {
  const counter = document.querySelector('[data-inventory-count]');
  if (!(counter instanceof HTMLElement)) return;
  const total = readInventoryCount();
  if (!total) {
    counter.textContent = '';
    counter.hidden = true;
    return;
  }
  counter.textContent = String(total);
  counter.hidden = false;
}

function ensureInventoryClassicRuntime() {
  if (inventoryRuntimeReady || typeof window.handleExportInventory === 'function') {
    inventoryRuntimeReady = true;
    return Promise.resolve();
  }
  if (inventoryRuntimePromise) return inventoryRuntimePromise;

  inventoryRuntimePromise = new Promise((resolve, reject) => {
    const finish = () => {
      inventoryRuntimeReady = true;
      resolve();
    };
    const fail = () => {
      inventoryRuntimePromise = null;
      reject(new Error('Unable to load shared Inventory runtime'));
    };

    const existing = Array.from(document.scripts).find((script) => {
      if (!script.src) return false;
      try {
        const url = new URL(script.src, window.location.href);
        return /\\/scripts\\/inventory\\.js$/i.test(url.pathname);
      } catch (error) {
        return false;
      }
    });

    if (existing) {
      if (typeof window.handleExportInventory === 'function') {
        finish();
        return;
      }
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = inventoryRuntimeUrl;
    script.async = true;
    script.dataset.shellInventoryRuntime = 'true';
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });
    document.body.appendChild(script);
  });

  return inventoryRuntimePromise;
}

function closestRuntimeTrigger(target, selector) {
  return target instanceof Element ? target.closest(selector) : null;
}

function warmInventoryRuntime(event) {
  if (inventoryRuntimeReady) return;
  if (closestRuntimeTrigger(event.target, INVENTORY_RUNTIME_WARM_SELECTOR)) {
    ensureInventoryClassicRuntime().catch(() => {});
  }
}

function installInventoryRuntimeIntentLoader() {
  document.addEventListener('pointerover', warmInventoryRuntime, { capture: true, passive: true });
  document.addEventListener('pointerdown', warmInventoryRuntime, { capture: true, passive: true });
  document.addEventListener('focusin', warmInventoryRuntime, { capture: true });

  document.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || inventoryRuntimeReady) return;

    const warmTrigger = target.closest(INVENTORY_RUNTIME_WARM_SELECTOR);
    if (!warmTrigger) return;

    const runtime = ensureInventoryClassicRuntime();
    const replayTrigger = target.closest(INVENTORY_RUNTIME_REPLAY_SELECTOR);
    if (!replayTrigger) {
      runtime.catch(() => {});
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      await runtime;
      window.requestAnimationFrame(() => replayTrigger.click());
    } catch (error) {
      console.error('Unable to prepare shared allneeds controls', error);
    }
  }, true);
}

syncInventoryCount();
installInventoryRuntimeIntentLoader();
`;

const canaryTest = `import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

test('Home preserves first-paint shell while leaving Inventory runtime off first load', async () => {
  const [home, need, inventory] = await Promise.all([
    read('index.html'), read('needs/acceptance/index.html'), read('inventory/index.html'),
  ]);
  assert.ok(home.includes('data-shell-customizer-placeholder'));
  assert.ok(home.includes('class="palette-corner__toggle"'));
  assert.ok(home.includes('<span class="palette-corner__glyph">+</span>'));
  assert.ok(home.includes('<span class="visually-hidden">Open customizer</span>'));
  assert.ok(home.includes('<script src="scripts/shell-runtime-loader.js" defer></script>'));
  assert.ok(!home.includes('<script src="scripts/inventory.js" defer></script>'));
  assert.ok(home.indexOf('scripts/shell-runtime-loader.js') < home.indexOf('scripts/inventory-core-shell.js'));
  assert.ok(need.includes('../../scripts/inventory.js'));
  assert.ok(inventory.includes('../scripts/inventory.js'));
});

test('Home loader preserves count and capture/replay readiness for shell-owned actions', async () => {
  const source = await read('scripts/shell-runtime-loader.js');
  assert.ok(source.includes("const INVENTORY_STORAGE_KEY = 'nvcApp.inventory';"));
  assert.ok(source.includes('return Array.isArray(parsed) ? parsed.length : 0;'));
  for (const selector of [
    '[data-palette-toggle]', '[data-support-journal-open]', '[data-menu-drill="account-data"]',
    '[data-menu-action="share-with-nat"]', '#inventory-export', '#inventory-import-trigger',
    '[data-backend-save-button]', '[data-backend-load-button]',
  ]) assert.ok(source.includes(selector), selector);
  assert.ok(source.includes("document.addEventListener('pointerdown', warmInventoryRuntime"));
  assert.ok(source.includes('event.stopImmediatePropagation();'));
  assert.ok(source.includes('window.requestAnimationFrame(() => replayTrigger.click());'));
});

test('Customizer adopts the static Home control instead of replacing it', async () => {
  const controller = await read('scripts/inventory.js');
  assert.ok(controller.includes("document.querySelector('[data-shell-customizer-placeholder]')"));
  assert.ok(controller.includes("staticContainer?.querySelector('.palette-corner__toggle')"));
  assert.ok(controller.includes("container.removeAttribute('data-shell-customizer-placeholder');"));
  assert.ok(controller.includes('staticToggle instanceof HTMLButtonElement ? staticToggle : document.createElement'));
  assert.ok(controller.includes('if (!container.isConnected) {\\n    document.body.appendChild(container);\\n  }'));
});

test('generator explicitly owns the Home canary', async () => {
  const generator = await read('scripts/build-pages.mjs');
  assert.ok(generator.includes('function normalizeScripts(scripts, options = {})'));
  assert.ok(generator.includes('const includeInventoryRuntime = options.includeInventoryRuntime !== false;'));
  assert.ok(generator.includes("...(includeInventoryRuntime ? [{ src: 'scripts/inventory.js', defer: true }] : [])"));
  assert.ok(generator.includes("bodyExtras = '',"));
  assert.ok(generator.includes('includeInventoryRuntime = true,'));
  assert.ok(generator.includes("scripts: [{ src: 'scripts/shell-runtime-loader.js', defer: true, beforeBase: true }],"));
  assert.ok(generator.includes('bodyExtras: customizerShellPlaceholderHtml,'));
  assert.ok(generator.includes('includeInventoryRuntime: false,'));
});
`;

writeFileSync('scripts/shell-runtime-loader.js', loader);
writeFileSync('tests/home-runtime-canary.test.mjs', canaryTest);

updateFile('scripts/build-pages.mjs', (source) => {
  source = replaceOnce(
    source,
    'function normalizeScripts(scripts) {',
    "function normalizeScripts(scripts, options = {}) {\n  const includeInventoryRuntime = options.includeInventoryRuntime !== false;",
    'normalizeScripts signature',
  );

  const start = source.indexOf('function normalizeScripts(scripts, options = {})');
  const end = source.indexOf('\nfunction htmlPage(', start);
  if (start < 0 || end <= start) throw new Error('normalizeScripts block not found');
  let block = source.slice(start, end);
  block = replaceOnce(
    block,
    "    { src: 'scripts/inventory.js', defer: true },",
    "    ...(includeInventoryRuntime ? [{ src: 'scripts/inventory.js', defer: true }] : []),",
    'normalizeScripts Inventory entry',
  );
  source = source.slice(0, start) + block + source.slice(end);

  const placeholder = `const customizerShellPlaceholderHtml = \`    <div class="palette-corner" data-shell-customizer-placeholder>\n      <button type="button" class="palette-corner__toggle" aria-haspopup="dialog" aria-expanded="false">\n        <span class="palette-corner__glyph">+</span>\n        <span class="visually-hidden">Open customizer</span>\n      </button>\n    </div>\`;\n\n`;
  source = replaceOnce(
    source,
    'function normalizeScripts(scripts, options = {}) {',
    placeholder + 'function normalizeScripts(scripts, options = {}) {',
    'static Customizer shell insertion',
  );
  source = replaceOnce(
    source,
    "  socialAlt = 'Three colorful doorways symbolizing allneeds.app',\n  headExtras = '',\n}) {",
    "  socialAlt = 'Three colorful doorways symbolizing allneeds.app',\n  headExtras = '',\n  bodyExtras = '',\n  includeInventoryRuntime = true,\n}) {",
    'htmlPage options',
  );
  source = replaceOnce(source, '  const scriptEntries = normalizeScripts(scripts);', '  const scriptEntries = normalizeScripts(scripts, { includeInventoryRuntime });', 'script entries call');
  source = replaceOnce(source, "  const extraHead = headExtras ? `\\n${headExtras}` : '';", "  const extraHead = headExtras ? `\\n${headExtras}` : '';\n  const extraBody = bodyExtras ? `${bodyExtras}\\n` : '';", 'body extras serialization');
  source = replaceOnce(source, "    </div>\n${scriptsHtml ? `${scriptsHtml}\\n` : ''}  </body>", "    </div>\n${extraBody}${scriptsHtml ? `${scriptsHtml}\\n` : ''}  </body>", 'body extras output');
  source = replaceOnce(
    source,
    "    main,\n    activeNav: 'home',\n    canonicalPath: '/',",
    "    main,\n    scripts: [{ src: 'scripts/shell-runtime-loader.js', defer: true, beforeBase: true }],\n    activeNav: 'home',\n    canonicalPath: '/',\n    bodyExtras: customizerShellPlaceholderHtml,\n    includeInventoryRuntime: false,",
    'Home page runtime ownership',
  );
  return source;
});

updateFile('scripts/inventory.js', (source) => {
  const oldBlock = `function buildPaletteUi() {
  const container = document.createElement('div');
  container.className = 'palette-corner';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'palette-corner__toggle';
  toggle.setAttribute('aria-haspopup', 'dialog');

  const glyph = document.createElement('span');
  glyph.className = 'palette-corner__glyph';
  glyph.textContent = '+';
  toggle.appendChild(glyph);

  const srLabel = document.createElement('span');
  srLabel.className = 'visually-hidden';
  srLabel.textContent = 'Open customizer';
  toggle.appendChild(srLabel);

  const nav = document.querySelector('.site-nav');`;
  const newBlock = `function buildPaletteUi() {
  const staticContainer = document.querySelector('[data-shell-customizer-placeholder]');
  const staticToggle = staticContainer?.querySelector('.palette-corner__toggle');
  const container =
    staticContainer instanceof HTMLElement ? staticContainer : document.createElement('div');
  container.className = 'palette-corner';
  container.removeAttribute('data-shell-customizer-placeholder');

  const toggle =
    staticToggle instanceof HTMLButtonElement ? staticToggle : document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'palette-corner__toggle';
  toggle.setAttribute('aria-haspopup', 'dialog');

  if (!(staticToggle instanceof HTMLButtonElement)) {
    const glyph = document.createElement('span');
    glyph.className = 'palette-corner__glyph';
    glyph.textContent = '+';
    toggle.appendChild(glyph);

    const srLabel = document.createElement('span');
    srLabel.className = 'visually-hidden';
    srLabel.textContent = 'Open customizer';
    toggle.appendChild(srLabel);
  }

  const nav = document.querySelector('.site-nav');`;
  source = replaceOnce(source, oldBlock, newBlock, 'Customizer static-shell adoption');
  source = replaceOnce(source, "  container.append(toggle, panel);\n  document.body.appendChild(container);", "  container.append(toggle, panel);\n  if (!container.isConnected) {\n    document.body.appendChild(container);\n  }", 'Customizer connected-container guard');
  return source;
});

updateFile('tests/journal-load-graph.test.mjs', (source) => replaceOnce(
  source,
  "  const baseScriptsStart = buildPages.indexOf('function normalizeScripts(scripts)');",
  "  const baseScriptsStart = buildPages.indexOf('function normalizeScripts(');",
  'Journal normalizeScripts locator',
));

updateFile('tests/shared-nav-menu.test.mjs', (source) => {
  const oldBlock = `  const inventoryScript = home.indexOf('<script src="scripts/inventory.js" defer></script>');
  const menuScript = home.indexOf('<script defer src="scripts/inventory-core-shell.js"></script>');
  assert.ok(inventoryScript >= 0 && menuScript > inventoryScript,
    'classic inventory implementation must load before the Menu controller that binds its global actions');`;
  const newBlock = `  const inventoryScript = home.indexOf('<script src="scripts/inventory.js" defer></script>');
  const loaderScript = home.indexOf('<script src="scripts/shell-runtime-loader.js" defer></script>');
  const menuScript = home.indexOf('<script defer src="scripts/inventory-core-shell.js"></script>');
  const eagerRuntimeIsReady = inventoryScript >= 0 && menuScript > inventoryScript;
  const lazyRuntimeIsGuarded = loaderScript >= 0 && menuScript > loaderScript;
  assert.ok(eagerRuntimeIsReady || lazyRuntimeIsGuarded,
    'Menu actions require either the eager Inventory runtime or a pre-Menu intent loader');
  if (lazyRuntimeIsGuarded) {
    const loader = await fs.readFile(path.join(root, 'scripts/shell-runtime-loader.js'), 'utf8');
    assert.ok(loader.includes("'[data-menu-drill=\\"account-data\\"]'"), 'Account drill should warm the canonical runtime');
    assert.ok(loader.includes("'#inventory-export'"), 'backup action should be capture-guarded');
    assert.ok(loader.includes("'#inventory-import-trigger'"), 'restore action should be capture-guarded');
    assert.ok(loader.includes("'[data-backend-save-button]'"), 'profile save should be capture-guarded');
    assert.ok(loader.includes("'[data-backend-load-button]'"), 'profile load should be capture-guarded');
    assert.ok(loader.includes('event.stopImmediatePropagation();'), 'lazy actions must not reach Menu handlers before canonical runtime readiness');
    assert.ok(loader.includes('window.requestAnimationFrame(() => replayTrigger.click());'), 'held actions must replay after canonical runtime readiness');
  }`;
  return replaceOnce(source, oldBlock, newBlock, 'Menu eager-or-lazy readiness contract');
});

updateFile('package.json', (source) => replaceOnce(
  source,
  '"test:flicker-jitter": "node --test tests/navigation-highlight.test.mjs tests/runtime-load-graph.test.mjs tests/shared-nav-menu.test.mjs tests/shared-density-polish.test.mjs tests/journal-load-graph.test.mjs"',
  '"test:flicker-jitter": "node --test tests/navigation-highlight.test.mjs tests/runtime-load-graph.test.mjs tests/shared-nav-menu.test.mjs tests/shared-density-polish.test.mjs tests/journal-load-graph.test.mjs tests/home-runtime-canary.test.mjs"',
  'CI canary test registration',
));

console.log('Home canary source transform completed.');
