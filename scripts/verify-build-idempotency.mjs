import { spawnSync } from 'node:child_process';

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
  throw new Error(`Unknown idempotency mode: ${mode}`);
}

const after = captureGitDiff();
if (after !== before) {
  console.error('Build is not idempotent: running the same generator again changed the working tree.');
  run('git', ['status', '--short']);
  process.exit(1);
}

console.log(`Verified ${mode} build idempotency.`);
