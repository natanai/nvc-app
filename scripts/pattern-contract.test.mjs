#!/usr/bin/env node
import assert from 'node:assert/strict';

import { splitCuePatterns, preparePattern } from '../lib/observationSuggest.js';

function compilePrepared(pattern) {
  const prepared = preparePattern(pattern);
  if (!prepared) {
    return { prepared: null, regex: null, error: 'empty pattern' };
  }
  for (const attempt of prepared.attempts || []) {
    try {
      return { prepared, regex: new RegExp(attempt, 'i'), error: null };
    } catch (error) {
      // try next attempt
    }
  }
  return { prepared, regex: null, error: prepared.error || 'compile failed' };
}

// (a) plain literal with punctuation auto-escapes
{
  const { prepared, regex } = compilePrepared('Budget v2!');
  assert.ok(prepared?.isLiteral, 'Expected literal auto-escape');
  assert.ok(regex?.test('budget v2! update'), 'Literal punctuation should match as-is');
}

// (b) literal containing a period should not behave like wildcard
{
  const { prepared, regex } = compilePrepared('release 2.0');
  assert.ok(prepared?.isLiteral, 'Expected literal with dot to auto-escape');
  assert.ok(regex?.test('Release 2.0 milestone'), 'Escaped dot should match literal text');
  assert.ok(!regex?.test('Release 230 milestone'), 'Escaped dot should not act as wildcard');
}

// (c) explicit word boundary pattern
{
  const { prepared, regex } = compilePrepared('\\bupdate\\b');
  assert.ok(prepared && !prepared.isLiteral, 'Expected regex mode for \\b pattern');
  assert.ok(regex?.test('Pending update requested')); 
  assert.ok(!regex?.test('Updating soon'));
}

// (d) non-nested optional group alternation
{
  const { prepared, regex } = compilePrepared('(?:late|delayed)? reply');
  assert.ok(prepared && !prepared.isLiteral, 'Expected regex mode for optional group');
  assert.ok(regex?.test('Late reply from team'));
  assert.ok(regex?.test(' reply from team'));
}

// (e) escaped pipe keeps single entry with alternation
{
  const entries = splitCuePatterns('cat\\|dog|bird');
  assert.deepEqual(entries, ['cat|dog', 'bird'], 'splitCuePatterns should preserve escaped pipe');
  const { regex } = compilePrepared('cat|dog');
  assert.ok(regex?.test('dog spotted'));
  assert.ok(regex?.test('cat spotted'));
}

// (f) invalid pattern (lookbehind) should fail
{
  const { prepared, regex, error } = compilePrepared('(?<=secret) note');
  assert.ok(prepared && !prepared.isLiteral, 'Prepared pattern should exist for invalid regex');
  assert.ok(!regex, 'Lookbehind should not compile');
  assert.ok(error, 'Invalid pattern should report an error');
}

// Legacy split behavior remains unchanged for plain pipes
{
  const entries = splitCuePatterns('alpha|beta|gamma');
  assert.deepEqual(entries, ['alpha', 'beta', 'gamma'], 'Plain pipes should continue to split entries');
}

console.log('✅ pattern contract regression tests passed');
