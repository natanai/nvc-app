from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f'{label}: expected anchor not found')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


magnets = ROOT / 'scripts' / 'magnets.js'
replace_once(
    magnets,
    "const resolveFixedObstacleOverlaps = (state) => {\n",
    "const resolveFixedObstacleOverlaps = (state, { allowReseed = true } = {}) => {\n",
    'fixed-obstacle resolver options',
)
replace_once(
    magnets,
    """  if (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state)) {\n    applyRowPackedLayout(state, state.magnets, { persist: false });\n  } else {\n    updateLayout(state);\n  }\n  return true;\n};\n""",
    """  if (allowReseed && (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state))) {\n    applyRowPackedLayout(state, state.magnets, { persist: false });\n  } else {\n    updateLayout(state);\n  }\n  return true;\n};\n""",
    'fixed-obstacle resolver reseed policy',
)
replace_once(
    magnets,
    """    updateBoardHeight(state);\n    updateLayout(state);\n    state.lastLayoutType = 'restored';\n    if (!isNavBoardState(state) && (layoutHasOverlap(state) || layoutHasFixedObstacleOverlap(state))) {\n      shouldSeed = true;\n    }\n""",
    """    updateBoardHeight(state);\n    updateLayout(state);\n    state.lastLayoutType = 'restored';\n    if (!isNavBoardState(state) && layoutHasFixedObstacleOverlap(state)) {\n      resolveFixedObstacleOverlaps(state, { allowReseed: false });\n      updateLayout(state);\n    }\n""",
    'category hub restored-layout ownership',
)

test_path = ROOT / 'tests' / 'acceptance-interaction-regressions.test.mjs'
test_text = test_path.read_text(encoding='utf-8')
marker = "test('restored category hub layouts keep manual overlap instead of reseeding the board'"
if marker not in test_text:
    test_text += r'''

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
'''
    test_path.write_text(test_text, encoding='utf-8')

print('Prepared dense category-hub restore persistence fix.')
