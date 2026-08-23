import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');

test('deterministic styles are parser-discovered rather than injected by browser JavaScript', () => {
  const inference = read('scripts/feeling-reverse-inference.js');
  const pages = read('scripts/build-pages.mjs');
  const feeling = read('feelings/afraid/index.html');

  assert.equal(inference.includes("document.createElement('link')"), false);
  assert.equal(inference.includes('loadPolishStyles'), false);
  assert.ok(pages.includes('styles/feeling-inference-mobile.css'));
  assert.ok(feeling.includes('<link rel="stylesheet" href="../../styles/feeling-inference-mobile.css" />'));
});

test('Inventory arrives as its final deterministic shell', () => {
  const pages = read('scripts/build-pages.mjs');
  const shell = read('scripts/inventory-core-shell.js');
  const css = read('styles/inventory-core-shell.css');
  const html = read('inventory/index.html');

  assert.equal(shell.includes('prepareInventoryExperience'), false);
  assert.equal(shell.includes(".inventory-journal-button')?.remove()"), false);
  assert.equal(shell.includes(".inventory-shared-button')?.remove()"), false);
  assert.equal(shell.includes(".inventory-bluesky-panel')?.remove()"), false);
  assert.equal(shell.includes(".inventory-main > .inventory-actions')?.remove()"), false);
  assert.equal(css.includes('.inventory-page .inventory-main > .inventory-actions'), false);
  assert.equal(html.includes('class="inventory-journal-button"'), false);
  assert.equal(html.includes('class="inventory-shared-button"'), false);
  assert.equal(html.includes('class="inventory-bluesky-panel"'), false);
  assert.equal(html.includes('class="inventory-actions inventory-actions--collapsible"'), false);
  assert.ok(html.includes('class="inventory-message inventory-page__status" data-inventory-message'));
  assert.equal(pages.includes('<details class="inventory-bluesky-panel">'), false);
});

test('strategy save chrome is compiler-owned while saved/auth/edit state remains runtime-owned', () => {
  const pages = read('scripts/build-pages.mjs');
  const inventory = read('scripts/inventory.js');
  const need = read('needs/acceptance/index.html');

  assert.equal(inventory.includes('applyCompactSaveTargetControls'), false);
  assert.equal(inventory.includes('dataset.navDynamic'), false);
  assert.equal(inventory.includes("insertAdjacentElement('afterend', saveToProfileButton)"), false);
  assert.ok(pages.includes('data-save-to-device-button="true" data-app-icon="device"'));
  assert.ok(pages.includes('data-save-to-profile-button="true" data-app-icon="profile"'));
  assert.ok(pages.includes('name="save-target" value="device"'));
  assert.ok(need.includes('data-save-to-device-button="true"'));
  assert.ok(need.includes('data-save-to-profile-button="true"'));

  assert.ok(inventory.includes('updateProfileSaveButtonStates'), 'auth-dependent enablement remains runtime state');
  assert.ok(inventory.includes('updateStrategySaveButton'), 'persisted saved state remains runtime state');
  assert.ok(inventory.includes('setInventoryFormMode'), 'edit mode remains runtime state');
});

test('global Menu defers optional Bluesky loading until Account & data intent', () => {
  const shell = read('scripts/inventory-core-shell.js');
  const setupIndex = shell.indexOf('syncAccountStatus(menu);');
  const drillIndex = shell.indexOf("menu.querySelector('[data-menu-drill=\"account-data\"]')");
  const ensureIndex = shell.indexOf('ensureBlueskyModule(rootUrl);', drillIndex);
  assert.ok(setupIndex >= 0 && drillIndex > setupIndex && ensureIndex > drillIndex);
  assert.equal(shell.slice(setupIndex, drillIndex).includes('ensureBlueskyModule(rootUrl);'), false);
});
