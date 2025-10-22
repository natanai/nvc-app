const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'for',
  'nor',
  'so',
  'yet',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'with',
  'about',
  'via',
  'per',
  'into',
  'onto',
  'from',
  'as',
  'than',
  'if',
  'else',
  'because',
  'while',
  'when',
  'after',
  'before',
  'though',
  'although',
  'ever',
  'even',
  'again',
  'also',
  'still',
  'only',
  'just',
  'very',
  'back',
  'away',
  'over',
  'under',
  'out',
  'off',
  'up',
  'down',
  'their',
  'my',
  'your',
  'our',
  'his',
  'her',
  'its',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'it',
  'be',
  'am',
  'is',
  'are',
  'was',
  'were',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'doing',
  'done',
  'this',
  'that',
  'these',
  'those',
  'there',
  'here',
  'then',
  'thanx',
  'im',
  'hes',
  'shes',
  'youre',
  'cant',
  'wont',
  'shouldnt',
  'couldnt',
  'wouldnt',
  'dont',
  'doesnt',
  'didnt',
  'aint',
]);

const ALWAYS_KEEP = new Set([
  'no',
  'not',
  'none',
  'never',
  'without',
  'zero',
  'dm',
  'pm',
  'am',
  'pto',
  'ok',
  'id',
  'room',
  'hr',
  'hrs',
  'min',
  'mins',
  'minute',
  'minut',
  'hour',
  'hours',
]);

const WORD_REGEX = /[\p{L}\p{N}']+/gu;

export function createCueMatchers({ patterns = [], example = '' } = {}) {
  const matchers = new Map();

  const addSource = (text, sourceType) => {
    const segments = segmentIntoChunks(text);
    segments.forEach(segment => {
      const matcher = buildMatcher(segment, sourceType);
      if (!matcher) {
        return;
      }
      const existing = matchers.get(matcher.key);
      if (existing) {
        if (matcher.sourceType && !existing.sources.includes(matcher.sourceType)) {
          existing.sources.push(matcher.sourceType);
        }
        return;
      }
      matchers.set(matcher.key, matcher);
    });
  };

  patterns.filter(Boolean).forEach(pattern => addSource(pattern, 'pattern'));
  if (example) {
    addSource(example, 'example');
  }

  return Array.from(matchers.values());
}

export function createObservationProfile(rawText) {
  const source = typeof rawText === 'string' ? rawText : '';
  const normalized = normalizeWhitespace(source).toLowerCase();
  const tokens = extractTokens(normalized);
  const meaningful = tokens.filter(isMeaningfulToken);
  return {
    raw: normalized,
    tokens,
    meaningful,
    tokenSet: new Set(meaningful),
  };
}

export function matchCueRow(profile, row) {
  if (!profile || !row) {
    return false;
  }

  const patterns = Array.isArray(row.patterns) ? row.patterns : [];
  const patternMatch = patterns.some(pattern => regexMatches(pattern, profile.raw));
  if (patternMatch) {
    return true;
  }

  const matchers = Array.isArray(row.matchers) ? row.matchers : [];
  return matchers.some(matcher => matchChunkMatcher(matcher, profile));
}

function matchChunkMatcher(matcher, profile) {
  if (!matcher) {
    return false;
  }

  if (matcher.regex && regexMatches(matcher.regex, profile.raw)) {
    return true;
  }

  if (!matcher.tokenSet || matcher.tokenSet.size === 0) {
    return false;
  }

  const matches = countTokenMatches(matcher.tokenSet, profile.tokenSet);
  return matches >= matcher.tokenThreshold;
}

function countTokenMatches(patternSet, textSet) {
  let count = 0;
  patternSet.forEach(token => {
    if (textSet.has(token)) {
      count += 1;
    }
  });
  return count;
}

function regexMatches(pattern, text) {
  if (!(pattern instanceof RegExp) || typeof text !== 'string') {
    return false;
  }
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function segmentIntoChunks(text) {
  if (!text) {
    return [];
  }

  const normalized = normalizeWhitespace(String(text));
  if (!normalized) {
    return [];
  }

  const sanitized = normalized.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const sentenceSegments = sanitized
    .split(/(?<=[.!?])\s+|\n+/)
    .map(part => part.trim())
    .filter(Boolean);

  const clauses = [];
  sentenceSegments.forEach(sentence => {
    const parts = sentence
      .split(/\s*(?:[,;]|(?:--)|(?:—)|(?:–)|(?:\s-\s))\s*/)
      .map(part => part.trim())
      .filter(Boolean);
    parts.forEach(part => {
      if (!part) {
        return;
      }
      const wordCount = countWords(part);
      if (wordCount <= 1) {
        return;
      }
      if (wordCount > 10) {
        const splitOnConjunction = part
          .split(/\b(?:and|but|so|because|while|when|after|before|though|although)\b/gi)
          .map(chunk => chunk.trim())
          .filter(Boolean);
        if (splitOnConjunction.length > 1) {
          splitOnConjunction.forEach(chunk => {
            if (countWords(chunk) > 1) {
              clauses.push(chunk);
            }
          });
          return;
        }
      }
      clauses.push(part);
    });
  });

  const unique = new Map();
  clauses.forEach(clause => {
    const key = clause.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, clause);
    }
  });

  return Array.from(unique.values());
}

