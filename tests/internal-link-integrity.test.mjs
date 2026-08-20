import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoots = [
  'index.html',
  'alexithymia-support',
  'faux-feelings',
  'feelings',
  'needs',
  'inventory',
  'observations',
  'feed',
];

function decodeAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .trim();
}

async function collectHtml(target, output = []) {
  let stats;
  try {
    stats = await fs.stat(target);
  } catch {
    return output;
  }

  if (stats.isFile()) {
    if (target.endsWith('.html')) output.push(target);
    return output;
  }

  for (const entry of await fs.readdir(target)) {
    await collectHtml(path.join(target, entry), output);
  }
  return output;
}

function extractHrefs(html) {
  const hrefs = [];
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/giu;
  for (const match of html.matchAll(anchorPattern)) {
    hrefs.push(decodeAttribute(match[2]));
  }
  return hrefs;
}

function extractAnchors(html) {
  const anchors = new Set();
  for (const match of html.matchAll(/\b(?:id|name)\s*=\s*(["'])(.*?)\1/giu)) {
    anchors.add(decodeAttribute(match[2]));
  }
  return anchors;
}

function splitHref(rawHref) {
  if (!rawHref || rawHref === '#') return null;
  if (/^(?:mailto|tel|javascript|data):/iu.test(rawHref)) return null;

  if (/^https?:\/\//iu.test(rawHref)) {
    const url = new URL(rawHref);
    if (url.hostname !== 'allneeds.app' && url.hostname !== 'www.allneeds.app') return null;
    return { pathname: url.pathname, fragment: url.hash.slice(1) };
  }

  const hashIndex = rawHref.indexOf('#');
  const beforeHash = hashIndex >= 0 ? rawHref.slice(0, hashIndex) : rawHref;
  const fragment = hashIndex >= 0 ? rawHref.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const pathname = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  return { pathname, fragment };
}

async function resolveTarget(sourceFile, hrefPath) {
  let target;
  if (!hrefPath) {
    target = sourceFile;
  } else if (hrefPath.startsWith('/')) {
    target = path.resolve(root, `.${hrefPath}`);
  } else {
    target = path.resolve(path.dirname(sourceFile), hrefPath);
  }

  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { error: 'escapes the repository site root' };
  }

  let stats;
  try {
    stats = await fs.stat(target);
  } catch {
    return { error: `missing target ${path.relative(root, target) || 'index.html'}` };
  }

  if (stats.isDirectory()) {
    target = path.join(target, 'index.html');
    try {
      const indexStats = await fs.stat(target);
      if (!indexStats.isFile()) throw new Error('not a file');
    } catch {
      return { error: `directory has no index.html: ${path.relative(root, target)}` };
    }
  }

  return { target };
}

const htmlFiles = [];
for (const siteRoot of siteRoots) {
  await collectHtml(path.join(root, siteRoot), htmlFiles);
}

const htmlCache = new Map();
async function readHtml(file) {
  if (!htmlCache.has(file)) {
    htmlCache.set(file, await fs.readFile(file, 'utf8'));
  }
  return htmlCache.get(file);
}

test('published static anchors point to existing local targets and fragments', async () => {
  const failures = [];

  for (const sourceFile of htmlFiles.sort()) {
    const sourceHtml = await readHtml(sourceFile);
    for (const rawHref of extractHrefs(sourceHtml)) {
      let parsed;
      try {
        parsed = splitHref(rawHref);
      } catch (error) {
        failures.push(`${path.relative(root, sourceFile)}: invalid href ${rawHref} (${error.message})`);
        continue;
      }
      if (!parsed) continue;

      let pathname = parsed.pathname;
      try {
        pathname = decodeURIComponent(pathname);
      } catch {
        failures.push(`${path.relative(root, sourceFile)}: invalid URL encoding in ${rawHref}`);
        continue;
      }

      const resolved = await resolveTarget(sourceFile, pathname);
      if (resolved.error) {
        failures.push(`${path.relative(root, sourceFile)}: ${rawHref} -> ${resolved.error}`);
        continue;
      }

      if (!parsed.fragment) continue;
      if (!resolved.target.endsWith('.html')) continue;

      let fragment;
      try {
        fragment = decodeURIComponent(parsed.fragment);
      } catch {
        failures.push(`${path.relative(root, sourceFile)}: invalid fragment encoding in ${rawHref}`);
        continue;
      }

      const targetHtml = await readHtml(resolved.target);
      const anchors = extractAnchors(targetHtml);
      if (!anchors.has(fragment)) {
        failures.push(
          `${path.relative(root, sourceFile)}: ${rawHref} -> missing #${fragment} in ${path.relative(root, resolved.target)}`,
        );
      }
    }
  }

  assert.deepEqual(failures, [], failures.join('\n'));
});
