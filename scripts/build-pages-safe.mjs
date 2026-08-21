import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const indexData = JSON.parse(readFileSync(join(rootDir, 'data', 'index.json'), 'utf8'));

const KNOWN_SCOPES = new Set([
  'home',
  'faux-feelings',
  'feelings',
  'needs',
  'inventory',
  'observation-guide',
  'support-lane',
]);

const DEFAULT_SCOPES = [
  'home',
  'faux-feelings',
  'feelings',
  'needs',
  'inventory',
  'observation-guide',
  'support-lane',
];

function parseScopeArgs(argv) {
  let raw = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--scope') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --scope option.');
      }
      raw = value;
      index += 1;
    } else if (arg.startsWith('--scope=')) {
      raw = arg.slice('--scope='.length);
    }
  }

  if (raw == null) {
    return null;
  }

  const scopes = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!scopes.length) {
    throw new Error('The --scope option requires at least one scope name.');
  }

  const invalid = scopes.filter((scope) => !KNOWN_SCOPES.has(scope));
  if (invalid.length) {
    throw new Error(`Unknown scope(s): ${invalid.join(', ')}. Valid scopes: ${Array.from(KNOWN_SCOPES).join(', ')}`);
  }

  return new Set(scopes);
}

function normalizeRelativePath(path) {
  return path.split(sep).join('/');
}

function expectedOutputs(scopeSet) {
  const shouldBuild = (scope) => !scopeSet || scopeSet.has(scope);
  const outputs = new Set();

  if (shouldBuild('home')) {
    outputs.add('index.html');
  }

  if (shouldBuild('faux-feelings')) {
    outputs.add('faux-feelings/index.html');
    for (const item of indexData.fauxFeelings || []) {
      if (item?.slug) outputs.add(`faux-feelings/${item.slug}/index.html`);
    }
  }

  if (shouldBuild('feelings')) {
    outputs.add('feelings/index.html');
    outputs.add('feelings/body-cues/index.html');
    for (const item of indexData.feelings || []) {
      if (item?.slug) outputs.add(`feelings/${item.slug}/index.html`);
    }
  }

  if (shouldBuild('needs')) {
    outputs.add('needs/index.html');
    for (const item of indexData.needs || []) {
      if (item?.slug) outputs.add(`needs/${item.slug}/index.html`);
    }
  }

  if (shouldBuild('inventory')) {
    outputs.add('inventory/index.html');
    outputs.add('inventory/journal/index.html');
  }

  if (shouldBuild('observation-guide')) {
    outputs.add('observations/index.html');
  }

  if (shouldBuild('support-lane')) {
    outputs.add('alexithymia-support/index.html');
  }

  return outputs;
}

function copyRepositoryToStage(stageRoot) {
  cpSync(rootDir, stageRoot, {
    recursive: true,
    filter(source) {
      const rel = normalizeRelativePath(relative(rootDir, source));
      if (!rel) return true;
      if (rel === '.git' || rel.startsWith('.git/')) return false;
      if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
      return true;
    },
  });
}

function runNode(stageRoot, relativeScript, args = []) {
  const result = spawnSync(process.execPath, [join(stageRoot, relativeScript), ...args], {
    cwd: stageRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${relativeScript} exited with status ${result.status}`);
  }
}

function canonicalizeOpeningTag(tagName, rawAttributes) {
  const attributes = [];
  const source = String(rawAttributes || '').replace(/\/$/, '').trim();
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;

  while ((match = attributePattern.exec(source))) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    const hasValue = doubleQuoted !== undefined || singleQuoted !== undefined || unquoted !== undefined;
    const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
    attributes.push({ name, hasValue, value });
  }

  attributes.sort((left, right) => left.name.localeCompare(right.name));
  const serialized = attributes
    .map(({ name, hasValue, value }) => (hasValue ? `${name}="${value}"` : name))
    .join(' ');

  return serialized ? `<${tagName} ${serialized}>` : `<${tagName}>`;
}

function canonicalizeNavigation(navHtml) {
  return navHtml
    .replace(/<([A-Za-z][A-Za-z0-9:-]*)([^<>]*?)>/g, (full, tagName, attributes) => {
      if (full.startsWith('</') || full.startsWith('<!')) return full;
      return canonicalizeOpeningTag(tagName, attributes);
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNavigationSerialization(html) {
  const startMarker = '<nav class="site-nav magnet-section"';
  const start = html.indexOf(startMarker);
  if (start < 0) return html;
  const close = html.indexOf('</nav>', start);
  if (close < 0) return html;
  const end = close + '</nav>'.length;
  const nav = html.slice(start, end);
  return `${html.slice(0, start)}[[SITE_NAV:${canonicalizeNavigation(nav)}]]${html.slice(end)}`;
}

function shellSerializationEquivalent(stagedPath, destination) {
  if (!existsSync(destination)) return false;
  const staged = readFileSync(stagedPath, 'utf8');
  const current = readFileSync(destination, 'utf8');
  if (staged === current) return true;
  return normalizeNavigationSerialization(staged) === normalizeNavigationSerialization(current);
}

function copyOwnedOutputs(stageRoot, outputs) {
  let published = 0;
  let byteStable = 0;

  for (const relativePath of outputs) {
    const stagedPath = join(stageRoot, relativePath);
    if (!existsSync(stagedPath)) {
      throw new Error(`Generator did not produce declared output: ${relativePath}`);
    }

    const destination = join(rootDir, relativePath);

    // The current production tree contains historical indentation and attribute
    // ordering in the shared nav shell. If the staged generator reproduces the
    // exact same shell structure/attributes/text and the rest of the page is
    // byte-identical, retain the already-tested production serialization. Any
    // actual page or shell markup difference is still copied and becomes a diff.
    if (shellSerializationEquivalent(stagedPath, destination)) {
      byteStable += 1;
      continue;
    }

    mkdirSync(dirname(destination), { recursive: true });
    cpSync(stagedPath, destination, { force: true });
    published += 1;
  }

  return { published, byteStable };
}

const requestedScopes = parseScopeArgs(process.argv.slice(2));
const activeScopes = requestedScopes ? Array.from(requestedScopes) : DEFAULT_SCOPES;
const outputs = expectedOutputs(requestedScopes);
const stageParent = mkdtempSync(join(tmpdir(), 'allneeds-pages-'));
const stageRoot = join(stageParent, 'repo');

try {
  copyRepositoryToStage(stageRoot);

  const scopeArgs = requestedScopes
    ? ['--scope', activeScopes.join(',')]
    : [];

  // The legacy generator is intentionally destructive inside its workspace.
  // Run it only in an isolated staging copy, then publish the files that the
  // selected scopes explicitly own. Standalone tools and unrelated routes can
  // therefore never be deleted by a broad page rebuild.
  runNode(stageRoot, 'scripts/build-pages.mjs', scopeArgs);
  runNode(stageRoot, 'scripts/finalize-static-assets.mjs');
  const { published, byteStable } = copyOwnedOutputs(stageRoot, outputs);

  console.log(
    `Page build complete: ${published} changed output${published === 1 ? '' : 's'}, ` +
      `${byteStable} structurally identical output${byteStable === 1 ? '' : 's'} kept byte-stable.`,
  );
} finally {
  rmSync(stageParent, { recursive: true, force: true });
}
