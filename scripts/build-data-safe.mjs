import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const OUTPUTS = {
  index: 'data/index.json',
  'body-regions': 'data/body-regions.json',
  'reverse-inference': 'data/reverse-inference.json',
};
const PRODUCTION_DEFAULT_SCOPES = ['index', 'body-regions'];

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

  // reverse-inference.json is currently a curated production asset whose
  // rankings/intensity metadata are richer than the historical formula in
  // build-data.mjs can reproduce. Routine builds therefore validate/preserve
  // it rather than silently replacing live behavior. It can still be rebuilt
  // explicitly with --scope reverse-inference or --scope all while its source
  // model is being reconciled.
  if (!raw) {
    return new Set(PRODUCTION_DEFAULT_SCOPES);
  }
  if (raw.trim().toLowerCase() === 'all') {
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

function jsonSemanticallyEqual(leftPath, rightPath) {
  if (!existsSync(leftPath) || !existsSync(rightPath)) return false;
  try {
    const left = JSON.parse(readFileSync(leftPath, 'utf8'));
    const right = JSON.parse(readFileSync(rightPath, 'utf8'));
    return isDeepStrictEqual(left, right);
  } catch {
    return false;
  }
}

const scopes = parseScope(process.argv.slice(2));
const stageParent = mkdtempSync(join(tmpdir(), 'allneeds-data-'));
const stageRoot = join(stageParent, 'repo');
let published = 0;
let byteStable = 0;

try {
  copyRepository(stageRoot);

  // The canonical compiler reads editable spreadsheet data in an isolated
  // workspace. The deterministic finalization step removes historical
  // duplicate-row ordering from Body Cues. Only explicitly owned outputs are
  // ever copied back into the real repository.
  runScript(stageRoot, 'scripts/build-data.mjs');
  runScript(stageRoot, 'scripts/finalize-generated-data.mjs');

  for (const scope of scopes) {
    const relativePath = OUTPUTS[scope];
    const stagedPath = join(stageRoot, relativePath);
    if (!existsSync(stagedPath)) throw new Error(`Generator did not produce declared data output: ${relativePath}`);
    const destination = join(rootDir, relativePath);

    // JSON object key order and trailing-newline style are not data semantics.
    // If the source compiler reproduces the committed value exactly as parsed,
    // keep the existing bytes so a no-op production build is genuinely a no-op.
    if (jsonSemanticallyEqual(stagedPath, destination)) {
      byteStable += 1;
      continue;
    }

    mkdirSync(dirname(destination), { recursive: true });
    cpSync(stagedPath, destination, { force: true });
    published += 1;
  }

  console.log(
    `Data build complete: ${published} changed output${published === 1 ? '' : 's'}, ` +
      `${byteStable} semantically identical output${byteStable === 1 ? '' : 's'} kept byte-stable.`,
  );
} finally {
  rmSync(stageParent, { recursive: true, force: true });
}
