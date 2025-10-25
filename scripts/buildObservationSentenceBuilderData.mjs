import fs from 'fs/promises';
import path from 'path';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const SENTENCE_BUILDER_DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const SENTENCE_BUILDER_RELATIVE_MOMENTS = [
  'Yesterday',
  'Earlier today',
  'This morning',
  'This afternoon',
  'This evening',
  'Tonight',
  'Last night',
  'Earlier this week',
  'Over the weekend',
];

const SENTENCE_BUILDER_CALENDAR_REFERENCES = [
  'early this month',
  'mid-month',
  'later this month',
  'early this quarter',
  'mid-year',
  'late this year',
];

const SENTENCE_BUILDER_TIMES_OF_DAY = [
  'early morning',
  'mid-morning',
  'midday',
  'early afternoon',
  'late afternoon',
  'early evening',
  'late evening',
  'midnight',
];

const SENTENCE_BUILDER_SEEDED_MOMENTS = [
  'During the weekly check-in',
  'During the staff meeting',
  'Right after the call ended',
  'Right before the handoff',
  'While we reviewed updates',
  'As we wrapped up for the day',
  'While we waited for feedback',
  'During the morning standup',
  'During the afternoon sync',
];

const SENTENCE_BUILDER_CONTEXT_LOCATIONS = [
  'at work',
  'at home',
  'in the meeting room',
  'in the classroom',
  'on a video call',
  'on the phone',
  'in the group chat',
  'in the hallway',
  'in the lobby',
  'at the event space',
  'at the coffee area',
  'in the workshop',
  'on the project channel',
];

const SENTENCE_BUILDER_CONTEXT_COMPANIONS = [
  'with my team',
  'with my family',
  'with a client',
  'with the students',
  'with coworkers',
  'with a manager',
  'with a partner',
  'on my own',
  'with a facilitator',
  'with a support agent',
  'with the group',
  'with the vendor',
];

const SENTENCE_BUILDER_WHERE_RELATIONSHIP_PLACEHOLDERS = [
  '(person-partner)',
  '(person-peer)',
  '(person-authority)',
  '(person-general)',
];

const SENTENCE_BUILDER_CONTEXT_MODIFIERS = [
  '',
  'during our check-in',
  'during the meeting',
  'while we reviewed updates',
  'while we planned next steps',
  'as we wrapped up for the day',
];

const SENTENCE_BUILDER_SEEDED_CONTEXTS = [
  'at work with my team',
  'at home with my family',
  'on a video call with a client',
  'in the classroom with the students',
  'at the event space with the group',
  'in the lobby on my own',
  'on the phone with a support agent',
  'in the hallway with coworkers',
  'on the project channel with the team',
  'in the meeting room with a manager',
];

const SENTENCE_BUILDER_WHEN_TEMPLATE_TOKENS = [
  ['When', '(moment)'],
  ['When', 'I', '(moment)'],
  ['When', 'we', '(moment)'],
  ['When', 'the', '(event)'],
  ['While', '(moment)'],
  ['While', 'I', '(moment)'],
  ['While', 'we', '(moment)'],
  ['While', '(moment)', 'during', '(event)'],
  ['As', 'soon', 'as', '(event)'],
  ['As', 'we', '(moment)'],
  ['As', 'I', '(moment)'],
  ['After', '(event)'],
  ['After', '(event)', 'at', '(location)'],
  ['After', '(event)', 'with', '(person-general)'],
  ['Before', '(event)'],
  ['Before', '(event)', 'at', '(location)'],
  ['Before', '(event)', 'with', '(person-general)'],
  ['Right', 'after', '(event)'],
  ['Right', 'before', '(event)'],
  ['Right', 'after', '(event)', 'at', '(location)'],
  ['Right', 'before', '(event)', 'at', '(location)'],
  ['During', '(event)'],
  ['During', '(event)', 'at', '(location)'],
  ['During', '(event)', 'with', '(person-general)'],
  ['Throughout', '(event)'],
  ['Throughout', '(event)', 'at', '(location)'],
  ['Throughout', '(event)', 'with', '(group)'],
  ['On', '(day)'],
  ['On', '(day)', 'morning'],
  ['On', '(day)', 'afternoon'],
  ['On', '(day)', 'evening'],
  ['On', '(day)', 'during', '(event)'],
  ['On', '(day)', 'at', '(time)'],
  ['On', '(date)'],
  ['On', '(date)', 'at', '(time)'],
  ['On', '(date)', 'during', '(event)'],
  ['At', '(time)'],
  ['At', '(time)', 'during', '(event)'],
  ['At', '(time)', 'with', '(person-general)'],
  ['Later', 'that', '(day)'],
  ['Later', 'in', '(moment)'],
  ['Earlier', 'that', '(day)'],
  ['Earlier', 'in', '(moment)'],
  ['In', 'the', 'middle', 'of', '(event)'],
  ['Moments', 'after', '(event)'],
  ['Moments', 'before', '(event)'],
  ['Heading', 'into', '(event)'],
  ['Heading', 'out', 'of', '(event)'],
  ['Immediately', 'after', '(event)'],
  ['Immediately', 'before', '(event)'],
];

