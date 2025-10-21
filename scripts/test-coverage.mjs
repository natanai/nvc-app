#!/usr/bin/env node
/**
 * Usage: node scripts/test-coverage.mjs
 */

import fs from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCSV,
  splitCuePatterns,
  compilePattern,
  suggestFromObservation,
} from '../lib/observationSuggest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataDir = join(rootDir, 'data');
const testsDir = join(rootDir, 'tests');
const outDir = join(rootDir, 'scripts', 'out');

const sanitizedPath = join(dataDir, 'observation_cues.sanitized.csv');
const rawPath = join(dataDir, 'observation_cues.csv');
const cueCsvPath = fs.existsSync(sanitizedPath) ? sanitizedPath : rawPath;
const coverageInputPath = join(testsDir, 'free-text.txt');
const coverageDetailPath = join(outDir, 'coverage-detail.csv');

function ensureOutDir() {
  mkdirSync(outDir, { recursive: true });
}

function readCueRows() {
  const csvText = fs.readFileSync(cueCsvPath, 'utf8').replace(/^\ufeff/, '');
  const rows = parseCSV(csvText);
  if (!rows.length) {
    throw new Error(`No rows found in ${cueCsvPath}`);
  }

  const header = rows[0].map(h => (h || '').trim().toLowerCase());
  const cueIndex = header.indexOf('cue');
  const patternsIndex = header.findIndex(label => label.startsWith('patterns'));
  const feelingsIndex = header.findIndex(label => label.startsWith('feelings'));
  const needsIndex = header.findIndex(label => label.startsWith('needs'));

  if ([cueIndex, patternsIndex, feelingsIndex, needsIndex].some(idx => idx === -1)) {
    throw new Error('Cue CSV is missing required cue/pattern/feelings/needs columns.');
  }

  return rows.slice(1).map(cols => {
    if (!cols || !cols.length) {
      return null;
    }
    const cue = String(cols[cueIndex] || '').trim();
    const patternCell = cols[patternsIndex] ?? '';
    const feelingsCell = cols[feelingsIndex] ?? '';
    const needsCell = cols[needsIndex] ?? '';

    const patterns = splitCuePatterns(patternCell)
      .map(entry => compilePattern(entry))
      .filter(Boolean);

    const feelings = feelingsCell
      .split('|')
      .map(entry => entry.trim())
      .filter(Boolean);
    const needs = needsCell
      .split('|')
      .map(entry => entry.trim())
      .filter(Boolean);

    return {
      cue,
      patterns,
      feelings,
      needs,
    };
  }).filter(Boolean);
}

function readCoverageInputs() {
  const text = fs.readFileSync(coverageInputPath, 'utf8');
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function writeCoverageDetail(results) {
  ensureOutDir();
  const lines = ['input,matched_count,matched_cues,feelings,needs'];
  results.forEach(({ input, matchedCount, matchedCues, feelings, needs }) => {
    const safe = value => String(value ?? '').replace(/"/g, '""');
    lines.push(
      `"${safe(input)}","${matchedCount}","${safe(matchedCues.join(';'))}","${safe(feelings.join('|'))}","${safe(needs.join('|'))}"`,
    );
  });
  writeFileSync(coverageDetailPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const cues = readCueRows();
  const inputs = readCoverageInputs();

  const results = inputs.map(input => {
    const suggestion = suggestFromObservation(input, cues);
    const matchedCues = suggestion.why || [];
    return {
      input,
      matchedCount: matchedCues.length,
      matchedCues,
      feelings: suggestion.feelings || [],
      needs: suggestion.needs || [],
    };
  });

  const matchedInputs = results.filter(result => result.matchedCount > 0).length;
  const totalInputs = inputs.length;
  const averageMatches = totalInputs
    ? results.reduce((sum, result) => sum + result.matchedCount, 0) / totalInputs
    : 0;
  const coveragePercent = totalInputs ? (matchedInputs / totalInputs) * 100 : 0;

  writeCoverageDetail(results);

  console.log(
    JSON.stringify(
      {
        input: cueCsvPath,
        coverage_inputs: coverageInputPath,
        detail_csv: coverageDetailPath,
        total_inputs: totalInputs,
        matched_inputs: matchedInputs,
        coverage_percent: Number(coveragePercent.toFixed(2)),
        avg_matches_per_input: Number(averageMatches.toFixed(2)),
      },
      null,
      2,
    ),
  );
}

main();