function countWords(segment) {
  const matches = segment.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

function buildMatcher(segment, sourceType) {
  const tokens = extractTokens(segment.toLowerCase());
  if (!tokens.length) {
    return null;
  }

  const orderedMeaningful = tokens.filter(isMeaningfulToken);
  const orderedForRegex = limitTokensForRegex(orderedMeaningful.length ? orderedMeaningful : tokens);
  if (!orderedForRegex.length) {
    return null;
  }

  const uniqueTokens = uniqueOrderedTokens(orderedMeaningful.length ? orderedMeaningful : orderedForRegex);
  if (!uniqueTokens.length) {
    return null;
  }

  if (uniqueTokens.length === 1 && !/\d/.test(uniqueTokens[0]) && !ALWAYS_KEEP.has(uniqueTokens[0])) {
    return null;
  }

  const regex = createFlexibleRegex(orderedForRegex);
  if (!regex) {
    return null;
  }

  const tokenThreshold = computeTokenThreshold(uniqueTokens.length);

  return {
    key: orderedForRegex.join('|'),
    regex,
    tokens: uniqueTokens,
    tokenSet: new Set(uniqueTokens),
    tokenThreshold,
    sourceType,
    sources: sourceType ? [sourceType] : [],
  };
}

function limitTokensForRegex(tokens, max = 6) {
  if (!Array.isArray(tokens) || !tokens.length) {
    return [];
  }
  if (tokens.length <= max) {
    return tokens.slice();
  }
  const head = tokens.slice(0, 3);
  const tail = tokens.slice(-2);
  const midIndex = Math.floor(tokens.length / 2);
  const middle = tokens.slice(midIndex, midIndex + 1);
  return [...head, ...middle, ...tail];
}

function computeTokenThreshold(length) {
  if (length <= 1) {
    return length;
  }
  if (length === 2) {
    return 2;
  }
  if (length === 3) {
    return 2;
  }
  if (length <= 5) {
    return 3;
  }
  return Math.max(3, Math.ceil(length * 0.6));
}

function createFlexibleRegex(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) {
    return null;
  }

  const escaped = tokens.map(token => escapeRegExp(token)).filter(Boolean);
  if (!escaped.length) {
    return null;
  }

  if (escaped.length === 1) {
    return new RegExp(`\\b${escaped[0]}\\b`, 'iu');
  }

  const joiner = "(?:[^\\p{L}\\p{N}']+[\\p{L}\\p{N}']+){0,3}?[^\\p{L}\\p{N}']+";
  let pattern = `\\b${escaped[0]}\\b`;
  for (let i = 1; i < escaped.length; i += 1) {
    pattern += `${joiner}\\b${escaped[i]}\\b`;
  }
  return new RegExp(pattern, 'iu');
}

function extractTokens(text) {
  if (!text) {
    return [];
  }
  const tokens = [];
  let match;
  const normalized = String(text).normalize('NFKD');
  while ((match = WORD_REGEX.exec(normalized)) !== null) {
    const raw = match[0];
    const token = normalizeToken(raw);
    if (token) {
      tokens.push(token);
    }
  }
  return tokens;
}

function normalizeToken(token) {
  if (!token) {
    return '';
  }
  const lower = String(token)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  const trimmed = lower.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
  if (!trimmed) {
    return '';
  }

  const withoutPossessive = trimmed.endsWith("'s") ? trimmed.slice(0, -2) : trimmed;
  const collapsed = withoutPossessive.replace(/'/g, '');
  const ascii = collapsed.replace(/[\u0300-\u036f]/g, '');
  const cleaned = ascii.replace(/[^a-z0-9]/g, '');
  if (!cleaned) {
    return '';
  }

  return stemToken(cleaned);
}

function stemToken(token) {
  if (token.length <= 3) {
    return token;
  }
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('ses') || token.endsWith('xes') || token.endsWith('zes')) {
    return token.slice(0, -2);
  }
  if (token.endsWith('ing') && token.length > 5) {
    return token.slice(0, -3);
  }
  if (token.endsWith('ed') && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith('es') && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && token.length > 4 && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

function isMeaningfulToken(token) {
  if (!token) {
    return false;
  }
  if (ALWAYS_KEEP.has(token)) {
    return true;
  }
  if (/\d/.test(token)) {
    return true;
  }
  if (token.length <= 2) {
    return false;
  }
  if (STOPWORDS.has(token)) {
    return false;
  }
  return true;
}

function uniqueOrderedTokens(tokens) {
  const seen = new Set();
  const ordered = [];
  tokens.forEach(token => {
    if (!token) {
      return;
    }
    if (seen.has(token)) {
      return;
    }
    seen.add(token);
    ordered.push(token);
  });
  return ordered;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/\s+/g, ' ').trim();
}
