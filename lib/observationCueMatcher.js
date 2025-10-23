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

export function createObservationProfile(rawText, options = {}) {
  const source = typeof rawText === 'string' ? rawText : '';
  const normalized = normalizeWhitespace(source);
  const lower = normalized.toLowerCase();
  const tokens = extractTokens(lower);
  const meaningful = tokens.filter(isMeaningfulToken);
  const tokenSet = new Set(meaningful);
  const schema = options?.schema;
  const slots = buildSlotMatches(schema, lower, tokenSet);
  const features = buildProfileFeatures(schema, slots, tokenSet);

  return {
    raw: lower,
    original: source,
    tokens,
    meaningful,
    tokenSet,
    slots,
    features,
  };
}

export function matchCueRow(profile, row, options = {}) {
  if (!profile || !row) {
    return null;
  }

  const patternMatches = [];
  const compiledPatterns = Array.isArray(row.compiledPatterns) ? row.compiledPatterns : [];
  compiledPatterns.forEach(pattern => {
    const matches = collectRegexMatches(pattern, profile.raw);
    if (matches.length) {
      patternMatches.push({ pattern, matches });
    }
  });

  const matcherMatches = [];
  const matchers = Array.isArray(row.matchers) ? row.matchers : [];
  matchers.forEach(matcher => {
    const result = matchChunkMatcher(matcher, profile);
    if (result) {
      matcherMatches.push(result);
    }
  });

  if (!patternMatches.length && !matcherMatches.length) {
    return null;
  }

  const slots = buildRowSlotCoverage(row, profile, options.schema);
  const matchedTokens = new Set();
  matcherMatches.forEach(hit => {
    (hit.tokens || []).forEach(token => matchedTokens.add(token));
  });
  const features = buildMatchFeatures(slots, options.schema);

  return {
    id: row.id || row.cue,
    row,
    patternMatches,
    matcherMatches,
    slots,
    features,
    tokens: Array.from(matchedTokens),
    patterns: patternMatches.flatMap(match => match.matches || []),
  };
}

function buildSlotMatches(schema, text, tokenSet) {
  const slots = {};
  if (!schema || !Array.isArray(schema.slots)) {
    return slots;
  }
  schema.slots.forEach(slot => {
    if (!slot || !slot.id) {
      return;
    }
    const tokens = new Set();
    const patterns = new Set();
    const detectorTokens = Array.isArray(slot.detectorTokens) ? slot.detectorTokens : [];
    detectorTokens.forEach(token => {
      if (tokenSet.has(token)) {
        tokens.add(token);
      }
    });
    const compiledPatterns = Array.isArray(slot.compiledPatterns) ? slot.compiledPatterns : [];
    compiledPatterns.forEach(pattern => {
      collectRegexMatches(pattern, text).forEach(match => patterns.add(match));
    });
    slots[slot.id] = {
      id: slot.id,
      tokens: Array.from(tokens),
      patterns: Array.from(patterns),
      count: tokens.size + patterns.size,
    };
  });
  return slots;
}

function buildRowSlotCoverage(row, profile, schema) {
  const slotIds = Array.isArray(row.slots) ? row.slots : [];
  if (!slotIds.length) {
    return [];
  }
  const coverage = [];
  slotIds.forEach(slotId => {
    const profileSlot = profile.slots?.[slotId] || { tokens: [], patterns: [] };
    const evidence = row.slotEvidenceCompiled?.[slotId] || row.slotEvidence?.[slotId] || {};
    const tokens = new Set(profileSlot.tokens || []);
    const evidenceTokens = Array.isArray(evidence.tokens) ? evidence.tokens : [];
    evidenceTokens.forEach(token => {
      if (profile.tokenSet.has(token)) {
        tokens.add(token);
      }
    });
    const patterns = new Set(profileSlot.patterns || []);
    const evidencePatterns = Array.isArray(evidence.compiledPatterns) ? evidence.compiledPatterns : [];
    evidencePatterns.forEach(pattern => {
      collectRegexMatches(pattern, profile.raw).forEach(match => patterns.add(match));
    });
    coverage.push({
      id: slotId,
      matched: tokens.size > 0 || patterns.size > 0,
      tokens: Array.from(tokens),
      patterns: Array.from(patterns),
    });
  });
  return coverage;
}

