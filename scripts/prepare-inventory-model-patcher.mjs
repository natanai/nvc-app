import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = 'scripts/apply-inventory-model-v1.mjs';
const targetPath = '/tmp/apply-inventory-model-v1.mjs';
let source = readFileSync(sourcePath, 'utf8');

const badLine = "    button.setAttribute('aria-label', \\`\\${need.title}, \\${count ? `${count} saved ${count === 1 ? 'strategy' : 'strategies'}` : 'no saved strategies'}. \\${expanded ? 'Hide' : 'Show'} details.\\`);";
const replacement = `    const savedLabel = count
      ? String(count) + ' saved ' + (count === 1 ? 'strategy' : 'strategies')
      : 'no saved strategies';
    button.setAttribute(
      'aria-label',
      need.title + ', ' + savedLabel + '. ' + (expanded ? 'Hide' : 'Show') + ' details.'
    );`;

if (!source.includes(badLine)) {
  throw new Error('Expected nested-template Inventory patcher line was not found.');
}

source = source.replace(badLine, replacement);
writeFileSync(targetPath, source);
console.log(targetPath);
