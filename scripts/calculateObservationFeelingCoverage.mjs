import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseObservationCueCSV } from '../lib/observationCueData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sanitizedCuePath = path.join(rootDir, 'data', 'observation_cues.sanitized.csv');
const indexPath = path.join(rootDir, 'data', 'index.json');
const outputPath = path.join(rootDir, 'data', 'observation_detector_stats.json');

function formatPercentage(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value * 10000) / 100;
}

async function loadSanitizedCues() {
  const csv = await readFile(sanitizedCuePath, 'utf8');
  return parseObservationCueCSV(csv);
}

async function loadFeelingIndex() {
  const raw = await readFile(indexPath, 'utf8');
  const data = JSON.parse(raw);
  const feelings = Array.isArray(data?.feelings) ? data.feelings : [];
  return feelings
    .map(item => (item && typeof item.slug === 'string' ? item.slug.trim() : ''))
    .filter(Boolean);
}

function buildStats(cues, feelingSlugs) {
  const cueFeelings = new Set();
  cues.forEach(cue => {
    const feelings = Array.isArray(cue?.feelings) ? cue.feelings : [];
    feelings
      .filter(feeling => typeof feeling === 'string' && feeling.trim())
      .forEach(feeling => {
        cueFeelings.add(feeling.trim());
      });
  });

  const librarySet = new Set(feelingSlugs);
  const matchedFeelings = Array.from(cueFeelings).filter(slug => librarySet.has(slug));
  const unmatchedFeelings = Array.from(cueFeelings)
    .filter(slug => !librarySet.has(slug))
    .sort();

  const uniqueCueCount = cueFeelings.size;
  const exactMatchCount = matchedFeelings.length;
  const totalLibraryCount = librarySet.size;

  const exactMatchRatio = uniqueCueCount > 0 ? exactMatchCount / uniqueCueCount : 0;
  const libraryCoverageRatio = totalLibraryCount > 0 ? exactMatchCount / totalLibraryCount : 0;

  return {
    updatedAt: new Date().toISOString(),
    feelings: {
      totalLibraryCount,
      uniqueCueCount,
      exactMatchCount,
      exactMatchRatio,
      exactMatchPercentage: formatPercentage(exactMatchRatio),
      libraryCoverageRatio,
      libraryCoveragePercentage: formatPercentage(libraryCoverageRatio),
      missingFromLibrary: unmatchedFeelings,
    },
  };
}

async function loadExistingStats() {
  try {
    const raw = await readFile(outputPath, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      return data;
    }
  } catch (error) {
    // ignore missing file errors
  }
  return null;
}

function normalizeFeelings(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }
  const missing = Array.isArray(summary.missingFromLibrary) ? [...summary.missingFromLibrary] : [];
  missing.sort();
  return {
    totalLibraryCount: Number(summary.totalLibraryCount) || 0,
    uniqueCueCount: Number(summary.uniqueCueCount) || 0,
    exactMatchCount: Number(summary.exactMatchCount) || 0,
    exactMatchRatio: Number(summary.exactMatchRatio) || 0,
    exactMatchPercentage: Number(summary.exactMatchPercentage) || 0,
    libraryCoverageRatio: Number(summary.libraryCoverageRatio) || 0,
    libraryCoveragePercentage: Number(summary.libraryCoveragePercentage) || 0,
    missingFromLibrary: missing,
  };
}

function feelingsSummariesEqual(a, b) {
  const normalizedA = normalizeFeelings(a);
  const normalizedB = normalizeFeelings(b);
  if (!normalizedA || !normalizedB) {
    return false;
  }
  return (
    normalizedA.totalLibraryCount === normalizedB.totalLibraryCount &&
    normalizedA.uniqueCueCount === normalizedB.uniqueCueCount &&
    normalizedA.exactMatchCount === normalizedB.exactMatchCount &&
    normalizedA.exactMatchRatio === normalizedB.exactMatchRatio &&
    normalizedA.exactMatchPercentage === normalizedB.exactMatchPercentage &&
    normalizedA.libraryCoverageRatio === normalizedB.libraryCoverageRatio &&
    normalizedA.libraryCoveragePercentage === normalizedB.libraryCoveragePercentage &&
    JSON.stringify(normalizedA.missingFromLibrary) === JSON.stringify(normalizedB.missingFromLibrary)
  );
}

async function main() {
  const [cues, feelings, existing] = await Promise.all([
    loadSanitizedCues(),
    loadFeelingIndex(),
    loadExistingStats(),
  ]);
  const stats = buildStats(cues, feelings);
  if (existing?.feelings && feelingsSummariesEqual(existing.feelings, stats.feelings)) {
    stats.updatedAt = existing.updatedAt || stats.updatedAt;
  }
  await writeFile(outputPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  console.log(`Observation detector stats written to ${outputPath}`);
  if (stats?.feelings) {
    const exactPct = stats.feelings.exactMatchPercentage;
    const coveragePct = stats.feelings.libraryCoveragePercentage;
    console.log(
      `Exact feeling matches: ${stats.feelings.exactMatchCount}/${stats.feelings.uniqueCueCount}` +
        ` (${exactPct}% of unique feeling suggestions).`,
    );
    console.log(
      `Feelings library coverage: ${stats.feelings.exactMatchCount}/${stats.feelings.totalLibraryCount}` +
        ` (${coveragePct}% of published feelings).`,
    );
    if (stats.feelings.missingFromLibrary.length) {
      console.log('Missing feelings:', stats.feelings.missingFromLibrary.join(', '));
    }
  }
}

main().catch(error => {
  console.error('Unable to calculate observation detector stats');
  console.error(error);
  process.exitCode = 1;
});
