import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const rootDir = process.cwd();
const excludedDirectories = new Set([
  '.git',
  '.github',
  'assets',
  'data',
  'docs',
  'icons',
  'scripts',
  'src',
  'tests',
  'node_modules',
]);

function collectIndexPages(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      if (entry.name === '.well-known') {
        // intentionally allow .well-known pages to be inspected, since they may contain real HTML.
      } else if (entry.isDirectory()) {
        // Skip hidden directories other than .well-known.
        continue;
      }
    }

    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) {
        continue;
      }
      files.push(...collectIndexPages(entryPath));
    } else if (entry.isFile() && entry.name === 'index.html') {
      files.push(entryPath);
    }
  }

  return files;
}

const indexPages = collectIndexPages(rootDir)
  .map((filePath) => ({
    absolute: filePath,
    relative: relative(rootDir, filePath),
  }))
  .sort((a, b) => a.relative.localeCompare(b.relative));

if (indexPages.length === 0) {
  throw new Error('Flicker and jitter check: no index.html pages were discovered.');
}

const issues = [];

function requirePattern(page, pattern, description) {
  if (!pattern.test(page.contents)) {
    issues.push(`${page.relative}: ${description}`);
  }
}

for (const page of indexPages) {
  const contents = readFileSync(page.absolute, 'utf8');
  page.contents = contents;
}

const contrastScriptPattern = /<script[^>]+assets\/js\/ui\/contrast\.js"?[^>]*><\/script>/i;
const themeStoragePattern = /STORAGE_KEY\s*=\s*['"]nvcApp\.theme['"]/;
const bodyBasePathPattern = /<body[^>]*\sdata-base-path\s*=\s*["'][^"']*["'][^>]*>/i;
const pageWrapperPattern = /<div[^>]*class=["'][^"']*\bpage-wrapper\b[^"']*["'][^>]*>/i;
const siteNavPattern = /<nav[^>]*class=["'][^"']*\bsite-nav\b[^"']*["'][^>]*>/i;
const skipLinkPattern = /<a[^>]*class=["'][^"']*\bskip-link\b[^"']*["'][^>]*>/i;

for (const page of indexPages) {
  requirePattern(page, contrastScriptPattern, 'missing contrast preload script to prevent theme flicker.');
  requirePattern(page, themeStoragePattern, 'missing theme pre-application logic for smooth page transitions.');
  requirePattern(page, bodyBasePathPattern, 'missing data-base-path attribute on <body>, which avoids navigation jitter.');
  requirePattern(page, pageWrapperPattern, 'missing page-wrapper container that stabilizes layout between navigations.');
  requirePattern(page, siteNavPattern, 'missing persistent site navigation needed for stable transitions.');
  requirePattern(page, skipLinkPattern, 'missing skip-link anchor which anchors layout and prevents jump jitter.');
}

if (issues.length > 0) {
  const summary = issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n');
  throw new Error(`Flicker and jitter check found ${issues.length} issue(s):\n${summary}`);
}

console.log(`Flicker and jitter check passed for ${indexPages.length} page(s).`);
