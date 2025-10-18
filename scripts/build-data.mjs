import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

import { buildReverseInferenceIndex } from './reverse-inference-index.js';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA_DIR = join(ROOT, 'data');

function readCsv(path) {
  const text = readFileSync(join(ROOT, path), 'utf8').replace(/\ufeff/g, '');
  return parseCsv(text);
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      current.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      current.push(cell);
      rows.push(current);
      current = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }

  const [header, ...data] = rows.filter((row) => row.length > 0);
  const trimmedHeader = header.map((h) => h.trim());

  return data
    .map((row) => {
      const obj = {};
      trimmedHeader.forEach((key, index) => {
        obj[key] = (row[index] ?? '').trim();
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((value) => value !== ''));
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitMultiline(value) {
  if (!value) return [];
  return value
    .split(/\r?\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseSupportingSources(value) {
  return splitMultiline(value)
    .map((entry) => entry.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(https?:\/\/\S+)(?:\s+\((.+)\))?$/i);
      if (match) {
        return {
          url: match[1],
          description: (match[2] || '').trim(),
        };
      }
      return {
        url: entry,
        description: '',
      };
    });
}

function uniqueByTitle(items) {
  const seen = new Set();
  return items.filter(({ title }) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeContributorName(value) {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'placeholder' ? trimmed : '';
}

function sanitizeLocation(value) {
  if (!value) {
    return '';
  }
  return value.trim();
}

const rawFeelings = readCsv('data/Feelings.csv');
const rawNeeds = readCsv('data/Needs.csv');
const rawSituations = readCsv('data/Situations.csv');
const rawStrategies = readCsv('data/Strategies.csv');
const rawBodyCues = readCsv('data/BodyCues.csv');

function buildBodyRegions(rows) {
  const regions = [];
  const regionIndex = new Map();

  rows.forEach((row) => {
    const regionId = row.regionId;
    if (!regionId) return;

    let region = regionIndex.get(regionId);
    if (!region) {
      region = {
        id: regionId,
        label: row.regionLabel || '',
        prompt: row.prompt || '',
        options: [],
        _optionIndex: new Map(),
      };
      regionIndex.set(regionId, region);
      regions.push(region);
    }

    const optionId = row.optionId;
    if (!optionId) return;

    let option = region._optionIndex.get(optionId);
    if (!option) {
      option = {
        id: optionId,
        title: row.optionTitle || '',
        note: row.optionNote || '',
        insight: row.optionInsight || '',
        emotions: {},
      };
      region._optionIndex.set(optionId, option);
      region.options.push(option);
    }

    const feelingKey = row.feelingKey;
    const weight = Number(row.weight);
    if (feelingKey && Number.isFinite(weight) && weight > 0) {
      option.emotions[feelingKey] = weight;
    }
  });

  return regions.map((region) => {
    const { _optionIndex, ...rest } = region;
    rest.options = region.options.map((option) => ({
      ...option,
    }));
    return rest;
  });
}

const bodyRegions = buildBodyRegions(rawBodyCues);

const feelings = rawFeelings.map((row) => ({
  title: row.Title,
  slug: row.Slug || slugify(row.Title),
  description: row.Description || '',
  situations: uniqueByTitle(splitList(row.Situations).map((title) => ({ title }))),
  needs: uniqueByTitle(splitList(row.Needs).map((title) => ({ title }))),
  bodySignals: splitList(row.Body),
}));

const needs = rawNeeds.map((row) => ({
  title: row.Title,
  slug: row.Slug || slugify(row.Title),
  category: row.Category || '',
  description: row.Description || '',
  strategies: uniqueByTitle(splitList(row.Strategies).map((title) => ({ title }))),
  situations: uniqueByTitle(splitList(row.Situations).map((title) => ({ title }))),
  feelings: uniqueByTitle(splitList(row.Feelings).map((title) => ({ title }))),
  originalClaim: row['Original Claim'] || '',
  rewrittenClaim: row['Rewritten Claim'] || '',
  supportingSources: parseSupportingSources(row['Supporting Sources']),
}));

const situations = rawSituations.map((row) => ({
  title: row.Title,
  slug: slugify(row.Title),
  feelings: uniqueByTitle(splitList(row.Feelings).map((title) => ({ title }))),
  needs: uniqueByTitle(splitList(row.Needs).map((title) => ({ title }))),
}));

const strategies = rawStrategies.map((row) => ({
  title: row.Title,
  slug: slugify(row.Title),
  description: row.Description || '',
  needs: uniqueByTitle(splitList(row.Needs).map((title) => ({ title }))),
  firstName: sanitizeContributorName(row['First Name']),
  location: sanitizeLocation(row.Location),
}));

const feelingsMap = new Map(feelings.map((item) => [item.title.toLowerCase(), item.slug]));
const needsMap = new Map(needs.map((item) => [item.title.toLowerCase(), item.slug]));
const situationsMap = new Map(situations.map((item) => [item.title.toLowerCase(), item.slug]));
const strategiesMap = new Map(strategies.map((item) => [item.title.toLowerCase(), item.slug]));

function attachSlugs(collection, listKey, slugMap) {
  collection.forEach((item) => {
    item[listKey] = item[listKey].map(({ title }) => ({
      title,
      slug: slugMap.get(title.toLowerCase()) || null,
    }));
  });
}

attachSlugs(feelings, 'needs', needsMap);
attachSlugs(feelings, 'situations', situationsMap);
attachSlugs(needs, 'strategies', strategiesMap);
attachSlugs(needs, 'situations', situationsMap);
attachSlugs(needs, 'feelings', feelingsMap);
attachSlugs(situations, 'feelings', feelingsMap);
attachSlugs(situations, 'needs', needsMap);
attachSlugs(strategies, 'needs', needsMap);

mkdirSync(DATA_DIR, { recursive: true });

const dataset = { feelings, needs, situations, strategies };

writeFileSync(join(DATA_DIR, 'index.json'), JSON.stringify(dataset, null, 2));
writeFileSync(join(DATA_DIR, 'body-regions.json'), `${JSON.stringify(bodyRegions, null, 2)}\n`);

const reverseIndex = buildReverseInferenceIndex({ needs, feelings, bodyRegions });
writeFileSync(join(DATA_DIR, 'reverse-inference.json'), `${JSON.stringify(reverseIndex, null, 2)}\n`);

console.log('Wrote data/index.json, data/body-regions.json, and data/reverse-inference.json');
