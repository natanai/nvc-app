import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildReverseInferenceIndex } from './reverse-inference-index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataDir = join(rootDir, 'data');

const PAGE_TO_MODEL_KEY = new Map([
  ['excited', 'excitement'],
  ['joyful', 'joy'],
  ['hopeful', 'hope'],
  ['contented', 'contentment'],
]);
const MODEL_TO_PAGE_KEY = new Map(
  Array.from(PAGE_TO_MODEL_KEY.entries(), ([pageKey, modelKey]) => [modelKey, pageKey]),
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...records] = rows.filter((candidate) => candidate.some((value) => value !== ''));
  if (!header) return [];
  const keys = header.map((value) => value.trim());
  return records.map((values) => Object.fromEntries(keys.map((key, index) => [key, (values[index] ?? '').trim()])));
}

function normalizeCueFeelingKey(value) {
  const key = String(value || '').trim();
  // This is the current public vocabulary key used by Body Cues. The source
  // historically appended this cue as `love`; preserve the production key
  // rather than silently changing the public JSON contract on every rebuild.
  return key === 'love' ? 'love-caring' : key;
}

function buildCanonicalCueWeights(rows) {
  const weights = new Map();
  const order = new Map();

  for (const row of rows) {
    if (String(row['Row Type'] || '').trim().toLowerCase() !== 'cue') continue;
    const regionId = row['Cue Region ID'];
    const optionId = row['Cue Option ID'];
    const feelingKey = normalizeCueFeelingKey(row['Cue Feeling Key']);
    const weight = Number(row['Cue Weight']);
    if (!regionId || !optionId || !feelingKey || !Number.isFinite(weight) || weight <= 0) continue;

    const optionKey = `${regionId}\u0000${optionId}`;
    const weightKey = `${optionKey}\u0000${feelingKey}`;
    const previous = weights.get(weightKey);

    // Several historical migrations produced duplicate cue rows. Their order
    // must never decide production behavior. The strongest reviewed weight is
    // the stable value and reproduces the current live Body Cues data.
    if (previous === undefined || weight > previous) {
      weights.set(weightKey, weight);
    }

    if (!order.has(optionKey)) order.set(optionKey, []);
    const keys = order.get(optionKey);
    if (!keys.includes(feelingKey)) keys.push(feelingKey);
  }

  return { weights, order };
}

function normalizeBodyRegions(bodyRegions, cueSourceRows) {
  const { weights, order } = buildCanonicalCueWeights(cueSourceRows);

  return bodyRegions.map((region) => ({
    ...region,
    options: (region.options || []).map((option) => {
      const optionKey = `${region.id}\u0000${option.id}`;
      const emotionKeys = order.get(optionKey) || Object.keys(option.emotions || {});
      const emotions = {};

      for (const feelingKey of emotionKeys) {
        const weightKey = `${optionKey}\u0000${feelingKey}`;
        const weight = weights.get(weightKey);
        if (Number.isFinite(weight) && weight > 0) emotions[feelingKey] = weight;
      }

      return { ...option, emotions };
    }),
  }));
}

function bodyRegionsForInference(bodyRegions) {
  return bodyRegions.map((region) => ({
    ...region,
    options: (region.options || []).map((option) => {
      const emotions = {};
      for (const [pageKey, weight] of Object.entries(option.emotions || {})) {
        const modelKey = PAGE_TO_MODEL_KEY.get(pageKey) || pageKey;
        const existing = emotions[modelKey];
        emotions[modelKey] = Number.isFinite(existing) ? Math.max(existing, weight) : weight;
      }
      return { ...option, emotions };
    }),
  }));
}

function restorePageFacingInferenceKeys(index) {
  const output = {};

  for (const [modelKey, value] of Object.entries(index)) {
    if (modelKey === '_meta') continue;
    const pageKey = MODEL_TO_PAGE_KEY.get(modelKey) || modelKey;
    const entry = value && typeof value === 'object' ? { ...value } : value;

    if (entry && Array.isArray(entry.evidenceKeys)) {
      entry.evidenceKeys = entry.evidenceKeys.map((key) =>
        key === `emotion-${modelKey}` ? `emotion-${pageKey}` : key,
      );
    }
    output[pageKey] = entry;
  }

  if (index._meta) output._meta = index._meta;
  return output;
}

const cueRows = parseCsv(readFileSync(join(dataDir, 'Feelings.csv'), 'utf8').replace(/\ufeff/g, ''));
const generatedBodyRegions = JSON.parse(readFileSync(join(dataDir, 'body-regions.json'), 'utf8'));
const dataset = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'));

const bodyRegions = normalizeBodyRegions(generatedBodyRegions, cueRows);
const modelBodyRegions = bodyRegionsForInference(bodyRegions);
const modelIndex = buildReverseInferenceIndex({
  needs: dataset.needs || [],
  feelings: dataset.feelings || [],
  bodyRegions: modelBodyRegions,
});
const reverseInference = restorePageFacingInferenceKeys(modelIndex);

writeFileSync(join(dataDir, 'body-regions.json'), `${JSON.stringify(bodyRegions, null, 2)}\n`);
writeFileSync(join(dataDir, 'reverse-inference.json'), `${JSON.stringify(reverseInference, null, 2)}\n`);

console.log('Normalized Body Cues duplicates and rebuilt page-facing reverse inference deterministically.');
