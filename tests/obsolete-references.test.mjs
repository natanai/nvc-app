import { readdirSync, readFileSync } from 'fs';
import { join, relative, extname } from 'path';

const rootDir = process.cwd();
const ignoredDirectories = new Set(['.git', '.github', '.vscode', 'node_modules']);
const allowedExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.md',
  '.svg',
  '.txt',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const obsoletePatterns = ['#journal-dashboard'];
const allowedMatches = new Map([
  ['scripts/inventory.js', new Set(['#journal-dashboard'])],
]);

function collectFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }
    if (entry.name.startsWith('.')) {
      if (!['.git', '.github'].includes(entry.name)) {
        continue;
      }
    }

    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (allowedExtensions.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

const files = collectFiles(rootDir).filter((file) => !file.endsWith('tests/obsolete-references.test.mjs'));

const issues = [];

for (const file of files) {
  const contents = readFileSync(file, 'utf8');
  for (const pattern of obsoletePatterns) {
    if (!contents.includes(pattern)) {
      continue;
    }
    const relativePath = relative(rootDir, file);
    const allowedForFile = allowedMatches.get(relativePath);
    if (allowedForFile?.has(pattern)) {
      continue;
    }
    issues.push(`${relativePath} → ${pattern}`);
  }
}

if (issues.length) {
  const message = issues.join('\n');
  throw new Error(`Obsolete feature references detected:\n${message}`);
}

console.log(`Checked ${files.length} files for obsolete references. None found.`);
