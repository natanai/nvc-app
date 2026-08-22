from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_exact(path: Path, old: str, new: str, label: str, expected: int = 1) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count == 0 and new in text:
        return
    if count != expected:
        raise RuntimeError(f'{label}: expected {expected} occurrence(s), found {count}')
    path.write_text(text.replace(old, new), encoding='utf-8')


inventory = ROOT / 'scripts' / 'inventory.js'

helper_anchor = "const SAVE_TARGET_PROFILE = 'profile';\n\nfunction normalizeVisibilityValue"
helper_block = """const SAVE_TARGET_PROFILE = 'profile';

function applyCompactSaveTargetControls(deviceButton, profileButton) {
  if (deviceButton) {
    deviceButton.textContent = 'Device';
    deviceButton.classList.add('app-action', 'app-action--primary');
    deviceButton.dataset.appIcon = 'device';
    deviceButton.setAttribute('aria-label', 'Save to device');
    deviceButton.setAttribute('title', 'Save to device');
  }

  if (profileButton) {
    profileButton.textContent = 'Profile';
    profileButton.classList.remove(
      'strategy-form__submit--secondary',
      'strategy-card__save--device',
      'app-action--primary',
    );
    profileButton.classList.add('app-action', 'app-action--secondary', 'strategy-card__save--profile');
    profileButton.dataset.appIcon = 'profile';
    profileButton.setAttribute('aria-label', 'Save to profile');
    profileButton.setAttribute('title', 'Save to profile');
  }

  const actionBar = deviceButton?.parentElement;
  if (actionBar && profileButton?.parentElement === actionBar) {
    actionBar.classList.add('strategy-card__actions--save-targets');
  }
}

function normalizeVisibilityValue"""
replace_exact(inventory, helper_anchor, helper_block, 'compact save-target helper')

replace_exact(
    inventory,
    "button.dataset.defaultLabel = button.textContent?.trim() || '💾 Save to device';",
    "button.dataset.defaultLabel = button.textContent?.trim() || 'Device';",
    'strategy device fallback label',
)
replace_exact(
    inventory,
    "button.dataset.savedLabel = '✓ Saved on this device';",
    "button.dataset.savedLabel = 'Saved';",
    'strategy saved label',
)
replace_exact(
    inventory,
    "button.setAttribute('aria-pressed', isSaved ? 'true' : 'false');",
    "button.setAttribute('aria-pressed', isSaved ? 'true' : 'false');\n  button.setAttribute('aria-label', isSaved ? 'Saved to device' : 'Save to device');",
    'strategy saved accessibility state',
)
replace_exact(
    inventory,
    "textContent = '💾 Save to device';",
    "textContent = 'Device';",
    'device save visible labels',
    expected=3,
)
replace_exact(
    inventory,
    "textContent = 'Save to profile';",
    "textContent = 'Profile';",
    'profile save visible labels',
    expected=3,
)

replace_exact(
    inventory,
    """    saveToProfileButton.classList.add('strategy-card__save--profile');
    registerProfileSaveButton(saveToProfileButton);""",
    """    saveToProfileButton.classList.add('strategy-card__save--profile');
    applyCompactSaveTargetControls(saveToDeviceButton, saveToProfileButton);
    registerProfileSaveButton(saveToProfileButton);""",
    'strategy card compact save actions',
)
replace_exact(
    inventory,
    """      formSaveToProfile.classList.add('strategy-form__submit--secondary', 'strategy-card__save--profile');
      registerProfileSaveButton(formSaveToProfile);""",
    """      formSaveToProfile.classList.add('strategy-form__submit--secondary', 'strategy-card__save--profile');
      applyCompactSaveTargetControls(formSaveToDevice, formSaveToProfile);
      registerProfileSaveButton(formSaveToProfile);""",
    'shared strategy form compact save actions',
)
replace_exact(
    inventory,
    """      saveToProfileButton.classList.add('strategy-form__submit--secondary', 'strategy-card__save--profile');
      registerProfileSaveButton(saveToProfileButton);""",
    """      saveToProfileButton.classList.add('strategy-form__submit--secondary', 'strategy-card__save--profile');
      applyCompactSaveTargetControls(state.inventorySubmitButton, saveToProfileButton);
      registerProfileSaveButton(saveToProfileButton);""",
    'inventory form compact save actions',
)

replace_exact(
    inventory,
    "state.journalController.markSaved('Saved ✓', 1500);",
    "state.journalController.markSaved('Saved', 1500);",
    'journal saved button label',
)
replace_exact(
    inventory,
    "state.journalSaveButton.textContent = 'Saved ✓';",
    "state.journalSaveButton.textContent = 'Saved';",
    'journal saved fallback label',
)
replace_exact(
    inventory,
    "showJournalStatus('Saved ✓ Your entry is in Journal History below. The form is ready for a new entry.');",
    "showJournalStatus('Saved. Your entry is in Journal History below. The form is ready for a new entry.');",
    'journal save status copy',
)

