import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function write(path, value) {
  writeFileSync(join(root, path), value);
}

function replaceOnce(source, search, replacement, label) {
  const count = typeof search === 'string'
    ? source.split(search).length - 1
    : [...source.matchAll(new RegExp(search.source, search.flags.includes('g') ? search.flags : `${search.flags}g`))].length;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return source.replace(search, replacement);
}

function replaceCount(source, search, replacement, expected, label) {
  const regex = search instanceof RegExp
    ? new RegExp(search.source, search.flags.includes('g') ? search.flags : `${search.flags}g`)
    : new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = [...source.matchAll(regex)];
  if (matches.length !== expected) {
    throw new Error(`${label}: expected ${expected} matches, found ${matches.length}`);
  }
  return source.replace(regex, replacement);
}

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Page compiler: deterministic route CSS and final strategy-save markup.
// ---------------------------------------------------------------------------
let pages = read('scripts/build-pages.mjs');

pages = replaceOnce(
  pages,
  "  includeLocalStorageReminder = false,\n}) {",
  "  includeLocalStorageReminder = false,\n  includeSaveTargets = false,\n}) {",
  'renderStrategyForm save-target option',
);

pages = replaceOnce(
  pages,
  "  const localStorageNote = includeLocalStorageReminder\n    ? `\n            ${localStorageReminderHtml}`\n    : '';\n\n  return `",
  "  const localStorageNote = includeLocalStorageReminder\n    ? `\n            ${localStorageReminderHtml}`\n    : '';\n\n  const saveActions = includeSaveTargets\n    ? `\n            <input type=\"hidden\" name=\"save-target\" value=\"device\" />\n            <div class=\"strategy-card__actions strategy-card__actions--stacked strategy-card__actions--save-targets strategy-form__actions\">\n              <button type=\"submit\" class=\"strategy-form__submit strategy-card__save strategy-card__save--device app-action app-action--primary\" data-save-to-device-button=\"true\" data-app-icon=\"device\" aria-label=\"Save to device\" title=\"Save to device\">Device</button>\n              <button type=\"submit\" class=\"strategy-form__submit strategy-form__submit--secondary strategy-card__save strategy-card__save--profile app-action app-action--secondary\" data-save-to-profile-button=\"true\" data-app-icon=\"profile\" aria-label=\"Save to profile\" aria-disabled=\"true\" title=\"Sign in to save to profile\" disabled>Profile</button>\n            </div>`\n    : `\n            <div class=\"strategy-card__actions strategy-card__actions--stacked strategy-form__actions\">\n              <button type=\"submit\" class=\"strategy-form__submit strategy-card__save\">${escapeHtml(submitLabel)}</button>\n            </div>`;\n\n  return `",
  'renderStrategyForm save actions declaration',
);

pages = replaceOnce(
  pages,
  "            <div class=\"strategy-card__actions strategy-card__actions--stacked strategy-form__actions\">\n              <button type=\"submit\" class=\"strategy-form__submit strategy-card__save\">${escapeHtml(submitLabel)}</button>\n            </div>\n            ${localStorageNote}",
  "            ${saveActions}\n            ${localStorageNote}",
  'renderStrategyForm final action markup',
);

pages = replaceOnce(
  pages,
  "    includeLocalStorageReminder: false,\n  };",
  "    includeLocalStorageReminder: false,\n    includeSaveTargets: true,\n  };",
  'personal strategy forms opt into save targets',
);

pages = replaceOnce(
  pages,
  "                      <div class=\"strategy-card__actions strategy-card__actions--stacked\">\n                        <button type=\"button\" class=\"strategy-card__save\">Save to device</button>\n                      </div>",
  "                      <div class=\"strategy-card__actions strategy-card__actions--stacked strategy-card__actions--save-targets\">\n                        <button type=\"button\" class=\"strategy-card__save strategy-card__save--device app-action app-action--primary\" data-save-to-device-button=\"true\" data-app-icon=\"device\" aria-label=\"Save to device\" title=\"Save to device\">Device</button>\n                        <button type=\"button\" class=\"strategy-card__save strategy-card__save--profile app-action app-action--secondary\" data-save-to-profile-button=\"true\" data-app-icon=\"profile\" aria-label=\"Save to profile\" aria-disabled=\"true\" title=\"Sign in to save to profile\" disabled>Profile</button>\n                      </div>",
  'need strategy cards emit final save targets',
);

