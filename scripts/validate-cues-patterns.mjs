#!/usr/bin/env node
/**
 * Usage: node scripts/validate-cues-patterns.mjs
 */

import fs from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCSV,
  splitCuePatterns,
  preparePattern,
  compilePattern,
} from '../lib/observationSuggest.js';
import { slugify } from '../lib/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataDir = join(rootDir, 'data');
const outDir = join(rootDir, 'scripts', 'out');
const sanitizedPath = join(dataDir, 'observation_cues.sanitized.csv');
const rawPath = join(dataDir, 'observation_cues.csv');
const inputPath = fs.existsSync(sanitizedPath) ? sanitizedPath : rawPath;
const failureCsvPath = join(outDir, 'validate-failures.csv');

const feelingsCsv = join(dataDir, 'Feelings.csv');
const needsCsv = join(dataDir, 'Needs.csv');
const fauxFeelingsCsv = join(dataDir, 'Faux Feelings.csv');

function readCsvObjects(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, '');
  const rows = parseCSV(text);
  if (!rows.length) {
    return [];
  }
  const headers = rows[0].map(h => (h || '').trim());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });
}

function buildFeelingSlugSet() {
  const rows = readCsvObjects(feelingsCsv);
  const slugs = new Set();
  rows.forEach(row => {
    const type = (row['Row Type'] || '').trim().toLowerCase();
    if (type && type !== 'feeling') {
      return;
    }
    const override = (row['Slug Override'] || '').trim();
    const title = (row['Feeling Title'] || '').trim();
    const slug = override || slugify(title);
    if (slug) {
      slugs.add(slug);
    }
  });
  return slugs;
}

function buildNeedSlugSet() {
  const rows = readCsvObjects(needsCsv);
  const slugs = new Set();
  rows.forEach(row => {
    const override = (row['Slug Override'] || '').trim();
    const title = (row['Need Title'] || '').trim();
    const slug = override || slugify(title);
    if (slug) {
      slugs.add(slug);
    }
  });
  return slugs;
}

