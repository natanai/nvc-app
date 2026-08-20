import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function pathFor(rel) {
  return join(root, rel);
}

function read(rel) {
  return readFileSync(pathFor(rel), 'utf8');
}

function write(rel, content) {
  writeFileSync(pathFor(rel), content, 'utf8');
}

function replaceOnce(rel, before, after) {
  const source = read(rel);
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(`Expected text not found in ${rel}: ${before.slice(0, 100)}`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected text appears more than once in ${rel}: ${before.slice(0, 100)}`);
  }
  write(rel, source.slice(0, first) + after + source.slice(first + before.length));
}

const builder = 'scripts/build-pages.mjs';
replaceOnce(
  builder,
  "import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';",
  "import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'fs';",
);
replaceOnce(
  builder,
  "const DIRECTORIES_BY_SCOPE = new Map([\n  ['faux-feelings', ['faux-feelings']],\n  ['feelings', ['feelings']],\n  ['needs', ['needs']],\n  ['inventory', ['inventory']],\n]);",
  "const DIRECTORIES_BY_SCOPE = new Map([\n  ['faux-feelings', ['faux-feelings']],\n  ['feelings', ['feelings']],\n  ['needs', ['needs']],\n  ['inventory', ['inventory']],\n]);\n\n// These live inside otherwise generated directories but are maintained as\n// standalone static features. A rebuild must never delete them.\nconst PRESERVED_STATIC_ENTRIES_BY_DIRECTORY = new Map([\n  ['feelings', new Set(['emotions-wheel'])],\n]);",
);
replaceOnce(
  builder,
  "for (const dir of directoriesToReset) {\n  rmSync(join(rootDir, dir), { recursive: true, force: true });\n}",
  "function resetGeneratedDirectory(dir) {\n  const directoryPath = join(rootDir, dir);\n  const preservedEntries = PRESERVED_STATIC_ENTRIES_BY_DIRECTORY.get(dir);\n\n  if (!preservedEntries || preservedEntries.size === 0) {\n    rmSync(directoryPath, { recursive: true, force: true });\n    return;\n  }\n\n  if (!existsSync(directoryPath)) {\n    return;\n  }\n\n  for (const entry of readdirSync(directoryPath)) {\n    if (preservedEntries.has(entry)) {\n      continue;\n    }\n    rmSync(join(directoryPath, entry), { recursive: true, force: true });\n  }\n}\n\nfor (const dir of directoriesToReset) {\n  resetGeneratedDirectory(dir);\n}",
);
replaceOnce(builder, "submitLabel: '💾 Save to device',", "submitLabel: 'Save to device',");
replaceOnce(
  builder,
  "function buildPersonalStrategyNotice(basePath, suffix = '') {\n  const safeSuffix = suffix ? ` ${suffix}` : '';\n  return `<p class=\"strategy-form__notice\">Personal strategies you add stay on this browser. Visit the <a href=\"${basePath}inventory/\">inventory screen</a> to export them if you would like a backup.${safeSuffix}</p>`;\n}",
  "function buildPersonalStrategyNotice() {\n  return '<p class=\"strategy-form__notice\">Backup, restore, and account sync are in Menu → Account &amp; data.</p>';\n}",
);
replaceOnce(
  builder,
  '<h2 id=\"journal-form-heading\" class=\"section-title\">Log a new entry</h2>',
  '<h2 id=\"journal-form-heading\" class=\"section-title\">New entry</h2>',
);
replaceOnce(
  builder,
  '<p class=\"journal-form-section__hint\">Tag what\'s present right now. Unsure of the feeling? Leave it blank and lean on the notes.</p>',
  '<p class=\"journal-form-section__hint\">Tag what’s present now. Feeling optional—notes are enough.</p>',
);

const packageJson = JSON.parse(read('package.json'));
packageJson.scripts['build:pages'] = 'node scripts/build-pages.mjs';
packageJson.scripts['test:generator-stability'] = 'node tests/generator-source-of-truth.test.mjs';
packageJson.scripts['test:workflow-safety'] = 'node tests/workflow-safety.test.mjs';
packageJson.scripts['verify:build-idempotent'] = 'node scripts/verify-build-idempotency.mjs full';
packageJson.scripts['verify:feelings-idempotent'] = 'node scripts/verify-build-idempotency.mjs feelings';
packageJson.scripts['verify:observation-idempotent'] = 'node scripts/verify-build-idempotency.mjs observation-guide';
packageJson.scripts['guard:workflow-output'] = 'node scripts/check-workflow-output-scope.mjs';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

write('scripts/verify-build-idempotency.mjs', `import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || 'full';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', encoding: 'utf8' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function captureGitDiff() {
  const result = spawnSync('git', ['diff', '--binary', '--no-ext-diff'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Unable to read git diff');
  }
  return result.stdout;
}

const before = captureGitDiff();

if (mode === 'full') {
  run(npm, ['run', 'build:data']);
  run(npm, ['run', 'build:pages']);
} else if (mode === 'feelings') {
  run(npm, ['run', 'build:data']);
  run(process.execPath, ['scripts/build-pages.mjs', '--scope=feelings,faux-feelings']);
} else if (mode === 'observation-guide') {
  run(process.execPath, ['scripts/build-pages.mjs', '--scope=observation-guide']);
} else {
  throw new Error(\`Unknown idempotency mode: \${mode}\`);
}

const after = captureGitDiff();
if (after !== before) {
  console.error('Build is not idempotent: running the same generator again changed the working tree.');
  run('git', ['status', '--short']);
  process.exit(1);
}

console.log(\`Verified \${mode} build idempotency.\`);
`);

write('scripts/check-workflow-output-scope.mjs', `import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
const GENERATED_SITE_PREFIXES = [
  'data/',
  'index.html',
  'alexithymia-support/',
  'faux-feelings/',
  'feelings/',
  'needs/',
  'inventory/',
  'observations/',
];

const allowedByMode = {
  'site-rebuild': GENERATED_SITE_PREFIXES,
  'fact-checking': GENERATED_SITE_PREFIXES,
  'strategy-import': GENERATED_SITE_PREFIXES,
  'push-poems': ['data/', 'feelings/', 'faux-feelings/'],
  'observation-guide': ['observations/index.html'],
};

if (!allowedByMode[mode]) {
  throw new Error(\`Unknown workflow output mode: \${mode || '(missing)'}\`);
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || \`Command failed: \${command}\`);
  }
  return result.stdout;
}

const changed = capture('git', ['diff', '--name-only', '-z'])
  .split('\\0')
  .filter(Boolean);
const untracked = capture('git', ['ls-files', '--others', '--exclude-standard', '-z'])
  .split('\\0')
  .filter(Boolean);
const files = Array.from(new Set([...changed, ...untracked]));
const allowed = allowedByMode[mode];
const unexpected = files.filter((file) => !allowed.some((prefix) => file === prefix || file.startsWith(prefix)));

if (unexpected.length) {
  console.error(\`Workflow produced files outside its allowed \${mode} output scope:\`);
  unexpected.forEach((file) => console.error(\`  - \${file}\`));
  process.exit(1);
}

console.log(\`Verified workflow output scope (\${mode}): \${files.length} changed file(s).\`);
`);

write('tests/generator-source-of-truth.test.mjs', `import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function text(rel) {
  return fs.readFile(path.join(root, rel), 'utf8');
}

test('build-pages is the single source of truth for generated UI', async () => {
  const packageJson = JSON.parse(await text('package.json'));
  const builder = await text('scripts/build-pages.mjs');

  assert.equal(packageJson.scripts['build:pages'], 'node scripts/build-pages.mjs');
  await assert.rejects(fs.access(path.join(root, 'scripts/finalize-static-assets.mjs')), { code: 'ENOENT' });
  assert.ok(builder.includes("submitLabel: 'Save to device'"));
  assert.ok(!builder.includes('💾 Save to device'));
  assert.ok(builder.includes('Backup, restore, and account sync are in Menu → Account &amp; data.'));
  assert.ok(!builder.includes('Personal strategies you add stay on this browser.'));
  assert.ok(builder.includes('<h2 id=\\"journal-form-heading\\" class=\\"section-title\\">New entry</h2>'));
  assert.ok(builder.includes('Tag what’s present now. Feeling optional—notes are enough.'));
});

test('generated directory resets preserve standalone static features', async () => {
  const builder = await text('scripts/build-pages.mjs');
  assert.ok(builder.includes('PRESERVED_STATIC_ENTRIES_BY_DIRECTORY'));
  assert.ok(builder.includes("['feelings', new Set(['emotions-wheel'])]"));
  assert.ok(builder.includes('resetGeneratedDirectory(dir)'));
  assert.ok(!builder.includes("for (const dir of directoriesToReset) {\\n  rmSync(join(rootDir, dir), { recursive: true, force: true });\\n}"));
  await fs.access(path.join(root, 'feelings/emotions-wheel/index.html'));
});

test('checked-in generated artifacts match the generator contract', async () => {
  const needHtml = await text('needs/acceptance/index.html');
  const inventoryHtml = await text('inventory/index.html');
  const journalHtml = await text('inventory/journal/index.html');
  const feedHtml = await text('feed/index.html');

  assert.ok(needHtml.includes('>Save to device</button>'));
  assert.ok(!needHtml.includes('💾 Save to device'));
  assert.ok(inventoryHtml.includes('Backup, restore, and account sync are in Menu → Account &amp; data.'));
  assert.ok(journalHtml.includes('>New entry</h2>'));
  assert.ok(journalHtml.includes('Tag what’s present now. Feeling optional—notes are enough.'));
  assert.ok(feedHtml.includes('<h1 class=\\"page-title\\">Shared strategies</h1>'));
  assert.ok(!feedHtml.includes('Pull strategies'));
});
`);

write('tests/workflow-safety.test.mjs', `import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = path.join(root, '.github/workflows');

async function workflow(name) {
  return fs.readFile(path.join(workflowsDir, name), 'utf8');
}

test('write workflows use bounded staging and concurrency', async () => {
  const names = (await fs.readdir(workflowsDir)).filter((name) => /\\.ya?ml$/.test(name));
  for (const name of names) {
    const source = await workflow(name);
    if (!/contents:\\s*write/.test(source)) continue;
    assert.ok(source.includes('concurrency:'), \`\${name} must define concurrency\`);
    assert.ok(!source.includes('git add -A'), \`\${name} must not stage the entire repository\`);
    assert.ok(!source.includes('git push --force'), \`\${name} must never force-push\`);
    assert.ok(!source.includes('finalize-static-assets.mjs'), \`\${name} must not depend on a post-generator finalizer\`);
  }
});

test('site-mutating workflows verify idempotency and output scope before commit', async () => {
  const expectations = {
    'rebuild-site.yml': ['verify:build-idempotent', 'guard:workflow-output -- site-rebuild'],
    'fact-checking-import.yml': ['verify:build-idempotent', 'guard:workflow-output -- fact-checking'],
    'strategy-importer.yml': ['verify:build-idempotent', 'guard:workflow-output -- strategy-import'],
    'push-poems.yml': ['verify:feelings-idempotent', 'guard:workflow-output -- push-poems'],
    'observation-guide-builder.yml': ['verify:observation-idempotent', 'guard:workflow-output -- observation-guide'],
  };

  for (const [name, required] of Object.entries(expectations)) {
    const source = await workflow(name);
    for (const token of required) {
      assert.ok(source.includes(token), \`\${name} is missing safety gate: \${token}\`);
    }
  }
});
`);

const oldSharedTest = read('tests/shared-density-polish.test.mjs');
const replacementSharedTest = oldSharedTest
  .replace(
    /test\('build pipeline writes final user-facing static markup before deployment',[\s\S]*?\n\}\);\n\n/,
    '',
  )
  .replace(
    /test\('shared strategies behavior is feed-first without repairing static chrome in JS',[\s\S]*?\n\}\);\n?$/,
    `test('shared strategies behavior is feed-first without repairing static chrome in JS', async () => {\n  const feed = await fs.readFile(path.join(root, 'scripts/strategy-feed.js'), 'utf8');\n\n  assert.ok(feed.includes(\"addButton.textContent = 'Save to inventory'\"));\n  assert.ok(feed.includes('await fetchAndRenderFeed();'));\n  assert.ok(feed.includes(\"state.scopeSelect?.addEventListener('change'\"));\n  assert.ok(feed.includes(\"state.sortSelect?.addEventListener('change', fetchAndRenderFeed)\"));\n  assert.ok(!feed.includes('[data-feed-follows-check]'));\n  assert.ok(!feed.includes('[data-feed-fetch]'));\n});\n`,
  );