const SENTENCE_BUILDER_WHEN_FLEXIBLE_EXTRAS = [
  ['After', '(moment)'],
  ['After', '(time)'],
  ['After', '(day)'],
  ['After', '(date)'],
  ['Before', '(moment)'],
  ['Before', '(time)'],
  ['Before', '(day)'],
  ['Before', '(date)'],
  ['While', '(event)', 'at', '(location)'],
  ['While', '(event)', 'with', '(person-general)'],
  ['While', '(moment)', 'at', '(location)'],
  ['When', '(day)', 'at', '(time)'],
  ['When', '(moment)', 'at', '(location)'],
  ['When', '(moment)', 'with', '(person-general)'],
  ['When', '(time)'],
  ['When', '(date)'],
  ['During', '(moment)'],
  ['During', '(moment)', 'at', '(location)'],
  ['During', '(moment)', 'with', '(person-general)'],
  ['Throughout', '(event)', 'with', '(person-general)'],
  ['Around', '(time)'],
  ['Around', '(moment)'],
  ['Earlier', 'than', '(time)'],
  ['Later', 'than', '(time)'],
  ['Earlier', 'that', '(day)', 'at', '(time)'],
  ['Later', 'that', '(day)', 'at', '(time)'],
];

const SENTENCE_BUILDER_WHERE_TEMPLATE_TOKENS = [
  ['at', '(location)'],
  ['at', '(location)', 'with', '(person-general)'],
  ['at', '(location)', 'with', '(person-partner)'],
  ['at', '(location)', 'with', '(person-peer)'],
  ['at', '(location)', 'with', '(person-authority)'],
  ['at', '(location)', 'with', '(group)'],
  ['at', '(location)', 'with', '(people)'],
  ['at', '(location)', 'during', '(event)'],
  ['at', '(location)', 'about', '(object)'],
  ['at', '(location)', 'discussing', '(object)'],
  ['at', '(location)', 'reviewing', '(object)'],
  ['in', '(location)'],
  ['in', '(location)', 'with', '(person-general)'],
  ['in', '(location)', 'with', '(group)'],
  ['in', '(location)', 'with', '(people)'],
  ['in', '(location)', 'during', '(event)'],
  ['in', '(location)', 'about', '(object)'],
  ['in', '(location)', 'reviewing', '(object)'],
  ['in', 'conversation', 'with', '(person-general)'],
  ['in', 'conversation', 'with', '(group)'],
  ['on', '(channel)'],
  ['on', '(channel)', 'with', '(person-general)'],
  ['on', '(channel)', 'with', '(group)'],
  ['on', '(channel)', 'with', '(person-general)', 'about', '(object)'],
  ['on', '(channel)', 'with', '(group)', 'about', '(object)'],
  ['on', '(channel)', 'about', '(object)'],
  ['on', '(channel)', 'during', '(event)'],
  ['over', '(channel)'],
  ['over', '(channel)', 'with', '(person-general)'],
  ['over', '(channel)', 'with', '(group)'],
  ['with', '(person-general)'],
  ['with', '(person-partner)'],
  ['with', '(person-peer)'],
  ['with', '(person-authority)'],
  ['with', '(role)'],
  ['with', '(group)'],
  ['with', '(people)'],
  ['with', '(person-general)', 'on', '(channel)'],
  ['with', '(person-general)', 'for', '(event)'],
  ['with', '(person-general)', 'about', '(object)'],
  ['with', '(person-general)', 'during', '(event)'],
  ['with', '(group)', 'during', '(event)'],
  ['with', '(group)', 'about', '(object)'],
  ['with', '(group)', 'on', '(channel)'],
  ['with', '(people)', 'about', '(object)'],
  ['with', '(people)', 'during', '(event)'],
  ['during', '(event)'],
  ['during', '(event)', 'with', '(person-general)'],
  ['during', '(event)', 'with', '(group)'],
  ['during', '(event)', 'on', '(channel)'],
  ['near', '(location)'],
  ['outside', '(location)'],
  ['inside', '(location)'],
  ['around', '(location)'],
  ['across', '(channel)'],
  ['across', '(channel)', 'with', '(person-general)'],
  ['between', '(location)', 'and', '(location)'],
  ['from', '(location)'],
  ['alongside', '(person-peer)'],
  ['alongside', '(person-general)'],
  ['alongside', '(group)'],
  ['in', 'front', 'of', '(location)'],
  ['next', 'to', '(person-general)'],
  ['next', 'to', '(group)'],
];

