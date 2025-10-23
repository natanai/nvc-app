import assert from 'node:assert/strict';

import { createCueMatchers } from '../lib/observationCueMatcher.js';
import { compileObservationCueLibrary } from '../lib/observationCueData.js';
import { suggestFromObservation } from '../lib/observationSuggest.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('summarizes cue modules and formula coverage', () => {
  const observation =
    'Yesterday at 3 p.m. in the conference room with Alex I heard him say "Please follow up" after they had emailed me 5 times.';
  const library = createMockCueLibrary();

  const result = suggestFromObservation(observation, library);

  assert.equal(result.hits.length, 3);
  assert.deepEqual(new Set(result.feelings), new Set(['concerned', 'curious', 'relieved']));
  assert.deepEqual(new Set(result.needs), new Set(['clarity', 'understanding', 'progress']));
  assert.deepEqual(new Set(result.slots.coveredIds), new Set(['time', 'context', 'sensory', 'measure']));
  assert.deepEqual(result.slots.missingIds, []);
  assert.ok(result.slots.supportSummary.length > 0);
  assert.equal(result.slots.missingSummary, '');

  const moduleCounts = Object.fromEntries(result.modules.map(module => [module.id, module.count]));
  assert.deepEqual(moduleCounts, {
    'time-context-module': 1,
    'sensory-module': 1,
    'measure-module': 1,
  });
});

function createMockCueLibrary() {
  const cues = [
    {
      id: 'time-context-cue',
      cue: 'time + context support',
      label: 'Time + context support',
      feelings: ['concerned'],
      needs: ['clarity'],
      slotCoverage: ['time', 'context'],
      matchers: createCueMatchers({ patterns: ['conference room with alex'] }),
      example: 'In the conference room with Alex yesterday.',
      phrases: ['conference room with Alex'],
    },
    {
      id: 'sensory-cue',
      cue: 'sensory detail prompt',
      label: 'Sensory detail prompt',
      feelings: ['curious'],
      needs: ['understanding'],
      slotCoverage: ['sensory'],
      matchers: createCueMatchers({ patterns: ['heard him say'] }),
      example: 'I heard him say “Please follow up.”',
      phrases: ['heard him say'],
    },
    {
      id: 'measure-cue',
      cue: 'measurement reinforcement',
      label: 'Measurement reinforcement',
      feelings: ['relieved'],
      needs: ['progress'],
      slotCoverage: ['measure'],
      matchers: createCueMatchers({ patterns: ['emailed me 5 times'] }),
      example: 'They emailed me 5 times.',
      phrases: ['emailed me 5 times'],
    },
  ];

  const moduleDefs = [
    {
      id: 'time-context-module',
      label: 'Formula coverage: time and context slots',
      summary: 'Supports the time and context slots.',
      slotIds: ['time', 'context'],
      detectors: [{ type: 'regex', pattern: 'conference room', flags: 'i' }],
      cueIds: ['time-context-cue'],
    },
    {
      id: 'sensory-module',
      label: 'Formula coverage: sensory slot',
      summary: 'Supports the sensory slot.',
      slotIds: ['sensory'],
      detectors: [{ type: 'regex', pattern: 'heard him say', flags: 'i' }],
      cueIds: ['sensory-cue'],
    },
    {
      id: 'measure-module',
      label: 'Formula coverage: measurement slot',
      summary: 'Supports the measurement slot.',
      slotIds: ['measure'],
      detectors: [{ type: 'regex', pattern: 'emailed me 5 times', flags: 'i' }],
      cueIds: ['measure-cue'],
    },
  ];

  return compileObservationCueLibrary({ cues, modules: moduleDefs });
}

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`\u2714 ${name}`);
    } catch (error) {
      console.error(`\u2718 ${name}`);
      throw error;
    }
  }
  console.log('All observation suggestion tests passed.');
}

run();
