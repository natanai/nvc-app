import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('entrypoint linter understands cache-busted browser URLs', async () => {
  const linter = await fs.readFile(path.join(root, 'scripts/lint-entrypoints.mjs'), 'utf8');
  assert.ok(linter.includes('stripBrowserUrlSuffix'));

  const result = spawnSync(process.execPath, ['scripts/lint-entrypoints.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    `Entrypoint lint failed.\nstdout:\n${result.stdout || ''}\nstderr:\n${result.stderr || ''}`,
  );
});
