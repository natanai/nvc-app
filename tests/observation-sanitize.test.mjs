import assert from 'node:assert/strict';
import { sanitizeObservationText } from '../lib/observationSanitize.js';
import { lintObservation } from '../lib/nvcLint.js';

const catalog = createTestCatalog();

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('keeps direct quotes with evaluative content', () => {
  const text = 'Yesterday at 3 pm, Alex said, "You are lazy."';
  const lint = lintObservation(text, catalog);
  assert.equal(lint.ok, true, 'direct quotes should not flag lint errors');
  assert.equal(sanitizeObservationText(text, catalog), text);
});

test('strips sentences that only contain evaluations', () => {
  const text = 'You always leave a mess on the table.';
  assert.equal(sanitizeObservationText(text, catalog), '');
});

test('retains measurable observational language', () => {
  const text = 'At 4:02 pm I saw 3 unread emails and no reply.';
  assert.equal(sanitizeObservationText(text, catalog), 'At 4:02 pm I saw 3 unread emails and no reply.');
});

test('removes sentences containing feelings or faux feelings', () => {
  const text = 'At 4 pm I felt sad and ignored.';
  assert.equal(sanitizeObservationText(text, catalog), '');
});

test('preserves observational portion while dropping evaluations', () => {
  const text = 'At 4 pm I noticed the report had 3 errors. You always do this.';
  assert.equal(sanitizeObservationText(text, catalog), 'At 4 pm I noticed the report had 3 errors.');
});

test('allows quotes that include feeling words', () => {
  const text = 'At noon you said, "I feel sad about the delay."';
  const lint = lintObservation(text, catalog);
  assert.equal(lint.ok, true, 'quoted feelings should be allowed');
  assert.equal(sanitizeObservationText(text, catalog), text);
});

test('flags speculation phrases as non-observational', () => {
  const text = 'It seems like you ignored my email.';
  assert.equal(sanitizeObservationText(text, catalog), '');
});

test('flags thought-language constructions', () => {
  const text = 'I think you were unfair in the meeting.';
  assert.equal(sanitizeObservationText(text, catalog), '');
});

test('removes soft qualifiers while keeping the measurable core', () => {
  const text = 'Maybe at 4 pm you sent the file.';
  assert.equal(sanitizeObservationText(text, catalog), 'at 4 pm you sent the file.');
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
  console.log('All observation sanitize tests passed.');
}

run();

function createTestCatalog() {
  return {
    feelings: toMap([
      ['sad', { title: 'Sad' }],
      ['hurt', { title: 'Hurt' }],
      ['tired', { title: 'Tired' }],
    ]),
    needs: toMap([
      ['connection', { title: 'Connection' }],
      ['rest', { title: 'Rest' }],
      ['consideration', { title: 'Consideration' }],
    ]),
    fauxFeelings: toMap([
      ['ignored', { title: 'Ignored' }],
      ['disrespected', { title: 'Disrespected' }],
    ]),
  };
}

function toMap(entries) {
  return new Map(entries);
}
