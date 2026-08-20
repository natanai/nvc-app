import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const csvPath = join(rootDir, 'data', 'Feelings.csv');
const generatedPath = join(rootDir, 'data', 'body-regions.json');

const text = readFileSync(csvPath, 'utf8');
const newline = text.includes('\r\n') ? '\r\n' : '\n';
const hadTrailingNewline = /\r?\n$/.test(text);
const lines = text.split(/\r?\n/);
if (hadTrailingNewline && lines.at(-1) === '') lines.pop();

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

const header = parseCsvLine(lines[0]).map((cell) => cell.trim());
const indexOf = (name) => {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`Missing required CSV column: ${name}`);
  return index;
};

const rowTypeIndex = indexOf('Row Type');
const regionIndex = indexOf('Cue Region ID');
const optionIndex = indexOf('Cue Option ID');
const feelingIndex = indexOf('Cue Feeling Key');
const weightIndex = indexOf('Cue Weight');

const generated = JSON.parse(readFileSync(generatedPath, 'utf8'));
const liveWeights = new Map();
for (const region of generated) {
  for (const option of region.options || []) {
    for (const [feelingKey, weight] of Object.entries(option.emotions || {})) {
      liveWeights.set(`${region.id}\u0000${option.id}\u0000${feelingKey}`, Number(weight));
    }
  }
}

const groups = new Map();
for (let index = 1; index < lines.length; index += 1) {
  const cells = parseCsvLine(lines[index]);
  if ((cells[rowTypeIndex] || '').trim().toLowerCase() !== 'cue') continue;
  const regionId = (cells[regionIndex] || '').trim();
  const optionId = (cells[optionIndex] || '').trim();
  const feelingKey = (cells[feelingIndex] || '').trim();
  if (!regionId || !optionId || !feelingKey) continue;
  const key = `${regionId}\u0000${optionId}\u0000${feelingKey}`;
  const entries = groups.get(key) || [];
  entries.push({ index, cells, weight: Number((cells[weightIndex] || '').trim()) });
  groups.set(key, entries);
}

const remove = new Set();
let repairedGroups = 0;
for (const [key, entries] of groups) {
  if (entries.length < 2) continue;
  const liveWeight = liveWeights.get(key);
  if (!Number.isFinite(liveWeight)) {
    throw new Error(`Cannot repair duplicate ${key.replaceAll('\u0000', '/')} because the current generated artifact has no live weight.`);
  }
  const matches = entries.filter((entry) => Number.isFinite(entry.weight) && Math.abs(entry.weight - liveWeight) < 1e-9);
  if (!matches.length) {
    throw new Error(
      `Cannot repair duplicate ${key.replaceAll('\u0000', '/')}: current generated weight is ${liveWeight}, ` +
        `but CSV candidates are ${entries.map((entry) => entry.weight).join(', ')}.`,
    );
  }
  const keep = matches[0];
  for (const entry of entries) {
    if (entry.index !== keep.index) remove.add(entry.index);
  }
  repairedGroups += 1;
  console.log(
    `Preserving live weight ${liveWeight} for ${key.replaceAll('\u0000', '/')} from CSV line ${keep.index + 1}; ` +
      `removing ${entries.length - 1} duplicate row${entries.length === 2 ? '' : 's'}.`,
  );
}

if (!repairedGroups) {
  console.log('No duplicate body-cue mappings require repair.');
  process.exit(0);
}

const outputLines = lines.filter((_, index) => !remove.has(index));
writeFileSync(csvPath, outputLines.join(newline) + (hadTrailingNewline ? newline : ''), 'utf8');
console.log(`Repaired ${repairedGroups} duplicate mapping group${repairedGroups === 1 ? '' : 's'} while preserving current generated/live weights.`);