write('tests/shared-density-polish.test.mjs', replacementSharedTest);

function insertAfter(rel, marker, insertion) {
  replaceOnce(rel, marker, marker + insertion);
}

insertAfter(
  '.github/workflows/rebuild-site.yml',
  "      - name: Rebuild dataset and pages\n        run: |\n          npm run build:data\n          npm run build:pages\n",
  "\n      - name: Verify rebuild stability and scope\n        run: |\n          npm run verify:build-idempotent\n          npm run guard:workflow-output -- site-rebuild\n          npm run test:generator-stability\n",
);
replaceOnce(
  '.github/workflows/rebuild-site.yml',
  '          git add -A\n',
  '          git add data index.html alexithymia-support faux-feelings feelings needs inventory observations\n',
);

insertAfter(
  '.github/workflows/fact-checking-import.yml',
  "      - name: Propagate citation updates and rebuild site artifacts\n        run: |\n          npm run replace:needs-sources\n          npm run build:data\n          npm run build:pages\n",
  "\n      - name: Verify generated output stability and scope\n        run: |\n          npm run verify:build-idempotent\n          npm run guard:workflow-output -- fact-checking\n          npm run test:generator-stability\n          npm run test:data-integrity\n",
);
replaceOnce(
  '.github/workflows/fact-checking-import.yml',
  '          git add -A\n',
  '          git add data index.html alexithymia-support faux-feelings feelings needs inventory observations\n',
);