pages = pages.replace(/\n\$\{strategiesNote\}\n/g, '\n');
if (pages.includes('${strategiesNote}')) {
  throw new Error('obsolete strategiesNote reference remains');
}

pages = replaceOnce(
  pages,
  "    description: item.description,\n  });\n\n  writePage(`feelings/${item.slug}/index.html`, html);",
  "    description: item.description,\n    headExtras: '    <link rel=\"stylesheet\" href=\"../../styles/feeling-inference-mobile.css\" />',\n  });\n\n  writePage(`feelings/${item.slug}/index.html`, html);",
  'Feeling route parser-discovers inference CSS',
);

// Inventory source should emit only the final workspace rather than old chrome
// that another runtime later hides/removes.
pages = replaceOnce(
  pages,
  /\n\s*<a class=\\?"inventory-journal-button\\?" href=\\?"\.\/journal\/\\?">[\s\S]*?<\/a>/,
  '',
  'remove obsolete Inventory Journal header link',
);

pages = replaceOnce(
  pages,
  /\n\s*<a class=\\?"inventory-shared-button\\?" href=\\?"\.\.\/feed\/\\?">[\s\S]*?<\/a>/,
  '',
  'remove obsolete Inventory Shared header link',
);

pages = replaceOnce(
  pages,
  /\n\s*<details class=\\?"inventory-bluesky-panel\\?">[\s\S]*?<\/details>/,
  '',
  'remove obsolete Inventory Bluesky panel',
);

pages = replaceOnce(
  pages,
  /(<section class=\\?"inventory-main\\?" aria-labelledby=\\?"inventory-overview-heading\\?">)\n\s*<details class=\\?"inventory-actions inventory-actions--collapsible\\?">[\s\S]*?<\/details>/,
  "$1\n        <p class=\\\"inventory-message inventory-page__status\\\" data-inventory-message hidden aria-live=\\\"polite\\\"></p>",
  'replace obsolete Inventory actions panel with canonical status',
);

pages = replaceOnce(
  pages,
  "  const inventoryFormNotice = buildPersonalStrategyNotice(\n    basePath,\n    'Use the export tools above whenever you would like a backup.'\n  );",
  "  const inventoryFormNotice = buildPersonalStrategyNotice();",
  'Inventory personal strategy notice call',
);

// Remove obsolete inline Inventory CSS at its compiler owner. Keep the actual
// Inventory workspace presentation in this same canonical style block.
const oldCssStart = pages.indexOf('      /* Optional Bluesky sync panel */');
const inventoryCssStart = pages.indexOf('      /* Inventory UX first pass v2 — inline pre-paint base styles */', oldCssStart);
if (oldCssStart < 0 || inventoryCssStart < 0) throw new Error('Inventory legacy CSS boundary not found');
pages = pages.slice(0, oldCssStart) + pages.slice(inventoryCssStart);

const journalCssStart = pages.indexOf("      /* Journal stays immediately available without competing with the\n         Inventory's primary task. */");
const hierarchyCssStart = pages.indexOf('      /* One task hierarchy:', journalCssStart);
if (journalCssStart < 0 || hierarchyCssStart < 0) throw new Error('Inventory Journal CSS boundary not found');
pages = pages.slice(0, journalCssStart) + pages.slice(hierarchyCssStart);

const obsoleteUtilityCssStart = pages.indexOf('      .inventory-header__quick-actions .strategy-quick-actions__link--secondary {');
const inventoryModelCssStart = pages.indexOf('      /* Inventory model prototype v1 — base presentation only. */', obsoleteUtilityCssStart);
if (obsoleteUtilityCssStart < 0 || inventoryModelCssStart < 0) throw new Error('Inventory utility CSS boundary not found');
pages = pages.slice(0, obsoleteUtilityCssStart) + pages.slice(inventoryModelCssStart);

