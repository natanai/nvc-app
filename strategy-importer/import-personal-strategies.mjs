import { readdirSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA_DIR = join(ROOT, 'data');
const STRATEGY_IMPORT_DIR = join(ROOT, 'strategy-importer');
const STRATEGIES_CSV_PATH = join(ROOT, 'data', 'Strategies.csv');

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
        i += 1;
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
  if (!header) {
    return [];
  }
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

function loadNeedsLookup() {
  const csv = readFileSync(join(DATA_DIR, 'Needs.csv'), 'utf8').replace(/\ufeff/g, '');
  const needs = parseCsv(csv);
  const lookup = new Map();

  needs.forEach((row) => {
    const title = (row['Need Title'] || '').trim();
    const slug = (row['Slug Override'] || slugify(title)).trim();
    if (slug) {
      lookup.set(normalizeNeedSlug(slug), title);
    }
  });

  return lookup;
}

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeNeedSlug(value) {
  return slugify(value);
}

function escapeCsv(value) {
  const text = value ?? '';
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsvRow(values) {
  return values.map(escapeCsv).join(',');
}

function readStrategiesCsv() {
  const csv = readFileSync(STRATEGIES_CSV_PATH, 'utf8').replace(/\ufeff/g, '');
  const rows = parseCsv(csv);
  const slugs = new Set();
  const titles = new Set();

  rows.forEach((row) => {
    const title = (row['Strategy Title'] || '').trim();
    const override = (row['Slug Override'] || '').trim();
    const slug = (override || slugify(title)).trim();
    if (slug) {
      slugs.add(slug.toLowerCase());
    }
    if (title) {
      titles.add(title.toLowerCase());
    }
  });

  return { rows, slugs, titles };
}

function extractStrategiesFromFile(path) {
  const content = readFileSync(path, 'utf8');
  let payload;

  try {
    payload = JSON.parse(content);
  } catch (error) {
    console.warn(`Skipping ${path} – not valid JSON.`);
    return [];
  }

  const list = Array.isArray(payload?.personalStrategies)
    ? payload.personalStrategies
    : [];

  if (!list.length) {
    console.warn(`No personal strategies found in ${path}; skipping.`);
    return [];
  }

  return list;
}

function resolveNeedTitles(entry, needLookup) {
  const needCandidates = [];

  const tagCandidates = Array.isArray(entry?.tags) ? entry.tags : [];
  const needSlugs = Array.isArray(entry?.needSlugs) ? entry.needSlugs : [];
  const primary = entry?.needSlug || entry?.sourceNeedPage || '';

  needCandidates.push(...tagCandidates, ...needSlugs, primary);

  const normalized = Array.from(
    new Set(
      needCandidates
        .map((value) => normalizeNeedSlug(value))
        .filter(Boolean)
    )
  );

  const titles = normalized
    .map((slug) => needLookup.get(slug) || '')
    .filter(Boolean);

  if (titles.length) {
    return titles;
  }

  const fallback = (entry?.need || '').trim();
  return fallback ? [fallback] : [];
}

function normalizeContributor(entry) {
  const contributorSource = entry?.contributor && typeof entry.contributor === 'object' ? entry.contributor : {};
  const name = (contributorSource.name || entry?.firstName || '').trim();
  const location = (contributorSource.location || entry?.location || '').trim();
  return { name, location };
}

function buildStrategyRows(files, existingSlugs, existingTitles, needLookup) {
  const newRows = [];
  const seenSlugs = new Set();
  const seenIds = new Set();

  files.forEach((filePath) => {
    const strategies = extractStrategiesFromFile(filePath);
    strategies.forEach((entry) => {
      const strategyId = typeof entry?.id === 'string' || typeof entry?.id === 'number'
        ? String(entry.id).trim()
        : '';
      const title = (entry?.title || '').trim();
      if (!title) {
        console.warn(`Skipping strategy without a title in ${filePath}.`);
        return;
      }

      const lowerTitle = title.toLowerCase();
      if (existingTitles.has(lowerTitle)) {
        console.warn(`Skipping strategy "${title}" – a matching title already exists in Strategies.csv.`);
        return;
      }

      if (strategyId && seenIds.has(strategyId.toLowerCase())) {
        console.warn(`Skipping duplicate strategy id "${strategyId}" within imported files.`);
        return;
      }

      const slug = slugify(title);
      if (!slug) {
        console.warn(`Skipping strategy "${title}" in ${filePath} – slug resolved to empty value.`);
        return;
      }

      const slugKey = slug.toLowerCase();
      if (existingSlugs.has(slugKey)) {
        console.warn(`Skipping strategy "${title}" – slug already exists in Strategies.csv.`);
        return;
      }

      if (seenSlugs.has(slugKey)) {
        console.warn(`Skipping duplicate strategy "${title}" within imported files.`);
        return;
      }

      const needs = resolveNeedTitles(entry, needLookup);
      if (!needs.length) {
        console.warn(
          `Skipping strategy "${title}" in ${filePath} – no recognizable need slugs or names were found.`,
        );
        return;
      }
      const description = (entry?.description || '').trim();
      const { name, location } = normalizeContributor(entry);

      if (strategyId) {
        seenIds.add(strategyId.toLowerCase());
      }

      newRows.push({
        title,
        description,
        needs,
        contributorName: name,
        contributorLocation: location,
      });

      seenSlugs.add(slugKey);
    });
  });

  return newRows;
}

function appendStrategies(rows) {
  if (!rows.length) {
    console.log('No new strategies to append.');
    return false;
  }

  let buffer = '';
  const existing = readFileSync(STRATEGIES_CSV_PATH, 'utf8');
  if (!existing.endsWith('\n')) {
    buffer += '\n';
  }

  rows.forEach((row) => {
    buffer +=
      toCsvRow([
        row.title,
        row.description,
        '',
        row.needs.join(', '),
        row.contributorName,
        row.contributorLocation,
      ]) + '\n';
  });

  appendFileSync(STRATEGIES_CSV_PATH, buffer, 'utf8');
  console.log(`Appended ${rows.length} strategies to data/Strategies.csv.`);
  return true;
}

function main() {
  const files = readdirSync(STRATEGY_IMPORT_DIR)
    .filter((file) => file.toLowerCase().endsWith('.json'))
    .map((file) => join(STRATEGY_IMPORT_DIR, file));

  if (!files.length) {
    console.log('No import files found in strategy-importer/. Exiting.');
    return;
  }

  const needLookup = loadNeedsLookup();
  const { slugs: existingSlugs, titles: existingTitles } = readStrategiesCsv();
  const newRows = buildStrategyRows(files, existingSlugs, existingTitles, needLookup);
  appendStrategies(newRows);
}

main();
