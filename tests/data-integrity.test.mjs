import { accessSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const rootDir = process.cwd();
const issues = [];
const warnings = [];
const reportDirectory = join(rootDir, 'data', 'reports');
const reportPath = join(reportDirectory, 'data-integrity-report.md');
const missingVocabularySpreadsheetPath = join(reportDirectory, 'missing-vocabulary.csv');

function clearFailureReport() {
  try {
    rmSync(reportPath, { force: true });
  } catch (error) {
    // Ignore errors when attempting to clear previous reports; they should not block the check.
  }
}

function clearMissingVocabularySpreadsheet() {
  try {
    rmSync(missingVocabularySpreadsheetPath, { force: true });
  } catch (error) {
    // Ignore errors when attempting to clear previous reports; they should not block the check.
  }
}

function writeFailureReport({ issueList, counts }) {
  mkdirSync(reportDirectory, { recursive: true });

  const generatedAt = new Date().toISOString();
  const datasetSummary = [
    `- Feelings: ${counts.feelings}`,
    `- Needs: ${counts.needs}`,
    `- Situations: ${counts.situations}`,
    `- Strategies: ${counts.strategies}`,
    `- Reverse inference entries: ${counts.reverseEntries}`,
  ].join('\n');

  const issueSummary = issueList.map((issue, index) => `${index + 1}. ${issue}`).join('\n');

  const reportContents = `# Data Integrity Report\n\nGenerated: ${generatedAt}\n\n## Dataset Summary\n\n${datasetSummary}\n\n## Issues\n\n${issueSummary}\n`;

  writeFileSync(reportPath, reportContents, 'utf8');
  return relative(rootDir, reportPath);
}

function formatCsvValue(value) {
  const normalized = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function writeMissingVocabularySpreadsheet({ feelingReferences, needReferences }) {
  mkdirSync(reportDirectory, { recursive: true });

  const rows = [['Type', 'Word', 'Contexts']];

  function appendRows(type, referenceMap) {
    const sortedWords = Array.from(referenceMap.keys()).sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' }),
    );

    sortedWords.forEach((word) => {
      const contexts = Array.from(referenceMap.get(word) ?? [])
        .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
        .join('; ');
      rows.push([type, word, contexts]);
    });
  }

  appendRows('Feeling', feelingReferences);
  appendRows('Need', needReferences);

  const csvContents = rows.map((row) => row.map(formatCsvValue).join(',')).join('\n');
  writeFileSync(missingVocabularySpreadsheetPath, csvContents, 'utf8');
  return relative(rootDir, missingVocabularySpreadsheetPath);
}

function readJsonFile(relativePath) {
  const fullPath = join(rootDir, relativePath);
  try {
    const contents = readFileSync(fullPath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Data integrity check: unable to read ${relativePath}: ${error.message}`);
  }
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    issues.push(`${label} collection is missing or not an array.`);
    return [];
  }
  return value;
}

function ensurePageExists(directory, slug, label) {
  const relativePath = join(directory, slug, 'index.html');
  const fullPath = join(rootDir, relativePath);
  try {
    accessSync(fullPath);
  } catch (error) {
    issues.push(`${label} page missing: ${relative(rootDir, fullPath)}`);
  }
}

function createSlugIndex(items, { label, directory }) {
  const map = new Map();

  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      issues.push(`${label} entry at index ${index} is not an object.`);
      return;
    }

    const slug = typeof item.slug === 'string' ? item.slug.trim() : '';
    if (!slug) {
      const title = typeof item.title === 'string' ? item.title : `entry ${index}`;
      issues.push(`${label} "${title}" is missing a slug.`);
      return;
    }

    if (map.has(slug)) {
      issues.push(`${label} slug "${slug}" appears multiple times.`);
      return;
    }

    if (directory) {
      ensurePageExists(directory, slug, label);
    }

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) {
      issues.push(`${label} entry with slug "${slug}" is missing a title.`);
    }

    map.set(slug, item);
  });

  return map;
}

function buildTitleIndex(map) {
  const result = new Map();
  map.forEach((item, slug) => {
    const title = typeof item.title === 'string' ? item.title.trim().toLowerCase() : '';
    if (title && !result.has(title)) {
      result.set(title, { slug, item });
    }
  });
  return result;
}

function checkReferenceList({
  sourceLabel,
  sourceItem,
  listKey,
  targetLabel,
  targetMap,
  targetTitleIndex,
}) {
  const list = sourceItem[listKey];

  if (list === undefined) {
    return;
  }

  if (!Array.isArray(list)) {
    issues.push(
      `${sourceLabel} "${sourceItem.title}" has a non-array "${listKey}" relationship.`,
    );
    return;
  }

  const seen = new Set();

  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      issues.push(
        `${sourceLabel} "${sourceItem.title}" has an invalid entry in "${listKey}" at position ${index}.`,
      );
      return;
    }

    const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';

    if (!slug) {
      if (title) {
        const normalized = title.toLowerCase();
        const match = targetTitleIndex.get(normalized);
        if (match) {
          issues.push(
            `${sourceLabel} "${sourceItem.title}" references ${targetLabel} "${title}" without a slug (expected "${match.slug}").`,
          );
          return;
        }
      }

      issues.push(
        `${sourceLabel} "${sourceItem.title}" references ${targetLabel} "${title || `entry ${index}`}" without a slug.`,
      );
      return;
    }

    if (seen.has(slug)) {
      issues.push(
        `${sourceLabel} "${sourceItem.title}" references ${targetLabel} slug "${slug}" multiple times in "${listKey}".`,
      );
      return;
    }
    seen.add(slug);

    if (!targetMap.has(slug)) {
      if (title) {
        const normalized = title.toLowerCase();
        const match = targetTitleIndex.get(normalized);
        if (match) {
          issues.push(
            `${sourceLabel} "${sourceItem.title}" references ${targetLabel} "${title}" using slug "${slug}" but the site uses slug "${match.slug}".`,
          );
          return;
        }
      }

      issues.push(
        `${sourceLabel} "${sourceItem.title}" references missing ${targetLabel} slug "${slug}"${
          title ? ` (title "${title}")` : ''
        }.`,
      );
    }
  });
}

function verifyDirectoryCoverage(directory, slugMap, label) {
  const dirPath = join(rootDir, directory);
  let entries = [];
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    issues.push(`Unable to read directory ${directory}: ${error.message}`);
    return;
  }

  entries.forEach((entry) => {
    if (!entry.isDirectory()) {
      return;
    }
    if (!slugMap.has(entry.name)) {
      issues.push(`${label} directory "${directory}/${entry.name}" does not match any entry in data/index.json.`);
    }
  });
}

function checkBodySignals(feeling) {
  const list = feeling.bodySignals;
  if (list === undefined) {
    issues.push(`Feeling "${feeling.title}" is missing bodySignals data.`);
    return;
  }
  if (!Array.isArray(list)) {
    issues.push(`Feeling "${feeling.title}" has non-array bodySignals data.`);
    return;
  }
  list.forEach((signal, index) => {
    if (typeof signal !== 'string' || !signal.trim()) {
      issues.push(
        `Feeling "${feeling.title}" has an invalid body signal entry at position ${index}.`,
      );
    }
  });
}

// Some reverse inference entries are intentionally absent while data is collected.
// Track those keys explicitly so the integrity check still passes but we can
// continue catching unexpected omissions if new feelings point to missing data.
const KNOWN_INFERENCE_GAPS = new Set(['uncertain']);

clearMissingVocabularySpreadsheet();

const dataset = readJsonFile('data/index.json');
const reverseIndex = readJsonFile('data/reverse-inference.json');

const {
  BODY_REGIONS,
  QUADRANT_SUGGESTIONS,
  EMOTION_LIBRARY,
} = await import(new URL('../scripts/alexithymia-support-data.js', import.meta.url));

const feelings = ensureArray(dataset.feelings, 'Feelings');
const needs = ensureArray(dataset.needs, 'Needs');
const situations = ensureArray(dataset.situations, 'Situations');
const strategies = ensureArray(dataset.strategies, 'Strategies');

const feelingsBySlug = createSlugIndex(feelings, { label: 'Feeling', directory: 'feelings' });
const needsBySlug = createSlugIndex(needs, { label: 'Need', directory: 'needs' });
const situationsBySlug = createSlugIndex(situations, {
  label: 'Situation',
  directory: 'situations',
});
const strategiesBySlug = createSlugIndex(strategies, { label: 'Strategy' });

const needsByTitle = buildTitleIndex(needsBySlug);
const feelingsByTitle = buildTitleIndex(feelingsBySlug);
const situationsByTitle = buildTitleIndex(situationsBySlug);
const strategiesByTitle = buildTitleIndex(strategiesBySlug);

const alexithymiaFeelingReferences = new Map();
const alexithymiaNeedReferences = new Map();

function trackMissingReference(map, word, context) {
  const normalized = typeof word === 'string' ? word.trim() : '';
  if (!normalized) {
    return;
  }

  const entry = map.get(normalized) ?? new Set();
  entry.add(context);
  map.set(normalized, entry);
}

function ensureFeelingWordHasPage(word, context) {
  const normalized = typeof word === 'string' ? word.trim().toLowerCase() : '';
  if (!normalized) {
    return;
  }

  if (!feelingsByTitle.has(normalized)) {
    trackMissingReference(alexithymiaFeelingReferences, word, context);
  }
}

function ensureNeedWordHasPage(word, context) {
  const normalized = typeof word === 'string' ? word.trim().toLowerCase() : '';
  if (!normalized) {
    return;
  }

  if (!needsByTitle.has(normalized)) {
    trackMissingReference(alexithymiaNeedReferences, word, context);
  }
}

BODY_REGIONS.forEach((region) => {
  region?.options?.forEach((option) => {
    const context = `alexithymia body option "${option?.id ?? 'unknown'}"`;
    Object.keys(option?.emotions ?? {}).forEach((emotion) => {
      ensureFeelingWordHasPage(emotion, context);
    });
  });
});

Object.entries(QUADRANT_SUGGESTIONS ?? {}).forEach(([quadrant, suggestion]) => {
  suggestion?.emotions?.forEach((emotion) => {
    ensureFeelingWordHasPage(emotion, `alexithymia quadrant "${quadrant}"`);
  });
});

Object.entries(EMOTION_LIBRARY ?? {}).forEach(([emotionSlug, config]) => {
  ensureFeelingWordHasPage(emotionSlug, `alexithymia emotion entry "${emotionSlug}"`);
  config?.needs?.forEach((need) => {
    ensureNeedWordHasPage(need, `alexithymia emotion "${emotionSlug}"`);
  });
});

if (alexithymiaFeelingReferences.size > 0) {
  alexithymiaFeelingReferences.forEach((contexts, word) => {
    const contextList = Array.from(contexts).sort().join('; ');
    warnings.push(
      `Alexithymia data references feeling "${word}" (${contextList}) but the site has no matching feeling page.`,
    );
  });
}

if (alexithymiaNeedReferences.size > 0) {
  alexithymiaNeedReferences.forEach((contexts, word) => {
    const contextList = Array.from(contexts).sort().join('; ');
    warnings.push(
      `Alexithymia data references need "${word}" (${contextList}) but the site has no matching need page.`,
    );
  });
}

const missingVocabularyRelativePath = writeMissingVocabularySpreadsheet({
  feelingReferences: alexithymiaFeelingReferences,
  needReferences: alexithymiaNeedReferences,
});

if (alexithymiaFeelingReferences.size > 0 || alexithymiaNeedReferences.size > 0) {
  console.log(`Missing vocabulary spreadsheet saved to ${missingVocabularyRelativePath}.`);
}

verifyDirectoryCoverage('feelings', feelingsBySlug, 'Feeling');
verifyDirectoryCoverage('needs', needsBySlug, 'Need');
verifyDirectoryCoverage('situations', situationsBySlug, 'Situation');

feelings.forEach((feeling) => {
  checkReferenceList({
    sourceLabel: 'Feeling',
    sourceItem: feeling,
    listKey: 'needs',
    targetLabel: 'Need',
    targetMap: needsBySlug,
    targetTitleIndex: needsByTitle,
  });
  checkReferenceList({
    sourceLabel: 'Feeling',
    sourceItem: feeling,
    listKey: 'situations',
    targetLabel: 'Situation',
    targetMap: situationsBySlug,
    targetTitleIndex: situationsByTitle,
  });
  checkBodySignals(feeling);
});

needs.forEach((need) => {
  checkReferenceList({
    sourceLabel: 'Need',
    sourceItem: need,
    listKey: 'strategies',
    targetLabel: 'Strategy',
    targetMap: strategiesBySlug,
    targetTitleIndex: strategiesByTitle,
  });
  checkReferenceList({
    sourceLabel: 'Need',
    sourceItem: need,
    listKey: 'situations',
    targetLabel: 'Situation',
    targetMap: situationsBySlug,
    targetTitleIndex: situationsByTitle,
  });
  checkReferenceList({
    sourceLabel: 'Need',
    sourceItem: need,
    listKey: 'feelings',
    targetLabel: 'Feeling',
    targetMap: feelingsBySlug,
    targetTitleIndex: feelingsByTitle,
  });
});

situations.forEach((situation) => {
  checkReferenceList({
    sourceLabel: 'Situation',
    sourceItem: situation,
    listKey: 'feelings',
    targetLabel: 'Feeling',
    targetMap: feelingsBySlug,
    targetTitleIndex: feelingsByTitle,
  });
  checkReferenceList({
    sourceLabel: 'Situation',
    sourceItem: situation,
    listKey: 'needs',
    targetLabel: 'Need',
    targetMap: needsBySlug,
    targetTitleIndex: needsByTitle,
  });
});

strategies.forEach((strategy) => {
  checkReferenceList({
    sourceLabel: 'Strategy',
    sourceItem: strategy,
    listKey: 'needs',
    targetLabel: 'Need',
    targetMap: needsBySlug,
    targetTitleIndex: needsByTitle,
  });
});

const slugMap = reverseIndex?._meta?.slugMap;
if (!slugMap || typeof slugMap !== 'object') {
  issues.push('Reverse inference slug map is missing.');
}

const reverseKeys = Object.keys(reverseIndex).filter((key) => key !== '_meta');
reverseKeys.forEach((key) => {
  const entry = reverseIndex[key];
  if (!entry || typeof entry !== 'object') {
    issues.push(`Reverse inference entry "${key}" is not an object.`);
    return;
  }

  const nvcList = entry.needsHypotheses?.nvc;
  if (nvcList !== undefined) {
    if (!Array.isArray(nvcList)) {
      issues.push(`Reverse inference entry "${key}" has a non-array needsHypotheses.nvc list.`);
    } else {
      nvcList.forEach((need, index) => {
        const slug = typeof need?.slug === 'string' ? need.slug.trim() : '';
        const title = typeof need?.title === 'string' ? need.title.trim() : '';
        if (!slug) {
          issues.push(
            `Reverse inference entry "${key}" has a needs hypothesis without a slug${
              title ? ` (title "${title}")` : ''
            } at position ${index}.`,
          );
          return;
        }
        if (!needsBySlug.has(slug)) {
          issues.push(
            `Reverse inference entry "${key}" references missing need slug "${slug}"${
              title ? ` (title "${title}")` : ''
            }.`,
          );
        }
      });
    }
  }
});

if (slugMap && typeof slugMap === 'object') {
  Object.entries(slugMap).forEach(([slug, feelingKey]) => {
    if (typeof feelingKey !== 'string' || !feelingKey.trim()) {
      issues.push(`Reverse inference slug map entry for "${slug}" is invalid.`);
      return;
    }
    if (!reverseIndex[feelingKey]) {
      if (KNOWN_INFERENCE_GAPS.has(feelingKey)) {
        return;
      }
      issues.push(
        `Reverse inference slug map points slug "${slug}" to missing entry "${feelingKey}".`,
      );
    }
  });
}

if (warnings.length > 0) {
  const summary = warnings.map((warning, index) => `${index + 1}. ${warning}`).join('\n');
  console.warn(`Data integrity warnings detected:\n${summary}`);
}

if (issues.length > 0) {
  const reportRelativePath = writeFailureReport({
    issueList: issues,
    counts: {
      feelings: feelings.length,
      needs: needs.length,
      situations: situations.length,
      strategies: strategies.length,
      reverseEntries: reverseKeys.length,
    },
  });
  const summary = issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n');
  throw new Error(
    `Data integrity check failed with ${issues.length} issue(s). Detailed report saved to ${reportRelativePath}.\n${summary}`,
  );
}

clearFailureReport();

console.log(
  `Data integrity check passed for ${feelings.length} feelings, ${needs.length} needs, ${situations.length} situations, ${strategies.length} strategies, and ${reverseKeys.length} reverse inference entries.`,
);
