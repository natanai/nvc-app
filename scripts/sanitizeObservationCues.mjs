import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { sanitizeObservationText } from '../lib/observationSanitize.js';
import { slugify } from '../lib/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const DEFAULT_INPUT = join(rootDir, 'data', 'observation_cues.csv');
const DEFAULT_OUTPUT = join(rootDir, 'data', 'observation_cues.sanitized.csv');
const DEFAULT_INDEX = join(rootDir, 'data', 'index.json');

export function sanitizeObservationCues({
  inputPath = DEFAULT_INPUT,
  outputPath = DEFAULT_OUTPUT,
  indexPath = DEFAULT_INDEX,
  logger = console,
} = {}) {
  const rawCsv = readFileSync(inputPath, 'utf8').replace(/\ufeff/g, '');
  const rows = parseCsv(rawCsv);
  if (!rows.length) {
    throw new Error(`No rows parsed from observation cues at ${inputPath}`);
  }
  const [header, ...dataRows] = rows;
  const catalogData = JSON.parse(readFileSync(indexPath, 'utf8'));
  const catalog = buildCatalog(catalogData);

  const sanitizedRows = [];
  let dropped = 0;
  let changed = 0;
  let fauxFeelingDrops = 0;

  const exampleIndex = header.findIndex(col => col.toLowerCase().startsWith('example'));
  const cueIndex = header.findIndex(col => col.toLowerCase().startsWith('cue'));

  if (exampleIndex === -1) {
    throw new Error('Expected an "example" column in observation cues CSV.');
  }

  const fauxFeelingMatchers = buildFauxFeelingMatchers(catalog.fauxFeelings);

  dataRows.forEach(row => {
    if (!Array.isArray(row)) {
      dropped += 1;
      return;
    }

    const example = row[exampleIndex] ?? '';
    const sanitizedExample = sanitizeObservationText(example, catalog);

    if (!sanitizedExample) {
      dropped += 1;
      return;
    }

    if (containsFauxFeeling(row, fauxFeelingMatchers)) {
      dropped += 1;
      fauxFeelingDrops += 1;
      return;
    }

    if (sanitizeWhitespace(example) !== sanitizedExample) {
      changed += 1;
    }

    const normalizedRow = [...row];
    normalizedRow[exampleIndex] = sanitizedExample;

    // Ensure cue column trimmed to help downstream matching.
    if (cueIndex !== -1 && typeof normalizedRow[cueIndex] === 'string') {
      normalizedRow[cueIndex] = normalizedRow[cueIndex].trim();
    }

    sanitizedRows.push(normalizedRow);
  });

  const csvOutput = [header, ...sanitizedRows]
    .map(columns => columns.map(encodeCsvCell).join(','))
    .join('\n')
    .concat('\n');

  writeFileSync(outputPath, csvOutput);

  const fauxFeelingSummary =
    fauxFeelingDrops > 0 ? `, removed ${fauxFeelingDrops} containing faux feelings` : '';

  if (logger && typeof logger.info === 'function') {
    logger.info(
      `Sanitized observation cues written to ${outputPath} (kept ${sanitizedRows.length}, dropped ${dropped}${fauxFeelingSummary}, changed ${changed}).`,
    );
  } else if (logger && typeof logger.log === 'function') {
    logger.log(
      `Sanitized observation cues written to ${outputPath} (kept ${sanitizedRows.length}, dropped ${dropped}${fauxFeelingSummary}, changed ${changed}).`,
    );
  }

  return {
    outputPath,
    kept: sanitizedRows.length,
    dropped,
    changed,
    droppedFauxFeelings: fauxFeelingDrops,
  };
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

  return rows;
}

function encodeCsvCell(value) {
  const str = typeof value === 'string' ? value : value == null ? '' : String(value);
  const needsQuotes = /[",\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function sanitizeWhitespace(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/\s+/g, ' ');
}

function buildCatalog(data) {
  const feelings = new Map();
  const needs = new Map();
  const fauxFeelings = new Map();

  if (Array.isArray(data?.feelings)) {
    data.feelings.forEach(item => {
      if (item?.slug) {
        feelings.set(item.slug, {
          slug: item.slug,
          title: item.title || item.slug,
        });
      }
    });
  }

  if (Array.isArray(data?.needs)) {
    data.needs.forEach(item => {
      if (item?.slug) {
        needs.set(item.slug, {
          slug: item.slug,
          title: item.title || item.slug,
        });
      }
    });
  }

  if (Array.isArray(data?.fauxFeelings)) {
    data.fauxFeelings.forEach(item => {
      if (item?.slug) {
        fauxFeelings.set(item.slug, {
          slug: item.slug,
          title: item.title || item.slug,
          feelings: Array.isArray(item.feelings) ? item.feelings.map(f => f.slug).filter(Boolean) : [],
          needs: Array.isArray(item.needs) ? item.needs.map(n => n.slug).filter(Boolean) : [],
        });
      }
    });
  }

  return { feelings, needs, fauxFeelings };
}

function buildFauxFeelingMatchers(fauxFeelings) {
  if (!(fauxFeelings instanceof Map)) {
    return [];
  }

  return [...fauxFeelings.values()]
    .map(item => buildFauxFeelingMatcher(item?.slug, item?.title))
    .filter(Boolean);
}

function buildFauxFeelingMatcher(slug, title) {
  const baseSlug = typeof slug === 'string' && slug ? slug : slugify(title || '');
  if (!baseSlug) {
    return null;
  }

  const tokens = baseSlug
    .split('-')
    .map(token => token.trim())
    .filter(Boolean)
    .map(escapeRegExpLiteral);

  if (!tokens.length) {
    return null;
  }

  const pattern = tokens.join('(?:[-\s]+)');
  return new RegExp(`\\b${pattern}\\b`, 'i');
}

function escapeRegExpLiteral(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsFauxFeeling(row, matchers) {
  if (!Array.isArray(row) || !Array.isArray(matchers) || !matchers.length) {
    return false;
  }

  return row.some(cell => {
    if (typeof cell !== 'string' || !cell) {
      return false;
    }
    return matchers.some(regex => regex.test(cell));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  sanitizeObservationCues();
}