pages = pages.replace(
  'grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr);',
  'grid-template-columns: minmax(0, 18rem);',
);
pages = pages.replace(
  '      .inventory-header__quick-actions .strategy-quick-actions__link,\n      .inventory-header__quick-actions .inventory-shared-button {',
  '      .inventory-header__quick-actions .strategy-quick-actions__link {',
);
pages = pages.replace(
  '      .inventory-header__quick-actions .strategy-quick-actions__icon,\n      .inventory-header__quick-actions .inventory-shared-button__icon {',
  '      .inventory-header__quick-actions .strategy-quick-actions__icon {',
);
pages = pages.replace(
  '        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
  '        grid-template-columns: minmax(0, 18rem);',
);
pages = pages.replace(
  '      .inventory-header__quick-actions {\n        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);\n      }',
  '      .inventory-header__quick-actions {\n        grid-template-columns: minmax(0, 18rem);\n      }',
);

pages = pages.replace('  const blueskyPanelStyles = `    <style>', '  const inventoryPageStyles = `    <style>');
pages = pages.replace('headExtras: `${blueskyPanelStyles}\\n${inventoryMobileStyles}`', 'headExtras: `${inventoryPageStyles}\\n${inventoryMobileStyles}`');
if (pages.includes('blueskyPanelStyles')) throw new Error('obsolete blueskyPanelStyles variable remains');

write('scripts/build-pages.mjs', pages);

// ---------------------------------------------------------------------------
// 2. Feeling runtime: behavior/data only; deterministic CSS is parser-owned.
// ---------------------------------------------------------------------------
let inference = read('scripts/feeling-reverse-inference.js');
inference = replaceOnce(
  inference,
  "const POLISH_STYLESHEET_ID = 'feeling-inference-mobile-styles';\n",
  '',
  'remove Feeling stylesheet ID',
);
inference = replaceOnce(
  inference,
  /function loadPolishStyles\(\) \{[\s\S]*?\n\}\n\nfunction fetchReverseIndex\(\)/,
  'function fetchReverseIndex()',
  'remove runtime Feeling stylesheet injection',
);
inference = replaceOnce(
  inference,
  "  Promise.all([loadPolishStyles(), fetchReverseIndex()]).then(([, data]) => {",
  "  fetchReverseIndex().then((data) => {",
  'Feeling initialization no longer waits for injected CSS',
);
write('scripts/feeling-reverse-inference.js', inference);

// ---------------------------------------------------------------------------
// 3. Inventory shared shell: delete the post-load deterministic normalizer.
// ---------------------------------------------------------------------------
let shell = read('scripts/inventory-core-shell.js');
shell = replaceOnce(
  shell,
  /function isInventoryWorkspace\(rootUrl\) \{[\s\S]*?\n\}\n\nfunction escapeHtml/,
  'function escapeHtml',
  'remove Inventory workspace detector used only by normalizer',
);
shell = replaceOnce(
  shell,
  /function prepareInventoryExperience\(rootUrl\) \{[\s\S]*?\n\}\n\nfunction triggerCustomizer/,
  'function triggerCustomizer',
  'remove Inventory post-load DOM normalizer',
);
shell = replaceOnce(
  shell,
  "  const rootUrl = getSiteRootUrl(nav);\n  prepareInventoryExperience(rootUrl);",
  "  const rootUrl = getSiteRootUrl(nav);",
  'remove Inventory normalizer call',
);
shell = replaceOnce(
  shell,
  "  syncInventoryCount(menu, nav);\n  syncAccountStatus(menu);\n  ensureBlueskyModule(rootUrl);\n  setupAccountDataControls(menu);",
  "  syncInventoryCount(menu, nav);\n  syncAccountStatus(menu);\n  setupAccountDataControls(menu);",
  'do not eagerly load Bluesky from the global Menu shell',
);
shell = replaceOnce(
  shell,
  "  menu.querySelector('[data-menu-drill=\"account-data\"]')?.addEventListener('click', () => {\n    showMenuView(menu, MENU_ACCOUNT_VIEW);\n  });",
  "  menu.querySelector('[data-menu-drill=\"account-data\"]')?.addEventListener('click', () => {\n    ensureBlueskyModule(rootUrl);\n    showMenuView(menu, MENU_ACCOUNT_VIEW);\n  });",
  'load Bluesky only when Account & data is opened',
);
write('scripts/inventory-core-shell.js', shell);

