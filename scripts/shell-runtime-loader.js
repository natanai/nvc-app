const INVENTORY_STORAGE_KEY = 'nvcApp.inventory';
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
        return /\/scripts\/inventory\.js$/i.test(url.pathname);
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
