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
    id: 'nav-faux-feelings',
    label: 'Faux feelings magnet',
    requiredClasses: ['site-nav__magnet--faux-feelings'],
    requiredAttributes: [
      { name: 'data-nav-hidden', value: 'true' },
      { name: 'aria-hidden', value: 'true' },
      { name: 'tabindex', value: '-1' },
    ],
  },
  {
    id: 'nav-body-cues',
    label: 'Body cues magnet',
    requiredClasses: ['site-nav__magnet--body-cues'],
    requiredAttributes: [
      { name: 'data-nav-hidden', value: 'true' },
      { name: 'data-nav-supplemental', value: 'true' },
      { name: 'aria-hidden', value: 'true' },
      { name: 'tabindex', value: '-1' },
    ],
  },
  {
    id: 'nav-journal-dashboard',
    label: 'Journal History magnet',
    requiredClasses: ['site-nav__magnet--journal-dashboard'],
    requiredAttributes: [
      { name: 'data-nav-hidden', value: 'true' },
      { name: 'data-nav-supplemental', value: 'true' },
      { name: 'aria-hidden', value: 'true' },
      { name: 'tabindex', value: '-1' },
    ],
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

function escapeRegExp(value) {
  return value.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

function extractAttribute(tag, name) {
  const pattern = new RegExp(
    `${escapeRegExp(name)}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`,
    'i',
  );
  const match = pattern.exec(tag);
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function findMagnetTags(html, magnetId) {
  const pattern = new RegExp(
    `<a[^>]*data-magnet-id=(?:"|')${escapeRegExp(magnetId)}(?:"|')[^>]*>`,
    'gi',
  );
  return Array.from(html.matchAll(pattern), (match) => match[0]);
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
      const tags = findMagnetTags(contents, magnet.id);
      const relative = path.relative(repoRoot, file);

      if (!tags.length) {
        violations.push(`${relative} is missing ${magnet.label} (${magnet.id})`);
        continue;
      }

      for (const tag of tags) {
        if (magnet.requiredClasses) {
          const classValue = extractAttribute(tag, 'class') ?? '';
          const classList = new Set(
            classValue
              .split(/\s+/)
              .map((cls) => cls.trim())
              .filter(Boolean),
          );

          for (const requiredClass of magnet.requiredClasses) {
            if (!classList.has(requiredClass)) {
              violations.push(
                `${relative} ${magnet.label} (${magnet.id}) is missing class ${requiredClass}`,
              );
            }
          }
        }

        if (magnet.requiredAttributes) {
          for (const attribute of magnet.requiredAttributes) {
            const actual = extractAttribute(tag, attribute.name);
            if (actual === null) {
              violations.push(
                `${relative} ${magnet.label} (${magnet.id}) is missing attribute ${attribute.name}`,
              );
            } else if (
              Object.prototype.hasOwnProperty.call(attribute, 'value') &&
              actual !== attribute.value
            ) {
              violations.push(
                `${relative} ${magnet.label} (${magnet.id}) has ${attribute.name}="${actual}" but expected "${attribute.value}"`,
              );
            }
          }
        }
      }
    }
  }

  const supportPath = path.join(repoRoot, 'alexithymia-support', 'index.html');
  const supportContents = await fs.readFile(supportPath, 'utf8');

  assert.ok(
    supportContents.includes('magnetPositions:site-nav'),
    'Alexithymia Support page is missing the nav magnet prefill script (magnetPositions:site-nav).',
  );

  const supportObservationTags = findMagnetTags(supportContents, 'nav-observations');
  assert.ok(
    supportObservationTags.length > 0,
    'Alexithymia Support page is missing the Observations magnet.',
  );

  assert.ok(
    supportObservationTags.some((tag) => {
      const hidden = extractAttribute(tag, 'data-nav-hidden');
      const ariaHidden = extractAttribute(tag, 'aria-hidden');
      return hidden !== 'true' && ariaHidden !== 'true';
    }),
    'Alexithymia Support page should display the Observations magnet by default.',
  );

  if (violations.length) {
    assert.fail(`Missing navigation magnets:\n${violations.join('\n')}`);
  }
});
