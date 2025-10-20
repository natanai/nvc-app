export const EVAL_MARKERS = [
  'always',
  'never',
  'should',
  'shouldn’t',
  "shouldn't",
  'must',
  'ought',
  'right',
  'wrong',
  'good',
  'bad',
  'better',
  'worse',
  'best',
  'worst',
  'lazy',
  'selfish',
  'rude',
  'respectful',
  'disrespectful',
  'toxic',
  'manipulative',
  'gaslighting',
  'immature',
  'childish',
  'irresponsible',
  'careless',
  'unfair',
  'mean',
  'unkind',
  'crazy',
  'insane',
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
  { label: 'supposed to', regex: /\bsupposed\s+to\b/i },
  { label: 'have to', regex: /\bhave\s+to\b/i },
  { label: 'kind of person', regex: /\bkind\s+of\s+person\b/i },
  { label: 'take advantage', regex: /\btake\s+advantage\b/i },
];

export const AGENTIVE_PATTERNS = [/you\s+made\s+me/i, /they\s+made\s+me/i, /because of you/i];

export function lintObservation(text, catalog) {
  const source = typeof text === 'string' ? text : '';
  const evaluationMarkers = collectPatternMatches(source, EVAL_WORD_PATTERNS);
  const evaluationPhrases = collectPatternMatches(source, EVAL_PHRASE_PATTERNS);
  const agentiveMarkers = collectRegexMatches(source, AGENTIVE_PATTERNS);
  const fauxFeelings = matchCatalogTerms(source, catalog, 'fauxFeelings');
  const feelings = matchCatalogTerms(source, catalog, 'feelings');
  const needs = matchCatalogTerms(source, catalog, 'needs');

  const nonObservationalCount =
    evaluationMarkers.length +
    evaluationPhrases.length +
    agentiveMarkers.length +
    fauxFeelings.length +
    feelings.length +
    needs.length;

  const hits = uniqueStrings([...evaluationMarkers, ...evaluationPhrases, ...agentiveMarkers]);

  return {
    ok: nonObservationalCount === 0,
    hits,
    evaluationMarkers: uniqueStrings([...evaluationMarkers, ...evaluationPhrases]),
    agentiveMarkers,
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
