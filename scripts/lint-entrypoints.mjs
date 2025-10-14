import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, extname, join, posix, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function walk(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    if (entry.name === 'node_modules') {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizePath(filePath) {
  return posix.normalize(relative(rootDir, filePath).replace(/\\/g, '/'));
}

function resolveScriptFromHtml(htmlFile, src) {
  if (!src || /^(?:[a-z]+:)?\/\//i.test(src) || src.startsWith('data:')) {
    return null;
  }
  const resolved = resolve(dirname(htmlFile), src);
  if (!resolved.startsWith(rootDir) || !existsSync(resolved)) {
    return null;
  }
  return normalizePath(resolved);
}

function resolveImport(fromFile, specifier) {
  if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
    return null;
  }

  const baseDir = dirname(fromFile);
  const attempt = specifier.startsWith('/') ? resolve(rootDir, `.${specifier}`) : resolve(baseDir, specifier);
  const candidates = [];
  const ext = extname(attempt);
  if (ext) {
    candidates.push(attempt);
  } else {
    candidates.push(`${attempt}.js`, `${attempt}.mjs`, join(attempt, 'index.js'), join(attempt, 'index.mjs'));
  }

  for (const candidate of candidates) {
    if (candidate.startsWith(rootDir) && existsSync(candidate)) {
      return normalizePath(candidate);
    }
  }

  return null;
}

const assetJsDir = join(rootDir, 'assets', 'js');
const scriptJsDir = join(rootDir, 'scripts');

const candidateFiles = new Set();

if (existsSync(assetJsDir)) {
  for (const file of walk(assetJsDir)) {
    if (file.endsWith('.js')) {
      candidateFiles.add(normalizePath(file));
    }
  }
}

if (existsSync(scriptJsDir)) {
  for (const file of walk(scriptJsDir)) {
    if (file.endsWith('.js')) {
      candidateFiles.add(normalizePath(file));
    }
  }
}

const referenceCounts = new Map();
for (const file of candidateFiles) {
  referenceCounts.set(file, 0);
}

const htmlFiles = walk(rootDir).filter((file) => file.endsWith('.html'));
const scriptTagPattern = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

for (const htmlFile of htmlFiles) {
  const contents = readFileSync(htmlFile, 'utf8');
  let match;
  while ((match = scriptTagPattern.exec(contents))) {
    const src = match[1];
    const normalized = resolveScriptFromHtml(htmlFile, src);
    if (normalized && referenceCounts.has(normalized)) {
      referenceCounts.set(normalized, referenceCounts.get(normalized) + 1);
    }
  }
}

const jsLikeFiles = walk(rootDir).filter((file) => file.endsWith('.js') || file.endsWith('.mjs'));
const importPattern = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g;
const dynamicImportPattern = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

for (const file of jsLikeFiles) {
  const contents = readFileSync(file, 'utf8');
  let match;
  while ((match = importPattern.exec(contents))) {
    const specifier = match[1];
    const resolved = resolveImport(file, specifier);
    if (resolved && referenceCounts.has(resolved)) {
      referenceCounts.set(resolved, referenceCounts.get(resolved) + 1);
    }
  }
  while ((match = dynamicImportPattern.exec(contents))) {
    const specifier = match[1];
    const resolved = resolveImport(file, specifier);
    if (resolved && referenceCounts.has(resolved)) {
      referenceCounts.set(resolved, referenceCounts.get(resolved) + 1);
    }
  }
}

const unused = Array.from(referenceCounts.entries())
  .filter(([, count]) => count === 0)
  .map(([file]) => file)
  .sort();

if (unused.length > 0) {
  console.error('Unused browser assets detected:');
  for (const file of unused) {
    console.error(`  - ${file}`);
  }
  console.error('\nRemove the files above or reference them from a page before continuing.');
  process.exitCode = 1;
} else {
  console.log('All browser assets are referenced by a page or module import.');
}
