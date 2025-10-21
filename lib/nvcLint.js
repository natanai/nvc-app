export const EVAL_MARKERS = [
  'always',
  'never',
  'must',
  'right',
  'wrong',
  'good',
  'bad',
  'better',
  'worse',
  'best',
  'worst',
  'horrid',
  'appalling',
  'terrific',
  'unacceptable',
  'ridiculous',
  'pathetic',
  'horrible',
  'awful',
  'terrible',
  'useless',
  'pointless',
  'unprofessional',
  'shameful',
  'disgusting',
  'amazing',
  'awesome',
  'fantastic',
  'incredible',
  'perfect',
  'unfair',
  'inexcusable',
  'disappointing',
];

const EVAL_WORD_PATTERNS = EVAL_MARKERS.map(word => ({
  label: word,
  regex: buildWordRegex(word),
}));

const EVAL_PHRASE_PATTERNS = [
  { label: 'waste of time', regex: /\bwaste\s+of\s+time\b/i },
  { label: 'kind of person', regex: /\bkind\s+of\s+person\b/i },
  { label: 'take advantage', regex: /\btake\s+advantage\b/i },
  { label: 'lack of respect', regex: /\black\s+of\s+respect\b/i },
  { label: 'lack of consideration', regex: /\black\s+of\s+consideration\b/i },
  { label: 'lack of empathy', regex: /\black\s+of\s+empathy\b/i },
  { label: 'lack of support', regex: /\black\s+of\s+support\b/i },
  { label: 'lack of effort', regex: /\black\s+of\s+effort\b/i },
  { label: 'lack of transparency', regex: /\black\s+of\s+transparency\b/i },
  { label: 'lack of communication', regex: /\black\s+of\s+communication\b/i },
  { label: 'lack of accountability', regex: /\black\s+of\s+accountability\b/i },
  { label: 'as usual', regex: /\bas\s+usual\b/i },
  { label: 'yet again', regex: /\byet\s+again\b/i },
  { label: 'same old', regex: /\bsame\s+old\b/i },
  { label: 'ever since', regex: /\bever\s+since\b/i },
];

const FLAG_GUIDANCE = 'Add a time/place anchor, quote the exact words, or note a count so the statement stays camera-ready.';