function buildProfileFeatures(schema, slotMatches, tokenSet) {
  const slotList = Array.isArray(schema?.slots) ? schema.slots : [];
  const slots = {};
  const anchors = new Map();
  slotList.forEach(slot => {
    const match = slotMatches[slot.id] || { tokens: [], patterns: [], count: 0 };
    const tokens = Array.isArray(match.tokens) ? match.tokens : [];
    const patterns = Array.isArray(match.patterns) ? match.patterns : [];
    slots[slot.id] = {
      id: slot.id,
      label: slot.label || slot.id,
      count: Number(match.count) || 0,
      tokens: tokens.slice(),
      patterns: patterns.slice(),
    };
    const anchorsForSlot = Array.isArray(slot.traitAnchors)
      ? slot.traitAnchors
      : Array.isArray(slot.traits?.anchors)
        ? slot.traits.anchors
        : [];
    anchorsForSlot.forEach(anchor => {
      const key = typeof anchor === 'string' ? anchor.trim() : '';
      if (!key) {
        return;
      }
      if (!anchors.has(key)) {
        anchors.set(key, {
          id: key,
          slots: new Set(),
          tokens: new Set(),
          patterns: new Set(),
        });
      }
      const entry = anchors.get(key);
      entry.slots.add(slot.id);
      tokens.forEach(token => entry.tokens.add(token));
      patterns.forEach(pattern => entry.patterns.add(pattern));
    });
  });

  return {
    slots,
    anchors: Array.from(anchors.values()).map(anchor => ({
      id: anchor.id,
      slots: Array.from(anchor.slots),
      tokens: Array.from(anchor.tokens),
      patterns: Array.from(anchor.patterns),
    })),
    tokenCount: tokenSet.size,
  };
}

function buildMatchFeatures(slotCoverage, schema) {
  const slotList = Array.isArray(slotCoverage) ? slotCoverage : [];
  const features = {
    slots: [],
    anchors: [],
  };

  const anchors = new Map();
  slotList.forEach(slot => {
    const schemaSlot = findSchemaSlot(schema, slot.id);
    features.slots.push({
      id: slot.id,
      label: schemaSlot?.label || slot.id,
      matched: Boolean(slot?.matched),
      tokens: Array.isArray(slot?.tokens) ? slot.tokens.slice() : [],
      patterns: Array.isArray(slot?.patterns) ? slot.patterns.slice() : [],
    });
    const anchorsForSlot = Array.isArray(schemaSlot?.traitAnchors)
      ? schemaSlot.traitAnchors
      : Array.isArray(schemaSlot?.traits?.anchors)
        ? schemaSlot.traits.anchors
        : [];
    anchorsForSlot.forEach(anchor => {
      const key = typeof anchor === 'string' ? anchor.trim() : '';
      if (!key) {
        return;
      }
      if (!anchors.has(key)) {
        anchors.set(key, {
          id: key,
          slots: new Set(),
          tokens: new Set(),
          patterns: new Set(),
        });
      }
      const entry = anchors.get(key);
      entry.slots.add(slot.id);
      (slot.tokens || []).forEach(token => entry.tokens.add(token));
      (slot.patterns || []).forEach(pattern => entry.patterns.add(pattern));
    });
  });

  features.anchors = Array.from(anchors.values()).map(anchor => ({
    id: anchor.id,
    slots: Array.from(anchor.slots),
    tokens: Array.from(anchor.tokens),
    patterns: Array.from(anchor.patterns),
  }));

  return features;
}

function findSchemaSlot(schema, slotId) {
  if (!schema || !Array.isArray(schema.slots)) {
    return null;
  }
  for (let i = 0; i < schema.slots.length; i += 1) {
    const slot = schema.slots[i];
    if (slot?.id === slotId) {
      return slot;
    }
  }
  return null;
}

function matchChunkMatcher(matcher, profile) {
  if (!matcher) {
    return null;
  }

  if (matcher.regex) {
    const matches = collectRegexMatches(matcher.regex, profile.raw);
    if (matches.length) {
      return { type: 'regex', matcher, matches };
    }
  }

  if (!matcher.tokenSet || matcher.tokenSet.size === 0) {
    return null;
  }

  const { count, tokens } = countTokenMatches(matcher.tokenSet, profile.tokenSet);
  if (count >= matcher.tokenThreshold) {
    return { type: 'tokens', matcher, tokens, count, threshold: matcher.tokenThreshold };
  }
  return null;
}

function countTokenMatches(patternSet, textSet) {
  const tokens = [];
  patternSet.forEach(token => {
    if (textSet.has(token)) {
      tokens.push(token);
    }
  });
  return { count: tokens.length, tokens };
}

function collectRegexMatches(pattern, text, limit = 6) {
  if (!(pattern instanceof RegExp) || typeof text !== 'string' || !text) {
    return [];
  }
  const flags = pattern.flags && pattern.flags.includes('g') ? pattern.flags : `${pattern.flags || ''}g`;
  const regex = new RegExp(pattern.source, flags);
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[0]) {
      matches.push(match[0]);
    }
    if (!regex.global || matches.length >= limit) {
      break;
    }
  }
  return matches;
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
