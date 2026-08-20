import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = path.join(root, '.github/workflows');
const EXPECTED_WORKFLOWS = ['site-maintenance.yml', 'site-quality-checks.yml'];
const SHARED_WRITE_LOCK = 'group: nvc-app-write-${{ inputs.target_branch }}';

async function workflow(name) {
  return fs.readFile(path.join(workflowsDir, name), 'utf8');
}

async function workflowNames() {
  return (await fs.readdir(workflowsDir))
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();
}

test('the repository exposes only one automatic workflow and one manual maintenance workflow', async () => {
  assert.deepEqual(await workflowNames(), EXPECTED_WORKFLOWS);

  const quality = await workflow('site-quality-checks.yml');
  const maintenance = await workflow('site-maintenance.yml');

  assert.ok(quality.includes('pull_request:'));
  assert.ok(quality.includes('workflow_dispatch:'));
  assert.ok(!quality.includes('\n  push:'), 'Site Quality must not run again after a PR is merged');
  assert.ok(!quality.includes('npm run lint:links'), 'external URL checks do not belong in merge CI');

  assert.ok(maintenance.includes('workflow_dispatch:'));
  assert.ok(!maintenance.includes('pull_request:'));
  assert.ok(!maintenance.includes('\n  push:'));
});

test('manual maintenance remains serialized and bounded', async () => {
  const source = await workflow('site-maintenance.yml');

  assert.ok(/contents:\s*write/.test(source));
  assert.ok(source.includes('concurrency:'));
  assert.ok(source.includes(SHARED_WRITE_LOCK));
  assert.ok(source.includes('cancel-in-progress: false'));
  assert.ok(!source.includes('git add -A'));
  assert.ok(!source.includes('git add .'));
  assert.ok(!source.includes('git push --force'));
  assert.ok(!source.includes('finalize-static-assets.mjs'));

  const requiredTasks = [
    'rebuild-site',
    'export-fact-checking',
    'apply-fact-checking',
    'rebuild-observation-guide',
    'publish-poems',
    'import-strategies',
  ];
  for (const task of requiredTasks) {
    assert.ok(source.includes(`- ${task}`), `Site Maintenance is missing task: ${task}`);
  }

  const requiredGuards = [
    'guard:workflow-output -- site-rebuild',
    'guard:workflow-output -- fact-checking-export',
    'guard:workflow-output -- fact-checking',
    'guard:workflow-output -- observation-guide',
    'guard:workflow-output -- push-poems',
    'guard:workflow-output -- strategy-import',
  ];
  for (const guard of requiredGuards) {
    assert.ok(source.includes(guard), `Site Maintenance is missing safety gate: ${guard}`);
  }
});

test('official GitHub actions use current Node 24-based action runtimes', async () => {
  for (const name of await workflowNames()) {
    const source = await workflow(name);
    assert.ok(source.includes('actions/checkout@v7'), `${name} must use checkout v7`);
    assert.ok(source.includes('actions/setup-node@v7'), `${name} must use setup-node v7`);
    assert.ok(!source.includes('actions/checkout@v4'));
    assert.ok(!source.includes('actions/setup-node@v4'));
  }
});

test('site quality reports actionable repository invariants', async () => {
  const source = await workflow('site-quality-checks.yml');
  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

  assert.ok(!packageJson.scripts.build.includes('lint:links'));
  assert.ok(packageJson.scripts['lint:links'], 'external link audit must remain available on demand');
  assert.ok(source.includes('npm run verify:build-idempotent'));
  assert.ok(source.includes('npm run test:architecture'));
  assert.ok(source.includes('npm run test:content-integrity'));
  assert.ok(source.includes('npm run test:ui-regressions'));
  assert.ok(source.includes('git status --porcelain'));
});