// ---------------------------------------------------------------------------
// 4. Inventory runtime: bind final static save controls instead of constructing
//    or cosmetically normalizing them after paint.
// ---------------------------------------------------------------------------
let inventory = read('scripts/inventory.js');
inventory = replaceOnce(
  inventory,
  /function applyCompactSaveTargetControls\(deviceButton, profileButton\) \{[\s\S]*?\n\}\n\nfunction normalizeVisibilityValue/,
  'function normalizeVisibilityValue',
  'remove compact save cosmetic normalizer',
);

inventory = replaceCount(
  inventory,
  /,\n\s*createElement: \(\) => \{[\s\S]*?\n\s*return link;\n\s*\}/,
  '',
  3,
  'remove dead nav static-element fallbacks',
);

inventory = replaceOnce(
  inventory,
  /    saveToDeviceButton\.textContent = 'Device';\n    saveToDeviceButton\.classList\.add\('strategy-card__save--device'\);\n\n    let saveToProfileButton = card\.querySelector\('\[data-save-to-profile-button="true"\]'\);\n    if \(!saveToProfileButton\) \{[\s\S]*?\n    registerProfileSaveButton\(saveToProfileButton\);/,
  "    const saveToProfileButton = card.querySelector('[data-save-to-profile-button=\"true\"]');\n    if (!(saveToProfileButton instanceof HTMLButtonElement)) {\n      return;\n    }\n    registerProfileSaveButton(saveToProfileButton);",
  'Need card setup binds canonical Profile button',
);

inventory = replaceOnce(
  inventory,
  "    const saveTargetField = document.createElement('input');\n    saveTargetField.type = 'hidden';\n    saveTargetField.name = 'save-target';\n    saveTargetField.value = SAVE_TARGET_DEVICE;\n    suggestionForm.appendChild(saveTargetField);",
  "    const saveTargetField = suggestionForm.querySelector('input[name=\"save-target\"]');\n    if (!(saveTargetField instanceof HTMLInputElement)) {\n      throw new Error('Canonical suggestion form is missing its save-target field');\n    }",
  'Need form uses compiler-authored save-target input',
);

inventory = replaceOnce(
  inventory,
  /    const formSaveToDevice = suggestionForm\.querySelector\('\.strategy-form__submit'\);\n    if \(formSaveToDevice\) \{[\s\S]*?\n      registerProfileSaveButton\(formSaveToProfile\);\n    \}/,
  "    const formSaveToDevice = suggestionForm.querySelector('[data-save-to-device-button=\"true\"]');\n    const formSaveToProfile = suggestionForm.querySelector('[data-save-to-profile-button=\"true\"]');\n    if (formSaveToDevice instanceof HTMLButtonElement && formSaveToProfile instanceof HTMLButtonElement) {\n      formSaveToDevice.addEventListener('click', () => {\n        saveTargetField.value = SAVE_TARGET_DEVICE;\n      });\n      formSaveToProfile.addEventListener('click', () => {\n        saveTargetField.value = SAVE_TARGET_PROFILE;\n      });\n      registerProfileSaveButton(formSaveToProfile);\n    }",
  'Need form binds compiler-authored save controls',
);

inventory = replaceOnce(
  inventory,
  "    const saveTargetField = document.createElement('input');\n    saveTargetField.type = 'hidden';\n    saveTargetField.name = 'save-target';\n    saveTargetField.value = SAVE_TARGET_DEVICE;\n    form.appendChild(saveTargetField);",
  "    const saveTargetField = form.querySelector('input[name=\"save-target\"]');\n    if (!(saveTargetField instanceof HTMLInputElement)) {\n      throw new Error('Canonical Inventory form is missing its save-target field');\n    }",
  'Inventory form uses compiler-authored save-target input',
);

inventory = replaceOnce(
  inventory,
  /    if \(state\.inventorySubmitButton\) \{\n      state\.inventorySubmitButton\.textContent = 'Device';[\s\S]*?\n      registerProfileSaveButton\(saveToProfileButton\);\n    \}/,
  "    if (state.inventorySubmitButton) {\n      state.inventorySubmitButton.addEventListener('click', () => {\n        saveTargetField.value = SAVE_TARGET_DEVICE;\n      });\n      const saveToProfileButton = form.querySelector('[data-save-to-profile-button=\"true\"]');\n      if (saveToProfileButton instanceof HTMLButtonElement) {\n        saveToProfileButton.addEventListener('click', () => {\n          saveTargetField.value = SAVE_TARGET_PROFILE;\n        });\n        registerProfileSaveButton(saveToProfileButton);\n      }\n    }",
  'Inventory form binds compiler-authored save controls',
);

if (inventory.includes('applyCompactSaveTargetControls')) throw new Error('save cosmetic normalizer remains');
if (inventory.includes('data.navDynamic') || inventory.includes("dataset.navDynamic")) throw new Error('dead dynamic nav fallback remains');
write('scripts/inventory.js', inventory);

// ---------------------------------------------------------------------------
// 5. Canonical shell CSS: obsolete Inventory elements no longer exist, so a
//    hide-until-JS compensation layer is forbidden.
// ---------------------------------------------------------------------------
let shellCss = read('styles/inventory-core-shell.css');
shellCss = replaceOnce(
  shellCss,
  /\/\* Inventory should be about the inventory itself\.[\s\S]*?\.inventory-page \.inventory-main > \.inventory-actions \{\n  display: none !important;\n\}\n\n/,
  '',
  'remove hide-until-JS Inventory compensation CSS',
);
write('styles/inventory-core-shell.css', shellCss);

// ---------------------------------------------------------------------------
// 6. Replace tests that blessed runtime repair with ownership invariants.
// ---------------------------------------------------------------------------
let nativeTests = read('tests/native-action-controls.test.mjs');
nativeTests = replaceOnce(
  nativeTests,
  /test\('strategy save destinations use compact native controls without emoji-era labels',[\s\S]*?\n\}\);\n\n/,
  `test('strategy save destinations are compiler-authored and runtime only binds stateful behavior', () => {\n  const inventory = read('scripts/inventory.js');\n  const pages = read('scripts/build-pages.mjs');\n  const need = read('needs/acceptance/index.html');\n  const inventoryHtml = read('inventory/index.html');\n  const styles = read('styles.css');\n\n  assert.equal(inventory.includes('💾'), false, 'save controls must not use the floppy-disk emoji');\n  assert.equal(inventory.includes('applyCompactSaveTargetControls'), false, 'runtime must not cosmetically normalize deterministic save controls');\n  assert.equal(inventory.includes('insertAdjacentElement(\\'afterend\\', saveToProfileButton)'), false, 'runtime must not create the deterministic Profile control');\n  assert.ok(pages.includes('data-save-to-device-button=\\"true\\" data-app-icon=\\"device\\"'));\n  assert.ok(pages.includes('data-save-to-profile-button=\\"true\\" data-app-icon=\\"profile\\"'));\n  assert.ok(pages.includes('name=\\"save-target\\" value=\\"device\\"'));\n  assert.ok(need.includes('data-save-to-device-button=\\"true\\"'));\n  assert.ok(need.includes('data-save-to-profile-button=\\"true\\"'));\n  assert.ok(inventoryHtml.includes('data-save-to-device-button=\\"true\\"'));\n  assert.ok(inventoryHtml.includes('data-save-to-profile-button=\\"true\\"'));\n\n  assert.ok(styles.includes('/* Compact native action controls */'));\n  assert.match(styles, /\\.app-action \\{[\\s\\S]*?min-height:\\s*44px;[\\s\\S]*?font-family:\\s*-apple-system/);\n  assert.match(styles, /\\.strategy-card__actions--save-targets \\{[\\s\\S]*?grid-template-columns:\\s*repeat\\(2, minmax\\(0, 1fr\\)\\)/);\n  assert.match(styles, /\\.app-action:disabled,[\\s\\S]*?border-style:\\s*solid/);\n});\n\n`,
  'invert native save-control ownership test',
);
write('tests/native-action-controls.test.mjs', nativeTests);