const FLAG_GROUP_DEFS = [
  {
    key: 'traitLabels',
    label: 'Trait / character labels',
    advice: 'Swap labels for the concrete action you saw or heard.',
    words: [
      'rude', 'mean', 'cruel', 'selfish', 'self-centered', 'inconsiderate', 'disrespectful', 'unkind',
      'toxic', 'unprofessional', 'inappropriate', 'unacceptable', 'problematic', 'offensive',
      'hostile', 'aggressive', 'passive-aggressive', 'confrontational', 'combative',
      'controlling', 'manipulative', 'coercive', 'domineering', 'bossy', 'overbearing',
      'dismissive', 'belittling', 'demeaning', 'condescending', 'patronizing',
      'arrogant', 'entitled', 'superior', 'judgmental', 'hypocritical',
      'careless', 'sloppy', 'reckless', 'negligent', 'thoughtless',
      'lazy', 'apathetic', 'indifferent', 'unmotivated',
      'unreliable', 'irresponsible', 'flaky', 'undependable',
      'incompetent', 'clueless', 'unqualified', 'incapable',
      'immature', 'childish', 'dramatic', 'attention-seeking',
      'dishonest', 'deceitful', 'two-faced', 'untrustworthy', 'liar',
      'bully', 'abusive', 'toxic person', 'gaslighter', 'narcissist', 'narcissistic', 'egotistical',
      'stupid', 'stupidity', 'dumb', 'idiot', 'idiotic', 'fool', 'foolish', 'moron', 'moronic',
      'evil', 'bad', 'wrong', 'jerk', 'hero', 'angel', 'saint', 'savior', 'rockstar', 'superstar', 'drama queen',
    ],
  },
  {
    key: 'comparisonStories',
    label: 'Comparison or “as usual” stories',
    advice: 'Point to one recent moment instead of comparing to a pattern.',
    words: [
      'as usual', 'same as always', 'same old story', 'same old pattern', 'same old', 'once again',
      'yet again', 'every single time', 'over and over', 'time after time', 'each time',
    ],
  },
  {
    key: 'moralizingLanguage',
    label: 'Moralizing language',
    advice: 'Skip should/shouldn’t judgments and name what happened instead.',
    words: [
      'should', 'shouldn’t', "shouldn't", 'ought', 'oughtn’t', "oughtn't", 'supposed to', 'not supposed to',
      'must', 'have to', 'need to', 'required to',
      'the right thing', 'the wrong thing', 'proper', 'improper',
      'respectful', 'disrespectful', 'basic decency', 'common sense', 'out of line', 'crossed a line',
    ],
  },
  {
    key: 'mindReadingClaims',
    label: 'Mind-reading or motive claims',
    advice: 'Describe the observable action and leave motives like “on purpose” for later.',
    words: [
      'on purpose', 'intentionally', 'deliberately', 'trying to', 'meant to', 'wanted to',
      'didn’t care', "didn't care", 'don’t care', "don't care", 'couldn’t care less', "couldn't care less",
      'to make me feel', 'to get back at me', 'to punish me', 'to manipulate me',
      'obviously', 'clearly', 'because you', 'because he', 'because she', 'because they',
      'for no reason', 'to hurt me', 'to hurt us', 'to spite me', 'to spite us', 'to annoy me', 'to annoy us',
      'just to hurt me', 'just to spite me', 'just to get a rise out of me', 'because you don’t care', "because you don't care",
      'because he doesn’t care', "because he doesn't care", 'because she doesn’t care', "because she doesn't care",
    ],
  },
  {
    key: 'globalLanguage',
    label: 'Global or absolute language',
    advice: 'Anchor the moment in a specific time frame instead of absolutes like “always”.',
    words: [
      'always', 'never', 'forever', 'constantly', 'incessantly', 'every time', 'all the time',
      'everyone', 'no one', 'nobody', 'all of you', 'none of you', 'all', 'none', 'whenever', 'everybody',
    ],
  },
  {
    key: 'vagueQuantifiers',
    label: 'Vague quantifiers or comparatives',
    advice: 'Give a count or timeframe instead of words like “often” or “too much”.',
    words: [
      'a lot', 'lots', 'many', 'countless', 'tons of', 'a bunch of',
      'often', 'rarely', 'frequently', 'sometimes', 'usually', 'normally', 'typically', 'seldom', 'hardly ever', 'mostly',
      'too much', 'too little', 'too many', 'enough', 'not enough',
      'more', 'less', 'better', 'worse',
      'very', 'really', 'extremely', 'totally', 'completely',
      'kind of', 'sorta', 'sort of', 'somewhat',
    ],
  },
  {
    key: 'fauxFeelingStoryWords',
    label: 'Faux-feelings or story words',
    advice: 'Name the words or actions you witnessed instead of story words like these.',
    words: [
      'ignored', 'dismissed', 'minimized', 'overlooked', 'sidelined', 'excluded', 'left out', 'ostracized',
      'abandoned', 'neglected',
      'attacked', 'targeted', 'picked on',
      'disrespected', 'devalued', 'belittled', 'demeaned', 'humiliated', 'shamed', 'insulted',
      'betrayed', 'backstabbed', 'thrown under the bus',
      'invalidated', 'unheard', 'unseen', 'unappreciated', 'unrecognized', 'taken for granted',
      'manipulated', 'controlled', 'coerced', 'used', 'exploited', 'taken advantage of',
      'gaslit', 'gaslighted',
      'judged', 'blamed', 'accused', 'criticized', 'condemned',
      'rejected', 'unwanted', 'unloved',
      'victimized', 'mistreated', 'abused', 'harassed',
      'threatened', 'unsafe',
      'pressured', 'cornered', 'provoked',
      'lied to', 'deceived', 'misled', 'tricked',
      'stonewalled', 'ghosted', 'left on read',
      'undermined', 'sabotaged', 'silenced', 'talked over', 'talked down to',
    ],
  },
  {
    key: 'idiomEvaluations',
    label: 'Idioms that conceal evaluations',
    advice: 'Translate the idiom into what a camera or microphone would capture.',
    words: [
      'threw me under the bus', 'stabbed me in the back', 'pushed my buttons',
      'talked down to me', 'gave me the cold shoulder', 'shut me down', 'steamrolled me',
      'blew me off', 'strung me along', 'led me on', 'set me up', 'baited me',
      'overstepped', 'crossed a boundary', 'out of pocket',
    ],
  },
  {
    key: 'pathologizingLabels',
    label: 'Pathologizing labels used as insults',
    advice: 'Describe the specific behaviour instead of medical labels.',
    words: [
      'crazy', 'insane', 'psycho', 'hysterical', 'unstable',
      'borderline', 'bipolar', 'adhd', 'autistic', 'ocd',
      'sociopath', 'psychopath', 'delusional',
    ],
  },
  {
    key: 'speculationLanguage',
    label: 'Speculation or inference language',
    advice: 'Stick with what you directly observed instead of “seems” or “probably”.',
    words: [
      'probably', 'likely', 'unlikely', 'maybe', 'perhaps', 'apparently', 'presumably',
      'seems', 'seemed', 'seeming', 'seems like', 'seem to', 'appears to', 'looks like', 'sounds like',
      'felt like', 'feel like',
    ],
  },
  {
    key: 'predictionLanguage',
    label: 'Predictions framed as certainty',
    advice: 'Focus on what already happened rather than predicting the future.',
    words: [
      'bound to', 'never going to', 'always going to', 'destined to', 'headed toward',
      'going to end up', 'sure to', 'guaranteed to', 'inevitable', 'without fail', 'no doubt',
    ],
  },
  {
    key: 'thinkingLanguage',
    label: 'Interpretations framed as thoughts',
    advice: 'Move “I think…” statements to the interpretation step and keep observations factual.',
    words: [
      'i think', 'i believe', 'i assume', 'i guess', 'i suspect', 'i imagine', 'i figure', 'i bet', 'i wonder if',
    ],
  },
  {
    key: 'blameLanguage',
    label: 'Blame or fault language',
    advice: 'Drop blame phrases and recount the observable sequence instead.',
    words: [
      'fault', 'faults', 'faulted', 'blame', 'blamed', 'blaming', 'at fault',
    ],
  },
  {
    key: 'absenceLanguage',
    label: 'Abstract lack statements',
    advice: 'Swap “lack of…” for a description of what you actually saw or heard.',
    words: [
      'lack of respect', 'lack of consideration', 'lack of empathy', 'lack of support', 'lack of effort',
      'lack of professionalism', 'lack of accountability', 'lack of integrity', 'lack of follow-through',
      'lack of transparency', 'lack of honesty', 'lack of communication', 'lack of awareness',
    ],
  },
  {
    key: 'thoughtsAsFeelings',
    label: 'Thoughts masquerading as feelings',
    advice: 'If you want to share feelings, keep them in a separate sentence after the observation.',
    words: [
      'i feel that', 'i feel like', 'i feel as if', 'i feel as though',
      'i feel you are', 'i feel he is', 'i feel she is', 'i feel they are',
      'i feel it’s', "i feel it's", 'i feel you should',
    ],
  },
];