const HEARD_VERB_KEYWORDS = [
  'said',
  'told',
  'asked',
  'yelled',
  'shouted',
  'whispered',
  'muttered',
  'texted',
  'emailed',
  'messaged',
  'called',
  'announced',
  'sang',
  'reported',
];

const ACTION_ACTOR_PATTERNS = [
  { regex: /\bmy\s+(?:manager|boss|supervisor|director|principal|teacher|professor|coach|lead|leadership)\b/gi, value: '(person-authority)' },
  { regex: /\bour\s+(?:manager|boss|supervisor|director|principal|teacher|professor|coach|lead|leadership)\b/gi, value: '(person-authority)' },
  { regex: /\bthe\s+(?:manager|boss|supervisor|director|principal|teacher|professor|coach|lead)\b/gi, value: '(person-authority)' },
  { regex: /\bmy\s+(?:partner|spouse|husband|wife|girlfriend|boyfriend|fianc[ée]|significant\s+other)\b/gi, value: '(person-partner)' },
  { regex: /\bour\s+(?:partner|spouse|husband|wife|girlfriend|boyfriend|fianc[ée]|significant\s+other)\b/gi, value: '(person-partner)' },
  { regex: /\bmy\s+(?:coworker|colleague|teammate|peer|classmate|friend|neighbor)\b/gi, value: '(person-peer)' },
  { regex: /\bour\s+(?:coworker|colleague|teammate|peer|classmate|friend|neighbor)\b/gi, value: '(person-peer)' },
  { regex: /\bthe\s+(?:coworker|colleague|teammate|peer|classmate|friend|neighbor)\b/gi, value: '(person-peer)' },
  { regex: /(?<!person-)\b(?:someone|somebody|anyone|coworker|colleague|teammate|peer|classmate|friend|neighbor)\b/gi, value: '(person-general)' },
  { regex: /\b(?:my|our|the)\s+(?:team|group|committee|department|board|staff|family|audience|class|crew)\b/gi, value: '(group)' },
  { regex: /\b(?:customers?|clients?|patients?)\b/gi, value: '(people)' },
  { regex: /\b(?:boss|manager|supervisor|director|principal|teacher|professor|coach|lead)\b/gi, value: '(person-authority)' },
];

const ACTION_OBJECT_PATTERNS = [
  { regex: /\b(?:budget|report|plan|proposal|project|task|issue|update|deck|slides|presentation|document|policy|contract|schedule|invoice|notes?)\b/gi, value: '(object)' },
  { regex: /\b(?:meeting|check[-\s]?in|stand[-\s]?up|review|call|sync|workshop|training|session|huddle)\b/gi, value: '(event)' },
  { regex: /\b(?:slack|teams|zoom|text|email|phone|video\s+call)\b/gi, value: '(channel)' },
  { regex: /\b(?:deadline|launch|handoff)\b/gi, value: '(event)' },
];

const ACTION_MESSAGE_PATTERNS = [
  { regex: /\b(?:message|messages|text|texts|email|emails|dm|dms|post|posts|comment|comments|ping|pings)\b/gi, value: '(message)' },
];

const ACTION_PRONOUN_REPLACEMENTS = [
  { regex: /\b(?:he|she|they)\b/gi, value: '(person-general)' },
  { regex: /\b(?:him|her|them)\b/gi, value: '(person-general)' },
  { regex: /\b(?:his|her|their)\b/gi, value: 'their' },
];

