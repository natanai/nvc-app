import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

function extractCoreUrls(source) {
  const block = source.match(/const CORE_URLS = \[([\s\S]*?)\];/);
  assert.ok(block, 'service worker should declare an explicit core cache');
  return Array.from(block[1].matchAll(/['"]([^'"]+)['"]/g), (match) => match[1]);
}

test('Home owns the Bedrock service-worker canary without adding it to parser first load', async () => {
  const [home, loader] = await Promise.all([
    read('index.html'),
    read('scripts/shell-runtime-loader.js'),
  ]);

  assert.ok(home.includes('src="scripts/shell-runtime-loader.js"'), 'Home should retain its existing small intent loader');
  assert.ok(!home.includes('service-worker.js'), 'service worker registration must stay out of generated HTML/parser first load');
  assert.ok(loader.includes("'../service-worker.js'"), 'Home loader should resolve the root service worker from its own URL');
  assert.ok(loader.includes("window.addEventListener('load', register, { once: true })"), 'registration should wait until normal page load finishes');
  assert.ok(loader.includes("window.requestIdleCallback(registerOfflineCacheCanary, { timeout: 2500 })"), 'capable browsers should schedule registration in idle time');
  assert.ok(loader.includes("updateViaCache: 'none'"), 'service-worker update checks should not be hidden behind HTTP cache reuse');
});

test('offline worker caches only safe same-origin GET traffic', async () => {
  const worker = await read('service-worker.js');

  assert.doesNotThrow(() => new Function(worker), 'service worker source should remain valid JavaScript');
  assert.ok(worker.includes("request.method !== 'GET'"), 'mutating requests must bypass Cache Storage');
  assert.ok(worker.includes('url.origin !== self.location.origin'), 'cross-origin requests must bypass this cache owner');
  assert.ok(worker.includes("url.pathname.startsWith('/api/')"), 'same-origin API traffic must bypass static caching');
  assert.ok(worker.includes("request.headers.get('authorization')"), 'authorized requests must bypass static caching');
  assert.ok(worker.includes("response.ok && response.type === 'basic'"), 'only successful same-origin basic responses should be stored');
  assert.ok(!worker.includes("request.mode === 'navigate'"), 'canary must not substitute Home HTML for uncached deep routes');
});

test('core offline cache paths are real browser-facing files', async () => {
  const worker = await read('service-worker.js');
  const coreUrls = extractCoreUrls(worker);

  assert.ok(coreUrls.includes('/'), 'Home must be part of the core cache');
  assert.ok(coreUrls.includes('/styles.css'), 'global presentation must be part of the core cache');
  assert.ok(coreUrls.includes('/scripts/inventory-core-shell.js'), 'global menu shell must be part of the core cache');
  assert.ok(coreUrls.includes('/scripts/magnets.js'), 'magnet behavior must be available from the core cache');
  assert.ok(coreUrls.includes('/data/index.json'), 'canonical route vocabulary should be available for the later full-site warmer');

  for (const urlPath of coreUrls) {
    const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
    const stat = await fs.stat(path.join(root, relativePath));
    assert.ok(stat.isFile(), `core cache entry should resolve to a committed file: ${urlPath}`);
  }
});

test('offline cache remains a canary rather than pretending dynamic services are offline', async () => {
  const worker = await read('service-worker.js');
  const forbidden = [
    'bsky.social',
    'public.api.bsky.app',
    'allneeds-api',
    'cloudflare-backend',
  ];

  for (const marker of forbidden) {
    assert.ok(!worker.includes(marker), `service worker should not own dynamic service traffic: ${marker}`);
  }

  assert.ok(worker.includes('full-site background warming is a later layer'), 'canary scope should be explicit in source until browser/device acceptance');
});
