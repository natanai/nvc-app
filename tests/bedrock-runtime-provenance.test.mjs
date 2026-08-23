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


test('Journal form semantics have one canonical owner', () => {
  const moduleSource = read('assets/js/journal/module.js');
  const inventory = read('scripts/inventory.js');
  const support = read('scripts/alexithymia-support.js');
  const pages = read('scripts/build-pages.mjs');
  const journal = read('inventory/journal/index.html');
  const supportPage = read('alexithymia-support/index.html');

  assert.equal(moduleSource.includes('JOURNAL_VARIANT_CONFIG'), false, 'parallel Journal semantic variants must stay retired');
  assert.equal(moduleSource.includes('journalVariant'), false, 'Journal module must not branch semantics by context name');
  assert.equal((moduleSource.match(/Optional reflection prompts/g) || []).length, 1, 'generic Journal copy must have one canonical owner');
  for (const duplicateChannel of [
    'journalPromptsHeading',
    'journalPrompts',
    'journalNotesPlaceholder',
    'journalNotesLabel',
    'journalTagsPlaceholder',
    'journalNeedsPlaceholder',
    'journalSubmitLabel',
    'journalClearLabel',
    'journalOpenLabel',
  ]) {
    assert.equal(moduleSource.includes(duplicateChannel), false, duplicateChannel + ' must not reopen per-mount semantic drift');
  }

  assert.equal(inventory.includes('journalVariant'), false, 'shared runtime binds the canonical Journal without selecting a variant');
  assert.equal(pages.includes('data-journal-variant='), false, 'compiler must not serialize semantic Journal variants');
  assert.equal(journal.includes('data-journal-variant='), false, 'generated Journal must not ship a semantic variant marker');
  assert.ok(pages.includes('data-journal-notes-rows=\"5\"'), 'fallback may keep context-specific density without redefining Journal semantics');

  for (const duplicateImplementation of [
    'journalController',
    'renderJournalForm',
    'handleJournalSubmit',
    'gatherSupportJournalData',
    'createLaneEntry',
    'renderJournalHistory',
  ]) {
    assert.equal(support.includes(duplicateImplementation), false, 'Alexithymia must not maintain a parallel Journal implementation: ' + duplicateImplementation);
  }
  assert.ok(supportPage.includes('data-support-journal-open'), 'Alexithymia keeps only its contextual entry point into the shared Journal');
  assert.ok(supportPage.includes('same Journal history as entries made elsewhere'), 'Alexithymia context must describe shared Journal ownership explicitly');
});