let navTests = read('tests/shared-nav-menu.test.mjs');
navTests = replaceOnce(
  navTests,
  /test\('Inventory keeps system management out of its primary workspace',[\s\S]*?\n\}\);/,
  `test('Inventory compiler omits system-management chrome instead of deleting it after paint', async () => {\n  const controller = await fs.readFile(path.join(root, 'scripts/inventory-core-shell.js'), 'utf8');\n  const pages = await fs.readFile(path.join(root, 'scripts/build-pages.mjs'), 'utf8');\n  const inventoryHtml = await fs.readFile(path.join(root, 'inventory/index.html'), 'utf8');\n  const css = await fs.readFile(path.join(root, 'styles/inventory-core-shell.css'), 'utf8');\n\n  assert.ok(!controller.includes('prepareInventoryExperience'), 'shared runtime must not normalize the deterministic Inventory shell');\n  assert.ok(!controller.includes("document.querySelector('.inventory-bluesky-panel')?.remove()"));\n  assert.ok(!controller.includes("document.querySelector('.inventory-main > .inventory-actions')?.remove()"));\n  assert.ok(!controller.includes("document.querySelector('.inventory-header .inventory-shared-button')?.remove()"));\n  assert.ok(!pages.includes('<details class=\\"inventory-bluesky-panel\\">'), 'compiler must not emit the retired Bluesky panel');\n  assert.ok(!pages.includes('<a class=\\"inventory-shared-button\\"'), 'compiler must not emit retired Shared chrome');\n  assert.ok(!inventoryHtml.includes('class=\\"inventory-bluesky-panel\\"'));\n  assert.ok(!inventoryHtml.includes('class=\\"inventory-actions inventory-actions--collapsible\\"'));\n  assert.ok(inventoryHtml.includes('class=\\"inventory-message inventory-page__status\\" data-inventory-message'), 'status belongs directly in the final Inventory shell');\n  assert.ok(!css.includes('.inventory-page .inventory-main > .inventory-actions'), 'CSS must not hide markup that should not exist');\n  assert.ok(css.includes('inset: auto 0 0 0;'), 'mobile Menu should present as a lightweight bottom sheet');\n});`,
  'invert Inventory normalizer test',
);
write('tests/shared-nav-menu.test.mjs', navTests);

