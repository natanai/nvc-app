#!/usr/bin/env node
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { splitCuePatterns, preparePattern } from '../lib/observationSuggest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const INPUT_PATH = join(rootDir, 'data', 'observation_cues.sanitized.csv');
const FAILURE_CSV = join(rootDir, 'pattern-contract-failures.csv');

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    const next = str[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur);
        out.push(row);
        row = [];
        cur = '';
      }
      if (ch === '\r' && next === '\n') {
        i += 1;
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

function compileFromPrepared(prepared) {
  if (!prepared || !prepared.attempts.length) {
    return { regex: null, error: prepared?.error || 'no attempts' };
  }
  let lastError = null;
  for (const attempt of prepared.attempts) {
    try {
      return { regex: new RegExp(attempt, 'i'), error: null };
    } catch (error) {
      lastError = error;
    }
  }
  return { regex: null, error: lastError?.message || 'compile failed' };
}

function main() {
  const text = fs.readFileSync(INPUT_PATH, 'utf8');
  const rows = parseCSV(text);
  if (!rows.length) {
    console.error('No rows found in observation cue CSV.');
    process.exit(1);
  }

  const header = rows[0];
  if (!header || header.length < 2) {
    console.error('CSV header is incomplete.');
    process.exit(1);
  }

  const summary = {
    rows: 0,
    patterns: 0,
    autoEscapedLiterals: 0,
    explicitRegex: 0,
    failures: 0,
    failureCsv: null,
  };
  const failures = [];

  rows.slice(1).forEach((cols, index) => {
    if (!cols || !cols.length) {
      return;
    }
    summary.rows += 1;
    const cue = String(cols[0] || '').trim();
    const patternCell = cols[1] ?? '';
    const patterns = splitCuePatterns(patternCell);
    summary.patterns += patterns.length;

    patterns.forEach(pattern => {
      const prepared = preparePattern(pattern);
      if (prepared?.isLiteral) {
        summary.autoEscapedLiterals += 1;
      } else if (prepared) {
        summary.explicitRegex += 1;
      }
      const { regex, error } = compileFromPrepared(prepared);
      if (!regex) {
        summary.failures += 1;
        failures.push({
          row: index + 2,
          cue,
          pattern,
          error: error || prepared?.error || 'compile failed',
        });
      }
    });
  });

  if (failures.length) {
    const lines = ['row,cue,pattern,error'];
    failures.forEach(({ row, cue, pattern, error }) => {
      const safeCue = (cue || '').replace(/"/g, '""');
      const safePattern = (pattern || '').replace(/"/g, '""');
      const safeError = (error || '').replace(/"/g, '""');
      lines.push(`"${row}","${safeCue}","${safePattern}","${safeError}"`);
    });
    fs.writeFileSync(FAILURE_CSV, `${lines.join('\n')}\n`, 'utf8');
    summary.failureCsv = FAILURE_CSV;
  } else if (fs.existsSync(FAILURE_CSV)) {
    fs.rmSync(FAILURE_CSV);
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failures) {
    console.log(`Wrote ${failures.length} compilation failures to ${FAILURE_CSV}`);
  } else {
    console.log('No pattern compilation failures detected.');
  }
}

main();