insertAfter(
  '.github/workflows/strategy-importer.yml',
  "      - name: Rebuild data and pages\n        if: steps.import.outputs.changes == 'true'\n        run: |\n          npm run build:data\n          npm run build:pages\n",
  "\n      - name: Verify generated output stability and scope\n        if: steps.import.outputs.changes == 'true'\n        run: |\n          npm run verify:build-idempotent\n          npm run guard:workflow-output -- strategy-import\n          npm run test:generator-stability\n          npm run test:data-integrity\n",
);
replaceOnce(
  '.github/workflows/strategy-importer.yml',
  '          git add -A\n',
  '          git add data index.html alexithymia-support faux-feelings feelings needs inventory observations\n',
);

replaceOnce(
  '.github/workflows/push-poems.yml',
  "        run: |\n          node scripts/build-pages.mjs --scope=feelings,faux-feelings\n          node scripts/finalize-static-assets.mjs\n",
  "        run: node scripts/build-pages.mjs --scope=feelings,faux-feelings\n",
);
insertAfter(
  '.github/workflows/push-poems.yml',
  "      - name: Rebuild feelings pages\n        if: ${{ inputs.run_build_pages != 'false' }}\n        run: node scripts/build-pages.mjs --scope=feelings,faux-feelings\n",
  "\n      - name: Verify poem rebuild stability and scope\n        run: |\n          npm run verify:feelings-idempotent\n          npm run guard:workflow-output -- push-poems\n          npm run test:generator-stability\n",
);
replaceOnce(
  '.github/workflows/push-poems.yml',
  '          git add -A\n',
  '          git add data feelings faux-feelings\n',
);

