const INVENTORY_STORAGE_KEY = 'nvcApp.inventory';
const RETIRED_OFFLINE_CACHE_PREFIX = 'allneeds-static-';
const RETIRED_OFFLINE_WORKER_PATH = '/service-worker.js';
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
  './inventory.js?v=2026-08-21-home-canary-ready',
  loaderScript?.src || document.baseURI,
).href;

let inventoryRuntimePromise = null;
let inventoryRuntimeReady = false;

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

function finishAfterInventoryInitialization(resolve) {
  const finish = () => {
    inventoryRuntimeReady = true;
    resolve();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finish, { once: true });
  } else {
    finish();
  }
}

function ensureInventoryClassicRuntime() {
  if (inventoryRuntimeReady) {
    return Promise.resolve();
  }
  if (inventoryRuntimePromise) return inventoryRuntimePromise;

  inventoryRuntimePromise = new Promise((resolve, reject) => {
    const finish = () => finishAfterInventoryInitialization(resolve);
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

function isRetiredOfflineWorkerRegistration(registration) {
  const worker = registration?.active || registration?.waiting || registration?.installing;
  if (!worker?.scriptURL) return false;
  try {
    return new URL(worker.scriptURL).pathname === RETIRED_OFFLINE_WORKER_PATH;
  } catch (error) {
    return false;
  }
}

async function retireOfflineCacheCanary() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter(isRetiredOfflineWorkerRegistration)
          .map((registration) => registration.unregister()),
      );
    } catch (error) {
      console.warn('Unable to retire old allneeds service worker', error);
    }
  }

  if ('caches' in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(RETIRED_OFFLINE_CACHE_PREFIX))
          .map((key) => window.caches.delete(key)),
      );
    } catch (error) {
      console.warn('Unable to clear old allneeds offline cache', error);
    }
  }
}

function scheduleOfflineCacheRetirement() {
  const retire = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => retireOfflineCacheCanary(), { timeout: 1500 });
    } else {
      window.setTimeout(() => retireOfflineCacheCanary(), 0);
    }
  };

  if (document.readyState === 'complete') {
    retire();
  } else {
    window.addEventListener('load', retire, { once: true });
  }
}

syncInventoryCount();
installInventoryRuntimeIntentLoader();
scheduleOfflineCacheRetirement();
