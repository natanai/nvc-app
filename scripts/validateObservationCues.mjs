import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_HEADERS = ['cue', 'patterns (|)', 'feelings (|)', 'needs (|)', 'example'];

function slugify(label) {
  return (label || '')
    .toLowerCase()
    .replace(/[\\/&+]/g, ' and ')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      if (inQuotes && str[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && str[i + 1] === '\n') {
        i++;
      }
      row.push(cur);
      out.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    out.push(row);
  }
  return out;
}

function csvToObjects(text) {
  const rows = parseCSV(text.replace(/^\ufeff/, ''));
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });
}

function loadCSVLabels(csvPath, { labelKey, filterRow } = {}) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = csvToObjects(text);
  const labels = new Set();
  rows.forEach(row => {
    if (filterRow && !filterRow(row)) return;
    const override = String(row['Slug Override'] || '').trim();
    const raw = String(row[labelKey] || '').trim();
    const slug = override || slugify(raw);
    if (slug) {
      labels.add(slug);
    }
  });
  return labels;
}

function compilePattern(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return null;
  }

  const attempts = [trimmed];
  const sanitized = trimmed.replace(/\\.\\?\\*/g, '.*');
  if (sanitized !== trimmed) {
    attempts.push(sanitized);
  }

  for (const attempt of attempts) {
    try {
      return new RegExp(attempt, 'i');
    } catch (error) {
      // continue
    }
  }

  return null;
}

function splitPipeList(value) {
  return String(value || '')
    .split('|')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function formatCueSet(set) {
  const cues = Array.from(set || []);
  cues.sort((a, b) => a.localeCompare(b));
  if (cues.length <= 8) {
    return cues.join(', ');
  }
  const sample = cues.slice(0, 5).join(', ');
  return `${sample}, … (${cues.length} total)`;
}

const root = process.cwd();
const cuesPath = path.join(root, 'data', 'observation_cues.csv');
const feelingsCsv = path.join(root, 'data', 'Feelings.csv');
const needsCsv = path.join(root, 'data', 'Needs.csv');

const cuesText = fs.readFileSync(cuesPath, 'utf8');
const rows = parseCSV(cuesText.replace(/^\ufeff/, ''));
if (!rows.length) {
  console.error('❌ observation_cues.csv is empty');
  process.exit(1);
}

const headers = rows[0].map(h => h.trim());
if (headers.length !== EXPECTED_HEADERS.length || headers.some((h, idx) => h !== EXPECTED_HEADERS[idx])) {
  console.error('❌ observation_cues.csv headers mismatch. Found:', headers.join(', '));
  console.error('   Expected:', EXPECTED_HEADERS.join(', '));
  process.exit(1);
}

const feelingSlugs = loadCSVLabels(feelingsCsv, {
  labelKey: 'Feeling Title',
  filterRow: row => String(row['Row Type'] || '').trim().toLowerCase() === 'feeling',
});
const needSlugs = loadCSVLabels(needsCsv, { labelKey: 'Need Title' });

const errors = [];
const missingFeelings = new Map();
const missingNeeds = new Map();
const duplicateCues = new Set();
const seenCues = new Set();

rows.slice(1).forEach((cols, rowIndex) => {
  const lineNumber = rowIndex + 2;
  if (cols.length !== EXPECTED_HEADERS.length) {
    errors.push(`Line ${lineNumber} has ${cols.length} columns (expected ${EXPECTED_HEADERS.length}).`);
    return;
  }

  const cue = String(cols[0] || '').trim();
  const patternsRaw = cols[1];
  const feelingsRaw = cols[2];
  const needsRaw = cols[3];
  const example = String(cols[4] || '').trim();

  if (!cue) {
    errors.push(`Line ${lineNumber} is missing a cue id.`);
  } else {
    if (!/^[a-z0-9-]+$/.test(cue)) {
      errors.push(`Cue id "${cue}" on line ${lineNumber} is not a slug (allowed: lowercase letters, numbers, hyphens).`);
    }
    if (seenCues.has(cue)) {
      duplicateCues.add(cue);
    }
    seenCues.add(cue);
  }

  const patterns = splitPipeList(patternsRaw);
  if (!patterns.length) {
    errors.push(`Cue "${cue || `line ${lineNumber}`}" must include at least one pattern.`);
  }
  patterns.forEach((pattern, patternIndex) => {
    if (!compilePattern(pattern)) {
      errors.push(`Cue "${cue || `line ${lineNumber}`}": pattern ${patternIndex + 1} ("${pattern}") is not a valid regular expression.`);
    }
  });

  const feelings = splitPipeList(feelingsRaw);
  const needs = splitPipeList(needsRaw);

  if (!feelings.length && !needs.length) {
    errors.push(`Cue "${cue || `line ${lineNumber}`}" must include at least one feeling or need.`);
  }

  const feelingSlugsSeen = new Set();
  feelings.forEach(feeling => {
    const slug = slugify(feeling);
    if (!slug) return;
    if (feelingSlugsSeen.has(slug)) {
      errors.push(`Cue "${cue}": feeling "${feeling}" is listed multiple times.`);
    }
    feelingSlugsSeen.add(slug);
    if (!feelingSlugs.has(slug)) {
      const existing = missingFeelings.get(slug) || { label: feeling, cues: new Set() };
      existing.cues.add(cue || `line ${lineNumber}`);
      missingFeelings.set(slug, existing);
    }
  });

  const needSlugsSeen = new Set();
  needs.forEach(need => {
    const slug = slugify(need);
    if (!slug) return;
    if (needSlugsSeen.has(slug)) {
      errors.push(`Cue "${cue}": need "${need}" is listed multiple times.`);
    }
    needSlugsSeen.add(slug);
    if (!needSlugs.has(slug)) {
      const existing = missingNeeds.get(slug) || { label: need, cues: new Set() };
      existing.cues.add(cue || `line ${lineNumber}`);
      missingNeeds.set(slug, existing);
    }
  });

  if (!example) {
    errors.push(`Cue "${cue || `line ${lineNumber}`}" is missing an example sentence.`);
  }
});

if (duplicateCues.size) {
  duplicateCues.forEach(cue => {
    errors.push(`Cue "${cue}" is defined more than once.`);
  });
}

missingFeelings.forEach((info, slug) => {
  const cueSummary = formatCueSet(info.cues);
  console.warn(`⚠️ Unknown feeling "${info.label}" (slug "${slug}") referenced by cues: ${cueSummary}`);
});

missingNeeds.forEach((info, slug) => {
  const cueSummary = formatCueSet(info.cues);
  console.warn(`⚠️ Unknown need "${info.label}" (slug "${slug}") referenced by cues: ${cueSummary}`);
});

if (errors.length) {
  errors.forEach(err => console.error(`❌ ${err}`));
  process.exit(1);
}

if (!missingFeelings.size && !missingNeeds.size) {
  console.log('✅ observation_cues.csv passes validation');
} else {
  console.log('✅ observation_cues.csv passes validation with warnings');
}
