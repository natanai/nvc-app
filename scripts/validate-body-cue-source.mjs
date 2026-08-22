import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A duplicate mapping makes generated weights depend on CSV row order. Treat
// that as invalid source data rather than silently choosing one value. This
// validator runs before build:data so ambiguous source never reaches artifacts.
const rootDir = process.cwd();
const sourcePath = join(rootDir, 'data', 'Feelings.csv');
const text = readFileSync(sourcePath, 'utf8').replace(/^\ufeff/, '');

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let sourceLine = 1;
  let rowStartLine = 1;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(cell);
      rows.push({ cells: row, line: rowStartLine });
      row = [];
      cell = '';
      sourceLine += 1;
      rowStartLine = sourceLine;
      continue;
    }

    if (char === '\n') {
      sourceLine += 1;
    }
    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push({ cells: row, line: rowStartLine });
  }

  return rows;
}

const parsedRows = parseCsv(text).filter(({ cells }) => cells.some((cell) => cell.trim() !== ''));
if (!parsedRows.length) {
  throw new Error('Body-cue source validation: data/Feelings.csv is empty.');
}

const header = parsedRows[0].cells.map((cell) => cell.trim());
const dataRows = parsedRows.slice(1);
const column = (name) => {
  const index = header.indexOf(name);
  if (index < 0) {
    throw new Error(`Body-cue source validation: missing required column "${name}".`);
  }
  return index;
};

const rowTypeIndex = column('Row Type');
const regionIndex = column('Cue Region ID');
const optionIndex = column('Cue Option ID');
const feelingIndex = column('Cue Feeling Key');
const weightIndex = column('Cue Weight');

const seen = new Map();
const duplicates = [];

for (const { cells, line } of dataRows) {
  const rowType = (cells[rowTypeIndex] || '').trim().toLowerCase();
  if (rowType !== 'cue') continue;

  const regionId = (cells[regionIndex] || '').trim();
  const optionId = (cells[optionIndex] || '').trim();
  const feelingKey = (cells[feelingIndex] || '').trim();
  const weight = (cells[weightIndex] || '').trim();
  if (!regionId || !optionId || !feelingKey) continue;

  const key = `${regionId}\u0000${optionId}\u0000${feelingKey}`;
  const first = seen.get(key);
  if (first) {
    duplicates.push({ regionId, optionId, feelingKey, first, duplicate: { line, weight } });
  } else {
    seen.set(key, { line, weight });
  }
}

if (duplicates.length) {
  const lines = duplicates.map(({ regionId, optionId, feelingKey, first, duplicate }) => {
    const values = first.weight === duplicate.weight
      ? `both weight ${first.weight || '(blank)'}`
      : `weights ${first.weight || '(blank)'} and ${duplicate.weight || '(blank)'}`;
    return `- ${regionId}/${optionId}/${feelingKey}: lines ${first.line} and ${duplicate.line}, ${values}`;
  });
  throw new Error(
    `Body-cue source contains ${duplicates.length} duplicate cue/emotion mapping${duplicates.length === 1 ? '' : 's'}. ` +
      `Each region/option/feeling tuple must appear exactly once so build output cannot depend on row order.\n${lines.join('\n')}`,
  );
}

console.log(`Body-cue source validation passed for ${seen.size} unique cue/emotion mappings.`);
