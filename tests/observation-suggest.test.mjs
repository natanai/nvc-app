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

test('limits module hits and reports overflow', () => {
  const observation =
    'Yesterday at 3 p.m. in the conference room with Alex I heard him say "Please follow up" after they had emailed me 5 times.';
  const library = createMockCueLibrary();

  const result = suggestFromObservation(observation, library, 6, { maxModules: 2 });

  assert.equal(result.hits.length, 2);
  assert.equal(result.totalHits, 3);
  assert.equal(result.overflow, 1);
});

test('honors builder override when matchers are absent', () => {
  const observation =
    'When yesterday afternoon, with my teammate in the conference room, I heard them start speaking while I was still mid-sentence.';
  const library = {
    cues: [],
    modules: [
      {
        id: 'structured-interruption',
        label: 'Spoken interruption',
        summary: 'Someone begins speaking before the first speaker has finished.',
        slotIds: ['time', 'context', 'sensory'],
        matchers: [],
        feelings: ['frustrated'],
        needs: ['respect'],
      },
    ],
  };

  const builderOverride = {
    moduleId: 'structured-interruption',
    actionId: 'structured-interruption',
    detailId: 'structured-interruption-detail',
    detailValue: 'them start speaking while I was still mid-sentence',
  };

  const result = suggestFromObservation(observation, library, 6, { builderOverride });

  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].module.id, 'structured-interruption');
  assert.equal(result.hits[0].match.type, 'builder');
  assert.deepEqual(new Set(result.slots.coveredIds), new Set(['time', 'context', 'sensory']));
  assert.equal(result.overflow, 0);
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
      matchers: createCueMatchers({ patterns: ['conference room'], sourceType: 'builder' }),
      cueIds: ['time-context-cue'],
    },
    {
      id: 'sensory-module',
      label: 'Formula coverage: sensory slot',
      summary: 'Supports the sensory slot.',
      slotIds: ['sensory'],
      matchers: createCueMatchers({ patterns: ['heard him say'], sourceType: 'builder' }),
      cueIds: ['sensory-cue'],
    },
    {
      id: 'measure-module',
      label: 'Formula coverage: measurement slot',
      summary: 'Supports the measurement slot.',
      slotIds: ['measure'],
      matchers: createCueMatchers({ patterns: ['emailed me 5 times'], sourceType: 'builder' }),
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