const ACTION_MISC_REPLACEMENTS = [
  { regex: /[“”]/g, value: '"' },
  { regex: /[’]/g, value: "'" },
  { regex: /\bI\s+(?:saw|see|heard|hear|noticed|notice|observed|observe|witnessed|witness)\s+/gi, value: '' },
  { regex: /\bWe\s+(?:saw|see|heard|hear|noticed|notice|observed|observe|witnessed|witness)\s+/gi, value: '' },
  { regex: /\bI\s+(?:was|am)\s+hearing\s+/gi, value: '' },
  { regex: /\bI\s+(?:was|am)\s+seeing\s+/gi, value: '' },
  { regex: /\bthis\s+happen:\s*/gi, value: '' },
  { regex: /\bthis:\s*/gi, value: '' },
  { regex: /\bthat:\s*/gi, value: '' },
  { regex: /\bthere\s+was\b/gi, value: 'there was' },
];

const ACTION_QUOTE_PLACEHOLDER = /"([^"\n]+)"/g;

const ACTION_TIME_PATTERNS = [
  { regex: /\b\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm)\b/gi, value: '(time)' },
  { regex: /\b\d{1,2}\s*(?:a\.m\.|p\.m\.|am|pm)\b/gi, value: '(time)' },
  { regex: /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, value: '(date)' },
  { regex: /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, value: '(day)' },
];

const ACTION_DETAIL_REPLACEMENTS = [
  { regex: /\b(?:yelled|shouted|screamed|announced|told|said|shared|asked)\b/gi, value: match => match.toLowerCase() === 'said' ? 'said' : match.toLowerCase() },
];

function createSentenceBuilderMomentLexicon() {
  return {
    daysOfWeek: [...SENTENCE_BUILDER_DAYS_OF_WEEK],
    relative: [...SENTENCE_BUILDER_RELATIVE_MOMENTS],
    calendarDates: [...SENTENCE_BUILDER_CALENDAR_REFERENCES],
    timesOfDay: [...SENTENCE_BUILDER_TIMES_OF_DAY],
    seeded: [...SENTENCE_BUILDER_SEEDED_MOMENTS],
  };
}

function createSentenceBuilderContextLexicon() {
  return {
    locations: [...SENTENCE_BUILDER_CONTEXT_LOCATIONS],
    companions: [...SENTENCE_BUILDER_CONTEXT_COMPANIONS],
    modifiers: [...SENTENCE_BUILDER_CONTEXT_MODIFIERS],
    seeded: [...SENTENCE_BUILDER_SEEDED_CONTEXTS],
  };
}

function normalizeBuilderSegment(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    return '';
  }
  return text.replace(/[\s]+/g, ' ').replace(/[;,:.]+$/g, '').trim();
}

function capitalizeFirst(text) {
  if (!text) {
    return '';
  }
  return text[0].toUpperCase() + text.slice(1);
}

function formatBuilderTitle(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(token => (token ? token[0].toUpperCase() + token.slice(1) : ''))
    .join(' ');
}

function ensureSentencePunctuation(text) {
  const source = typeof text === 'string' ? text.trim() : '';
  if (!source) {
    return '';
  }
  return /[.!?]$/.test(source) ? source : `${source}.`;
}

