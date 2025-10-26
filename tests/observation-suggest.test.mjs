import assert from 'node:assert/strict';

import { createCueMatchers } from '../lib/observationCueMatcher.js';
import { compileObservationCueLibrary } from '../lib/observationCueData.js';
import { aggregateFallbackSuggestions } from '../lib/observationFallback.js';
import { chooseFeelingsForNeeds } from '../lib/observationFeelingSelector.js';
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

test('limits suggestions to four needs and aligned feelings', () => {
  const observation =
    'Yesterday in the lab they skipped asking me for input, they cut off maya mid sentence, we went three shifts without a break, the handoff instructions were unclear, and the sensor kept glitching.';
  const library = createNeedHeavyCueLibrary();

  const result = suggestFromObservation(observation, library);

  assert.equal(result.needs.length, 4);
  assert.deepEqual(result.needs, ['autonomy', 'consideration', 'rest', 'clarity']);
  assert.equal(result.feelings.length, 4);
  const allowedFeelings = new Set(['frustrated', 'tense', 'annoyed', 'hurt', 'drained', 'confused']);
  result.feelings.forEach(feeling => {
    assert.ok(allowedFeelings.has(feeling), `Unexpected feeling suggestion ${feeling}`);
  });
  assert.ok(!result.feelings.includes('scared'));
  assert.ok(!result.needs.includes('stability'));
});

test('aggregates fallback suggestions into four needs with aligned feelings', () => {
  const observation =
    'Yesterday they skipped my update, talked over the briefing, cancelled our break, and gave confusing instructions while alarms kept flashing.';
  const cues = [
    {
      id: 'connection-fallback',
      label: 'Connection fallback',
      cue: 'connection fallback',
      feelings: ['lonely'],
      needs: ['connection'],
      phrases: ['skipped my update'],
      example: 'They skipped my update.',
    },
    {
      id: 'respect-fallback',
      label: 'Respect fallback',
      cue: 'respect fallback',
      feelings: ['angry'],
      needs: ['respect'],
      phrases: ['talked over the briefing'],
      example: 'They talked over the briefing.',
    },
    {
      id: 'rest-fallback',
      label: 'Rest fallback',
      cue: 'rest fallback',
      feelings: ['drained'],
      needs: ['rest'],
      phrases: ['cancelled our break'],
      example: 'They cancelled our break.',
    },
    {
      id: 'clarity-fallback',
      label: 'Clarity fallback',
      cue: 'clarity fallback',
      feelings: ['confused'],
      needs: ['clarity'],
      phrases: ['confusing instructions'],
      example: 'They gave confusing instructions.',
    },
    {
      id: 'safety-fallback',
      label: 'Safety fallback',
      cue: 'safety fallback',
      feelings: ['alarmed'],
      needs: ['safety'],
      phrases: ['sirens blaring'],
      example: 'Sirens were blaring.',
    },
  ];

  const results = aggregateFallbackSuggestions(observation, cues, { needLimit: 4, feelingLimit: 4 });

  assert.equal(results.length, 1);
  const fallback = results[0];
  assert.equal(fallback.needs.length, 4);
  assert.equal(new Set(fallback.needs).size, 4);
  const expectedNeeds = new Set(['clarity', 'connection', 'respect', 'rest']);
  fallback.needs.forEach(need => {
    assert.ok(expectedNeeds.has(need), `Unexpected fallback need ${need}`);
  });
  assert.ok(!fallback.needs.includes('safety'));

  assert.equal(fallback.feelings.length, 4);
  assert.equal(new Set(fallback.feelings).size, 4);
  const allowedFeelings = new Set(['confused', 'lonely', 'angry', 'drained', 'alarmed']);
  fallback.feelings.forEach(feeling => {
    assert.ok(allowedFeelings.has(feeling), `Unexpected fallback feeling ${feeling}`);
  });
  assert.ok(!fallback.feelings.includes('alarmed'));
});