inventory_text = inventory.read_text(encoding='utf-8')
count_save_entry = inventory_text.count("'Save entry'")
if count_save_entry:
    inventory.write_text(inventory_text.replace("'Save entry'", "'Save'"), encoding='utf-8')

journal = ROOT / 'assets' / 'js' / 'journal' / 'module.js'
journal_text = journal.read_text(encoding='utf-8')
journal_text = journal_text.replace("'Save entry'", "'Save'")
journal_text = journal_text.replace("'Clear form'", "'Clear'")
old_classes = """      submit: ['inventory-button'],
      clear: ['inventory-button', 'inventory-button--ghost'],"""
new_classes = """      submit: ['app-action', 'app-action--primary'],
      clear: ['app-action', 'app-action--quiet'],"""
if old_classes not in journal_text and new_classes not in journal_text:
    raise RuntimeError('journal action class anchor not found')
journal_text = journal_text.replace(old_classes, new_classes, 1)

old_inline = """  statusEl.setAttribute('data-journal-status', '');
  container.append(statusEl);
  if (actions.clearLabel) {
    const clear = createElement('button', {
      classes: classes.clear || [],
      attrs: { type: 'button' },
      text: actions.clearLabel,
    });
    clear.setAttribute('data-journal-clear', '');
    container.append(clear);
  }
  const submit = createElement('button', {
    classes: classes.submit || [],
    attrs: { type: 'submit' },
    text: actions.submitLabel || 'Save',
  });
  submit.setAttribute('data-journal-submit', '');
  container.append(submit);
  return { container, statusEl, openLink };
"""
new_inline = """  statusEl.setAttribute('data-journal-status', '');
  container.append(statusEl);
  const buttonBar = createElement('div', {
    classes: ['journal-form__action-buttons', 'app-action-bar'],
  });
  if (actions.clearLabel) {
    const clear = createElement('button', {
      classes: classes.clear || [],
      attrs: { type: 'button' },
      text: actions.clearLabel,
    });
    clear.setAttribute('data-journal-clear', '');
    clear.dataset.appIcon = 'clear';
    buttonBar.append(clear);
  }
  const submit = createElement('button', {
    classes: classes.submit || [],
    attrs: { type: 'submit' },
    text: actions.submitLabel || 'Save',
  });
  submit.setAttribute('data-journal-submit', '');
  submit.dataset.appIcon = 'save';
  buttonBar.append(submit);
  container.append(buttonBar);
  return { container, statusEl, openLink };
"""
if old_inline not in journal_text and new_inline not in journal_text:
    raise RuntimeError('journal inline action layout anchor not found')
journal_text = journal_text.replace(old_inline, new_inline, 1)

# The less-common split layout should use the same icon language if an override enables it.
split_submit = "submit.setAttribute('data-journal-submit', '');\n    primary.append(submit);"
split_submit_new = "submit.setAttribute('data-journal-submit', '');\n    submit.dataset.appIcon = 'save';\n    primary.append(submit);"
if split_submit in journal_text:
    journal_text = journal_text.replace(split_submit, split_submit_new, 1)
split_clear = "clear.setAttribute('data-journal-clear', '');\n      container.append(clear);"
split_clear_new = "clear.setAttribute('data-journal-clear', '');\n      clear.dataset.appIcon = 'clear';\n      container.append(clear);"
if split_clear in journal_text:
    journal_text = journal_text.replace(split_clear, split_clear_new, 1)

journal.write_text(journal_text, encoding='utf-8')

