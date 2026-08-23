import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const roots = ['scripts', 'assets/js'];
const extensions = new Set(['.js', '.mjs']);

function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...collect(path));
    else if ([...extensions].some((ext) => name.endsWith(ext))) out.push(path);
  }
  return out;
}

const patterns = [
  ['stylesheet injection', /createElement\(\s*['"](?:link|style)['"]\s*\)|document\.write\s*\(/g],
  ['DOM removal', /(?:\.remove\(\)|removeChild\s*\()/g],
  ['static-adjacent insertion', /insertAdjacentElement\s*\(/g],
  ['button creation', /createElement\(\s*['"]button['"]\s*\)/g],
  ['link creation', /createElement\(\s*['"]a['"]\s*\)/g],
  ['runtime class rewrite', /\.className\s*=|\.classList\.(?:add|remove|toggle)\s*\(/g],
  ['runtime copy rewrite', /\.textContent\s*=/g],
  ['runtime inline style', /\.style\.(?:setProperty|removeProperty|cssText|[A-Za-z][A-Za-z0-9]*)\s*=|\.style\.setProperty\s*\(/g],
];

const files = roots.flatMap((entry) => collect(join(root, entry)));
const summary = new Map();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const rel = relative(root, file).replaceAll('\\', '/');
  const lines = source.split(/\r?\n/);
  for (const [label, regex] of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source))) {
      const before = source.slice(0, match.index);
      const lineNo = before.split(/\r?\n/).length;
      const line = lines[lineNo - 1]?.trim() || '';
      const key = `${rel} :: ${label}`;
      if (!summary.has(key)) summary.set(key, []);
      const bucket = summary.get(key);
      if (bucket.length < 12) bucket.push(`${lineNo}: ${line}`);
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }
}

console.log('BEDROCK PROVENANCE AUDIT');
console.log(`Scanned ${files.length} browser/build JavaScript files. Findings are candidates, not automatic violations.`);
for (const [key, lines] of [...summary.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`\n### ${key}`);
  for (const line of lines) console.log(`  ${line}`);
}

const knownViolations = [
  ['Inventory post-load normalizer', 'scripts/inventory-core-shell.js', 'prepareInventoryExperience'],
  ['Strategy save cosmetic normalizer', 'scripts/inventory.js', 'applyCompactSaveTargetControls'],
  ['Feeling inference runtime stylesheet injection', 'scripts/feeling-reverse-inference.js', 'loadPolishStyles'],
];

console.log('\nKNOWN BEDROCK VIOLATIONS');
for (const [label, path, needle] of knownViolations) {
  const source = readFileSync(join(root, path), 'utf8');
  console.log(`${source.includes(needle) ? 'FAIL' : 'PASS'} ${label}: ${path} :: ${needle}`);
}
