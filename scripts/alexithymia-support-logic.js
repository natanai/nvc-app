export const EMOTION_CIRCUMPLEX = {
  anxiety: { valence: 'unpleasant', arousal: 'high' },
  fear: { valence: 'unpleasant', arousal: 'high' },
  anger: { valence: 'unpleasant', arousal: 'high' },
  overwhelm: { valence: 'unpleasant', arousal: 'high' },
  stress: { valence: 'unpleasant', arousal: 'high' },
  frustration: { valence: 'unpleasant', arousal: 'high' },
  worry: { valence: 'unpleasant', arousal: 'medium' },
  guilt: { valence: 'unpleasant', arousal: 'medium' },
  shame: { valence: 'unpleasant', arousal: 'medium' },
  sadness: { valence: 'unpleasant', arousal: 'low' },
  grief: { valence: 'unpleasant', arousal: 'low' },
  lonely: { valence: 'unpleasant', arousal: 'low' },
  tired: { valence: 'neutral', arousal: 'low' },
  numb: { valence: 'neutral', arousal: 'low' },
  bored: { valence: 'neutral', arousal: 'low' },
  curiosity: { valence: 'neutral', arousal: 'medium' },
  thoughtful: { valence: 'neutral', arousal: 'medium' },
  uncertain: { valence: 'neutral', arousal: 'medium' },
  determined: { valence: 'neutral', arousal: 'high' },
  focused: { valence: 'neutral', arousal: 'high' },
  anticipation: { valence: 'neutral', arousal: 'high' },
  excitement: { valence: 'pleasant', arousal: 'high' },
  calm: { valence: 'pleasant', arousal: 'low' },
  relief: { valence: 'pleasant', arousal: 'low' },
  contentment: { valence: 'pleasant', arousal: 'medium' },
  hope: { valence: 'pleasant', arousal: 'medium' },
  gratitude: { valence: 'pleasant', arousal: 'medium' },
  joy: { valence: 'pleasant', arousal: 'high' },
  pride: { valence: 'pleasant', arousal: 'high' },
};

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp01(value) {
  if (!isFiniteNumber(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function inferZoneFromSensations(selections) {
  if (!Array.isArray(selections) || !selections.length) {
    return null;
  }
  const tallies = {
    valence: new Map([
      ['pleasant', 0],
      ['neutral', 0],
      ['unpleasant', 0],
    ]),
    arousal: new Map([
      ['low', 0],
      ['medium', 0],
      ['high', 0],
    ]),
  };

  selections.forEach(({ option, intensity }) => {
    if (!option || !option.emotions) {
      return;
    }
    const normalizedIntensity = clamp01(Number(intensity) / 10);
    if (normalizedIntensity <= 0) {
      return;
    }
    Object.entries(option.emotions).forEach(([emotionKey, weight]) => {
      const scaledWeight = Number(weight) * normalizedIntensity;
      if (!Number.isFinite(scaledWeight) || scaledWeight <= 0) {
        return;
      }
      const anchor = EMOTION_CIRCUMPLEX[emotionKey];
      if (!anchor) {
        return;
      }
      tallies.valence.set(
        anchor.valence,
        (tallies.valence.get(anchor.valence) || 0) + scaledWeight,
      );
      tallies.arousal.set(
        anchor.arousal,
        (tallies.arousal.get(anchor.arousal) || 0) + scaledWeight,
      );
    });
  });

  const bestValence = [...tallies.valence.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const bestArousal = [...tallies.arousal.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!bestValence || !bestArousal) {
    return null;
  }
  return `${bestArousal}-${bestValence}`;
}

export function mergeCompassAndInferredZone(compassKey, inferredKey) {
  if (compassKey && compassKey.includes('-')) {
    return compassKey;
  }
  return inferredKey || compassKey || null;
}

export function calculateRejectionPenalty(count) {
  const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  return 1 / (1 + safeCount);
}

export function normalizeScoresWithPenalty(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return [];
  }
  const maxScore = entries.reduce((acc, entry) => (entry.score > acc ? entry.score : acc), 0);
  const safeMax = maxScore > 0 ? maxScore : 1;
  return entries.map((entry) => ({
    ...entry,
    confidence: clamp01(entry.score / safeMax),
  }));
}
