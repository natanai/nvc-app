import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.bedrock-strategy-css-canonicalize.mjs';
let source = readFileSync(path, 'utf8');
const duplicateRule = `.strategy-section {\\n  display: grid;\\n  gap: 0.58rem;\\n}\\n\\n`;
const index = source.indexOf(duplicateRule);
if (index < 0) throw new Error('Expected duplicate strategy-section rule not found in migration block');
source = source.slice(0, index) + source.slice(index + duplicateRule.length);
writeFileSync(path, source, 'utf8');
console.log('Strategy CSS migration now preserves the existing canonical strategy-section owner.');
