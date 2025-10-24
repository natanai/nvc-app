import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const TAXONOMY_PATH = join(rootDir, 'data', 'observation_taxonomy.json');
const INDEX_PATH = join(rootDir, 'data', 'index.json');
const LEXICON_OUTPUT_PATH = join(rootDir, 'data', 'observation_lexicon.json');
const BLUEPRINT_OUTPUT_PATH = join(rootDir, 'data', 'observation_module_blueprints.json');

const VARIATIONS_PER_PATTERN = 12;
const STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'again',
  'all',
  'also',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'been',
  'before',
  'but',
  'by',
  'call',
  'can',
  'did',
  'didn',
  'do',
  'does',
  'doing',
  'during',
  'each',
  'for',
  'from',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'him',
  'his',
  'how',
  'i',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'me',
  'more',
  'most',
  'my',
  'no',
  'not',
  'of',
  'on',
  'once',
  'one',
  'only',
  'or',
  'our',
  'out',
  'over',
  's',
  'said',
  'she',
  'so',
  'some',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'two',
  'under',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'will',
  'with',
  'without',
  'would',
  'you',
  'your',
]);

const TIME_ANCHORS = [
  'On Monday morning',
  'On Monday evening',
  'On Tuesday afternoon',
  'On Tuesday night',
  'On Wednesday morning',
  'On Wednesday night',
  'On Thursday afternoon',
  'On Thursday evening',
  'On Friday morning',
  'On Friday night',
  'On Saturday afternoon',
  'On Saturday evening',
  'On Sunday morning',
  'On Sunday afternoon',
  'Yesterday morning',
  'Yesterday afternoon',
  'Yesterday evening',
  'Earlier today',
  'This morning',
  'This afternoon',
  'This evening',
  'Late last night',
  'Around lunchtime',
  'Right before bed',
];

const CONTEXT_ANCHORS = [
  'during our project stand-up',
  'during our one-on-one check-in',
  'during the team retro',
  'during a family dinner at home',
  'during a family video call',
  'during our weekly planning session',
  'during the apartment meeting',
  'during the PTA meeting',
  'during our therapy session',
  'during our budget review',
  'during a volunteer shift',
  'during the car ride home',
  'during our breakfast together',
  'during our lunch break',
  'during the evening walk',
  'during the commute on the train',
  'during our shared workspace day',
  'during the neighborhood association call',
  'during the doctor visit',
  'during the video conference',
  'during the strategy workshop',
  'during the parent-teacher conference',
  'during the study group',
  'during the support group call',
  'during the staff meeting',
  'during the weekly sync',
  'during the practice session',
  'during the weekend errand run',
  'during the grocery trip',
  'during our Sunday planning time',
  'during the apartment chore review',
  'during the morning coffee together',
  'during the evening debrief',
];

const SENSORY_PREFIXES = [
  'I noticed',
  'I observed',
  'I heard',
  'I saw',
  'I read',
  'I received',
  'I watched',
  'I felt the room shift when',
  'I tracked that',
  'I logged that',
  'I recorded that',
  'I checked and saw that',
];

const MODULE_SLOT_IDS = ['time', 'context', 'sensory'];

function main() {
  const taxonomy = JSON.parse(readFileSync(TAXONOMY_PATH, 'utf8'));
  const siteIndex = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));

  const support = buildSupportMaps(siteIndex);
  const modules = [];
  const lexicon = {};

  taxonomy.families.forEach(family => {
    const module = buildModule(family, support, lexicon);
    modules.push(module);
  });

  const sortedLexicon = Object.fromEntries(
    Object.entries(lexicon)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );

  const blueprint = { modules };

  writeFileSync(LEXICON_OUTPUT_PATH, `${JSON.stringify(sortedLexicon, null, 2)}\n`);
  writeFileSync(BLUEPRINT_OUTPUT_PATH, `${JSON.stringify(blueprint, null, 2)}\n`);

  console.info(
    `Generated ${modules.length} modules and ${modules.reduce((sum, module) => sum + module.cues.length, 0)} cues.`,
  );
}

