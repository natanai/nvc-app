const WORD_SCORE_PATTERN = /[\p{L}\p{N}'\u2019]+/gu;
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
const NON_WORD_CHAR_PATTERN = /[^a-z0-9']/g;
const ASCII_WORD_CHAR_PATTERN = /[a-z0-9]/;
const CURLY_APOSTROPHE_PATTERN = /[\u2018\u2019\u201A\u201B]/g;

function normalizeTokenForScore(token) {
  const normalized = normalizeForScore(token);
  if (!normalized) {
    return '';
  }
  const cleaned = normalized.replace(NON_WORD_CHAR_PATTERN, '');
  if (!cleaned || !ASCII_WORD_CHAR_PATTERN.test(cleaned)) {
    return '';
  }
  return cleaned;
}

export function normalizeForScore(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(CURLY_APOSTROPHE_PATTERN, "'")
    .replace(COMBINING_MARKS_PATTERN, '');
}

export function tokenizeForScore(text) {
  if (!text) {
    return [];
  }
  const matches = String(text).match(WORD_SCORE_PATTERN);
  if (!matches) {
    return [];
  }
  return matches.map(normalizeTokenForScore).filter(Boolean);
}

export function scoreCueMatch(tokenSet, normalizedText, cue) {
  const sources = [];
  if (Array.isArray(cue?.phrases)) {
    sources.push(...cue.phrases);
  }
  if (cue?.phrase) {
    sources.push(cue.phrase);
  }
  if (cue?.example) {
    sources.push(cue.example);
  }
  if (cue?.label) {
    sources.push(cue.label);
  }
  if (cue?.cue) {
    sources.push(cue.cue);
  }

  let best = 0;
  sources.forEach(source => {
    const value = typeof source === 'string' ? source.trim() : '';
    if (!value) {
      return;
    }
    const sourceTokens = tokenizeForScore(value);
    if (!sourceTokens.length) {
      return;
    }
    let matches = 0;
    sourceTokens.forEach(token => {
      if (tokenSet.has(token)) {
        matches += 1;
      }
    });
    let score = matches;
    if (matches) {
      score += matches / sourceTokens.length;
    }
    const normalizedSource = normalizeForScore(value);
    if (normalizedSource && normalizedText.includes(normalizedSource)) {
      score += Math.min(4, normalizedSource.length / 12);
    }
    if (score > best) {
      best = score;
    }
  });

  return best;
}
