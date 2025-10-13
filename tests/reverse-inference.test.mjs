import test from 'node:test';
import assert from 'node:assert/strict';

import { intensityBandFromWeight, buildReverseInferenceIndex } from '../scripts/reverse-inference-index.js';
import { EVIDENCE_REGISTRY } from '../scripts/evidence-registry.js';

test('intensityBandFromWeight follows heuristic thresholds', () => {
  assert.deepEqual(intensityBandFromWeight(1.25, 'high'), [5, 10]);
  assert.deepEqual(intensityBandFromWeight(1, 'medium'), [5, 9]);
  assert.deepEqual(intensityBandFromWeight(0.85, 'low'), [3, 7]);
  assert.deepEqual(intensityBandFromWeight(0.5, 'high'), [8, 10]);
});

const reverseIndex = buildReverseInferenceIndex();

test('reverse index provides data for core feelings', () => {
  assert.ok(reverseIndex.anxiety, 'anxiety entry missing');
  assert.ok(Array.isArray(reverseIndex.anxiety.bodyCues));
  assert.ok(reverseIndex.anxiety.bodyCues.length > 0);
});

test('reverse index evidence keys exist in registry', () => {
  Object.entries(reverseIndex).forEach(([feelingKey, entry]) => {
    if (feelingKey === '_meta') return;
    (entry.evidenceKeys || []).forEach((key) => {
      assert.ok(EVIDENCE_REGISTRY[key], `Evidence key ${key} missing for ${feelingKey}`);
    });
    (entry.bodyCues || []).forEach((cue) => {
      assert.ok(EVIDENCE_REGISTRY[cue.evidenceKey], `Body cue evidence missing for ${feelingKey}:${cue.optionId}`);
    });
  });
});

test('reverse index body cues carry arousal-aware intensity', () => {
  const fearEntry = reverseIndex.fear;
  assert.ok(fearEntry?.bodyCues?.length, 'fear cues missing');
  const [firstCue] = fearEntry.bodyCues;
  assert.equal(firstCue?.arousal, 'high');
  assert.ok(
    Array.isArray(firstCue?.intensityBand),
    'intensity band missing from arousal-aware cue'
  );
});
