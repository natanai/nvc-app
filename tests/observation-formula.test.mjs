import assert from 'node:assert/strict';

import {
  evaluateObservationFormula,
  formatObservationFormulaSlotSummary,
} from '../lib/observationFormula.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('detects all observation formula slots in a detailed statement', () => {
  const text =
    'Yesterday at 3:15 p.m. in the conference room with Alex I saw her hand three invoices to the team and say “Please sign before leaving.”';
  const evaluation = evaluateObservationFormula(text);
  const completed = new Set(evaluation.completedIds);
  assert.ok(completed.has('time'));
  assert.ok(completed.has('context'));
  assert.ok(completed.has('sensory'));
  assert.ok(completed.has('measure'));
});

test('detects expanded observation phrases and counts', () => {
  const text =
    'Over the weekend at home with my project manager on Zoom I was listening as she said “Let’s review it” after a couple of follow-up emails.';
  const evaluation = evaluateObservationFormula(text);
  const completed = new Set(evaluation.completedIds);
  assert.ok(completed.has('time'));
  assert.ok(completed.has('context'));
  assert.ok(completed.has('sensory'));
  assert.ok(completed.has('measure'));
});

test('honours highlight keys when evaluating formula slots', () => {
  const text = 'At noon I saw the note on the door.';
  const evaluation = evaluateObservationFormula(text, {
    highlights: [
      { token: 'at noon', key: 'timeAnchors' },
      { token: 'I saw', key: 'sensoryVerbs' },
    ],
  });
  assert.ok(evaluation.slots.time.satisfied);
  assert.ok(evaluation.slots.sensory.satisfied);
});

test('formats observation formula slot summaries', () => {
  assert.equal(formatObservationFormulaSlotSummary(['time']), 'time anchor slot');
  assert.equal(
    formatObservationFormulaSlotSummary(['time', 'context'], { includeArticle: true }),
    'the time anchor and setting or people slots',
  );
});

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✔ ${name}`);
    } catch (error) {
      console.error(`✘ ${name}`);
      throw error;
    }
  }
  console.log('All observation formula tests passed.');
}

run();
