import assert from 'node:assert/strict';

import { createCueMatchers, createObservationProfile, matchCueRow } from '../lib/observationCueMatcher.js';
import { parseObservationSchema, parseCueModules, suggestFromObservation } from '../lib/observationSuggest.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('matches cue when example chunk covers the variation', () => {
  const patterns = ['text marked as read without response'];
  const example = "Message showed as 'seen' yesterday; no reply since then.";
  const matchers = createCueMatchers({ patterns, example });
  const row = { compiledPatterns: patterns.map(p => new RegExp(p, 'i')), matchers };
  const profile = createObservationProfile(
    'Yesterday the message was marked as seen and there has been no reply since then.',
  );
  const result = matchCueRow(profile, row);
  assert.ok(result);
  assert.ok(Array.isArray(result.features?.slots));
});

test('detects matches with inserted words between tokens', () => {
  const example = 'My private email was forwarded to two managers without asking me.';
  const matchers = createCueMatchers({ patterns: [], example });
  const row = { compiledPatterns: [], matchers };
  const profile = createObservationProfile('They forwarded my email to managers without asking first.');
  const result = matchCueRow(profile, row);
  assert.ok(result);
});

test('preserves direct regex matches for existing cues', () => {
  const patterns = ['voice dm during quiet hours'];
  const example = 'At midnight they sent a 5-minute voice message instead of a short text.';
  const matchers = createCueMatchers({ patterns, example });
  const row = { compiledPatterns: patterns.map(p => new RegExp(p, 'i')), matchers };
  const profile = createObservationProfile('Please stop sending voice DM during quiet hours.');
  const result = matchCueRow(profile, row);
  assert.ok(result);
});

test('handles semicolon-delimited example phrases', () => {
  const example = "Message showed as 'seen' yesterday; no reply since then.";
  const matchers = createCueMatchers({ patterns: [], example });
  const row = { compiledPatterns: [], matchers };
  const profile = createObservationProfile('There has been no reply since then on my message.');
  const result = matchCueRow(profile, row);
  assert.ok(result);
});

test('parseObservationSchema normalizes traits and patterns', () => {
  const raw = {
    schemaVersion: 2,
    slots: [
      {
        id: 'Date',
        prompt: ' On [DATE] ',
        label: ' Date anchor ',
        description: 'Mention timing.',
        group: 'lead',
        order: '5',
        chips: ['today', null],
        suggestions: [' Mention the date ', ''],
        traits: { tokens: [' Today ', ''], anchors: [' temporal '], syntactic: [' time-phrase '] },
        patterns: ['\\bToday\\b', ''],
      },
    ],
  };
  const schema = parseObservationSchema(raw);
  assert.equal(schema.schemaVersion, 2);
  assert.equal(schema.slots.length, 1);
  const slot = schema.slots[0];
  assert.equal(slot.id, 'Date');
  assert.equal(slot.prompt, 'On [DATE]');
  assert.deepEqual(slot.detectorTokens, ['today']);
  assert.deepEqual(slot.traitAnchors, ['temporal']);
  assert.deepEqual(slot.traitSyntactic, ['time-phrase']);
  assert.equal(slot.compiledPatterns.length, 1);
});

test('parseCueModules compiles motif metadata and entries', () => {
  const schema = parseObservationSchema({
    slots: [
      { id: 'date', prompt: 'Date', label: 'Date', traits: { tokens: ['today'], anchors: ['temporal'] }, patterns: ['today'] },
      { id: 'actor', prompt: 'Actor', label: 'Actor', traits: { tokens: ['manager'], anchors: ['actor'] }, patterns: ['manager'] },
    ],
  });
  const raw = {
    motifs: [
      {
        id: 'motif',
        label: 'Motif',
        slots: ['date', 'actor', 'ignored'],
        slotPrompts: { date: ['Mention when it happened.'], extra: ['skip'] },
        traits: { tokens: [' Manager '], patterns: ['manager'], anchors: [' conversation '] },
        entries: [
          {
            id: 'entry-1',
            example: 'Today the manager replied.',
            patterns: ['manager replied', ''],
            feelings: ['relieved'],
            needs: ['clarity'],
            slots: ['date', 'actor', 'missing'],
            slotEvidence: {
              date: { tokens: [' today '], patterns: ['today'] },
            },
          },
        ],
      },
    ],
  };
  const modules = parseCueModules(raw, schema);
  assert.equal(modules.length, 1);
  const motif = modules[0];
  assert.deepEqual(motif.slots, ['date', 'actor']);
  assert.deepEqual(motif.traitTokens, ['manager']);
  assert.equal(motif.traitCompiledPatterns.length, 1);
  assert.equal(motif.entries.length, 1);
  const entry = motif.entries[0];
  assert.ok(entry.matchers.length > 0);
  assert.ok(entry.slotEvidenceCompiled.date);
  assert.deepEqual(entry.slotEvidenceCompiled.date.tokens, ['today']);
  assert.equal(entry.slotEvidenceCompiled.date.compiledPatterns.length, 1);
});

test('suggestFromObservation returns slot coverage and prompts', () => {
  const schema = parseObservationSchema({
    slots: [
      { id: 'date', prompt: 'On [DATE]', label: 'Date', order: 1, traits: { tokens: ['today'], anchors: ['temporal'] }, patterns: ['today'] },
      { id: 'actor', prompt: '[WHO]', label: 'Actor', order: 2, traits: { tokens: ['manager'], anchors: ['actor'] }, patterns: ['manager'] },
    ],
  });
  const rawModules = {
    motifs: [
      {
        id: 'motif-a',
        label: 'Motif A',
        slots: ['date', 'actor'],
        slotPrompts: { actor: ['Name who was involved.'] },
        entries: [
          {
            id: 'entry-a',
            example: 'Today the manager replied.',
            patterns: ['manager replied'],
            feelings: ['relieved'],
            needs: ['clarity'],
            slots: ['date', 'actor'],
          },
        ],
      },
    ],
  };
  const modules = parseCueModules(rawModules, schema);
  const result = suggestFromObservation('Today the manager replied.', modules, schema, { maxEach: 3 });
  assert.equal(result.feelings[0], 'relieved');
  assert.equal(result.needs[0], 'clarity');
  assert.ok(result.profile.features);
  assert.ok(result.slotCoverage.date.filled);
  assert.ok(result.slotCoverage.actor.prompts.includes('Name who was involved.'));
  assert.ok(result.hits.length >= 1);
  assert.ok(Array.isArray(result.hits[0].match.features.slots));
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