styles = ROOT / 'styles.css'
styles_text = styles.read_text(encoding='utf-8')
marker = '/* Compact native action controls */'
if marker not in styles_text:
    styles_text = styles_text.rstrip() + r'''

/* Compact native action controls */
.app-action-bar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.5rem;
}

.app-action {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.42rem;
  padding: 0.56rem 0.78rem;
  border: 1px solid color-mix(in srgb, var(--outline) 26%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, #ffffff 90%, var(--lavender) 10%);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
  font-size: 0.9rem;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: 0;
  text-transform: none;
  white-space: nowrap;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--outline) 16%, transparent);
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

.app-action:hover,
.app-action:focus-visible {
  transform: none;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--outline) 16%, transparent);
}

.app-action:active {
  transform: scale(0.97);
}

.app-action:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--outline) 44%, transparent);
  outline-offset: 2px;
}

.app-action--primary {
  background: color-mix(in srgb, var(--rose) 82%, #ffffff 18%);
  border-color: color-mix(in srgb, var(--outline) 34%, transparent);
  color: var(--btn-fg);
}

.app-action--primary:hover,
.app-action--primary:focus-visible {
  background: color-mix(in srgb, var(--rose) 90%, #ffffff 10%);
}

.app-action--secondary {
  background: color-mix(in srgb, #ffffff 90%, var(--lavender) 10%);
  border-color: color-mix(in srgb, var(--outline) 24%, transparent);
  color: var(--ink-soft);
}

.app-action--quiet {
  background: transparent;
  border-color: transparent;
  color: var(--ink-soft);
  box-shadow: none;
}

.app-action--quiet:hover,
.app-action--quiet:focus-visible {
  background: color-mix(in srgb, var(--lavender) 44%, transparent);
  box-shadow: none;
}

.app-action:disabled,
.app-action[aria-disabled='true'] {
  opacity: 0.46;
  cursor: not-allowed;
  border-style: solid;
  box-shadow: none;
  transform: none;
}

.app-action[data-app-icon]::before {
  content: '';
  width: 1.05rem;
  height: 1.05rem;
  flex: 0 0 1.05rem;
  background: currentColor;
  -webkit-mask: var(--app-action-icon) center / contain no-repeat;
  mask: var(--app-action-icon) center / contain no-repeat;
}

.app-action[data-app-icon='device'] {
  --app-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M11 3h2v8.17l2.59-2.58L17 10l-5 5-5-5 1.41-1.41L11 11.17V3ZM5 17h14v3H5v-3Z'/%3E%3C/svg%3E");
}

.app-action[data-app-icon='profile'] {
  --app-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z'/%3E%3C/svg%3E");
}

.app-action[data-app-icon='clear'] {
  --app-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='m6.7 5.3 5.3 5.3 5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z'/%3E%3C/svg%3E");
}

.app-action[data-app-icon='save'] {
  --app-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='m9.4 18.4-5-5 1.4-1.4 3.6 3.6 8.8-8.8 1.4 1.4-10.2 10.2Z'/%3E%3C/svg%3E");
}

.strategy-card__actions--save-targets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  align-items: center;
  justify-content: stretch;
}

.strategy-card__actions--save-targets .strategy-card__save.app-action {
  width: 100%;
  min-width: 0;
  align-self: stretch;
  text-align: center;
}

.strategy-card__actions--save-targets .strategy-save-target-hint,
.strategy-card__actions--save-targets .local-storage-note {
  grid-column: 1 / -1;
  justify-self: stretch;
  margin: 0.1rem 0 0;
  text-align: left;
}

.strategy-card__save--profile.app-action,
.strategy-card__save--profile.app-action:hover,
.strategy-card__save--profile.app-action:focus-visible {
  border-style: solid;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--outline) 14%, transparent);
  transform: none;
}

.strategy-card__save--saved.app-action {
  background: color-mix(in srgb, var(--mint) 78%, #ffffff 22%);
  color: var(--ink);
}

.journal-form__action-buttons {
  width: 100%;
  justify-content: space-between;
}

.journal-form__action-buttons .app-action--quiet {
  margin-right: auto;
}

.journal-form__action-buttons .app-action--primary {
  margin-left: auto;
  min-width: 6.5rem;
}

@media (max-width: 420px) {
  .app-action {
    padding-inline: 0.68rem;
    font-size: 0.86rem;
  }

  .strategy-card__actions--save-targets {
    gap: 0.4rem;
  }
}
''' + '\n'
    styles.write_text(styles_text, encoding='utf-8')

acceptance = ROOT / 'tests' / 'acceptance-interaction-regressions.test.mjs'
acceptance_text = acceptance.read_text(encoding='utf-8')
acceptance_text = acceptance_text.replace(
    'Saved ✓ Your entry is in Journal History below. The form is ready for a new entry.',
    'Saved. Your entry is in Journal History below. The form is ready for a new entry.',
)
acceptance.write_text(acceptance_text, encoding='utf-8')

native_test = ROOT / 'tests' / 'native-action-controls.test.mjs'
native_test.write_text(r'''import assert from 'node:assert/strict';
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
''', encoding='utf-8')

package_path = ROOT / 'package.json'
package_text = package_path.read_text(encoding='utf-8')
old_suite_tail = 'tests/acceptance-interaction-regressions.test.mjs"'
new_suite_tail = 'tests/acceptance-interaction-regressions.test.mjs tests/native-action-controls.test.mjs"'
if new_suite_tail not in package_text:
    if old_suite_tail not in package_text:
        raise RuntimeError('package flicker/runtime suite anchor not found')
    package_text = package_text.replace(old_suite_tail, new_suite_tail, 1)
    package_path.write_text(package_text, encoding='utf-8')

print('Prepared compact native action controls for strategy save targets and Journal actions.')
