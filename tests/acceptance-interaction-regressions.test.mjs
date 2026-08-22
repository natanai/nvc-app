import assert from 'node:assert/strict';
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


test('restored category hub layouts keep manual overlap instead of reseeding the board', () => {
  const magnets = read('scripts/magnets.js');

  assert.ok(
    magnets.includes('const resolveFixedObstacleOverlaps = (state, { allowReseed = true } = {}) => {'),
    'fixed-obstacle repair must be able to preserve a restored user layout without global reseeding',
  );
  assert.ok(
    magnets.includes('if (allowReseed && (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state)))'),
    'global repacking must be explicitly opt-in at the obstacle resolver',
  );
  assert.ok(
    !magnets.includes("if (!isNavBoardState(state) && (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state))) {\n      shouldSeed = true;"),
    'a restored category hub must not discard all saved coordinates just because magnets overlap',
  );
  assert.match(
    magnets,
    /state\.lastLayoutType = 'restored';[\s\S]*?layoutHasFixedObstacleOverlap\(state\)[\s\S]*?resolveFixedObstacleOverlaps\(state, \{ allowReseed: false \}\)/,
    'restored category hubs may repair the fixed toggle locally without repacking every magnet',
  );
});
