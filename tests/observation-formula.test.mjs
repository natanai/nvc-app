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

test('recognizes ISO-style numeric dates as time anchors', () => {
  const text = 'On 2023-08-14 I saw the maintenance log update on the dashboard.';
  const evaluation = evaluateObservationFormula(text);
  assert.ok(evaluation.slots.time.satisfied);
});

test('recognizes 24-hour clock times without am/pm markers', () => {
  const text = 'At 17:45 I heard the service bell ring twice.';
  const evaluation = evaluateObservationFormula(text);
  assert.ok(evaluation.slots.time.satisfied);
});

test('avoids treating bare numbers as 24-hour clock times', () => {
  const text = 'By 1700 our group usually wraps the exercises.';
  const evaluation = evaluateObservationFormula(text);
  assert.ok(!evaluation.slots.time.satisfied);
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

test('detects virtual locations introduced with varied prepositions', () => {
  const slackEvaluation = evaluateObservationFormula('We aligned in Slack about the release.');
  const slackContext = slackEvaluation.slots.context;
  assert.ok(slackContext.satisfied);
  assert.ok(
    slackContext.matches.some(
      match => match.detectorId === 'location-virtual' && /\bin Slack\b/i.test(match.value),
    ),
  );

  const discordEvaluation = evaluateObservationFormula('I followed up via Discord before the call.');
  const discordContext = discordEvaluation.slots.context;
  assert.ok(discordContext.satisfied);
  assert.ok(
    discordContext.matches.some(
      match => match.detectorId === 'location-virtual' && /\bvia Discord\b/i.test(match.value),
    ),
  );
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

test('detects asynchronous message senders as context anchors', () => {
  const emailEvaluation = evaluateObservationFormula('At 9:05 a.m. my boss emailed "I need that deck tonight."');
  const emailContext = emailEvaluation.slots.context;
  assert.ok(emailContext.satisfied);
  assert.ok(emailContext.matches.some(match => match.detectorId === 'message-actor'));

  const voicemailEvaluation = evaluateObservationFormula('At 10:12 a.m. a customer left a voicemail saying "You are useless."');
  const voicemailContext = voicemailEvaluation.slots.context;
  assert.ok(voicemailContext.satisfied);
  assert.ok(voicemailContext.matches.some(match => match.detectorId === 'message-actor'));
});

test('accepts device sourced sensory descriptions', () => {
  const evaluation = evaluateObservationFormula('Security footage shows two contractors climbing the fence at 9 p.m.');
  const sensory = evaluation.slots.sensory;
  assert.ok(sensory.satisfied);
  assert.ok(sensory.matches.some(match => match.detectorId === 'device-sensory'));
});

test('counts collective body-language phrases as measurements', () => {
  const evaluation = evaluateObservationFormula('During mediation I watched both partners fold their arms.');
  const measure = evaluation.slots.measure;
  assert.ok(measure.satisfied);
  assert.ok(measure.matches.some(match => match.detectorId === 'body-language-count'));
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
