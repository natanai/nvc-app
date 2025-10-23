import assert from 'node:assert/strict';

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
    'module-time-context': 1,
    'module-sensory': 1,
    'module-measure': 1,
  });
});

function createMockCueLibrary() {
  const cues = [
    {
      id: 'time-context-cue',
      cue: 'time + context support',
      label: 'Time + context support',
      patterns: [/conference room/i],
      feelings: ['concerned'],
      needs: ['clarity'],
      slotCoverage: ['time', 'context'],
      moduleId: 'module-time-context',
    },
    {
      id: 'sensory-cue',
      cue: 'sensory detail prompt',
      label: 'Sensory detail prompt',
      patterns: [/heard him say/i],
      feelings: ['curious'],
      needs: ['understanding'],
      slotCoverage: ['sensory'],
      moduleId: 'module-sensory',
    },
    {
      id: 'measure-cue',
      cue: 'measurement reinforcement',
      label: 'Measurement reinforcement',
      patterns: [/5 times/i],
      feelings: ['relieved'],
      needs: ['progress'],
      slotCoverage: ['measure'],
      moduleId: 'module-measure',
    },
  ];

  const modules = [
    {
      id: 'module-time-context',
      label: 'Formula coverage: time and context slots',
      summary: 'Supports the time and context slots.',
      slotIds: ['time', 'context'],
    },
    {
      id: 'module-sensory',
      label: 'Formula coverage: sensory slot',
      summary: 'Supports the sensory slot.',
      slotIds: ['sensory'],
    },
    {
      id: 'module-measure',
      label: 'Formula coverage: measurement slot',
      summary: 'Supports the measurement slot.',
      slotIds: ['measure'],
    },
  ];

  const slotIndex = {
    time: ['module-time-context'],
    context: ['module-time-context'],
    sensory: ['module-sensory'],
    measure: ['module-measure'],
  };

  return { cues, modules, slotIndex };
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