test('chooseFeelingsForNeeds returns distinct slugs by mode', () => {
  const index = new Map([
    ['connection', { unmet: ['lonely', 'hurt'], met: ['warm', 'connected'] }],
    ['rest', { unmet: ['tired'], met: ['rested', 'relaxed'] }],
  ]);

  assert.deepEqual(
    chooseFeelingsForNeeds(index, ['connection', 'rest'], 'met', 4),
    ['warm', 'connected', 'rested', 'relaxed'],
  );

  assert.deepEqual(
    chooseFeelingsForNeeds(index, ['connection', 'rest'], 'unmet', 3),
    ['lonely', 'hurt', 'tired'],
  );

  assert.deepEqual(
    chooseFeelingsForNeeds(index, ['connection', 'rest', 'connection'], 'met', 2),
    ['warm', 'connected'],
  );
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

function createNeedHeavyCueLibrary() {
  const cues = [
    {
      id: 'autonomy-cue',
      cue: 'autonomy prompt',
      label: 'Autonomy prompt',
      feelings: ['frustrated', 'tense'],
      needs: ['autonomy'],
      slotCoverage: [],
      matchers: createCueMatchers({ patterns: ['skipped asking me for input'] }),
      example: 'They skipped asking me for input.',
      phrases: ['skipped asking me for input'],
    },
    {
      id: 'consideration-cue',
      cue: 'consideration prompt',
      label: 'Consideration prompt',
      feelings: ['hurt', 'annoyed'],
      needs: ['consideration'],
      slotCoverage: [],
      matchers: createCueMatchers({ patterns: ['cut off maya'] }),
      example: 'They cut off Maya.',
      phrases: ['cut off maya'],
    },
    {
      id: 'rest-cue',
      cue: 'rest prompt',
      label: 'Rest prompt',
      feelings: ['drained'],
      needs: ['rest'],
      slotCoverage: [],
      matchers: createCueMatchers({ patterns: ['three shifts without a break'] }),
      example: 'We went three shifts without a break.',
      phrases: ['three shifts without a break'],
    },
    {
      id: 'clarity-cue',
      cue: 'clarity prompt',
      label: 'Clarity prompt',
      feelings: ['confused'],
      needs: ['clarity'],
      slotCoverage: [],
      matchers: createCueMatchers({ patterns: ['handoff instructions were unclear'] }),
      example: 'The handoff instructions were unclear.',
      phrases: ['handoff instructions were unclear'],
    },
    {
      id: 'stability-cue',
      cue: 'stability prompt',
      label: 'Stability prompt',
      feelings: ['scared'],
      needs: ['stability'],
      slotCoverage: [],
      matchers: createCueMatchers({ patterns: ['sensor kept glitching'] }),
      example: 'The sensor kept glitching.',
      phrases: ['sensor kept glitching'],
    },
  ];

  const moduleDefs = [
    {
      id: 'autonomy-module',
      label: 'A autonomy cue',
      summary: 'Supports autonomy.',
      slotIds: [],
      detectors: [{ type: 'regex', pattern: 'skipped asking me for input', flags: 'i' }],
      cueIds: ['autonomy-cue'],
    },
    {
      id: 'consideration-module',
      label: 'B consideration cue',
      summary: 'Supports consideration.',
      slotIds: [],
      detectors: [{ type: 'regex', pattern: 'cut off maya', flags: 'i' }],
      cueIds: ['consideration-cue'],
    },
    {
      id: 'rest-module',
      label: 'C rest cue',
      summary: 'Supports rest.',
      slotIds: [],
      detectors: [{ type: 'regex', pattern: 'three shifts without a break', flags: 'i' }],
      cueIds: ['rest-cue'],
    },
    {
      id: 'clarity-module',
      label: 'D clarity cue',
      summary: 'Supports clarity.',
      slotIds: [],
      detectors: [{ type: 'regex', pattern: 'handoff instructions were unclear', flags: 'i' }],
      cueIds: ['clarity-cue'],
    },
    {
      id: 'stability-module',
      label: 'E stability cue',
      summary: 'Supports stability.',
      slotIds: [],
      detectors: [{ type: 'regex', pattern: 'sensor kept glitching', flags: 'i' }],
      cueIds: ['stability-cue'],
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