function buildSupportMaps(siteIndex) {
  const feelings = new Map();
  const needs = new Map();
  const feelingSlugs = new Set();
  const needSlugs = new Set();

  (siteIndex.feelings || []).forEach(entry => {
    if (!entry) return;
    const title = normalizeKey(entry.title);
    const slugKey = normalizeKey(entry.slug);
    if (entry.slug) {
      feelingSlugs.add(entry.slug);
    }
    if (title) {
      feelings.set(title, entry.slug);
    }
    if (slugKey) {
      feelings.set(slugKey, entry.slug);
    }
  });

  (siteIndex.needs || []).forEach(entry => {
    if (!entry) return;
    const title = normalizeKey(entry.title);
    const slugKey = normalizeKey(entry.slug);
    if (entry.slug) {
      needSlugs.add(entry.slug);
    }
    if (title) {
      needs.set(title, entry.slug);
    }
    if (slugKey) {
      needs.set(slugKey, entry.slug);
    }
  });

  const overrides = {
    feelings: new Map([
      ['overwhelm', 'overwhelmed'],
      ['tense', 'tense'],
      ['concerned', 'anxious'],
        ['disappointment', 'disappointed'],
      ['disappointed', 'disappointed'],
      ['disappointmented', 'disappointed'],
      ['annoyed', 'irritated'],
      ['uncomfortable', 'tense'],
      ['startled', 'alarmed'],
      ['distracted', 'confused'],
      ['stressed', 'pressured'],
      ['alert', 'energized'],
        ['worried', 'anxious'],
        ['unsure', 'anxious'],
    ]),
    needs: new Map([
      ['love caring', 'love-caring'],
      ['non judgmental communication', 'non-judgmental-communication'],
      ['do things at my own pace and in my own way', 'do-things-at-my-own-pace-and-in-my-own-way'],
      ['mutual support', 'mutual-support'],
      ['creative flow', 'creative-flow'],
      ['to belong', 'belonging'],
      ['to be included', 'inclusion'],
      ['to be acknowledged', 'acknowledgement'],
      ['to be safe', 'safety'],
      ['to be supported', 'support'],
      ['to feel safe', 'safety'],
      ['to feel secure', 'security'],
      ['to have choice', 'autonomy'],
      ['to have clarity', 'clarity'],
      ['to have harmony', 'harmony'],
      ['to rest', 'rest'],
      ['to recharge', 'rest'],
      ['to reconnect', 'connection'],
      ['steady presence', 'stability'],
      ['to be trusted', 'trust'],
      ['trusting communication', 'trust'],
      ['to be treated fairly', 'fairness'],
      ['reliable communication', 'reliability'],
      ['to be included fairly', 'fairness'],
      ['space to decompress', 'space'],
      ['shared understanding', 'understanding'],
    ]),
  };

  return { feelings, needs, feelingSlugs, needSlugs, overrides };
}

function buildModule(family, support, lexicon) {
  const moduleId = String(family.id || '').trim();
  if (!moduleId) {
    throw new Error('Family missing id');
  }
  const moduleLabel = String(family.label || '').trim() || formatTitle(moduleId);
  const moduleSummary = `Scenarios involving ${moduleLabel.toLowerCase()}.`;
  const moduleLexiconKeys = [];
  const moduleCues = [];
  const moduleFeelings = new Set();
  const moduleNeeds = new Set();

  const patterns = Array.isArray(family.patterns) ? family.patterns : [];

  patterns.forEach(pattern => {
    const patternId = String(pattern.id || '').trim();
    if (!patternId) {
      return;
    }

    const lexiconKey = `${moduleId}__${patternId}`;
    moduleLexiconKeys.push(lexiconKey);

    const patternFeelings = mapTerms(pattern.feelings || [], support.feelings, support.feelingSlugs, support.overrides.feelings);
    const patternNeeds = mapTerms(pattern.needs || [], support.needs, support.needSlugs, support.overrides.needs);

    patternFeelings.forEach(feeling => moduleFeelings.add(feeling));
    patternNeeds.forEach(need => moduleNeeds.add(need));

    const baseExample = sanitizeSentence(pattern.example || pattern.label || patternId.replace(/[-_]/g, ' '));
    const tokens = generateTokens(patternId, pattern.label, pattern.example);
    if (tokens.length) {
      lexicon[lexiconKey] = [{ tokens, threshold: Math.min(3, tokens.length) }];
    } else {
      lexicon[lexiconKey] = [{ phrase: baseExample }];
    }

    for (let variantIndex = 0; variantIndex < VARIATIONS_PER_PATTERN; variantIndex += 1) {
      const cueId = `${moduleId}-${patternId}-${variantIndex + 1}`;
      const example = buildExampleSentence(baseExample, variantIndex);
      moduleCues.push({
        id: cueId,
        lexiconKeys: [lexiconKey],
        feelings: patternFeelings,
        needs: patternNeeds,
        example,
      });
    }
  });

  const uniqueLexiconKeys = uniqueStrings(moduleLexiconKeys);
  const cues = moduleCues;

  return {
    id: moduleId,
    label: moduleLabel,
    summary: moduleSummary,
    slotIds: MODULE_SLOT_IDS,
    lexiconKeys: uniqueLexiconKeys,
    feelings: Array.from(moduleFeelings),
    needs: Array.from(moduleNeeds),
    examples: cues.slice(0, 3).map(cue => cue.example),
    cues,
  };
}