// ---------------------------------------------------------------------------
// 7. Permanent provenance guard: prevent these architectural failure modes from
//    silently becoming green CI again.
// ---------------------------------------------------------------------------
const provenanceTest = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\nimport { join } from 'node:path';\n\nconst root = new URL('../', import.meta.url).pathname;\nconst read = (path) => readFileSync(join(root, path), 'utf8');\n\ntest('deterministic styles are parser-discovered rather than injected by browser JavaScript', () => {\n  const inference = read('scripts/feeling-reverse-inference.js');\n  const pages = read('scripts/build-pages.mjs');\n  const feeling = read('feelings/afraid/index.html');\n\n  assert.equal(inference.includes("document.createElement('link')"), false);\n  assert.equal(inference.includes('loadPolishStyles'), false);\n  assert.ok(pages.includes('styles/feeling-inference-mobile.css'));\n  assert.ok(feeling.includes('<link rel="stylesheet" href="../../styles/feeling-inference-mobile.css" />'));\n});\n\ntest('Inventory arrives as its final deterministic shell', () => {\n  const pages = read('scripts/build-pages.mjs');\n  const shell = read('scripts/inventory-core-shell.js');\n  const css = read('styles/inventory-core-shell.css');\n  const html = read('inventory/index.html');\n\n  assert.equal(shell.includes('prepareInventoryExperience'), false);\n  assert.equal(shell.includes(".inventory-journal-button')?.remove()"), false);\n  assert.equal(shell.includes(".inventory-shared-button')?.remove()"), false);\n  assert.equal(shell.includes(".inventory-bluesky-panel')?.remove()"), false);\n  assert.equal(shell.includes(".inventory-main > .inventory-actions')?.remove()"), false);\n  assert.equal(css.includes('.inventory-page .inventory-main > .inventory-actions'), false);\n  assert.equal(html.includes('class="inventory-journal-button"'), false);\n  assert.equal(html.includes('class="inventory-shared-button"'), false);\n  assert.equal(html.includes('class="inventory-bluesky-panel"'), false);\n  assert.equal(html.includes('class="inventory-actions inventory-actions--collapsible"'), false);\n  assert.ok(html.includes('class="inventory-message inventory-page__status" data-inventory-message'));\n  assert.equal(pages.includes('<details class="inventory-bluesky-panel">'), false);\n});\n\ntest('strategy save chrome is compiler-owned while saved/auth/edit state remains runtime-owned', () => {\n  const pages = read('scripts/build-pages.mjs');\n  const inventory = read('scripts/inventory.js');\n  const need = read('needs/acceptance/index.html');\n\n  assert.equal(inventory.includes('applyCompactSaveTargetControls'), false);\n  assert.equal(inventory.includes('dataset.navDynamic'), false);\n  assert.equal(inventory.includes("insertAdjacentElement('afterend', saveToProfileButton)"), false);\n  assert.ok(pages.includes('data-save-to-device-button="true" data-app-icon="device"'));\n  assert.ok(pages.includes('data-save-to-profile-button="true" data-app-icon="profile"'));\n  assert.ok(pages.includes('name="save-target" value="device"'));\n  assert.ok(need.includes('data-save-to-device-button="true"'));\n  assert.ok(need.includes('data-save-to-profile-button="true"'));\n\n  assert.ok(inventory.includes('updateProfileSaveButtonStates'), 'auth-dependent enablement remains runtime state');\n  assert.ok(inventory.includes('updateStrategySaveButton'), 'persisted saved state remains runtime state');\n  assert.ok(inventory.includes('setInventoryFormMode'), 'edit mode remains runtime state');\n});\n\ntest('global Menu defers optional Bluesky loading until Account & data intent', () => {\n  const shell = read('scripts/inventory-core-shell.js');\n  const setupIndex = shell.indexOf('syncAccountStatus(menu);');\n  const drillIndex = shell.indexOf("menu.querySelector('[data-menu-drill=\\\"account-data\\\"]')");\n  const ensureIndex = shell.indexOf('ensureBlueskyModule(rootUrl);', drillIndex);\n  assert.ok(setupIndex >= 0 && drillIndex > setupIndex && ensureIndex > drillIndex);\n  assert.equal(shell.slice(setupIndex, drillIndex).includes('ensureBlueskyModule(rootUrl);'), false);\n});\n`;
write('tests/bedrock-runtime-provenance.test.mjs', provenanceTest);

let packageJson = read('package.json');
packageJson = replaceOnce(
  packageJson,
  'tests/journal-initial-history-hydration.test.mjs",',
  'tests/journal-initial-history-hydration.test.mjs tests/bedrock-runtime-provenance.test.mjs",',
  'include provenance guard in flicker/runtime suite',
);
write('package.json', packageJson);

const provenanceDoc = `# Bedrock runtime provenance\n\nBedrock uses one decision rule for browser mutations: **if the correct markup or presentation is knowable from the route/build, it must be emitted by its canonical compiler/style owner.** Runtime code is reserved for values that genuinely depend on saved user state, fetched data, authentication, permissions, device capabilities, or interaction state.\n\n## Blocking provenance failures\n\nThe production-finalization audit found and removed three classes of deterministic repair that had survived earlier green CI:\n\n- Inventory markup that was emitted by the page compiler, hidden by CSS, and then deleted/rearranged by the shared shell after load. The compiler now emits only the final Inventory workspace.\n- Device/Profile strategy controls that were cosmetically rewritten and partially constructed by \\`inventory.js\\`. The page compiler now emits the complete controls and save-target field; runtime only binds clicks and reflects saved/auth/edit state.\n- Feeling-detail CSS that was inserted with a runtime \\`<link>\\`. Feeling pages now parser-discover that stylesheet in their generated head.\n\nThe audit also removed dead runtime fallback creators for optional navigation magnets that are already serialized by the canonical page compiler.\n\n## Legitimate runtime mutation\n\nThese remain runtime by design:\n\n- Customizer colors/roundness and profile restore, because values come from user-selected or persisted state.\n- Magnet position, board height, dragging, shuffle, physics and tilt, because geometry and interaction are runtime state.\n- Journal entries, History filters, Feeling intensity selections and draft/save status, because they depend on local user data and interaction.\n- Observation suggestions, Body Cue results, reverse-inference results, Shared Strategy cards, and Bluesky status, because they depend on user input, fetched data, or authentication.\n- Hidden interaction surfaces such as the global Menu may be constructed when activated; they are not first-paint repair of route content. Optional Bluesky code is deferred until Account & data is opened on routes that do not otherwise need it.\n\n## Permanent gate\n\n\\`tests/bedrock-runtime-provenance.test.mjs\\` protects the concrete ownership boundaries above. Existing tests that previously required post-load Inventory cleanup or save-button cosmetic normalization were inverted so CI now rejects those patterns instead of blessing them.\n\nThis provenance gate complements, rather than replaces, generator zero-diff checks, route-runtime ownership tests, performance ceilings, persisted-state contracts, and real-device acceptance.\n`;
write('docs/bedrock-runtime-provenance.md', provenanceDoc);