function determineBuilderSense(example) {
  const lower = typeof example === 'string' ? example.toLowerCase() : '';
  if (!lower) {
    return 'saw';
  }
  if (/["“”]/.test(example)) {
    return 'heard';
  }
  if (HEARD_VERB_KEYWORDS.some(keyword => lower.includes(` ${keyword} `) || lower.startsWith(`${keyword} `))) {
    return 'heard';
  }
  if (lower.includes('voicemail') || lower.includes('audio') || lower.includes('call')) {
    return 'heard';
  }
  return 'saw';
}

function applyReplacementPatterns(source, patterns) {
  if (!patterns || !patterns.length) {
    return source;
  }
  let text = source;
  patterns.forEach(pattern => {
    if (!pattern || !pattern.regex) {
      return;
    }
    const replacer = typeof pattern.value === 'function' ? pattern.value : () => pattern.value;
    text = text.replace(pattern.regex, replacer);
  });
  return text;
}

function normalizeActionExample(example) {
  if (typeof example !== 'string') {
    return '';
  }
  let text = example.trim();
  if (!text) {
    return '';
  }
  text = applyReplacementPatterns(text, ACTION_MISC_REPLACEMENTS);
  text = text.replace(ACTION_QUOTE_PLACEHOLDER, '(statement)');
  text = applyReplacementPatterns(text, ACTION_TIME_PATTERNS);
  text = applyReplacementPatterns(text, ACTION_ACTOR_PATTERNS);
  text = applyReplacementPatterns(text, ACTION_PRONOUN_REPLACEMENTS);
  text = applyReplacementPatterns(text, ACTION_MESSAGE_PATTERNS);
  text = applyReplacementPatterns(text, ACTION_OBJECT_PATTERNS);
  text = applyReplacementPatterns(text, ACTION_DETAIL_REPLACEMENTS);
  text = text
    .replace(/\s+/g, ' ')
    .replace(/[?!]+$/g, '')
    .trim();
  return text;
}

function extractActionActor(normalized) {
  const actorMatch = normalized.match(/\((person-[^)]+|group|people)\)/);
  const actorToken = actorMatch ? `(${actorMatch[1]})` : '(person-general)';
  const remainder = actorMatch
    ? normalized.replace(actorToken, ' ').replace(/\s+/g, ' ').trim()
    : normalized;
  return { actorToken, remainder };
}

function determineActionPrimaryCategory({ lower, placeholders, sense }) {
  if (placeholders.includes('(message)') || /\b(?:texted|emailed|messaged|dm|pinged|posted|slack|teams|wrote)\b/.test(lower)) {
    return 'message';
  }
  if (
    placeholders.includes('(statement)')
    || sense === 'heard'
    || /\b(?:said|told|asked|shouted|yelled|shared|announced|reported|replied|responded|quoted|reminded|stated)\b/.test(lower)
  ) {
    return 'statement';
  }
  if (
    placeholders.includes('(gesture)')
    || /\b(?:rolled|shrugged|smiled|frowned|glared|stared|gestured|pointed|nodded|shook|sighed|laughed|eye[-\s]?roll)\b/.test(lower)
  ) {
    return 'gesture';
  }
  if (
    placeholders.includes('(object)')
    && /\b(?:shared|handed|gave|delivered|provided|submitted|uploaded|posted|presented|returned)\b/.test(lower)
  ) {
    return 'object';
  }
  return 'behavior';
}

function composeActionDetailTokens({ remainder, actorToken, sense }) {
  const lower = remainder.toLowerCase();
  const placeholderMatches = Array.from(remainder.matchAll(/\(([^)]+)\)/g)).map(match => `(${match[1]})`);
  const placeholders = placeholderMatches.filter(token => token !== actorToken);
  const primary = determineActionPrimaryCategory({ lower, placeholders, sense });

  let tokens;
  switch (primary) {
    case 'message':
      tokens = ['sent', '(message)'];
      break;
    case 'statement':
      tokens = ['said', '(statement)'];
      break;
    case 'gesture':
      tokens = ['showed', '(gesture)'];
      break;
    case 'object':
      tokens = ['shared', '(object)'];
      break;
    default:
      tokens = ['did', '(behavior)'];
      break;
  }

  const connectorMap = new Map([
    ['(object)', ['about', '(object)']],
    ['(channel)', ['over', '(channel)']],
    ['(event)', ['during', '(event)']],
    ['(people)', ['with', '(people)']],
    ['(group)', ['with', '(group)']],
    ['(person-general)', ['with', '(person-general)']],
    ['(person-peer)', ['with', '(person-peer)']],
    ['(person-partner)', ['with', '(person-partner)']],
    ['(person-authority)', ['with', '(person-authority)']],
    ['(location)', ['at', '(location)']],
    ['(time)', ['at', '(time)']],
    ['(day)', ['on', '(day)']],
    ['(date)', ['on', '(date)']],
    ['(moment)', ['during', '(moment)']],
  ]);

  const added = new Set();
  const connectors = [];
  placeholders.forEach(token => {
    if (token === '(statement)' || token === '(message)' || token === '(gesture)' || token === '(object)') {
      return;
    }
    const mapping = connectorMap.get(token);
    if (mapping) {
      const key = mapping.join('|');
      if (!added.has(key)) {
        connectors.push(...mapping);
        added.add(key);
      }
    }
  });

  return [...tokens, ...connectors];
}

