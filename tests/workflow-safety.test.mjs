import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = path.join(root, '.github/workflows');
const SHARED_WRITE_LOCK = 'group: nvc-app-write-${{ inputs.target_branch }}';

async function workflow(name) {
  return fs.readFile(path.join(workflowsDir, name), 'utf8');
}

async function workflowNames() {
  return (await fs.readdir(workflowsDir)).filter((name) => /\.ya?ml$/.test(name));
}

test('write workflows use one branch-scoped lock and bounded staging', async () => {
  for (const name of await workflowNames()) {
    const source = await workflow(name);
    if (!/contents:\s*write/.test(source)) continue;

    assert.ok(source.includes('concurrency:'), `${name} must define concurrency`);
    assert.ok(source.includes(SHARED_WRITE_LOCK), `${name} must share the branch-scoped write lock`);
    assert.ok(source.includes('cancel-in-progress: false'), `${name} must queue rather than cancel writes`);
    assert.ok(!source.includes('git add -A'), `${name} must not stage the entire repository`);
    assert.ok(!source.includes('git add .'), `${name} must not stage the entire repository`);
    assert.ok(!source.includes('git push --force'), `${name} must never force-push`);
    assert.ok(!source.includes('finalize-static-assets.mjs'), `${name} must not depend on a post-generator finalizer`);
  }
});

test('official GitHub actions do not regress to deprecated Node 20 runtimes', async () => {
  for (const name of await workflowNames()) {
    const source = await workflow(name);
    assert.ok(!source.includes('actions/checkout@v4'), `${name} must not use checkout v4`);
    assert.ok(!source.includes('actions/setup-node@v4'), `${name} must not use setup-node v4`);
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
      assert.ok(source.includes(token), `${name} is missing safety gate: ${token}`);
    }
  }
});

test('site quality validates generator and workflow contracts', async () => {
  const source = await workflow('site-quality-checks.yml');
  assert.ok(source.includes('npm run test:generator-stability'));
  assert.ok(source.includes('npm run test:workflow-safety'));
  assert.ok(source.includes('node tests/shared-density-polish.test.mjs'));
  assert.ok(source.includes('node tests/body-cues-static-first.test.mjs'));
});
