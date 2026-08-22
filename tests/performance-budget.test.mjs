import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// These are regression ceilings for raw first-party bytes referenced directly
// by <script src> in committed HTML. They are intentionally NOT estimates of
// transferred bytes: HTTP compression, caching, module imports, and runtime
// lazy loads are outside this static parser-graph metric.
const ROUTE_BUDGETS = [
  { label: 'Home', html: 'index.html', maxBytes: 110_000 },
  { label: 'Shared Strategies', html: 'feed/index.html', maxBytes: 125_000 },
  { label: 'Need detail', html: 'needs/acceptance/index.html', maxBytes: 355_000 },
  { label: 'Feeling detail', html: 'feelings/afraid/index.html', maxBytes: 355_000 },
  { label: 'Faux-feeling detail', html: 'faux-feelings/abandoned/index.html', maxBytes: 337_000 },
  { label: 'Body Cues', html: 'feelings/body-cues/index.html', maxBytes: 355_000 },
  { label: 'Inventory', html: 'inventory/index.html', maxBytes: 345_000 },
  { label: 'Journal', html: 'inventory/journal/index.html', maxBytes: 415_000 },
];

const ASSET_BUDGETS = [
  { path: 'scripts/inventory.js', maxBytes: 238_000 },
  { path: 'scripts/strategy-deck.js', maxBytes: 10_000 },
  { path: 'styles.css', maxBytes: 175_000 },
  { path: 'scripts/magnets.js', maxBytes: 65_000 },
  { path: 'scripts/inventory-core-shell.js', maxBytes: 30_000 },
  { path: 'scripts/alexithymia-support.js', maxBytes: 85_000 },
];

function isExternalSource(src) {
  return /^(?:https?:)?\/\//i.test(src) || /^(?:data|blob):/i.test(src);
}

function stripQueryAndHash(src) {
  return src.split('#', 1)[0].split('?', 1)[0];
}

function resolveScriptPath(htmlRelativePath, src) {
  const clean = stripQueryAndHash(src.trim());
  if (!clean || isExternalSource(clean)) return null;
  if (clean.startsWith('/')) return path.join(root, clean.replace(/^\/+/, ''));
  return path.resolve(root, path.dirname(htmlRelativePath), clean);
}

async function parserScriptGraph(htmlRelativePath) {
  const html = await fs.readFile(path.join(root, htmlRelativePath), 'utf8');
  const sources = [];
  const pattern = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html))) sources.push(match[1]);

  const files = new Map();
  for (const src of sources) {
    const absolutePath = resolveScriptPath(htmlRelativePath, src);
    if (!absolutePath) continue;
    const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
    assert.ok(!relativePath.startsWith('../'), `${htmlRelativePath} references script outside repository: ${src}`);
    const stat = await fs.stat(absolutePath);
    assert.ok(stat.isFile(), `${htmlRelativePath} script is not a file: ${relativePath}`);
    if (!files.has(relativePath)) files.set(relativePath, stat.size);
  }

  return {
    files,
    totalBytes: [...files.values()].reduce((sum, bytes) => sum + bytes, 0),
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

test('representative routes stay within parser-discovered JavaScript budgets', async () => {
  const results = new Map();

  for (const route of ROUTE_BUDGETS) {
    const graph = await parserScriptGraph(route.html);
    results.set(route.label, graph);
    console.log(
      `${route.label}: ${formatBytes(graph.totalBytes)} / ${formatBytes(route.maxBytes)} — ` +
        [...graph.files.keys()].join(', '),
    );
    assert.ok(
      graph.totalBytes <= route.maxBytes,
      `${route.label} parser-discovered JS grew to ${graph.totalBytes} bytes (budget ${route.maxBytes}). ` +
        'If the growth is intentional and browser-validated, update this ceiling explicitly.',
    );
  }

  const home = results.get('Home')?.totalBytes || 0;
  const need = results.get('Need detail')?.totalBytes || 0;
  assert.ok(home > 0 && need > 0, 'Home and Need detail baselines must both be measurable');
  assert.ok(
    home <= need * 0.4,
    `Home lost its lightweight canary advantage: ${home} bytes vs Need detail ${need} bytes.`,
  );
});

test('largest shared browser assets stay inside explicit raw-size ceilings', async () => {
  for (const asset of ASSET_BUDGETS) {
    const stat = await fs.stat(path.join(root, asset.path));
    console.log(`${asset.path}: ${formatBytes(stat.size)} / ${formatBytes(asset.maxBytes)}`);
    assert.ok(
      stat.size <= asset.maxBytes,
      `${asset.path} grew to ${stat.size} bytes (budget ${asset.maxBytes}). ` +
        'Prefer extracting ownership or lowering load scope before raising the ceiling.',
    );
  }
});
