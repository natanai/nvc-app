import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const factCheckingDir = join(rootDir, 'fact-checking');
const dataDir = join(rootDir, 'data');

function parseCsv(text) {
  const rows = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      current.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      current.push(cell);
      rows.push(current);
      current = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length || current.length) {
    current.push(cell);
    rows.push(current);
  }

  const nonEmpty = rows.filter((row) => row.length > 0);
  const [header, ...data] = nonEmpty;
  if (!header) return [];
  const keys = header.map((value) => value.trim());

  return data
    .map((row) => Object.fromEntries(keys.map((key, index) => [key, (row[index] ?? '').trim()])))
    .filter((row) => Object.values(row).some((value) => value !== ''));
}

function readCsv(name) {
  return parseCsv(readFileSync(join(factCheckingDir, name), 'utf8').replace(/\ufeff/g, ''));
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseEmotions(value) {
  const result = {};
  for (const pair of value ? value.split('|') : []) {
    const [emotion, weight] = pair.split(':');
    const parsed = Number.parseFloat(weight);
    if (emotion && Number.isFinite(parsed)) result[emotion.trim()] = parsed;
  }
  return result;
}

function buildBodyRegions() {
  const grouped = new Map();

  for (const row of readCsv('body-regions.csv')) {
    if (!row.regionId) continue;
    if (!grouped.has(row.regionId)) {
      grouped.set(row.regionId, {
        id: row.regionId,
        label: row.regionLabel,
        prompt: row.prompt,
        options: [],
      });
    }

    grouped.get(row.regionId).options.push({
      id: row.optionId,
      title: row.optionTitle,
      note: row.optionNote,
      insight: row.optionInsight,
      emotions: parseEmotions(row.emotions),
    });
  }

  return Array.from(grouped.values());
}

function buildReverseInference() {
  const grouped = {};

  for (const row of readCsv('reverse-inference.csv')) {
    const feeling = row.feeling;
    if (!feeling) continue;
    if (!grouped[feeling]) {
      grouped[feeling] = {
        zones: row.zones ? row.zones.split('|') : [],
        bodyCues: [],
      };
    }

    grouped[feeling].bodyCues.push({
      regionId: row.regionId,
      regionLabel: row.regionLabel,
      optionId: row.optionId,
      title: row.title,
      note: row.note,
      intensityBand: [parseNumber(row.intensityMin), parseNumber(row.intensityMax)].filter(
        (number) => number !== undefined,
      ),
      arousal: row.arousal || undefined,
      relativeWeight: parseNumber(row.relativeWeight),
      evidenceKey: row.evidenceKey || undefined,
    });
  }

  return grouped;
}

const bodyRegions = buildBodyRegions();
const reverseInference = buildReverseInference();

writeFileSync(join(dataDir, 'body-regions.json'), `${JSON.stringify(bodyRegions, null, 2)}\n`);
writeFileSync(join(dataDir, 'reverse-inference.json'), `${JSON.stringify(reverseInference, null, 2)}\n`);

console.log('Wrote reviewed data/body-regions.json and data/reverse-inference.json from fact-checking CSVs.');
