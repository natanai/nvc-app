from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f'{label}: expected anchor not found')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


physics = ROOT / 'scripts' / 'magnets' / 'magnetPhysics.js'
replace_once(
    physics,
    """    notifyPositions(state);\n    if (\n      state.dragIntent.pointerId === event.pointerId &&\n""",
    """    notifyPositions(state);\n    if (typeof state.onDragEnd === 'function') {\n      state.onDragEnd();\n    }\n    if (\n      state.dragIntent.pointerId === event.pointerId &&\n""",
    'magnet pointer-up persistence callback',
)
replace_once(
    physics,
    """    delete state.board.dataset.dragging;\n    notifyPositions(state);\n    if (state.dragIntent.pointerId === event.pointerId) {\n""",
    """    delete state.board.dataset.dragging;\n    notifyPositions(state);\n    if (typeof state.onDragEnd === 'function') {\n      state.onDragEnd();\n    }\n    if (state.dragIntent.pointerId === event.pointerId) {\n""",
    'magnet pointer-cancel persistence callback',
)
replace_once(
    physics,
    """    onDragRelease: options.onDragRelease,\n    isShuffling: false,\n""",
    """    onDragRelease: options.onDragRelease,\n    onDragEnd: options.onDragEnd,\n    isShuffling: false,\n""",
    'magnet drag-end callback ownership',
)

magnets = ROOT / 'scripts' / 'magnets.js'
replace_once(
    magnets,
    """  if (immediate) {\n    flush();\n    return;\n  }\n""",
    """  if (immediate) {\n    if (state.saveTimer != null) {\n      window.clearTimeout(state.saveTimer);\n      state.saveTimer = null;\n    }\n    flush();\n    return;\n  }\n""",
    'immediate magnet save flush',
)
replace_once(
    magnets,
    """      onDragRelease: () => state.setClickSuppress(),\n      onTiltPermissionDenied: (reason) => handleTiltPermissionDenied(state, reason),\n""",
    """      onDragRelease: () => state.setClickSuppress(),\n      onDragEnd: () => {\n        updateLayout(state);\n        persistLayout(state, true);\n      },\n      onTiltPermissionDenied: (reason) => handleTiltPermissionDenied(state, reason),\n""",
    'manual magnet drag persistence owner',
)

journal_module = ROOT / 'assets' / 'js' / 'journal' / 'module.js'
replace_once(
    journal_module,
    """  resetForm() {\n""",
    """  resetForm({ keepStatus = false, focusNotes = true } = {}) {\n""",
    'journal reset options',
)
replace_once(
    journal_module,
    """    if (this.statusEl) {\n      this.statusEl.textContent = '';\n    }\n""",
    """    if (this.statusEl && !keepStatus) {\n      this.statusEl.textContent = '';\n    }\n""",
    'journal preserved save status',
)
replace_once(
    journal_module,
    """    if (this.notesInput) {\n      this.autoResizeNotes();\n      this.notesInput.focus();\n    }\n""",
    """    if (this.notesInput) {\n      this.autoResizeNotes();\n      if (focusNotes) {\n        this.notesInput.focus();\n      } else {\n        this.notesInput.blur();\n      }\n    }\n""",
    'journal post-save focus behavior',
)