const FLAG_GROUPS = FLAG_GROUP_DEFS.map(def => ({
  key: def.key,
  label: def.label,
  advice: def.advice || FLAG_GUIDANCE,
  patterns: createWordPatterns(def.words || []),
}));

export const AGENTIVE_PATTERNS = [
  /you\s+made\s+me/i,
  /they\s+made\s+me/i,
  /because of you/i,
  /made\s+me\s+feel/i,
  /caused\s+me\s+to/i,
  /forced\s+me\s+to/i,
  /you\s+forced\s+me/i,
  /pressured\s+me\s+to/i,
  /left\s+me\s+no\s+choice/i,
];

export function lintObservation(text, catalog) {
  const source = typeof text === 'string' ? text : '';
  const protectedRanges = findQuoteRanges(source);
  const evaluationMarkers = collectPatternMatches(source, EVAL_WORD_PATTERNS, protectedRanges);
  const evaluationPhrases = collectPatternMatches(source, EVAL_PHRASE_PATTERNS, protectedRanges);
  const agentiveMarkers = collectRegexMatches(source, AGENTIVE_PATTERNS, protectedRanges);
  const flaggedGroups = collectFlaggedGroups(source, protectedRanges);
  const fauxFeelings = matchCatalogTerms(source, catalog, 'fauxFeelings', protectedRanges);
  const feelings = matchCatalogTerms(source, catalog, 'feelings', protectedRanges);
  const needs = matchCatalogTerms(source, catalog, 'needs', protectedRanges);

  const nonObservationalCount =
    evaluationMarkers.length +
    evaluationPhrases.length +
    agentiveMarkers.length +
    flaggedGroups.reduce((sum, group) => sum + (group.matches?.length || 0), 0) +
    fauxFeelings.length +
    feelings.length +
    needs.length;

  const groupMatches = flaggedGroups.flatMap(group => group.matches || []);
  const hits = uniqueStrings([...evaluationMarkers, ...evaluationPhrases, ...agentiveMarkers, ...groupMatches]);

  return {
    ok: nonObservationalCount === 0,
    hits,
    evaluationMarkers: uniqueStrings([...evaluationMarkers, ...evaluationPhrases]),
    agentiveMarkers,
    flaggedGroups,
    fauxFeelings,
    feelings,
    needs,
  };
}

