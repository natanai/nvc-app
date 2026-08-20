import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const mode = process.argv[2] || 'full';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', encoding: 'utf8' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Command failed: ${command}`);
  }
  return result.stdout;
}

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function captureWorkingState() {
  const untrackedFiles = capture('git', ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .sort();

  return JSON.stringify({
    unstagedDiff: capture('git', ['diff', '--binary', '--no-ext-diff']),
    stagedDiff: capture('git', ['diff', '--cached', '--binary', '--no-ext-diff']),
    untracked: untrackedFiles.map((file) => [file, hashFile(file)]),
  });
}

const before = captureWorkingState();

if (mode === 'full') {
  run(npm, ['run', 'build:data']);
  run(npm, ['run', 'build:pages']);
} else if (mode === 'feelings') {
  run(npm, ['run', 'build:data']);
  run(process.execPath, ['scripts/build-pages.mjs', '--scope=feelings,faux-feelings']);
} else if (mode === 'observation-guide') {
  run(process.execPath, ['scripts/build-pages.mjs', '--scope=observation-guide']);
} else {
  throw new Error(`Unknown idempotency mode: ${mode}`);
}

const after = captureWorkingState();
if (after !== before) {
  console.error('Build is not idempotent: running the same generator again changed the working tree.');
  run('git', ['status', '--short']);
  process.exit(1);
}

console.log(`Verified ${mode} build idempotency, including untracked outputs.`);