inventory = ROOT / 'scripts' / 'inventory.js'
replace_once(
    inventory,
    """    state.journalController.resetForm();\n""",
    """    state.journalController.resetForm({\n      keepStatus: Boolean(options.keepStatus),\n      focusNotes: options.focusNotes !== false,\n    });\n""",
    'journal controller reset option forwarding',
)
replace_once(
    inventory,
    """function focusJournalHistoryCard(id) {\n  if (!state.journalHistoryEl || !id) {\n    return;\n  }\n  const selector = `[data-journal-id=\"${escapeSelector(id)}\"]`;\n  const card = state.journalHistoryEl.querySelector(selector);\n  if (!card) {\n    return;\n  }\n""",
    """function focusJournalHistoryCard(id) {\n  if (!id) {\n    return;\n  }\n  const selector = `[data-journal-id=\"${escapeSelector(id)}\"]`;\n  const historyTargets = state.journalOverlayOpen\n    ? [state.journalOverlayHistoryEl, state.journalHistoryEl]\n    : [state.journalHistoryEl, state.journalOverlayHistoryEl];\n  const card = historyTargets\n    .filter((history) => history instanceof HTMLElement)\n    .map((history) => history.querySelector(selector))\n    .find((candidate) => candidate instanceof HTMLElement);\n  if (!card) {\n    return;\n  }\n""",
    'visible journal history focus target',
)
replace_once(
    inventory,
    """    savedEntry = store.create(entry);\n    showJournalStatus('Saved entry. It stays on this device until you export it.');\n    resetJournalForm({ keepStatus: true });\n    setJournalEditState('');\n""",
    """    savedEntry = store.create(entry);\n    showJournalStatus('Saved ✓ Your entry is in Journal History below. The form is ready for a new entry.');\n    resetJournalForm({ keepStatus: true, focusNotes: false });\n    setJournalEditState('');\n""",
    'journal saved-entry confirmation',
)

package_path = ROOT / 'package.json'
package_text = package_path.read_text(encoding='utf-8')
old_test = 'tests/strategy-deck-ownership.test.mjs'
new_test = 'tests/strategy-deck-ownership.test.mjs tests/acceptance-interaction-regressions.test.mjs'
if new_test not in package_text:
    if old_test not in package_text:
        raise RuntimeError('package.json flicker suite anchor not found')
    package_text = package_text.replace(old_test, new_test, 1)
    package_path.write_text(package_text, encoding='utf-8')

test_path = ROOT / 'tests' / 'acceptance-interaction-regressions.test.mjs'
test_path.write_text(r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');

test('manual magnet drag completion immediately persists the final layout', () => {
  const physics = read('scripts/magnets/magnetPhysics.js');
  const magnets = read('scripts/magnets.js');

  assert.ok(physics.includes('onDragEnd: options.onDragEnd'), 'physics state must own a drag-end callback');
  assert.ok(
    (physics.match(/typeof state\.onDragEnd === 'function'/g) || []).length >= 2,
    'pointer up and pointer cancel must both notify drag completion',
  );
  assert.match(
    magnets,
    /onDragEnd:\s*\(\) => \{[\s\S]*?updateLayout\(state\);[\s\S]*?persistLayout\(state, true\);[\s\S]*?\}/,
    'drag completion must flush the canonical layout immediately',
  );
  assert.match(
    magnets,
    /if \(immediate\) \{[\s\S]*?clearTimeout\(state\.saveTimer\)[\s\S]*?flush\(\);/,
    'an immediate drag save must cancel any stale throttled save first',
  );
});

test('journal save reset preserves confirmation and does not refocus an empty draft', () => {
  const moduleSource = read('assets/js/journal/module.js');
  const inventory = read('scripts/inventory.js');

  assert.ok(
    moduleSource.includes('resetForm({ keepStatus = false, focusNotes = true } = {})'),
    'shared Journal form reset must expose save-safe status/focus options',
  );
  assert.ok(
    moduleSource.includes('if (this.statusEl && !keepStatus)'),
    'save-safe reset must preserve an existing confirmation',
  );
  assert.match(
    moduleSource,
    /if \(focusNotes\) \{[\s\S]*?this\.notesInput\.focus\(\);[\s\S]*?\} else \{[\s\S]*?this\.notesInput\.blur\(\);/,
    'successful save may dismiss the blank editor instead of refocusing it',
  );
  assert.ok(
    inventory.includes("Saved ✓ Your entry is in Journal History below. The form is ready for a new entry."),
    'new-entry save must leave an explicit visible explanation of what happened',
  );
  assert.ok(
    inventory.includes('resetJournalForm({ keepStatus: true, focusNotes: false });'),
    'new-entry save must use the save-safe reset contract',
  );
  assert.match(
    inventory,
    /state\.journalOverlayOpen[\s\S]*?state\.journalOverlayHistoryEl[\s\S]*?state\.journalHistoryEl/,
    'saved-entry focus must prefer the visible overlay history when the overlay is open',
  );
});
''', encoding='utf-8')

print('Prepared manual-magnet persistence and Journal save-feedback repairs.')
