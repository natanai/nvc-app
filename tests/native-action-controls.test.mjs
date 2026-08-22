import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');

test('strategy save destinations use compact native controls without emoji-era labels', () => {
  const inventory = read('scripts/inventory.js');
  const styles = read('styles.css');

  assert.equal(inventory.includes('💾'), false, 'save controls must not use the floppy-disk emoji');
  assert.equal(inventory.includes('✓ Saved on this device'), false, 'saved state must not use a text glyph as its icon');
  assert.ok(inventory.includes("deviceButton.dataset.appIcon = 'device'"));
  assert.ok(inventory.includes("profileButton.dataset.appIcon = 'profile'"));
  assert.ok(inventory.includes("actionBar.classList.add('strategy-card__actions--save-targets')"));
  assert.ok(inventory.includes("deviceButton.textContent = 'Device'"));
  assert.ok(inventory.includes("profileButton.textContent = 'Profile'"));

  assert.ok(styles.includes('/* Compact native action controls */'));
  assert.match(styles, /\.app-action \{[\s\S]*?min-height:\s*44px;[\s\S]*?font-family:\s*-apple-system/);
  assert.match(styles, /\.strategy-card__actions--save-targets \{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.app-action:disabled,[\s\S]*?border-style:\s*solid/);
  assert.ok(styles.includes(".app-action[data-app-icon='device']"));
  assert.ok(styles.includes(".app-action[data-app-icon='profile']"));
});

test('Journal uses one compact horizontal Clear and Save action row', () => {
  const moduleSource = read('assets/js/journal/module.js');
  const inventory = read('scripts/inventory.js');
  const styles = read('styles.css');

  assert.ok(moduleSource.includes("submitLabel: 'Save'"));
  assert.ok(moduleSource.includes("clearLabel: 'Clear'"));
  assert.equal(moduleSource.includes("submit: ['inventory-button']"), false, 'Journal submit must not inherit the oversized legacy Inventory button');
  assert.equal(moduleSource.includes("clear: ['inventory-button', 'inventory-button--ghost']"), false, 'Journal clear must not inherit the oversized legacy Inventory button');
  assert.ok(moduleSource.includes("classes: ['journal-form__action-buttons', 'app-action-bar']"));
  assert.ok(moduleSource.includes("submit.dataset.appIcon = 'save'"));
  assert.ok(moduleSource.includes("clear.dataset.appIcon = 'clear'"));
  assert.ok(styles.includes('.journal-form__action-buttons'));
  assert.ok(styles.includes('justify-content: space-between'));
  assert.ok(inventory.includes("state.journalController.markSaved('Saved', 1500)"));
  assert.ok(inventory.includes("Saved. Your entry is in Journal History below. The form is ready for a new entry."));
});