function buildActionBuilderTokens(example) {
  const normalized = normalizeActionExample(example);
  if (!normalized) {
    return [];
  }
  const sense = determineBuilderSense(example);
  const sensePrefix = sense === 'heard'
    ? ['I', 'heard']
    : sense === 'saw'
      ? ['I', 'saw']
      : ['I', 'noticed'];

  const { actorToken, remainder } = extractActionActor(normalized);
  const detailTokens = composeActionDetailTokens({ remainder, actorToken, sense });

  return [...sensePrefix, actorToken, ...detailTokens];
}

function resolveCueExample(cueEntry, cueMeta) {
  const candidates = [];
  if (typeof cueEntry?.example === 'string') {
    candidates.push(cueEntry.example.trim());
  }
  if (Array.isArray(cueEntry?.examples)) {
    cueEntry.examples.forEach(example => {
      if (typeof example === 'string') {
        candidates.push(example.trim());
      }
    });
  }
  if (typeof cueMeta?.example === 'string') {
    candidates.push(cueMeta.example.trim());
  }
  return candidates.find(candidate => candidate && candidate.trim()) || '';
}

function buildSentenceBuilderActions(modules, cueMap) {
  const actions = [];
  const addedCueIds = new Set();
  const moduleList = Array.isArray(modules) ? modules : [];

  moduleList.forEach(entry => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const moduleId = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!moduleId) {
      return;
    }
    const moduleLabel = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : formatBuilderTitle(moduleId);
    const moduleSummary = typeof entry.slotSummary === 'string' ? entry.slotSummary.trim() : '';
    const cueEntries = Array.isArray(entry.cues) ? entry.cues : [];

    cueEntries.forEach(cueEntry => {
      const cueId = typeof cueEntry?.id === 'string' ? cueEntry.id.trim() : '';
      if (!cueId || addedCueIds.has(cueId)) {
        return;
      }
      const cueMeta = cueMap.get(cueId);
      const example = resolveCueExample(cueEntry, cueMeta);
      const builderTokens = buildActionBuilderTokens(example);
      if (!builderTokens.length) {
        return;
      }
      const actionText = ensureSentencePunctuation(builderTokens.join(' '));
      const label = (cueMeta?.phrase || cueMeta?.label || formatBuilderTitle(cueId)).trim();
      const summary = (cueMeta?.slotSummary || moduleSummary || '').trim();
      actions.push({
        id: cueId,
        moduleId,
        moduleLabel,
        moduleSummary,
        label,
        summary,
        text: actionText,
        builderTokens,
      });
      addedCueIds.add(cueId);
    });
  });

  if (!actions.length && cueMap.size) {
    cueMap.forEach((cueMeta, cueId) => {
      if (addedCueIds.has(cueId)) {
        return;
      }
      const example = resolveCueExample({}, cueMeta);
      const builderTokens = buildActionBuilderTokens(example);
      if (!builderTokens.length) {
        return;
      }
      const actionText = ensureSentencePunctuation(builderTokens.join(' '));
      const label = (cueMeta?.phrase || cueMeta?.label || formatBuilderTitle(cueId)).trim();
      const summary = (cueMeta?.slotSummary || '').trim();
      actions.push({
        id: cueId,
        moduleId: cueMeta?.moduleId || '',
        moduleLabel: cueMeta?.moduleId ? formatBuilderTitle(cueMeta.moduleId) : '',
        moduleSummary: '',
        label,
        summary,
        text: actionText,
        builderTokens,
      });
      addedCueIds.add(cueId);
    });
  }

  return actions.sort((a, b) => {
    const moduleCompare = (a.moduleLabel || '').localeCompare(b.moduleLabel || '');
    if (moduleCompare !== 0) {
      return moduleCompare;
    }
    return (a.label || '').localeCompare(b.label || '');
  });
}

function coerceSentenceBuilderTokens(template) {
  if (Array.isArray(template)) {
    return template
      .map(token => (typeof token === 'string' ? token.trim() : ''))
      .filter(Boolean);
  }
  if (typeof template === 'string') {
    return template
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean);
  }
  return [];
}