let readme = read('README.md');
const readmeNeedle = '- runtime JS owns genuinely stateful behavior. It should not rewrite deterministic markup or CSS after paint just to make the page look correct.\n';
if (readme.includes(readmeNeedle) && !readme.includes('bedrock-runtime-provenance.test.mjs')) {
  readme = readme.replace(
    readmeNeedle,
    `${readmeNeedle}- provenance is regression-tested by \\`tests/bedrock-runtime-provenance.test.mjs\\`; deterministic DOM removal, runtime save-control assembly, and route stylesheet injection are treated as architecture regressions.\n`,
  );
}
write('README.md', readme);

// ---------------------------------------------------------------------------
// 8. Build from canonical sources and exercise the normal quality boundary.
// ---------------------------------------------------------------------------
run(process.execPath, ['--check', 'scripts/inventory.js']);
run(process.execPath, ['--check', 'scripts/inventory-core-shell.js']);
run(process.execPath, ['--check', 'scripts/feeling-reverse-inference.js']);
run(process.execPath, ['--check', 'scripts/build-pages.mjs']);
run('npm', ['ci', '--ignore-scripts']);
run('npm', ['run', 'build']);
run(process.execPath, ['--test', 'tests/bedrock-runtime-provenance.test.mjs', 'tests/native-action-controls.test.mjs', 'tests/shared-nav-menu.test.mjs', 'tests/route-runtime-ownership.test.mjs']);
run('npm', ['run', 'test:flicker-jitter']);
run('npm', ['run', 'test:generator-ownership']);
run('npm', ['run', 'test:obsolete']);

