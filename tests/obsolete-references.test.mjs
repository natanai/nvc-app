import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const rootDir = process.cwd();
const retiredFiles = [
  'scripts/build-pages-safe.mjs',
  'scripts/finalize-static-assets.mjs',
  'scripts/build-data-safe.mjs',
  'scripts/finalize-generated-data.mjs',
];
const retiredBasenames = retiredFiles.map((path) => path.split('/').pop());
const activeReferenceRoots = ['package.json', 'scripts', '.github/workflows'];
const searchableExtensions = new Set(['.js', '.mjs', '.json', '.yaml', '.yml']);

function collectSearchableFiles(path) {
  if (!existsSync(path)) {
    return [];
  }
  const stat = statSync(path);
  if (stat.isFile()) {
    return searchableExtensions.has(extname(path).toLowerCase()) || path.endsWith('package.json') ? [path] : [];
  }

  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSearchableFiles(child));
    } else if (entry.isFile() && searchableExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(child);
    }
  }
  return files;
}

for (const retired of retiredFiles) {
  assert.equal(existsSync(join(rootDir, retired)), false, `${retired} is retired Bedrock scaffolding and must stay deleted`);
}

const activeFiles = activeReferenceRoots.flatMap((entry) => collectSearchableFiles(join(rootDir, entry)));
for (const file of activeFiles) {
  const relativePath = relative(rootDir, file).replaceAll('\\', '/');
  const contents = readFileSync(file, 'utf8');
  for (const basename of retiredBasenames) {
    assert.equal(
      contents.includes(basename),
      false,
      `${relativePath} must not reactivate retired wrapper/finalizer ${basename}`
    );
  }
}

const migrationDir = join(rootDir, '.github', 'scripts');
if (existsSync(migrationDir)) {
  const leftovers = readdirSync(migrationDir).filter((name) => /^bedrock-(?:migrate|migration|flatten|font|stable)/i.test(name));
  assert.deepEqual(leftovers, [], `temporary Bedrock migration scripts must be removed after landing: ${leftovers.join(', ')}`);
}

const inventorySource = readFileSync(join(rootDir, 'scripts', 'inventory.js'), 'utf8');
assert.equal(
  inventorySource.includes('#journal-dashboard'),
  false,
  'the legacy Journal hash must not drift back into the shared Inventory controller'
);

const redirectSource = readFileSync(join(rootDir, 'scripts', 'inventory-legacy-journal-redirect.js'), 'utf8');
assert.equal(
  redirectSource.includes('#journal-dashboard'),
  true,
  'the Inventory-only compatibility owner must retain the legacy Journal hash while compatibility is supported'
);

for (const file of collectSearchableFiles(join(rootDir, 'scripts'))) {
  const relativePath = relative(rootDir, file).replaceAll('\\', '/');
  if (relativePath === 'scripts/inventory-legacy-journal-redirect.js') {
    continue;
  }
  const contents = readFileSync(file, 'utf8');
  assert.equal(
    contents.includes('#journal-dashboard'),
    false,
    `${relativePath} must not become a second owner of the legacy Journal hash`
  );
}

console.log(
  `Bedrock tombstone guard passed: ${retiredFiles.length} retired build layers stay deleted, no temporary migration scripts remain, and the legacy Journal hash has one runtime owner.`
);
