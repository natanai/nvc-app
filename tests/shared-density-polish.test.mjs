import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('shared polish assets load from the common prepaint bootstrap', async () => {
  const contrast = await fs.readFile(path.join(root, 'assets/js/ui/contrast.js'), 'utf8');
  assert.ok(contrast.includes('styles/shared-density.css'));
  assert.ok(contrast.includes('scripts/shared-ui-polish.js'));
  assert.ok(contrast.includes('loadSharedPolishAssets();'));
});

test('strategy creation copy is current and emoji action labels are normalized', async () => {
  const polish = await fs.readFile(path.join(root, 'scripts/shared-ui-polish.js'), 'utf8');
  assert.ok(polish.includes('Backup, restore, and account sync are in Menu → Account & data.'));
  assert.ok(polish.includes("button.textContent = 'Save to device'"));
  assert.ok(polish.includes("button.textContent = 'Save to profile'"));
});

test('mobile journal chrome and entry copy are compact', async () => {
  const css = await fs.readFile(path.join(root, 'styles/shared-density.css'), 'utf8');
  const polish = await fs.readFile(path.join(root, 'scripts/shared-ui-polish.js'), 'utf8');

  assert.ok(css.includes('body .support-journal__header'));
  assert.ok(css.includes('max(0.48rem, env(safe-area-inset-top))'));
  assert.ok(css.includes('body .support-journal__content .journal-form'));
  assert.ok(css.includes('min-height: clamp(15rem, 52dvh, 28rem)'));
  assert.ok(polish.includes("heading.textContent = 'New entry'"));
  assert.ok(polish.includes('Tag what’s present now. Feeling optional—notes are enough.'));
});

test('shared strategies is feed-first rather than pull-button driven', async () => {
  const feed = await fs.readFile(path.join(root, 'scripts/strategy-feed.js'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/shared-density.css'), 'utf8');

  assert.ok(feed.includes("title.textContent = 'Shared strategies'"));
  assert.ok(feed.includes("addButton.textContent = 'Save to inventory'"));
  assert.ok(feed.includes("await fetchAndRenderFeed();"));
  assert.ok(feed.includes("state.scopeSelect?.addEventListener('change'"));
  assert.ok(feed.includes("state.sortSelect?.addEventListener('change', fetchAndRenderFeed)"));
  assert.ok(feed.includes('[data-feed-follows-check]'));
  assert.ok(feed.includes('[data-feed-fetch]'));
  assert.ok(css.includes('.feed-controls__icon-button'));
  assert.ok(css.includes('.feed-controls__button'));
  assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
});
