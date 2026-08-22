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

test('Journal and personal strategy density live at canonical owners across phone and desktop', () => {
  const moduleSource = read('assets/js/journal/module.js');
  const pages = read('scripts/build-pages.mjs');
  const deck = read('scripts/strategy-deck.js');
  const inventory = read('scripts/inventory.js');
  const styles = read('styles.css');
  const density = read('styles/shared-density.css');
  const readme = read('README.md');

  assert.ok(moduleSource.includes("emotion: 'Feeling'"));
  assert.ok(moduleSource.includes("needs: 'Needs'"));
  assert.ok(moduleSource.includes("tags: 'Tags'"));
  assert.ok(moduleSource.includes("classes: ['journal-meta-group']"));
  assert.equal(moduleSource.includes("'journal-meta-row--intensity'"), false, 'Journal intensity belongs to each Feeling in the Feeling popup');
  assert.ok(moduleSource.includes('data-journal-feeling-intensity'));
  assert.ok(density.includes('.journal-feeling-rating {'));
  assert.ok(moduleSource.includes("needsMode: 'catalog-multiselect'"));
  assert.ok(moduleSource.includes("tags: 'work, weekend, boundaries'"));
  assert.equal(moduleSource.includes("text: 'Selected needs'"), false, 'Journal needs must not render the prototype confirmation layer');
  assert.ok(density.includes('.journal-meta-group {'), 'canonical shared density CSS must own the finished Journal metadata group');
  assert.ok(styles.includes('.journal-label-icon'), 'Journal breadcrumb art must have deterministic dimensions');
  assert.ok(pages.includes('data-strategy-toggle'), 'View all must be compiler-authored before first paint');
  assert.equal(deck.includes("document.createElement('button')"), false, 'strategy deck runtime must not create deterministic controls');
  assert.equal(pages.includes('const strategiesNote'), false, 'built-in strategy browsing must not carry a storage reminder unrelated to browsing');
  assert.equal(inventory.includes('strategy-save-target-hint'), false, 'save-target explanatory chrome must not be injected after paint');
  assert.ok(density.includes('.journal-meta-row + .journal-meta-row'));
  assert.ok(pages.includes('journal-history-controls__filters'));
  assert.ok(pages.includes('journal-utility-disclosure'));
  assert.equal(pages.includes('data-journal-summary-toggle'), false, 'Patterns disclosure must use native details state rather than a custom runtime toggle');
  assert.match(styles, /\.strategy-card--form \{[\s\S]*?border:\s*1\.5px solid[\s\S]*?box-shadow:\s*none/);
  assert.match(styles, /\.strategy-card--form \.strategy-card--input \{[\s\S]*?border:\s*1px solid[\s\S]*?box-shadow:\s*none/);
  assert.ok(styles.includes('min-height: 4.75rem'));
  assert.ok(styles.includes('.strategy-section__header {'));
  assert.equal(styles.includes('min-height: 6.5rem'), false, 'prototype personal-strategy textarea height must not remain in the canonical CSS block');
  assert.ok(pages.includes('strategy-card strategy-card--form'), 'generated strategy forms must still originate in the page compiler');
  assert.equal(styles.includes('.inventory-journal-form__actions .inventory-button'), false);
  assert.ok(readme.includes('### Root-level UX changes'));
  assert.ok(readme.includes('Do not edit generated HTML as the source of a UI fix.'));
});
