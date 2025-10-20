#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'node:perf_hooks';

import { suggestFromObservation } from '../lib/observationSuggest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const DEFAULT_INPUT = join(rootDir, 'data', 'observation_cues.sanitized.csv');

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = str[i + 1];
    if (ch === '"') {
      if (inQ && next === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (cur.length || row.length) {
        row.push(cur);
        out.push(row);
        row = [];
        cur = '';
      }
      if (ch === '\r' && next === '\n') {
        i++;
      }
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

function compilePattern(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return null;
  }

  const attempts = [trimmed];
  const sanitized = trimmed.replace(/\.\?\*/g, '.*');
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

function formatCuePhrase(rawPattern) {
  const trimmed = typeof rawPattern === 'string' ? rawPattern.trim() : '';
  if (!trimmed) {
    return '';
  }
  const withoutAnchors = trimmed.replace(/^[\^]/, '').replace(/[\$]$/, '');
  return withoutAnchors
    .replace(/\\b/g, '')
    .replace(/\.\*/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCueLabel(slug) {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (!trimmed) {
    return '';
  }
  const spaced = trimmed.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced
    .split(' ')
    .map(token => (token ? token[0].toUpperCase() + token.slice(1) : ''))
    .join(' ');
}

function chooseCuePhrase(patternHints, cueValue) {
  const candidates = Array.isArray(patternHints) ? patternHints.filter(Boolean) : [];
  if (candidates.length) {
    const sorted = [...new Set(candidates)].sort((a, b) => a.length - b.length);
    return sorted[0];
  }
  const fallbackLabel = formatCueLabel(cueValue);
  if (fallbackLabel) {
    return fallbackLabel;
  }
  const fallback = formatCuePhrase(cueValue);
  return fallback || cueValue || '';
}

async function main({ inputPath = DEFAULT_INPUT } = {}) {
  const text = await readFile(inputPath, 'utf8');
  const rows = parseCSV(text);
  const dataRows = rows.slice(1).filter(r => r.length >= 5);

  const compileStart = performance.now();
  const cues = dataRows.map(cols => {
    const [cue, patternsRaw, feelingsRaw, needsRaw, example] = cols;
    const rawPatterns = (patternsRaw || '')
      .split('|')
      .map(p => (p || '').trim())
      .filter(Boolean);
    const patterns = rawPatterns.map(p => compilePattern(p)).filter(Boolean);
    const feelings = (feelingsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
    const needs = (needsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
    const patternHints = rawPatterns.map(p => formatCuePhrase(p)).filter(Boolean);
    const cueValue = (cue || '').trim();
    return {
      cue: cueValue,
      label: formatCueLabel(cueValue),
      patterns,
      feelings,
      needs,
      example: (example || '').trim(),
      phrase: chooseCuePhrase(patternHints, cueValue),
      phrases: patternHints,
    };
  });
  const compileEnd = performance.now();

  const totalPatterns = cues.reduce((sum, row) => sum + row.patterns.length, 0);
  const regexCompileMs = compileEnd - compileStart;

  const baseInput = 'At 4 pm I saw the report with 3 errors on the dashboard and saved the screenshot.';
  let matchInput = baseInput;
  while (matchInput.length < 200) {
    matchInput += ' ' + baseInput;
  }
  matchInput = matchInput.slice(0, 200);

  const iterations = 100;
  const matchStart = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    suggestFromObservation(matchInput, cues);
  }
  const matchEnd = performance.now();
  const averageMatchMs = (matchEnd - matchStart) / iterations;

  const summary = {
    rows: cues.length,
    patterns: totalPatterns,
    regexCompileMs,
    matchInputLength: matchInput.length,
    matchIterations: iterations,
    matchAverageMs: averageMatchMs,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
