import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
const VALID_MODES = new Set([
  'site-rebuild',
  'fact-checking',
  'strategy-import',
  'push-poems',
  'observation-guide',
]);

if (!VALID_MODES.has(mode)) {
  throw new Error(`Unknown workflow output mode: ${mode || '(missing)'}`);
}

const GENERATED_DATA_FILES = new Set([
  'data/index.json',
  'data/body-regions.json',
  'data/reverse-inference.json',
]);

const FACT_CHECKING_SOURCE_FILES = new Set([
  'data/Needs.csv',
  'data/Feelings.csv',
  'data/Faux Feelings.csv',
  'data/Strategies.csv',
  'data/color-palettes.csv',
  'data/observation_taxonomy.json',
  'data/observation_lexicon.json',
  'data/observation_need_templates.json',
  'data/observation_module_blueprints.json',
  'data/observation_detector_stats.json',
  'data/observation-guide.json',
  '_evidence/citations.csv',
  '_evidence/citations.json',
]);

const PROTECTED_STATIC_PREFIXES = [
  'feelings/emotions-wheel/',
];

function isGeneratedHtml(file) {
  if (file === 'index.html') return true;
  if (file === 'alexithymia-support/index.html') return true;
  if (file === 'observations/index.html') return true;
  if (file === 'inventory/index.html' || file === 'inventory/journal/index.html') return true;
  if (/^(?:faux-feelings|needs)\/[^/]+\/index\.html$/.test(file)) return true;
  if (file === 'faux-feelings/index.html' || file === 'needs/index.html') return true;
  if (/^feelings\/[^/]+\/index\.html$/.test(file) && !file.startsWith('feelings/emotions-wheel/')) return true;
  if (file === 'feelings/index.html') return true;
  return false;
}

function isFeelingsHtml(file) {
  if (file === 'faux-feelings/index.html' || /^faux-feelings\/[^/]+\/index\.html$/.test(file)) return true;
  if (file === 'feelings/index.html') return true;
  return /^feelings\/[^/]+\/index\.html$/.test(file) && !file.startsWith('feelings/emotions-wheel/');
}

function isAllowed(file) {
  if (PROTECTED_STATIC_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return false;
  }

  if (mode === 'site-rebuild') {
    return GENERATED_DATA_FILES.has(file) || isGeneratedHtml(file);
  }

  if (mode === 'strategy-import') {
    return file === 'data/Strategies.csv' || GENERATED_DATA_FILES.has(file) || isGeneratedHtml(file);
  }

  if (mode === 'push-poems') {
    return GENERATED_DATA_FILES.has(file) || isFeelingsHtml(file);
  }

  if (mode === 'observation-guide') {
    return file === 'observations/index.html';
  }

  return FACT_CHECKING_SOURCE_FILES.has(file) || GENERATED_DATA_FILES.has(file) || isGeneratedHtml(file);
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Command failed: ${command}`);
  }
  return result.stdout;
}

const unstaged = capture('git', ['diff', '--name-only', '-z'])
  .split('\0')
  .filter(Boolean);
const staged = capture('git', ['diff', '--cached', '--name-only', '-z'])
  .split('\0')
  .filter(Boolean);
const untracked = capture('git', ['ls-files', '--others', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean);
const files = Array.from(new Set([...unstaged, ...staged, ...untracked])).sort();
const unexpected = files.filter((file) => !isAllowed(file));

if (unexpected.length) {
  console.error(`Workflow produced files outside its allowed ${mode} output scope:`);
  unexpected.forEach((file) => console.error(`  - ${file}`));
  process.exit(1);
}

console.log(`Verified workflow output scope (${mode}): ${files.length} changed file(s).`);
