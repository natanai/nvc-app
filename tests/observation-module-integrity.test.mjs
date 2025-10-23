import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileObservationCueLibrary,
  parseObservationCueCSV,
  parseObservationCueModules,
} from '../lib/observationCueData.js';

async function loadLibrary() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(__dirname, '..');
  const csvPath = path.join(rootDir, 'data', 'observation_cues.sanitized.csv');
  const modulesPath = path.join(rootDir, 'data', 'observation_cue_modules.json');
  const [csvText, modulesText] = await Promise.all([
    fs.readFile(csvPath, 'utf8'),
    fs.readFile(modulesPath, 'utf8'),
  ]);
  const cues = parseObservationCueCSV(csvText);
  const moduleDefs = parseObservationCueModules(modulesText);
  return compileObservationCueLibrary({ cues, modules: moduleDefs });
}

async function run() {
  const library = await loadLibrary();
  const { modules, cues } = library;

  assert.ok(modules.length > 0, 'Expected compiled modules');
  assert.ok(cues.length > 0, 'Expected cue rows');

  modules.forEach(module => {
    assert.ok(module.id, 'module missing id');
    assert.ok(Array.isArray(module.matchers), `module ${module.id} missing matchers array`);
    assert.ok(module.matchers.length > 0, `module ${module.id} should expose matchers`);
    if (Array.isArray(module.slotIds) && module.slotIds.length) {
      assert.ok(module.slotSummary && module.slotSummary.length > 0, `module ${module.id} missing slot summary`);
    }
  });

  const assigned = new Set(modules.flatMap(module => module.cueIds || []));
  cues.forEach(cue => {
    assert.ok(assigned.has(cue.id), `cue ${cue.id} was not assigned to a module`);
    assert.ok(cue.moduleId, `cue ${cue.id} missing moduleId`);
  });

  const groupedModules = modules.filter(module => Array.isArray(module.cueIds) && module.cueIds.length > 1);
  assert.ok(
    groupedModules.length >= 50,
    `expected at least 50 grouped modules, found ${groupedModules.length}`,
  );

  const autoModules = modules.filter(module => module.auto);
  assert.ok(autoModules.length >= 40, `expected auto-generated modules to cover repeated cues`);

  const fallbackModules = modules.filter(module => module.id.startsWith('module-'));
  assert.ok(
    fallbackModules.length < cues.length / 2,
    `fallback modules should shrink after grouping, found ${fallbackModules.length}`,
  );

  console.log('Observation module integrity checks passed.');
}

run().catch(error => {
  console.error('Observation module integrity failed');
  throw error;
});