function buildFauxFeelingMatchers() {
  const rows = readCsvObjects(fauxFeelingsCsv);
  return rows
    .map(row => buildFauxFeelingMatcher(row['Slug Override'], row['Faux Feeling Title']))
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

function escapeRegExpLiteral(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureOutDir() {
  mkdirSync(outDir, { recursive: true });
}

function collectCompileFailure(prepared) {
  if (!prepared || !prepared.attempts?.length) {
    return prepared?.error || 'no pattern attempts';
  }
  let lastMessage = null;
  for (const attempt of prepared.attempts) {
    try {
      // eslint-disable-next-line no-new
      new RegExp(attempt, 'i');
    } catch (error) {
      lastMessage = error?.message || null;
    }
  }
  return lastMessage || prepared.error || 'compile failed';
}

function main() {
  const csvText = fs.readFileSync(inputPath, 'utf8').replace(/^\ufeff/, '');
  const rows = parseCSV(csvText);
  if (!rows.length) {
    console.error(`No rows found in ${inputPath}`);
    process.exit(1);
  }

  const header = rows[0].map(h => (h || '').trim().toLowerCase());
  const cueIndex = header.indexOf('cue');
  const patternsIndex = header.findIndex(label => label.startsWith('patterns'));
  const feelingsIndex = header.findIndex(label => label.startsWith('feelings'));
  const needsIndex = header.findIndex(label => label.startsWith('needs'));
  const exampleIndex = header.findIndex(label => label.startsWith('example'));

  if ([cueIndex, patternsIndex, feelingsIndex, needsIndex, exampleIndex].some(idx => idx === -1)) {
    console.error('Cue CSV is missing required columns (cue, patterns, feelings, needs, example).');
    process.exit(1);
  }

  const feelingSlugs = buildFeelingSlugSet();
  const needSlugs = buildNeedSlugSet();
  const fauxMatchers = buildFauxFeelingMatchers();

  const summary = {
    rows: 0,
    pattern_strings: 0,
    compiled_ok: 0,
    compile_errors: 0,
    rows_with_unknown_feelings: 0,
    rows_with_unknown_needs: 0,
    rows_with_faux_hits: 0,
    failure_csv: null,
  };

  const failureRows = [];

  rows.slice(1).forEach((cols, rowOffset) => {
    if (!cols || !cols.length) {
      return;
    }
    summary.rows += 1;
    const rowNumber = rowOffset + 2;
    const cue = String(cols[cueIndex] || '').trim();
    const patternCell = cols[patternsIndex] ?? '';
    const feelingCell = cols[feelingsIndex] ?? '';
    const needCell = cols[needsIndex] ?? '';
    const example = cols[exampleIndex] ?? '';

    const patterns = splitCuePatterns(patternCell);
    summary.pattern_strings += patterns.length;

    const patternFailures = [];

    patterns.forEach(pattern => {
      const prepared = preparePattern(pattern);
      if (!prepared || !prepared.attempts?.length) {
        summary.compile_errors += 1;
        patternFailures.push({ pattern, error: prepared?.error || 'pattern empty' });
        return;
      }
      const compiled = compilePattern(pattern);
      if (compiled) {
        summary.compiled_ok += 1;
      } else {
        summary.compile_errors += 1;
        patternFailures.push({ pattern, error: collectCompileFailure(prepared) });
      }
    });

    const feelings = feelingCell
      .split('|')
      .map(entry => entry.trim())
      .filter(Boolean);
    const needs = needCell
      .split('|')
      .map(entry => entry.trim())
      .filter(Boolean);

    const unknownFeelings = [];
    const feelingSeen = new Set();
    feelings.forEach(value => {
      const slug = slugify(value);
      if (!slug || feelingSeen.has(slug)) {
        return;
      }
      feelingSeen.add(slug);
      if (!feelingSlugs.has(slug)) {
        unknownFeelings.push(value);
      }
    });
    if (unknownFeelings.length) {
      summary.rows_with_unknown_feelings += 1;
    }

    const unknownNeeds = [];
    const needSeen = new Set();
    needs.forEach(value => {
      const slug = slugify(value);
      if (!slug || needSeen.has(slug)) {
        return;
      }
      needSeen.add(slug);
      if (!needSlugs.has(slug)) {
        unknownNeeds.push(value);
      }
    });
    if (unknownNeeds.length) {
      summary.rows_with_unknown_needs += 1;
    }

    const fauxSource = [cue, patternCell, feelingCell, needCell, example]
      .map(value => (typeof value === 'string' ? value : ''))
      .join(' ')
      .toLowerCase();
    const fauxHit = Boolean(fauxSource) && fauxMatchers.some(regex => regex.test(fauxSource));
    if (fauxHit) {
      summary.rows_with_faux_hits += 1;
    }

    if (patternFailures.length || unknownFeelings.length || unknownNeeds.length || fauxHit) {
      if (!patternFailures.length) {
        failureRows.push({
          row: rowNumber,
          cue,
          pattern: '',
          error: '',
          unknownFeelings,
          unknownNeeds,
          fauxHit,
        });
      } else {
        patternFailures.forEach(failure => {
          failureRows.push({
            row: rowNumber,
            cue,
            pattern: failure.pattern,
            error: failure.error,
            unknownFeelings,
            unknownNeeds,
            fauxHit,
          });
        });
      }
    }
  });

  ensureOutDir();
  if (failureRows.length) {
    const lines = ['row,cue,pattern,error,unknown_feelings,unknown_needs,faux_hit'];
    failureRows.forEach(({ row, cue, pattern, error, unknownFeelings, unknownNeeds, fauxHit }) => {
      const safe = value => String(value ?? '').replace(/"/g, '""');
      lines.push(
        `"${safe(row)}","${safe(cue)}","${safe(pattern)}","${safe(error)}","${safe(unknownFeelings.join('|'))}","${safe(unknownNeeds.join('|'))}","${fauxHit ? 'yes' : ''}"`,
      );
    });
    writeFileSync(failureCsvPath, `${lines.join('\n')}\n`, 'utf8');
    summary.failure_csv = failureCsvPath;
  } else if (fs.existsSync(failureCsvPath)) {
    fs.rmSync(failureCsvPath);
  }

  console.log(
    JSON.stringify(
      {
        input: inputPath,
        feelings_catalog: feelingsCsv,
        needs_catalog: needsCsv,
        faux_catalog: fauxFeelingsCsv,
        ...summary,
      },
      null,
      2,
    ),
  );

  const hasUnknowns = summary.rows_with_unknown_feelings > 0 || summary.rows_with_unknown_needs > 0;
  if (summary.compile_errors > 0 || hasUnknowns) {
    process.exit(1);
  }
}

main();
