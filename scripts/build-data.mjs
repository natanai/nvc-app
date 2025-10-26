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

function normalizeNeedStateValue(value) {
  const tokens = splitList(value).map((entry) => entry.toLowerCase());
  const states = new Set();
  tokens.forEach((token) => {
    if (token === 'both') {
      states.add('met');
      states.add('unmet');
    } else if (token === 'met' || token === 'unmet') {
      states.add(token);
    }
  });
  if (states.size >= 2) {
    return 'both';
  }
  if (states.has('unmet')) {
    return 'unmet';
  }
  return 'met';
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseSupportingSources(value) {
  const bulletRegex = /(?:[-•]\s*)?https?:\/\/\S+(?:[^-•]|-(?!\s*https?:\/\/))*/g;

  return splitMultiline(value)
    .flatMap((rawEntry) => {
      const entry = rawEntry.trim();
      if (!entry) return [];
      const matches = entry.match(bulletRegex);
      if (matches && matches.length > 0) {
        return matches.map((match) => match.trim());
      }
      return [entry];
    })
    .map((entry) => entry.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .map((entry) => {
      const pipeSegments = entry
        .split('|')
        .map((segment) => segment.trim())
        .filter(Boolean);

      if (pipeSegments.length >= 2 && /^https?:\/\/\S+$/i.test(pipeSegments[0])) {
        return {
          url: pipeSegments[0],
          description: pipeSegments.slice(1).join(' | ').trim(),
        };
      }

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

function filterDuplicateNeeds(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const title = (row['Need Title'] || '').trim();
    if (!title || title.toLowerCase() === 'title') {
      return false;
    }

    const slugField = row['Slug Override'] && row['Slug Override'].trim() ? row['Slug Override'].trim() : '';
    const slugSource = slugField || slugify(title);
    const slug = slugSource.toLowerCase();
    if (!slug) {
      return false;
    }

    if (seen.has(slug)) {
      return false;
    }
    seen.add(slug);
    return true;
  });
}

const rawFeelingsSheet = readCsv('data/Feelings.csv');
const rawPoemText = readFileSync(join(ROOT, 'data', 'poems_formatted.txt'), 'utf8').replace(/\ufeff/g, '');
const rawFeelingNeedStates = readCsv('data/FeelingNeedStates.csv');

function parseFormattedPoems(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];

  let current = null;

  const finishCurrent = () => {
    if (!current) {
      return;
    }

    const rawQuote = current.lines.join('\n').replace(/[\s\u00A0]+$/u, '');
    entries.push({
      title: current.title.trim(),
      poemQuote: rawQuote,
      poemUrl: current.url.trim(),
    });
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!current) {
      if (!trimmed) {
        continue;
      }
      current = {
        title: trimmed,
        lines: [],
        url: '',
      };
      continue;
    }

    if (!trimmed && !current.url) {
      current.lines.push('');
      continue;
    }

    if (!trimmed && current.url) {
      continue;
    }

    if (trimmed === '-') {
      finishCurrent();
      continue;
    }

    if (!current.url && /^https?:\/\//i.test(trimmed)) {
      current.url = trimmed;
      continue;
    }

    current.lines.push(line.replace(/\r$/, ''));
  }

  finishCurrent();

  return entries;
}

const formattedPoems = parseFormattedPoems(rawPoemText);
const poemLookup = new Map();

for (const entry of formattedPoems) {
  const slug = slugify(entry.title);
  if (!slug) {
    continue;
  }
  poemLookup.set(slug, {
    poemQuote: entry.poemQuote,
    poemUrl: entry.poemUrl,
  });
}
const rawNeeds = filterDuplicateNeeds(readCsv('data/Needs.csv'));
const rawFauxFeelings = readCsv('data/Faux Feelings.csv');
const rawStrategies = readCsv('data/Strategies.csv');

function partitionFeelingsSheet(rows) {
  const feelingRows = [];
  const cueRows = [];

  rows.forEach((row) => {
    const type = (row['Row Type'] || '').trim().toLowerCase();
    if (type === 'cue') {
      cueRows.push(row);
      return;
    }
    if (!type || type === 'feeling') {
      feelingRows.push(row);
    }
  });

  return { feelingRows, cueRows };
}

const { feelingRows: rawFeelings, cueRows: rawCueRows } = partitionFeelingsSheet(rawFeelingsSheet);

function buildBodyRegions(rows) {
  const regions = [];
  const regionIndex = new Map();

  rows.forEach((row) => {
    const regionId = row['Cue Region ID'];
    if (!regionId) return;

    let region = regionIndex.get(regionId);
    if (!region) {
      region = {
        id: regionId,
        label: row['Cue Region Label'] || '',
        prompt: row['Cue Region Prompt'] || '',
        options: [],
        _optionIndex: new Map(),
      };
      regionIndex.set(regionId, region);
      regions.push(region);
    }

    const optionId = row['Cue Option ID'];
    if (!optionId) return;

    let option = region._optionIndex.get(optionId);
    if (!option) {
      option = {
        id: optionId,
        title: row['Cue Option Title'] || '',
        note: row['Cue Option Note'] || '',
        insight: row['Cue Option Insight'] || '',
        emotions: {},
      };
      region._optionIndex.set(optionId, option);
      region.options.push(option);
    }

    const feelingKey = row['Cue Feeling Key'];
    const weight = Number(row['Cue Weight']);
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

const bodyRegions = buildBodyRegions(rawCueRows);

const feelings = rawFeelings.map((row) => {
  const title = row['Feeling Title'];
  const baseSlug = slugify(title);
  const slugOverride = (row['Slug Override'] || '').trim();
  const slug = slugOverride || baseSlug;
  const poemEntry = poemLookup.get(slug) || poemLookup.get(baseSlug) || { poemQuote: '', poemUrl: '' };

  return {
    title,
    slug,
    description: row['Page Summary'] || '',
    fauxFeelings: uniqueByTitle(splitList(row['Related Faux Feelings']).map((title) => ({ title }))),
    needs: uniqueByTitle(splitList(row['Related Needs']).map((title) => ({ title }))),
    bodySignals: splitList(row['Body Signal Notes']),
    poemQuote: poemEntry.poemQuote,
    poemUrl: poemEntry.poemUrl,
    needStates: {},
  };
});

const needs = rawNeeds.map((row) => ({
  title: row['Need Title'],
  slug: row['Slug Override'] || slugify(row['Need Title']),
  category: row['Category Label'] || '',
  description: row['Page Summary'] || '',
  strategies: uniqueByTitle(splitList(row['Related Strategies']).map((title) => ({ title }))),
  fauxFeelings: uniqueByTitle(splitList(row['Related Faux Feelings']).map((title) => ({ title }))),
  feelings: uniqueByTitle(splitList(row['Related Feelings']).map((title) => ({ title }))),
  originalClaim: row['Claim Summary'] || '',
  rewrittenClaim: row['Claim Narrative'] || '',
  supportingSources: parseSupportingSources(row['Source Links']),
}));

const fauxFeelings = rawFauxFeelings.map((row) => ({
  title: row['Faux Feeling Title'],
  slug: row['Slug Override'] || slugify(row['Faux Feeling Title']),
  feelings: uniqueByTitle(splitList(row['Related Feelings']).map((title) => ({ title }))),
  needs: uniqueByTitle(splitList(row['Related Needs']).map((title) => ({ title }))),
}));

const seenStrategySlugs = new Map();

const strategies = rawStrategies.map((row, index) => {
  const name = sanitizeContributorName(row['Contributor Name']);
  const location = sanitizeLocation(row['Contributor Location']);
  const title = (row['Strategy Title'] || '').trim();
  const slugOverride = (row['Slug Override'] || '').trim();

  if (!title) {
    throw new Error(
      `data/Strategies.csv row ${index + 2} must include a Strategy Title before it can be published.`,
    );
  }

  const slug = slugOverride || slugify(title);

  if (!slug) {
    throw new Error(
      `Strategy "${title}" resolved to an empty slug. Add a value to the "Slug Override" column to continue.`,
    );
  }

  const existingOwner = seenStrategySlugs.get(slug);
  if (existingOwner) {
    throw new Error(
      `Duplicate strategy slug "${slug}" found for "${existingOwner}" and "${title}". Supply a unique "Slug Override" to resolve the collision.`,
    );
  }
  seenStrategySlugs.set(slug, title);

  const entry = {
    title,
    slug,
    description: row['Strategy Summary'] || '',
    needs: uniqueByTitle(splitList(row['Supports Needs']).map((value) => ({ title: value }))),
  };
  if (name || location) {
    entry.contributor = { name, location };
  }
  return entry;
});

const feelingsMap = new Map(feelings.map((item) => [item.title.toLowerCase(), item.slug]));
const needsMap = new Map(needs.map((item) => [item.title.toLowerCase(), item.slug]));
const fauxFeelingsMap = new Map(fauxFeelings.map((item) => [item.title.toLowerCase(), item.slug]));
const strategiesMap = new Map(strategies.map((item) => [item.title.toLowerCase(), item.slug]));
const feelingsBySlug = new Map(feelings.map((item) => [item.slug, item]));
const needsBySlug = new Map(needs.map((item) => [item.slug, item]));

function attachRelationshipSlugs(collection, listKey, slugMap, { parentType, relatedType }) {
  collection.forEach((item) => {
    item[listKey] = item[listKey].map(({ title }) => {
      const slug = slugMap.get(title.toLowerCase());
      if (!slug) {
        throw new Error(
          `${parentType} "${item.title}" references unknown ${relatedType} "${title}". Update the spreadsheet entry to continue.`,
        );
      }
      return { title, slug };
    });
  });
}

attachRelationshipSlugs(feelings, 'needs', needsMap, { parentType: 'Feeling', relatedType: 'Need' });
attachRelationshipSlugs(feelings, 'fauxFeelings', fauxFeelingsMap, {
  parentType: 'Feeling',
  relatedType: 'Faux Feeling',
});
attachRelationshipSlugs(needs, 'strategies', strategiesMap, { parentType: 'Need', relatedType: 'Strategy' });
attachRelationshipSlugs(needs, 'fauxFeelings', fauxFeelingsMap, {
  parentType: 'Need',
  relatedType: 'Faux Feeling',
});
attachRelationshipSlugs(needs, 'feelings', feelingsMap, { parentType: 'Need', relatedType: 'Feeling' });
attachRelationshipSlugs(fauxFeelings, 'feelings', feelingsMap, {
  parentType: 'Faux Feeling',
  relatedType: 'Feeling',
});
attachRelationshipSlugs(fauxFeelings, 'needs', needsMap, {
  parentType: 'Faux Feeling',
  relatedType: 'Need',
});
attachRelationshipSlugs(strategies, 'needs', needsMap, { parentType: 'Strategy', relatedType: 'Need' });

rawFeelingNeedStates.forEach((row, index) => {
  const feelingSlug = (row['Feeling Slug'] || '').trim();
  const needSlug = (row['Need Slug'] || '').trim();
  if (!feelingSlug || !needSlug) {
    return;
  }
  const feeling = feelingsBySlug.get(feelingSlug);
  if (!feeling) {
    throw new Error(
      `data/FeelingNeedStates.csv row ${index + 2} references unknown feeling slug "${feelingSlug}". Update the spreadsheet entry to continue.`,
    );
  }
  const need = needsBySlug.get(needSlug);
  if (!need) {
    throw new Error(
      `data/FeelingNeedStates.csv row ${index + 2} references unknown need slug "${needSlug}". Update the spreadsheet entry to continue.`,
    );
  }
  const normalizedState = normalizeNeedStateValue(row['States']);
  feeling.needStates[need.slug] = normalizedState;
  if (!feeling.needs.some((entry) => entry.slug === need.slug)) {
    feeling.needs.push({ title: need.title, slug: need.slug });
  }
});

feelings.forEach((feeling) => {
  if (!feeling.needStates || typeof feeling.needStates !== 'object') {
    feeling.needStates = {};
  }
  const baseState = feeling.fauxFeelings.length ? 'unmet' : 'met';
  feeling.needs.forEach((entry) => {
    if (!feeling.needStates[entry.slug]) {
      feeling.needStates[entry.slug] = baseState;
    }
  });
});

mkdirSync(DATA_DIR, { recursive: true });

const dataset = { feelings, needs, fauxFeelings, strategies };

writeFileSync(join(DATA_DIR, 'index.json'), JSON.stringify(dataset, null, 2));
writeFileSync(join(DATA_DIR, 'body-regions.json'), `${JSON.stringify(bodyRegions, null, 2)}\n`);

const reverseIndex = buildReverseInferenceIndex({ needs, feelings, bodyRegions });
writeFileSync(join(DATA_DIR, 'reverse-inference.json'), `${JSON.stringify(reverseIndex, null, 2)}\n`);

console.log('Wrote data/index.json, data/body-regions.json, and data/reverse-inference.json');
