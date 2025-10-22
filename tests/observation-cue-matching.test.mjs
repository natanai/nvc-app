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
  assert.equal(matchCueRow(profile, row), true);
});

test('detects matches with inserted words between tokens', () => {
  const example = 'My private email was forwarded to two managers without asking me.';
  const matchers = createCueMatchers({ patterns: [], example });
  const row = { patterns: [], matchers };
  const profile = createObservationProfile('They forwarded my email to managers without asking first.');
  assert.equal(matchCueRow(profile, row), true);
});

test('preserves direct regex matches for existing cues', () => {
  const patterns = ['voice dm during quiet hours'];
  const example = 'At midnight they sent a 5-minute voice message instead of a short text.';
  const matchers = createCueMatchers({ patterns, example });
  const row = { patterns: patterns.map(p => new RegExp(p, 'i')), matchers };
  const profile = createObservationProfile('Please stop sending voice DM during quiet hours.');
  assert.equal(matchCueRow(profile, row), true);
});

test('handles semicolon-delimited example phrases', () => {
  const example = "Message showed as 'seen' yesterday; no reply since then.";
  const matchers = createCueMatchers({ patterns: [], example });
  const row = { patterns: [], matchers };
  const profile = createObservationProfile('There has been no reply since then on my message.');
  assert.equal(matchCueRow(profile, row), true);
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
