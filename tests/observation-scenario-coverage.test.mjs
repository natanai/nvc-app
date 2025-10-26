import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileObservationCueLibrary,
  parseObservationCueCSV,
  parseObservationCueModules,
} from '../lib/observationCueData.js';
import { suggestFromObservation } from '../lib/observationSuggest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function loadLibrary() {
  const csvPath = path.join(rootDir, 'data', 'observation_cues.csv');
  const modulesPath = path.join(rootDir, 'data', 'observation_cue_modules.json');
  const [csvText, modulesText] = await Promise.all([
    fs.readFile(csvPath, 'utf8'),
    fs.readFile(modulesPath, 'utf8'),
  ]);
  const cues = parseObservationCueCSV(csvText);
  const moduleDefs = parseObservationCueModules(modulesText);
  return compileObservationCueLibrary({ cues, modules: moduleDefs });
}

const SCENARIOS = [
  {
    text: 'During the morning check-in nobody checked how Mira was doing after she wiped her eyes.',
    moduleId: 'love-caring',
  },
  {
    text: 'They started a meeting in the shared workspace without adding me to the invite.',
    moduleId: 'belonging',
  },
  {
    text: 'After three client appointments in a row there still was no time for a break.',
    moduleId: 'rest',
  },
  {
    text: 'While I was finishing a sentence, Jordan interrupted to change the subject.',
    moduleId: 'consideration',
  },
  {
    text: 'They told me to sign the contract immediately without time to review.',
    moduleId: 'autonomy',
  },
  {
    text: 'The alarm panel showed the sensor offline and nobody addressed it.',
    moduleId: 'safety',
  },
  {
    text: 'The project announcement went out without my name on the contributors list.',
    moduleId: 'contribution',
  },
  {
    text: 'The fluorescent lights flickered through the entire evening.',
    moduleId: 'beauty',
  },
  {
    text: 'They asked me to tone down my description before the meeting.',
    moduleId: 'authenticity',
  },
];

async function run() {
  const library = await loadLibrary();

  SCENARIOS.forEach((scenario, index) => {
    const result = suggestFromObservation(scenario.text, library, 6, { maxModules: 12 });
    assert.ok(result.hits.length > 0, `Expected at least one module hit for scenario ${index + 1}`);
    const moduleIds = result.hits.map(hit => hit.module?.id).filter(Boolean);
    assert.ok(
      moduleIds.includes(scenario.moduleId),
      `Scenario ${index + 1} should include module ${scenario.moduleId}, found ${moduleIds.join(', ')}`,
    );
    assert.ok(result.feelings.length > 0, `Scenario ${index + 1} should surface feeling suggestions`);
    assert.ok(result.needs.length > 0, `Scenario ${index + 1} should surface need suggestions`);
  });

  console.log('Scenario coverage checks passed.');
}

run().catch(error => {
  console.error('Scenario coverage test failed');
  throw error;
});
