import { spawnSync } from 'node:child_process';

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
  throw new Error(`Unknown workflow output mode: ${mode || '(missing)'}`);
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Command failed: ${command}`);
  }
  return result.stdout;
}

const changed = capture('git', ['diff', '--name-only', '-z'])
  .split('\0')
  .filter(Boolean);
const untracked = capture('git', ['ls-files', '--others', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean);
const files = Array.from(new Set([...changed, ...untracked]));
const allowed = allowedByMode[mode];
const unexpected = files.filter((file) => !allowed.some((prefix) => file === prefix || file.startsWith(prefix)));

if (unexpected.length) {
  console.error(`Workflow produced files outside its allowed ${mode} output scope:`);
  unexpected.forEach((file) => console.error(`  - ${file}`));
  process.exit(1);
}

console.log(`Verified workflow output scope (${mode}): ${files.length} changed file(s).`);
