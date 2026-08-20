import test from 'node:test';
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
  const names = (await fs.readdir(workflowsDir)).filter((name) => /\.ya?ml$/.test(name));
  for (const name of names) {
    const source = await workflow(name);
    if (!/contents:\s*write/.test(source)) continue;
    assert.ok(source.includes('concurrency:'), `${name} must define concurrency`);
    assert.ok(!source.includes('git add -A'), `${name} must not stage the entire repository`);
    assert.ok(!source.includes('git push --force'), `${name} must never force-push`);
    assert.ok(!source.includes('finalize-static-assets.mjs'), `${name} must not depend on a post-generator finalizer`);
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
