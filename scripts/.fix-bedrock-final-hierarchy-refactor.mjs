import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.bedrock-final-hierarchy-refactor.mjs';
let source = readFileSync(path, 'utf8');
const replacements = [
  ["replaceCssRule(source, '.strategy-section',", "replaceCssRule(source, '\\n.strategy-section',"],
  ["replaceCssRule(source, '.strategy-deck',", "replaceCssRule(source, '\\n.strategy-deck',"],
  ["replaceCssRule(source, '.strategy-deck__toggle',", "replaceCssRule(source, '\\n.strategy-deck__toggle',"],
  ["replaceCssRule(source, '.strategy-form',", "replaceCssRule(source, '\\n.strategy-form',"],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Missing migration call: ${before}`);
  source = source.replace(before, after);
}
writeFileSync(path, source, 'utf8');
console.log('Final hierarchy migration selector targeting corrected.');