export function scaffoldRewrite(input = {}) {
  const parts = [];
  if (input.when) parts.push(input.when.trim());
  if (input.what) parts.push(input.what.trim());
  const core = parts.filter(Boolean).join(', ');
  const gap = input.gap && input.gap.trim() ? ` I had hoped ${input.gap.trim()}.` : '';
  return core ? core + '.' + gap : '';
}

function collectPatternMatches(text, patterns, protectedRanges) {
  if (!Array.isArray(patterns)) return [];
  const seen = new Set();
  const matches = [];
  patterns.forEach(item => {
    if (!item || !item.regex) return;
    const label = item.label || item.regex.source;
    const hits = findMatches(text, item.regex);
    const hasUnprotected = hits.some(hit => !isRangeProtected(hit.start, hit.end, protectedRanges));
    if (hasUnprotected && !seen.has(label)) {
      seen.add(label);
      matches.push(label);
    }
  });
  return matches;
}

function collectRegexMatches(text, patterns, protectedRanges) {
  if (!Array.isArray(patterns)) return [];
  const seen = new Set();
  const matches = [];
  patterns.forEach(regex => {
    if (!(regex instanceof RegExp)) return;
    const hits = findMatches(text, regex);
    hits.forEach(hit => {
      if (!hit?.match) return;
      if (isRangeProtected(hit.start, hit.end, protectedRanges)) return;
      const label = hit.match.toLowerCase();
      if (seen.has(label)) return;
      seen.add(label);
      matches.push(hit.match);
    });
  });
  return matches;
}

