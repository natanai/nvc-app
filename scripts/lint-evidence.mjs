import {
  BODY_OPTION_IDS,
  EMOTION_EVIDENCE_MAP,
  ZONE_COMBINATIONS,
  EVIDENCE_REGISTRY,
} from './alexithymia-support.js';
import { buildReverseInferenceIndex } from './reverse-inference-index.js';

function assertPresent(keys, formatter) {
  const missing = [];
  keys.forEach((key) => {
    const lookupKey = formatter ? formatter(key) : key;
    if (!Object.prototype.hasOwnProperty.call(EVIDENCE_REGISTRY, lookupKey)) {
      missing.push(lookupKey);
    }
  });
  return missing;
}

const bodyMissing = assertPresent(BODY_OPTION_IDS);
const zoneKeys = ZONE_COMBINATIONS.map(([valence, arousal]) => `zone-${valence}-${arousal}`);
const zoneMissing = assertPresent(zoneKeys);
const emotionKeys = Object.keys(EMOTION_EVIDENCE_MAP);
const emotionMissing = assertPresent(emotionKeys, (key) => `emotion-${key}`);
const skillKeys = ['skill-labeling', 'skill-physiological_sigh', 'skill-resonance_6bpm', 'skill-slow_446'];
const skillMissing = assertPresent(skillKeys);

const reverseIndex = buildReverseInferenceIndex();
const reverseMissing = [];

Object.entries(reverseIndex).forEach(([feelingKey, entry]) => {
  if (feelingKey === '_meta') {
    return;
  }
  if (!entry?.bodyCues?.length) {
    return;
  }
  entry.bodyCues.forEach((cue) => {
    if (!cue?.evidenceKey || !EVIDENCE_REGISTRY[cue.evidenceKey]) {
      reverseMissing.push(`Body cue ${feelingKey}:${cue?.optionId ?? 'unknown'} missing evidence`);
    }
  });
  entry.evidenceKeys?.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(EVIDENCE_REGISTRY, key)) {
      reverseMissing.push(`Reverse inference ${feelingKey} missing evidence key ${key}`);
    }
  });
});

const failures = [
  bodyMissing.length ? `Body sensations missing evidence: ${bodyMissing.join(', ')}` : null,
  zoneMissing.length ? `Zones missing evidence: ${zoneMissing.join(', ')}` : null,
  emotionMissing.length ? `Emotions missing evidence: ${emotionMissing.join(', ')}` : null,
  skillMissing.length ? `Skills missing evidence: ${skillMissing.join(', ')}` : null,
  reverseMissing.length ? reverseMissing.join('\n') : null,
].filter(Boolean);

if (failures.length) {
  console.error('Evidence lint failed:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Evidence lint passed: all mappings have evidence metadata.');
}
