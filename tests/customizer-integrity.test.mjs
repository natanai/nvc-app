import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const rootDir = process.cwd();
const ignoredDirectories = new Set(['node_modules', '.git', '.github', '.vscode']);

function collectHtmlFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      if (!['.github'].includes(entry.name)) {
        continue;
      }
    }
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

const htmlFiles = collectHtmlFiles(rootDir);

if (!htmlFiles.length) {
  throw new Error('Customizer integrity check: no HTML files found to inspect.');
}

const missingStorageSnippet = [];
const missingPreapplyFlag = [];
const missingToggle = [];
const staleHighContrast = [];
const staleContrastAttribute = [];

for (const file of htmlFiles) {
  const contents = readFileSync(file, 'utf8');
  const relativePath = relative(rootDir, file);

  if (!contents.includes("const STORAGE_KEY = 'nvcApp.theme'")) {
    missingStorageSnippet.push(relativePath);
  }

  if (!contents.includes('data-theme-preapplied')) {
    missingPreapplyFlag.push(relativePath);
  }

  if (!contents.includes('data-palette-toggle')) {
    missingToggle.push(relativePath);
  }

  if (contents.includes('themeHighContrast')) {
    staleHighContrast.push(relativePath);
  }

  if (
    contents.includes('data-theme-contrast=') ||
    contents.includes("setAttribute('data-theme-contrast'") ||
    contents.includes('setAttribute("data-theme-contrast"')
  ) {
    staleContrastAttribute.push(relativePath);
  }
}

const issues = [];

if (missingStorageSnippet.length) {
  issues.push(`Missing theme preload script in: ${missingStorageSnippet.join(', ')}`);
}

if (missingPreapplyFlag.length) {
  issues.push(`Missing data-theme-preapplied marker in: ${missingPreapplyFlag.join(', ')}`);
}

if (missingToggle.length) {
  issues.push(`Missing customizer toggle markup in: ${missingToggle.join(', ')}`);
}

if (staleHighContrast.length) {
  issues.push(`Found deprecated high contrast logic in: ${staleHighContrast.join(', ')}`);
}

if (staleContrastAttribute.length) {
  issues.push(`Found deprecated data-theme-contrast attribute in: ${staleContrastAttribute.join(', ')}`);
}

if (issues.length) {
  const message = issues.join('\n');
  throw new Error(`Customizer integrity check failed:\n${message}`);
}

console.log(`Customizer integrity check passed for ${htmlFiles.length} HTML files.`);