insertAfter(
  '.github/workflows/observation-guide-builder.yml',
  "      - name: Rebuild observation guide page\n        run: node scripts/build-pages.mjs --scope=observation-guide\n",
  "\n      - name: Verify observation rebuild stability and scope\n        run: |\n          npm run verify:observation-idempotent\n          npm run guard:workflow-output -- observation-guide\n          npm run test:generator-stability\n",
);

insertAfter(
  '.github/workflows/site-quality-checks.yml',
  "      - name: Verify generated artifacts are committed\n        run: git diff --exit-code\n",
  "\n      - name: Verify generator source-of-truth\n        run: npm run test:generator-stability\n\n      - name: Verify workflow safety contracts\n        run: npm run test:workflow-safety\n\n      - name: Verify static-first UI contracts\n        run: |\n          node tests/shared-density-polish.test.mjs\n          node tests/body-cues-static-first.test.mjs\n          npm run test:home-regressions\n          npm run test:obsolete\n",
);

const finalizerPath = pathFor('scripts/finalize-static-assets.mjs');
if (existsSync(finalizerPath)) unlinkSync(finalizerPath);

// Remove the temporary migration machinery from the final branch state.
const workflowPath = pathFor('.github/workflows/_stability-migration.yml');
if (existsSync(workflowPath)) unlinkSync(workflowPath);
unlinkSync(import.meta.url.replace('file://', ''));

console.log('Applied generator source-of-truth and workflow stability migration.');
