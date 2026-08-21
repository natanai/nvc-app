from pathlib import Path


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


pages_path = Path('scripts/build-pages.mjs')
pages = pages_path.read_text(encoding='utf-8')

pages = replace_exact(
    pages,
    "import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';",
    "import { readFileSync, writeFileSync, mkdirSync } from 'fs';",
    'fs import',
)

pages = replace_exact(
    pages,
    """const DEFAULT_SCOPES = [
  'home',
  'faux-feelings',
  'feelings',
  'needs',
  'inventory',
  'observation-guide',
  'support-lane',
];

""",
    '',
    'default scopes used only by directory reset',
)

pages = replace_exact(
    pages,
    """const DIRECTORIES_BY_SCOPE = new Map([
  ['faux-feelings', ['faux-feelings']],
  ['feelings', ['feelings']],
  ['needs', ['needs']],
  ['inventory', ['inventory']],
]);

""",
    '',
    'directory reset ownership map',
)

pages = replace_exact(
    pages,
    """const requestedScopes = parseScopeArgs(process.argv.slice(2));
const activeScopes = requestedScopes ? Array.from(requestedScopes) : DEFAULT_SCOPES;
const directoriesToResetSet = new Set();

for (const scope of activeScopes) {
  const directories = DIRECTORIES_BY_SCOPE.get(scope);
  if (!directories) {
    continue;
  }
  for (const directory of directories) {
    directoriesToResetSet.add(directory);
  }
}

const directoriesToReset = Array.from(directoriesToResetSet);

""",
    "const requestedScopes = parseScopeArgs(process.argv.slice(2));\n\n",
    'directory reset preparation',
)

pages = replace_exact(
    pages,
    """for (const dir of directoriesToReset) {
  rmSync(join(rootDir, dir), { recursive: true, force: true });
}

""",
    '',
    'recursive directory reset',
)

pages_path.write_text(pages, encoding='utf-8')

safe_path = Path('scripts/build-pages-safe.mjs')
safe = safe_path.read_text(encoding='utf-8')
safe = replace_exact(
    safe,
    """  // The legacy generator is intentionally destructive inside its workspace.
  // Run it only in an isolated staging copy, then publish exactly the files the
  // selected scopes own. Existing pages also retain their already-tested order
  // for the two deferred shell scripts rather than changing boot sequencing as
  // a side effect of an unrelated rebuild.
""",
    """  // The page compiler now preserves mixed-ownership route directories. This
  // staging publisher remains temporarily only to shield production pages from
  // historical serialization/script-order differences while those are moved
  // into one canonical compiler output.
""",
    'safe-builder transition comment',
)
safe_path.write_text(safe, encoding='utf-8')

print('Removed recursive mixed-ownership directory resets from the page compiler.')
