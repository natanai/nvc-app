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
];

const EVAL_WORD_PATTERNS = EVAL_MARKERS.map(word => ({
  label: word,
  regex: buildWordRegex(word),
}));

const EVAL_PHRASE_PATTERNS = [
  { label: 'waste of time', regex: /\bwaste\s+of\s+time\b/i },
  { label: 'kind of person', regex: /\bkind\s+of\s+person\b/i },
  { label: 'take advantage', regex: /\btake\s+advantage\b/i },
];

const FLAG_GUIDANCE = 'Try swapping in a time/place anchor, a quote, a count or measure, or a link to an artifact.';

const FLAG_GROUP_DEFS = [
  {
    key: 'traitLabels',
    label: 'Trait / character labels',
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
      'evil', 'bad', 'wrong',
    ],
  },
  {
    key: 'moralizingLanguage',
    label: 'Moralizing language',
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
    words: [
      'on purpose', 'intentionally', 'deliberately', 'trying to', 'meant to', 'wanted to',
      'didn’t care', "didn't care", 'don’t care', "don't care", 'couldn’t care less', "couldn't care less",
      'to make me feel', 'to get back at me', 'to punish me', 'to manipulate me',
      'obviously', 'clearly', 'because you',
    ],
  },
  {
    key: 'globalLanguage',
    label: 'Global or absolute language',
    words: [
      'always', 'never', 'forever', 'constantly', 'incessantly', 'every time', 'all the time',
      'everyone', 'no one', 'nobody', 'all of you', 'none of you', 'all', 'none',
    ],
  },
  {
    key: 'vagueQuantifiers',
    label: 'Vague quantifiers or comparatives',
    words: [
      'a lot', 'lots', 'many', 'countless', 'tons of', 'a bunch of',
      'often', 'rarely', 'frequently', 'sometimes',
      'too much', 'too little', 'too many', 'enough', 'not enough',
      'more', 'less', 'better', 'worse',
      'very', 'really', 'extremely', 'totally', 'completely',
      'kind of', 'sorta', 'sort of', 'somewhat',
    ],
  },
  {
    key: 'fauxFeelingStoryWords',
    label: 'Faux-feelings or story words',
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
    words: [
      'crazy', 'insane', 'psycho', 'hysterical', 'unstable',
      'borderline', 'bipolar', 'adhd', 'autistic', 'ocd',
      'sociopath', 'psychopath', 'delusional',
    ],
  },
  {
    key: 'thoughtsAsFeelings',
    label: 'Thoughts masquerading as feelings',
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

export const AGENTIVE_PATTERNS = [/you\s+made\s+me/i, /they\s+made\s+me/i, /because of you/i];

export function lintObservation(text, catalog) {
  const source = typeof text === 'string' ? text : '';
  const evaluationMarkers = collectPatternMatches(source, EVAL_WORD_PATTERNS);
  const evaluationPhrases = collectPatternMatches(source, EVAL_PHRASE_PATTERNS);
  const agentiveMarkers = collectRegexMatches(source, AGENTIVE_PATTERNS);
  const flaggedGroups = collectFlaggedGroups(source);
  const fauxFeelings = matchCatalogTerms(source, catalog, 'fauxFeelings');
  const feelings = matchCatalogTerms(source, catalog, 'feelings');
  const needs = matchCatalogTerms(source, catalog, 'needs');

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

function collectPatternMatches(text, patterns) {
  if (!Array.isArray(patterns)) return [];
  const seen = new Set();
  const matches = [];
  patterns.forEach(item => {
    if (!item || !item.regex) return;
    if (item.regex.test(text)) {
      const label = item.label || item.regex.source;
      if (!seen.has(label)) {
        seen.add(label);
        matches.push(label);
      }
    }
  });
  return matches;
}

function collectRegexMatches(text, patterns) {
  if (!Array.isArray(patterns)) return [];
  const seen = new Set();
  const matches = [];
  patterns.forEach(regex => {
    if (!(regex instanceof RegExp)) return;
    const exec = regex.exec(text);
    if (exec && exec[0]) {
      const label = exec[0].toLowerCase();
      if (!seen.has(label)) {
        seen.add(label);
        matches.push(label);
      }
    }
  });
  return matches;
}

function collectFlaggedGroups(text) {
  if (!FLAG_GROUPS.length) return [];
  const groups = [];
  FLAG_GROUPS.forEach(group => {
    const matches = collectPatternMatches(text, group.patterns);
    if (matches.length) {
      groups.push({ key: group.key, label: group.label, advice: group.advice, matches });
    }
  });
  return groups;
}

function matchCatalogTerms(text, catalog, key) {
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
    if (matcher.regex.test(text) && !seen.has(matcher.slug)) {
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
