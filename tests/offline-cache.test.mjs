import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

test('Home keeps the runtime loader but no longer registers a root-scoped cache worker', async () => {
  const [home, loader] = await Promise.all([
    read('index.html'),
    read('scripts/shell-runtime-loader.js'),
  ]);

  assert.ok(home.includes('src="scripts/shell-runtime-loader.js"'), 'Home should retain its small intent loader');
  assert.ok(!home.includes('service-worker.js'), 'service-worker cleanup must stay out of parser first load');
  assert.ok(!loader.includes('navigator.serviceWorker.register('), 'Home must not install a new service worker');
  assert.ok(loader.includes('navigator.serviceWorker.getRegistrations()'), 'Home should remove lingering canary registrations');
  assert.ok(loader.includes('registration.unregister()'), 'old root-scoped registrations should be unregistered');
  assert.ok(loader.includes("key.startsWith(RETIRED_OFFLINE_CACHE_PREFIX)"), 'old Bedrock Cache Storage entries should be removed');
});

test('retirement worker can replace an installed canary without owning fetch traffic', async () => {
  const worker = await read('service-worker.js');

  assert.doesNotThrow(() => new Function(worker), 'retirement worker source should remain valid JavaScript');
  assert.ok(worker.includes('self.skipWaiting()'), 'retirement worker should replace an installed canary immediately');
  assert.ok(worker.includes('self.registration.unregister()'), 'retirement worker should unregister itself after cleanup');
  assert.ok(worker.includes("key.startsWith(RETIRED_CACHE_PREFIX)"), 'retirement worker should delete prior Bedrock caches');
  assert.ok(!worker.includes("addEventListener('fetch'"), 'retirement worker must never intercept ordinary page or asset requests');
  assert.ok(!worker.includes('CORE_URLS'), 'retirement worker must not precache site resources');
  assert.ok(!worker.includes('cache.put('), 'retirement worker must not write a replacement static cache');
});

test('service-worker retirement is scoped to the abandoned Bedrock cache namespace', async () => {
  const [worker, loader] = await Promise.all([
    read('service-worker.js'),
    read('scripts/shell-runtime-loader.js'),
  ]);

  assert.ok(worker.includes("const RETIRED_CACHE_PREFIX = 'allneeds-static-';"));
  assert.ok(loader.includes("const RETIRED_OFFLINE_CACHE_PREFIX = 'allneeds-static-';"));
  assert.ok(loader.includes("const RETIRED_OFFLINE_WORKER_PATH = '/service-worker.js';"));
  assert.ok(!worker.includes('caches.delete(key))\n          .filter'), 'cleanup should not broaden into unrelated cache deletion');
});
