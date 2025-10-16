import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const requiredMagnets = [
  {
    id: 'nav-body-cues',
    label: 'Body cues magnet',
  },
  {
    id: 'nav-journal-dashboard',
    label: 'Journal dashboard magnet',
  },
];

async function collectHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

test('navigation pages include updated nav magnet definitions', async () => {
  const htmlFiles = await collectHtmlFiles(repoRoot);
  const violations = [];

  for (const file of htmlFiles) {
    const contents = await fs.readFile(file, 'utf8');
    if (!contents.includes('data-magnet-root')) {
      continue;
    }

    for (const magnet of requiredMagnets) {
      if (!contents.includes(`data-magnet-id="${magnet.id}"`)) {
        const relative = path.relative(repoRoot, file);
        violations.push(`${relative} is missing ${magnet.label} (${magnet.id})`);
      }
    }
  }

  if (violations.length) {
    assert.fail(`Missing navigation magnets:\n${violations.join('\n')}`);
  }
});