function collectFlaggedGroups(text, protectedRanges) {
  if (!FLAG_GROUPS.length) return [];
  const groups = [];
  FLAG_GROUPS.forEach(group => {
    const tokens = [];
    (group.patterns || []).forEach(pattern => {
      const hits = findMatches(text, pattern.regex);
      hits.forEach(hit => {
        if (!hit?.match) return;
        if (isRangeProtected(hit.start, hit.end, protectedRanges)) return;
        const token = hit.match.trim();
        if (token) {
          tokens.push(token);
        }
      });
    });
    const matches = uniqueStrings(tokens);
    if (matches.length) {
      groups.push({ key: group.key, label: group.label, advice: group.advice, matches });
    }
  });
  return groups;
}

function matchCatalogTerms(text, catalog, key, protectedRanges) {
  if (!catalog || !catalog[key] || typeof catalog[key].forEach !== 'function') {
    return [];
  }

  const cacheKey = `__${key}Matchers`;
  if (!catalog[cacheKey]) {
    catalog[cacheKey] = buildCatalogMatchers(catalog[key]);
  }

  const matchers = catalog[cacheKey] || [];
  const matches = [];
  const seen = new Set();
  matchers.forEach(matcher => {
    if (!matcher?.regex) return;
    const hits = findMatches(text, matcher.regex);
    const hasUnprotected = hits.some(hit => !isRangeProtected(hit.start, hit.end, protectedRanges));
    if (hasUnprotected && !seen.has(matcher.slug)) {
      seen.add(matcher.slug);
      matches.push(matcher.slug);
    }
  });
  return matches;
}

function buildCatalogMatchers(map) {
  const list = [];
  if (!map || typeof map.forEach !== 'function') {
    return list;
  }

  map.forEach((value, slug) => {
    const labels = new Set();
    if (value?.title) labels.add(value.title);
    if (slug) labels.add(slug.replace(/-/g, ' '));
    if (Array.isArray(value?.aliases)) {
      value.aliases.forEach(alias => {
        if (alias) labels.add(alias);
      });
    }
    labels.forEach(label => {
      const regex = buildWordRegex(label);
      if (regex) {
        list.push({ slug, regex });
      }
    });
  });

  return list;
}

function buildWordRegex(term) {
  if (typeof term !== 'string') return null;
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  const tokens = normalized.split(/[^a-z0-9'’]+/).filter(Boolean);
  if (!tokens.length) return null;
  const pattern = tokens
    .map(token => token.replace(/['’]/g, "['’]?"))
    .join('\\s+');
  if (!pattern) return null;
  return new RegExp(`\\b${pattern}(?:['’]s)?\\b`, 'i');
}

function createWordPatterns(words) {
  if (!Array.isArray(words)) return [];
  const patterns = [];
  words.forEach(word => {
    const regex = buildWordRegex(word);
    if (regex) {
      patterns.push({ label: word, regex });
    }
  });
  return patterns;
}

function findMatches(text, regex) {
  if (!(regex instanceof RegExp)) return [];
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const pattern = new RegExp(regex.source, flags);
  const matches = [];
  let exec;
  while ((exec = pattern.exec(text)) !== null) {
    const matchText = exec[0] || '';
    matches.push({
      start: exec.index,
      end: exec.index + matchText.length,
      match: matchText,
    });
    if (matchText.length === 0) {
      pattern.lastIndex++;
    }
  }
  return matches;
}

function isRangeProtected(start, end, ranges) {
  if (!Array.isArray(ranges) || !ranges.length) {
    return false;
  }
  return ranges.some(range => start >= range.start && end <= range.end);
}

function findQuoteRanges(text) {
  if (typeof text !== 'string' || !text) {
    return [];
  }
  const ranges = [];
  const regex = /“[^”]*”|"[^"\n]*"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const segment = match[0] || '';
    ranges.push({ start: match.index, end: match.index + segment.length });
    if (segment.length === 0) {
      regex.lastIndex++;
    }
  }
  return ranges;
}

function uniqueStrings(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  const seen = new Set();
  items.forEach(item => {
    if (!item) return;
    const key = String(item).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}
