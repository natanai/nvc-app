import assert from 'node:assert/strict';

import { createCueMatchers, createObservationProfile, matchCueRow } from '../lib/observationCueMatcher.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('matches cue when example chunk covers the variation', () => {
  const patterns = ['text marked as read without response'];
  const example = "Message showed as 'seen' yesterday; no reply since then.";
  const matchers = createCueMatchers({ patterns, example });
  const row = { patterns: patterns.map(p => new RegExp(p, 'i')), matchers };
  const profile = createObservationProfile(
    'Yesterday the message was marked as seen and there has been no reply since then.',
  );
  const result = matchCueRow(profile, row);
  assert.ok(result);
  assert.ok(['pattern', 'regex', 'tokens'].includes(result.match.type));
});

test('detects matches with inserted words between tokens', () => {
  const example = 'My private email was forwarded to two managers without asking me.';
  const matchers = createCueMatchers({ patterns: [], example });
  const row = { patterns: [], matchers };
  const profile = createObservationProfile('They forwarded my email to managers without asking first.');
  const result = matchCueRow(profile, row);
  assert.ok(result);
  assert.ok(result.match.type === 'tokens' || result.match.type === 'regex');
});

test('preserves direct regex matches for existing cues', () => {
  const patterns = ['voice dm during quiet hours'];
  const example = 'At midnight they sent a 5-minute voice message instead of a short text.';
  const matchers = createCueMatchers({ patterns, example });
  const row = { patterns: patterns.map(p => new RegExp(p, 'i')), matchers };
  const profile = createObservationProfile('Please stop sending voice DM during quiet hours.');
  const result = matchCueRow(profile, row);
  assert.ok(result);
  assert.ok(['pattern', 'regex', 'tokens'].includes(result.match.type));
});

test('handles semicolon-delimited example phrases', () => {
  const example = "Message showed as 'seen' yesterday; no reply since then.";
  const matchers = createCueMatchers({ patterns: [], example });
  const row = { patterns: [], matchers };
  const profile = createObservationProfile('There has been no reply since then on my message.');
  const result = matchCueRow(profile, row);
  assert.ok(result);
  assert.ok(result.match.type === 'tokens' || result.match.type === 'regex');
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
  console.log('All observation cue matching tests passed.');
}

run();
