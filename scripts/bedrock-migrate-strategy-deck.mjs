import { readFileSync, writeFileSync } from 'node:fs';

const inventoryPath = 'scripts/inventory.js';
const deckPath = 'scripts/strategy-deck.js';
const compilerPath = 'scripts/build-pages.mjs';

const inventory = readFileSync(inventoryPath, 'utf8');
const marker = "\n(function () {\n  const stack = document.querySelector('[data-strategy-stack]');";
const start = inventory.indexOf(marker);
if (start < 0) {
  throw new Error('Could not find the self-contained strategy deck IIFE at the end of inventory.js.');
}
if (inventory.indexOf(marker, start + marker.length) >= 0) {
  throw new Error('Strategy deck marker is not unique in inventory.js.');
}

const before = inventory.slice(0, start);
const deckSource = inventory.slice(start + 1).trimEnd() + '\n';
if (!deckSource.startsWith("(function () {\n  const stack = document.querySelector('[data-strategy-stack]');")) {
  throw new Error('Extracted strategy deck does not start at the expected boundary.');
}
if (!deckSource.endsWith('})();\n')) {
  throw new Error('Strategy deck extraction did not reach the end of inventory.js.');
}
if (before.includes("document.querySelector('[data-strategy-stack]')")) {
  throw new Error('inventory.js still contains another strategy deck owner before the extraction boundary.');
}

writeFileSync(deckPath, deckSource);
writeFileSync(inventoryPath, before.trimEnd() + '\n');

let compiler = readFileSync(compilerPath, 'utf8');
const needStart = compiler.indexOf('function renderNeed(item, allStrategies) {');
const evidenceStart = compiler.indexOf('function renderNeedEvidence(item) {');
if (needStart < 0 || evidenceStart < 0 || evidenceStart <= needStart) {
  throw new Error('Could not isolate renderNeed in build-pages.mjs.');
}

const prefix = compiler.slice(0, needStart);
let needRegion = compiler.slice(needStart, evidenceStart);
const suffix = compiler.slice(evidenceStart);
const oldScripts = `    scripts: [\n      { src: 'scripts/inventory-bluesky.js?v=2026-02-12', module: true },\n    ],`;
const newScripts = `    scripts: [\n      { src: 'scripts/strategy-deck.js', defer: true },\n      { src: 'scripts/inventory-bluesky.js?v=2026-02-12', module: true },\n    ],`;
const scriptCount = needRegion.split(oldScripts).length - 1;
if (scriptCount !== 1) {
  throw new Error(`Expected exactly one Need route script list, found ${scriptCount}.`);
}
needRegion = needRegion.replace(oldScripts, newScripts);
compiler = prefix + needRegion + suffix;
writeFileSync(compilerPath, compiler);
