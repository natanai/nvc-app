import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const indexData = JSON.parse(readFileSync(join(root, 'data', 'index.json'), 'utf8'));

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

function expectedOutputs() {
  const outputs = new Set(['index.html']);
  outputs.add('faux-feelings/index.html');
  for (const item of indexData.fauxFeelings || []) if (item?.slug) outputs.add(`faux-feelings/${item.slug}/index.html`);
  outputs.add('feelings/index.html');
  outputs.add('feelings/body-cues/index.html');
  for (const item of indexData.feelings || []) if (item?.slug) outputs.add(`feelings/${item.slug}/index.html`);
  outputs.add('needs/index.html');
  for (const item of indexData.needs || []) if (item?.slug) outputs.add(`needs/${item.slug}/index.html`);
  outputs.add('inventory/index.html');
  outputs.add('inventory/journal/index.html');
  outputs.add('observations/index.html');
  outputs.add('alexithymia-support/index.html');
  return [...outputs];
}

const REDUNDANT_INLINE_CRITICAL_RULES = [
  /\n\.magnet-board:not\(\[data-ready='1'\]\) \.magnet \{\n  position: absolute;\n  touch-action: none;\n  transition: none;\n  visibility: hidden;\n\}\n/g,
  /\n\.site-nav__magnet--menu \{\n  padding: 0\.45rem;\n  gap: 0;\n  justify-content: center;\n  min-width: 0;\n  background: color-mix\(in srgb, var\(--gold\) 72%, #ffffff 28%\);\n\}\n/g,
  /\n\.site-nav__menu-icon \{\n  width: 1\.4rem;\n  height: 1\.4rem;\n  display: block;\n  flex-shrink: 0;\n  fill: none;\n  stroke: var\(--outline\);\n  stroke-width: 2\.2;\n  stroke-linecap: round;\n  pointer-events: none;\n\}\n/g,
  /\n\.site-nav__magnet--menu\[aria-expanded='true'\] \{\n  background: color-mix\(in srgb, var\(--gold\) 88%, #ffffff 12%\);\n  box-shadow: inset 0 -8px 0 color-mix\(in srgb, var\(--outline\) 18%, transparent\);\n\}\n/g,
];

const CRITICAL_NEEDLES = [
  ".magnet-board:not([data-ready='1']) .magnet {",
  '.site-nav__magnet--menu {',
  '.site-nav__menu-icon {',
  ".site-nav__magnet--menu[aria-expanded='true'] {",
];

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
  const serialized = attributes.map(({ name, hasValue, value }) => (hasValue ? `${name}="${value}"` : name)).join(' ');
  return serialized ? `<${tagName} ${serialized}>` : `<${tagName}>`;
}

function normalizeNavigationSerialization(html) {
  const startMarker = '<nav class="site-nav magnet-section"';
  const start = html.indexOf(startMarker);
  if (start < 0) return html;
  const close = html.indexOf('</nav>', start);
  if (close < 0) return html;
  const end = close + '</nav>'.length;
  const nav = html.slice(start, end)
    .replace(/<([A-Za-z][A-Za-z0-9:-]*)([^<>]*?)>/g, (full, tagName, attributes) => {
      if (full.startsWith('</') || full.startsWith('<!')) return full;
      return canonicalizeOpeningTag(tagName, attributes);
    })
    .replace(/\s+/g, ' ')
    .trim();
  return `${html.slice(0, start)}[[SITE_NAV:${nav}]]${html.slice(end)}`;
}

function normalizeShellScriptSerialization(html) {
  return html.replace(/<script([^<>]*?)><\/script>/g, (full, attributes) => {
    if (!/scripts\/(?:inventory-core-shell|inventory)\.js/.test(attributes)) return full;
    return `${canonicalizeOpeningTag('script', attributes)}</script>`;
  });
}

function stripCritical(html) {
  let output = html;
  for (const pattern of REDUNDANT_INLINE_CRITICAL_RULES) output = output.replace(pattern, '\n');
  return output.replace(/\n{3,}/g, '\n\n');
}

function fullyNormalize(html) {
  return normalizeNavigationSerialization(stripCritical(normalizeShellScriptSerialization(html)));
}

function firstMismatch(a, b) {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  return i;
}

function countNeedle(source, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (true) {
    const next = source.indexOf(needle, cursor);
    if (next < 0) return count;
    count += 1;
    cursor = next + needle.length;
  }
}

function shellOrder(source) {
  const core = source.indexOf('scripts/inventory-core-shell.js');
  const inventory = source.indexOf('scripts/inventory.js');
  if (core < 0 || inventory < 0) return 'not-both-present';
  return core < inventory ? 'core-shell -> inventory' : 'inventory -> core-shell';
}

function shellTag(source, token) {
  const tokenAt = source.indexOf(token);
  if (tokenAt < 0) return '(not present)';
  const start = source.lastIndexOf('<script', tokenAt);
  const end = source.indexOf('>', tokenAt);
  if (start < 0 || end < 0) return '(unresolved)';
  return source.slice(start, end + 1).replace(/\s+/g, ' ');
}

function navOpening(source) {
  const start = source.indexOf('<nav class="site-nav magnet-section"');
  if (start < 0) return '(no shared nav)';
  const end = source.indexOf('>', start);
  return source.slice(start, end + 1).replace(/\s+/g, ' ');
}

const parent = mkdtempSync(join(tmpdir(), 'allneeds-page-drift-'));
const stage = join(parent, 'repo');

try {
  copyRepository(stage);
  const result = spawnSync(process.execPath, [join(stage, 'scripts', 'build-pages.mjs')], {
    cwd: stage,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }

  const counts = new Map();
  const examples = new Map();
  const unresolved = [];

  for (const rel of expectedOutputs()) {
    const currentPath = join(root, rel);
    const stagedPath = join(stage, rel);
    if (!existsSync(currentPath) || !existsSync(stagedPath)) {
      unresolved.push(`${rel}: missing current or staged output`);
      continue;
    }
    const current = readFileSync(currentPath, 'utf8');
    const staged = readFileSync(stagedPath, 'utf8');
    const shellCurrent = normalizeShellScriptSerialization(current);
    const shellStaged = normalizeShellScriptSerialization(staged);

    let kind = '';
    if (staged === current) kind = 'exact';
    else if (shellStaged === shellCurrent) kind = 'shell-attrs-only';
    else if (normalizeNavigationSerialization(staged) === normalizeNavigationSerialization(current)) kind = 'nav-only';
    else if (stripCritical(staged) === stripCritical(current)) kind = 'critical-css-only';
    else if (normalizeNavigationSerialization(shellStaged) === normalizeNavigationSerialization(shellCurrent)) kind = 'shell-attrs+nav';
    else if (stripCritical(shellStaged) === stripCritical(shellCurrent)) kind = 'shell-attrs+critical-css';
    else if (normalizeNavigationSerialization(stripCritical(staged)) === normalizeNavigationSerialization(stripCritical(current))) kind = 'nav+critical-css';
    else if (fullyNormalize(staged) === fullyNormalize(current)) kind = 'shell-attrs+nav+critical-css';
    else {
      kind = 'unresolved';
      const normalizedCurrent = fullyNormalize(current);
      const normalizedStaged = fullyNormalize(staged);
      const offset = firstMismatch(normalizedCurrent, normalizedStaged);
      unresolved.push(`${rel}: normalized mismatch at ${offset}`);
    }

    counts.set(kind, (counts.get(kind) || 0) + 1);
    if (!examples.has(kind)) examples.set(kind, []);
    if (examples.get(kind).length < 8) examples.get(kind).push(rel);
  }

  console.log('Direct page compiler drift classification:');
  for (const [kind, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`- ${kind}: ${count}`);
    console.log(`  examples: ${(examples.get(kind) || []).join(', ')}`);
  }

  if (unresolved.length) {
    console.log('Unresolved differences:');
    for (const item of unresolved.slice(0, 30)) console.log(`- ${item}`);
  }

  const sampleRel = 'feelings/hopeful/index.html';
  const sampleCurrent = readFileSync(join(root, sampleRel), 'utf8');
  const sampleStaged = readFileSync(join(stage, sampleRel), 'utf8');
  console.log(`Representative diagnostics: ${sampleRel}`);
  console.log(`- checked-in shell order: ${shellOrder(sampleCurrent)}`);
  console.log(`- direct compiler shell order: ${shellOrder(sampleStaged)}`);
  console.log(`- checked-in core-shell tag: ${shellTag(sampleCurrent, 'scripts/inventory-core-shell.js')}`);
  console.log(`- direct compiler core-shell tag: ${shellTag(sampleStaged, 'scripts/inventory-core-shell.js')}`);
  console.log(`- checked-in nav opening: ${navOpening(sampleCurrent)}`);
  console.log(`- direct compiler nav opening: ${navOpening(sampleStaged)}`);
  for (const needle of CRITICAL_NEEDLES) {
    console.log(`- critical rule ${JSON.stringify(needle)} checked-in=${countNeedle(sampleCurrent, needle)} direct=${countNeedle(sampleStaged, needle)}`);
  }
} finally {
  rmSync(parent, { recursive: true, force: true });
}