function collectSentenceBuilderSequences({ templates = [], extras = [], idPrefix, capitalize }) {
  const sequences = [];
  const seen = new Set();

  const addTokens = tokens => {
    const tokenList = coerceSentenceBuilderTokens(tokens);
    if (!tokenList.length) {
      return;
    }
    const normalized = normalizeBuilderSegment(tokenList.join(' '));
    if (!normalized) {
      return;
    }
    const key = tokenList.map(token => token.toLowerCase()).join('|');
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    sequences.push({
      id: `${idPrefix}-${sequences.length}`,
      value: capitalize ? capitalizeFirst(normalized) : normalized,
      raw: normalized,
      tokens: tokenList,
    });
  };

  templates.forEach(addTokens);
  extras.forEach(addTokens);

  sequences.sort((a, b) => a.value.localeCompare(b.value));
  sequences.forEach((sequence, index) => {
    sequence.id = `${idPrefix}-${index}`;
  });
  return sequences;
}

function buildSentenceBuilderWhenSequences(lexicon) {
  const extras = [];

  if (Array.isArray(lexicon?.seeded)) {
    lexicon.seeded.forEach(value => extras.push(value));
  }

  if (Array.isArray(lexicon?.relative)) {
    lexicon.relative.forEach(value => extras.push(value));
  }

  if (Array.isArray(lexicon?.daysOfWeek)) {
    const dayParts = ['morning', 'afternoon', 'evening'];
    lexicon.daysOfWeek.forEach(day => {
      extras.push(['On', day]);
      dayParts.forEach(part => extras.push(['On', day, part]));
    });
  }

  if (Array.isArray(lexicon?.timesOfDay)) {
    const limitedTimes = lexicon.timesOfDay.slice(0, Math.max(5, Math.min(8, lexicon.timesOfDay.length)));
    limitedTimes.forEach(time => {
      extras.push(['At', time]);
      extras.push(['In', 'the', time]);
      extras.push(['Around', time]);
    });
  }

  if (Array.isArray(lexicon?.calendarDates)) {
    lexicon.calendarDates.forEach(reference => {
      extras.push(reference);
    });
  }

  extras.push(['(moment)']);
  SENTENCE_BUILDER_WHEN_FLEXIBLE_EXTRAS.forEach(entry => extras.push(entry));

  return collectSentenceBuilderSequences({
    templates: SENTENCE_BUILDER_WHEN_TEMPLATE_TOKENS,
    extras,
    idPrefix: 'when',
    capitalize: true,
  });
}

function buildSentenceBuilderWhereSequences(lexicon) {
  const extras = [];

  if (Array.isArray(lexicon?.seeded)) {
    lexicon.seeded.forEach(value => extras.push(value));
  }

  if (Array.isArray(lexicon?.locations)) {
    lexicon.locations.forEach(location => extras.push(location));
  }

  if (Array.isArray(lexicon?.companions)) {
    lexicon.companions
      .filter(Boolean)
      .forEach(companion => extras.push(companion));
  }

  if (Array.isArray(lexicon?.modifiers)) {
    lexicon.modifiers
      .filter(Boolean)
      .forEach(modifier => extras.push(modifier));
  }

  SENTENCE_BUILDER_WHERE_RELATIONSHIP_PLACEHOLDERS.forEach(placeholder => {
    extras.push(['with', placeholder]);
  });

  return collectSentenceBuilderSequences({
    templates: SENTENCE_BUILDER_WHERE_TEMPLATE_TOKENS,
    extras,
    idPrefix: 'where',
    capitalize: false,
  });
}

function buildSequenceTrie(sequences) {
  const root = { options: [] };

  const ensureOption = (node, token) => {
    if (!Array.isArray(node.options)) {
      node.options = [];
    }
    let option = node.options.find(entry => entry.token === token);
    if (!option) {
      option = { token, node: { options: [] } };
      node.options.push(option);
    }
    return option;
  };

  sequences.forEach(sequence => {
    let node = root;
    const tokens = Array.isArray(sequence.tokens) ? sequence.tokens : [];
    tokens.forEach((token, index) => {
      if (!token) {
        return;
      }
      const option = ensureOption(node, token);
      node = option.node;
      if (!Array.isArray(node.ids)) {
        node.ids = [];
      }
      if (index === tokens.length - 1 && !node.ids.includes(sequence.id)) {
        node.ids.push(sequence.id);
      }
    });
  });

  const sortNode = node => {
    if (!node || !Array.isArray(node.options)) {
      return;
    }
    node.options.sort((a, b) => a.token.localeCompare(b.token));
    node.options.forEach(option => sortNode(option.node));
  };

  sortNode(root);
  return root;
}

