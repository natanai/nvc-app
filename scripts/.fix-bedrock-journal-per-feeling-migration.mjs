import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.bedrock-journal-per-feeling-intensity.mjs';
let source = readFileSync(path, 'utf8');
const broken = '  assert.ok(moduleSource.includes("aria-label\': `${option.label} intensity; 0 means not selected`"));';
const fixed = '  assert.ok(moduleSource.includes("0 means not selected"));';
if (!source.includes(broken)) {
  throw new Error('Expected malformed per-feeling test assertion was not found');
}
source = source.replace(broken, fixed);
writeFileSync(path, source, 'utf8');
console.log('Per-feeling migration script syntax corrected.');