// Final source assertions after canonical regeneration.
const finalPages = read('scripts/build-pages.mjs');
const finalInventory = read('scripts/inventory.js');
const finalShell = read('scripts/inventory-core-shell.js');
const finalInference = read('scripts/feeling-reverse-inference.js');
const finalInventoryHtml = read('inventory/index.html');
if (finalPages.includes('<details class="inventory-bluesky-panel">')) throw new Error('compiler still emits obsolete Inventory Bluesky chrome');
if (finalShell.includes('prepareInventoryExperience')) throw new Error('post-load Inventory normalizer remains');
if (finalInventory.includes('applyCompactSaveTargetControls')) throw new Error('save cosmetic normalizer remains');
if (finalInference.includes("document.createElement('link')")) throw new Error('Feeling runtime still injects stylesheet');
if (finalInventoryHtml.includes('inventory-bluesky-panel')) throw new Error('generated Inventory still contains old Bluesky panel');

// One-shot audit/finalizer scaffolding must never land in the clean head.
for (const path of [
  '.github/scripts/bedrock-provenance-audit.mjs',
  '.github/scripts/bedrock-provenance-finalize.mjs',
]) {
  const full = join(root, path);
  if (existsSync(full)) rmSync(full);
}

console.log('\nBedrock provenance finalization completed; one-shot scripts removed.');
