import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const OUTPUTS = {
  index: 'data/index.json',
  'body-regions': 'data/body-regions.json',
  'reverse-inference': 'data/reverse-inference.json',
};

function parseScope(argv) {
  let raw = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--scope') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) throw new Error('Missing value for --scope option.');
      raw = value;
      index += 1;
    } else if (arg.startsWith('--scope=')) {
      raw = arg.slice('--scope='.length);
    }
  }

  if (!raw || raw.trim().toLowerCase() === 'all') {
    return new Set(Object.keys(OUTPUTS));
  }

  const scopes = raw.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const invalid = scopes.filter((scope) => !Object.hasOwn(OUTPUTS, scope));
  if (invalid.length) {
    throw new Error(`Unknown data scope(s): ${invalid.join(', ')}. Valid scopes: all, ${Object.keys(OUTPUTS).join(', ')}`);
  }
  return new Set(scopes);
}

function normalizedRelative(path) {
  return path.split(sep).join('/');
}

function copyRepository(stageRoot) {
  cpSync(rootDir, stageRoot, {
    recursive: true,
    filter(source) {
      const rel = normalizedRelative(relative(rootDir, source));
      if (!rel) return true;
      if (rel === '.git' || rel.startsWith('.git/')) return false;
      if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
      return true;
    },
  });
}

function runScript(stageRoot, relativeScript) {
  const result = spawnSync(process.execPath, [join(stageRoot, relativeScript)], {
    cwd: stageRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${relativeScript} exited with status ${result.status}`);
}

const scopes = parseScope(process.argv.slice(2));
const stageParent = mkdtempSync(join(tmpdir(), 'allneeds-data-'));
const stageRoot = join(stageParent, 'repo');

try {
  copyRepository(stageRoot);

  // The canonical compiler reads the editable data sources (including the
  // Body Cues rows in data/Feelings.csv) in an isolated workspace. Only the
  // explicitly requested outputs are allowed back into the real repository.
  runScript(stageRoot, 'scripts/build-data.mjs');

  for (const scope of scopes) {
    const relativePath = OUTPUTS[scope];
    const stagedPath = join(stageRoot, relativePath);
    if (!existsSync(stagedPath)) throw new Error(`Generator did not produce declared data output: ${relativePath}`);
    const destination = join(rootDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(stagedPath, destination, { force: true });
  }

  console.log(`Published ${scopes.size} ownership-declared data output${scopes.size === 1 ? '' : 's'} from isolated staging.`);
} finally {
  rmSync(stageParent, { recursive: true, force: true });
}