function mapTerms(terms, baseMap, slugSet, overrideMap) {
  const results = new Set();
  (terms || []).forEach(term => {
    const mapped = mapTerm(term, baseMap, slugSet, overrideMap);
    if (mapped) {
      results.add(mapped);
    }
  });
  return Array.from(results);
}

function mapTerm(term, baseMap, slugSet, overrideMap) {
  if (!term) {
    return null;
  }
  const trimmed = String(term).trim();
  if (!trimmed) {
    return null;
  }
  const candidateSlug = slugify(trimmed);
  if (slugSet.has(candidateSlug)) {
    return candidateSlug;
  }
  const normalized = normalizeKey(trimmed);
  if (overrideMap && overrideMap.has(normalized)) {
    return overrideMap.get(normalized);
  }
  if (baseMap.has(normalized)) {
    return baseMap.get(normalized);
  }
  if (baseMap.has(candidateSlug)) {
    return baseMap.get(candidateSlug);
  }
  console.warn(`⚠️ Unable to map term "${trimmed}" to a supported slug.`);
  return null;
}

function generateTokens(id, label, example) {
  const candidates = new Set();
  addWords(candidates, id.replace(/[-_]/g, ' '));
  addWords(candidates, label);
  addWords(candidates, example);
  const filtered = Array.from(candidates)
    .filter(token => token && !STOP_WORDS.has(token) && (token.length >= 3 || /\d/.test(token)))
    .map(token => token.toLowerCase());

  const prioritized = prioritizeTokens(filtered);
  return prioritized.slice(0, 6);
}

function prioritizeTokens(tokens) {
  const weights = new Map();
  tokens.forEach(token => {
    const existing = weights.get(token) || 0;
    const weight = existing + (token.length >= 6 ? 3 : token.length >= 4 ? 2 : 1);
    weights.set(token, weight);
  });
  return Array.from(weights.keys()).sort((a, b) => {
    const weightDiff = (weights.get(b) || 0) - (weights.get(a) || 0);
    if (weightDiff !== 0) return weightDiff;
    return a.localeCompare(b);
  });
}

function addWords(set, text) {
  if (!text) {
    return;
  }
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  words.forEach(word => set.add(word));
}

function buildExampleSentence(baseExample, variantIndex) {
  const time = TIME_ANCHORS[variantIndex % TIME_ANCHORS.length];
  const context = CONTEXT_ANCHORS[Math.floor(variantIndex / TIME_ANCHORS.length) % CONTEXT_ANCHORS.length];
  const sensory = SENSORY_PREFIXES[
    Math.floor(variantIndex / (TIME_ANCHORS.length * CONTEXT_ANCHORS.length)) % SENSORY_PREFIXES.length
  ];
  const clause = lowercaseFirst(baseExample.replace(/\.$/, ''));
  return `${time} ${context}, ${sensory} ${clause}.`;
}

function lowercaseFirst(value) {
  if (!value) {
    return '';
  }
  return value[0].toLowerCase() + value.slice(1);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/&+]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sanitizeSentence(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  (values || []).forEach(value => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
}

function formatTitle(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

try {
  main();
} catch (error) {
  console.error('Failed to generate observation blueprint');
  console.error(error);
  process.exit(1);
}
