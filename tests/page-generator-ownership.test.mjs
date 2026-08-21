import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function normalizeRelative(path) {
  return path.split(sep).join('/');
}

function copyRepository(stageRoot) {
  cpSync(root, stageRoot, {
    recursive: true,
    filter(source) {
      const rel = normalizeRelative(relative(root, source));
      if (!rel) return true;
      if (rel === '.git' || rel.startsWith('.git/')) return false;
      if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
      return true;
    },
  });
}

test('page compiler contains no recursive mixed-ownership route reset', () => {
  const source = readFileSync(join(root, 'scripts', 'build-pages.mjs'), 'utf8');

  assert.ok(!source.includes('DIRECTORIES_BY_SCOPE'), 'route ownership must not be expressed as directories to wipe');
  assert.ok(!source.includes('directoriesToReset'), 'page generation must not prepare recursive directory resets');
  assert.ok(
    !source.includes("rmSync(join(rootDir, dir), { recursive: true, force: true })"),
    'the compiler must never recursively delete a route directory before rebuilding it',
  );
});

test('scoped Feelings generation preserves files it does not own', () => {
  const parent = mkdtempSync(join(tmpdir(), 'allneeds-page-owner-test-'));
  const stage = join(parent, 'repo');

  try {
    copyRepository(stage);

    const sentinel = join(stage, 'feelings', '__bedrock-unowned__', 'keep.txt');
    mkdirSync(dirname(sentinel), { recursive: true });
    writeFileSync(sentinel, 'this file is not owned by the Feelings generator\n');

    const wheel = join(stage, 'feelings', 'emotions-wheel', 'index.html');
    assert.ok(existsSync(wheel), 'Emotions Wheel fixture must exist before the scoped generation test');
    const wheelBefore = readFileSync(wheel, 'utf8');

    const result = spawnSync(
      process.execPath,
      [join(stage, 'scripts', 'build-pages.mjs'), '--scope', 'feelings'],
      { cwd: stage, encoding: 'utf8' },
    );

    assert.equal(
      result.status,
      0,
      `scoped Feelings generation should succeed\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}`,
    );
    assert.equal(
      readFileSync(sentinel, 'utf8'),
      'this file is not owned by the Feelings generator\n',
      'a scoped build must leave unknown/unowned files inside a mixed-ownership route directory untouched',
    );
    assert.equal(
      readFileSync(wheel, 'utf8'),
      wheelBefore,
      'Feelings generation must not rewrite or delete the standalone Emotions Wheel route',
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