function buildActionTrie(actions) {
  return buildSequenceTrie(actions.map(action => ({ id: action.id, tokens: action.tokens })));
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      const nextChar = text[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}
function loadCueLibrary(csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) {
    return new Map();
  }
  const [header, ...records] = rows;
  const columns = header.map(column => column.trim());
  const indexOf = name => columns.indexOf(name);
  const cueIndex = indexOf('cue');
  const exampleIndex = indexOf('example');
  const phraseIndex = indexOf('phrase');
  const summaryIndex = indexOf('slotSummary');

  const cueMap = new Map();

  records.forEach(record => {
    if (!record || !record.length) {
      return;
    }
    const cueId = (record[cueIndex] || '').trim();
    if (!cueId) {
      return;
    }
    const example = exampleIndex >= 0 ? (record[exampleIndex] || '').trim() : '';
    const phrase = phraseIndex >= 0 ? (record[phraseIndex] || '').trim() : '';
    const slotSummary = summaryIndex >= 0 ? (record[summaryIndex] || '').trim() : '';
    cueMap.set(cueId, { id: cueId, example, phrase, slotSummary });
  });

  return cueMap;
}

async function loadBlueprintModules() {
  const blueprintPath = path.join(DATA_DIR, 'observation_module_blueprints.json');
  const text = await fs.readFile(blueprintPath, 'utf8');
  const json = JSON.parse(text);
  if (Array.isArray(json?.modules)) {
    return json.modules;
  }
  if (Array.isArray(json)) {
    return json;
  }
  return [];
}

async function loadCueMap() {
  const csvPath = path.join(DATA_DIR, 'observation_cues.sanitized.csv');
  const text = await fs.readFile(csvPath, 'utf8');
  return loadCueLibrary(text);
}

function buildActionItems(actions) {
  return actions.map(action => {
    const sentence = ensureSentencePunctuation(action.text);
    const tokens = Array.isArray(action.builderTokens) && action.builderTokens.length
      ? action.builderTokens.slice()
      : sentence.split(/\s+/).filter(Boolean);
    return {
      id: action.id,
      label: action.label,
      moduleId: action.moduleId,
      moduleLabel: action.moduleLabel,
      summary: action.summary,
      text: sentence,
      tokens,
    };
  });
}

function buildExportDataset({ lexiconMoment, lexiconContext, whenSequences, whereSequences, actions, whenTrie, whereTrie, actionTrie }) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    lexicon: {
      moments: lexiconMoment,
      contexts: lexiconContext,
    },
    when: {
      sequences: whenSequences,
      trie: whenTrie,
    },
    where: {
      sequences: whereSequences,
      trie: whereTrie,
    },
    actions: {
      items: actions,
      trie: actionTrie,
    },
  };
}

async function main() {
  const [modules, cueMap] = await Promise.all([loadBlueprintModules(), loadCueMap()]);

  const lexiconMoment = createSentenceBuilderMomentLexicon();
  const lexiconContext = createSentenceBuilderContextLexicon();
  const actions = buildSentenceBuilderActions(modules, cueMap);

  const whenSequences = buildSentenceBuilderWhenSequences(lexiconMoment);
  const whereSequences = buildSentenceBuilderWhereSequences(lexiconContext);
  const actionItems = buildActionItems(actions);

  const dataset = buildExportDataset({
    lexiconMoment,
    lexiconContext,
    whenSequences,
    whereSequences,
    actions: actionItems,
    whenTrie: buildSequenceTrie(whenSequences),
    whereTrie: buildSequenceTrie(whereSequences),
    actionTrie: buildActionTrie(actionItems),
  });

  const outputJsonPath = path.join(DATA_DIR, 'observation_sentence_builder_data.json');
  await fs.writeFile(outputJsonPath, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(`Wrote sentence builder dataset to ${path.relative(ROOT_DIR, outputJsonPath)}`);

  const outputScriptPath = path.join(DATA_DIR, 'observation_sentence_builder_data.js');
  const scriptPayload = `window.__OBSERVATION_SENTENCE_BUILDER_DATA__ = ${JSON.stringify(dataset)};\n`;
  await fs.writeFile(outputScriptPath, scriptPayload);
  console.log(`Wrote sentence builder dataset script to ${path.relative(ROOT_DIR, outputScriptPath)}`);
}

main().catch(error => {
  console.error('Failed to build observation sentence builder data', error);
  process.exitCode = 1;
});
