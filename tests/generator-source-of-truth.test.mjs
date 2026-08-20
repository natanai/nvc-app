import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function text(rel) {
  return fs.readFile(path.join(root, rel), 'utf8');
}

test('build-pages is the single source of truth for generated UI', async () => {
  const packageJson = JSON.parse(await text('package.json'));
  const builder = await text('scripts/build-pages.mjs');

  assert.equal(packageJson.scripts['build:pages'], 'node scripts/build-pages.mjs');
  await assert.rejects(fs.access(path.join(root, 'scripts/finalize-static-assets.mjs')), { code: 'ENOENT' });
  assert.ok(builder.includes("submitLabel: 'Save to device'"));
  assert.ok(!builder.includes('💾 Save to device'));
  assert.ok(builder.includes('Backup, restore, and account sync are in Menu → Account &amp; data.'));
  assert.ok(!builder.includes('Personal strategies you add stay on this browser.'));
  assert.ok(builder.includes('<h2 id=\"journal-form-heading\" class=\"section-title\">New entry</h2>'));
  assert.ok(builder.includes('Tag what’s present now. Feeling optional—notes are enough.'));
});

test('generated directory resets preserve standalone static features', async () => {
  const builder = await text('scripts/build-pages.mjs');
  assert.ok(builder.includes('PRESERVED_STATIC_ENTRIES_BY_DIRECTORY'));
  assert.ok(builder.includes("['feelings', new Set(['emotions-wheel'])]"));
  assert.ok(builder.includes('resetGeneratedDirectory(dir)'));
  assert.ok(!builder.includes("for (const dir of directoriesToReset) {\n  rmSync(join(rootDir, dir), { recursive: true, force: true });\n}"));
  await fs.access(path.join(root, 'feelings/emotions-wheel/index.html'));
});

test('checked-in generated artifacts match the generator contract', async () => {
  const needHtml = await text('needs/acceptance/index.html');
  const inventoryHtml = await text('inventory/index.html');
  const journalHtml = await text('inventory/journal/index.html');
  const feedHtml = await text('feed/index.html');

  assert.ok(needHtml.includes('>Save to device</button>'));
  assert.ok(!needHtml.includes('💾 Save to device'));
  assert.ok(inventoryHtml.includes('Backup, restore, and account sync are in Menu → Account &amp; data.'));
  assert.ok(journalHtml.includes('>New entry</h2>'));
  assert.ok(journalHtml.includes('Tag what’s present now. Feeling optional—notes are enough.'));
  assert.ok(feedHtml.includes('<h1 class=\"page-title\">Shared strategies</h1>'));
  assert.ok(!feedHtml.includes('Pull strategies'));
});
