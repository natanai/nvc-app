import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseObservationCueCSV } from '../lib/observationCueData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sanitizedCuePath = path.join(rootDir, 'data', 'observation_cues.csv');
const detectorStatsPath = path.join(rootDir, 'data', 'observation_detector_stats.json');
const indexPath = path.join(rootDir, 'data', 'index.json');

function roundPercentage(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value * 10000) / 100;
}

async function loadSanitizedCueFeelings() {
  const csv = await fs.readFile(sanitizedCuePath, 'utf8');
  const rows = parseObservationCueCSV(csv);
  const set = new Set();
  rows.forEach(row => {
    const feelings = Array.isArray(row?.feelings) ? row.feelings : [];
    feelings
      .filter(feeling => typeof feeling === 'string' && feeling.trim())
      .forEach(feeling => set.add(feeling.trim()));
  });
  return set;
}

async function loadFeelingLibrarySlugs() {
  const raw = await fs.readFile(indexPath, 'utf8');
  const data = JSON.parse(raw);
  const feelings = Array.isArray(data?.feelings) ? data.feelings : [];
  return new Set(
    feelings
      .map(entry => (entry && typeof entry.slug === 'string' ? entry.slug.trim() : ''))
      .filter(Boolean),
  );
}

(async () => {
  const [cueFeelings, libraryFeelings, statsRaw] = await Promise.all([
    loadSanitizedCueFeelings(),
    loadFeelingLibrarySlugs(),
    fs.readFile(detectorStatsPath, 'utf8'),
  ]);

  const stats = JSON.parse(statsRaw);
  assert.ok(stats && typeof stats === 'object', 'stats should be an object');

  const summary = stats.feelings;
  assert.ok(summary, 'feelings stats missing');

  const matchedFeelings = Array.from(cueFeelings).filter(slug => libraryFeelings.has(slug));
  const unmatchedFeelings = Array.from(cueFeelings).filter(slug => !libraryFeelings.has(slug));

  assert.equal(summary.uniqueCueCount, cueFeelings.size, 'unique cue feeling count mismatch');
  assert.equal(summary.exactMatchCount, matchedFeelings.length, 'exact match count mismatch');
  assert.equal(summary.totalLibraryCount, libraryFeelings.size, 'feelings library count mismatch');
  assert.deepEqual(summary.missingFromLibrary, unmatchedFeelings.sort(), 'unexpected missing feelings');

  const exactMatchRatio = cueFeelings.size > 0 ? matchedFeelings.length / cueFeelings.size : 0;
  const coverageRatio = libraryFeelings.size > 0 ? matchedFeelings.length / libraryFeelings.size : 0;

  assert.equal(summary.exactMatchRatio, exactMatchRatio, 'exact match ratio mismatch');
  assert.equal(summary.libraryCoverageRatio, coverageRatio, 'library coverage ratio mismatch');
  assert.equal(summary.exactMatchPercentage, roundPercentage(exactMatchRatio), 'exact match percentage mismatch');
  assert.equal(summary.libraryCoveragePercentage, roundPercentage(coverageRatio), 'coverage percentage mismatch');
})();
