import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const inventoryHtmlPath = path.join(repoRoot, 'inventory', 'index.html');
const inventoryScriptPath = path.join(repoRoot, 'scripts', 'inventory.js');

function assertContains(haystack, needle, message) {
  assert.ok(
    haystack.includes(needle),
    message || `Expected to find "${needle}" in provided content.\n---\n${haystack}\n---`
  );
}

test('inventory feed UI elements exist in markup', async () => {
  const markup = await fs.readFile(inventoryHtmlPath, 'utf8');

  assertContains(markup, 'data-backend-fetch-feed-button', 'Missing feed fetch button in inventory markup.');
  assertContains(markup, 'data-backend-feed-container', 'Missing feed container in inventory markup.');
  assertContains(markup, 'data-backend-sync-status', 'Missing backend status element in inventory markup.');
});

test('inventory feed wiring is present in script', async () => {
  const script = await fs.readFile(inventoryScriptPath, 'utf8');

  assert.match(
    script,
    /const\s+backendFetchFeedButton\s*=\s*document\.querySelector\('\[data-backend-fetch-feed-button\]'\);/,
    'Feed fetch button query selector missing from inventory script.'
  );

  assert.match(
    script,
    /document\.querySelector\('\[data-backend-feed-container\]'\)/,
    'Feed container selection missing from inventory script.'
  );

  assert.match(
    script,
    /if \s*\(backendFetchFeedButton\)\s*\{[^}]*addEventListener\(['"]click['"],\s*\(event\) => \{[^}]*fetchSocialStrategiesFeed\(\);/s,
    'Feed fetch button is not wired to trigger the feed request.'
  );
});
