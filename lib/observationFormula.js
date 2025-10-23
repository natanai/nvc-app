import { DIRECT_QUOTE_REGEX } from './nvcLint.js';

const RELATIVE_DAY_REGEX =
  /\b(?:yesterday|today|tonight|this morning|this afternoon|this evening|earlier today|earlier this week|earlier tonight|later that day|later that night|last night|last week|last weekend|last month|last year)\b/gi;
const WEEKDAY_REGEX = /\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
const CALENDAR_REGEX =
  /\bon\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{2,4})?\b/gi;
const NUMERIC_DATE_REGEX = /\bon\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi;
const CLOCK_TIME_REGEX = /\b(?:at|around)\s+\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?|am|pm)\b/gi;
const TIME_OF_DAY_REGEX = /\b(?:at\s+(?:noon|midnight)|that\s+morning|that\s+evening|that\s+afternoon|sunrise|sunset)\b/gi;

const LOCATION_PLACES_REGEX =
  /\b(?:at|in|inside|outside|near|by)\s+(?:the\s+)?(?:library|cafeteria|gym(?:nasium)?|office|lobby|lounge|hallway|entrance|exit|reception|front\s+desk|parking\s+lot|parking\s+garage|conference\s+room|meeting\s+room|break\s+room|kitchen|warehouse|lab|laboratory|classroom|auditorium|stadium|arena|field|courtyard|playground|caf(?:e|é)|restaurant|store|shop|studio|workshop)(?:\s+[A-Za-z0-9]+)?\b/gi;
const LOCATION_ROOMS_REGEX =
  /\b(?:at|in|inside|outside|near|by)\s+(?:the\s+)?(?:room|suite|unit|apartment|apt\.?|rm\.?|classroom|office)\s*(?:[#-]?\s*\d+[A-Za-z]?|\s+[A-Za-z]\d{0,3})\b/gi;
const CONTEXT_PARTICIPANT_REGEX =
  /\bwith\s+(?:[A-Z][\w.-]*(?:\s+[A-Z][\w.-]*)*|them|him|her|you|me|us|my\s+\w+|our\s+\w+|the\s+\w+|this\s+\w+|that\s+\w+|your\s+\w+|their\s+\w+|a\s+\w+|an\s+\w+)\b/g;

const SENSORY_VERB_REGEX =
  /\b(?:i|we)\s+(?:saw|see|heard|hear|notice|noticed|observe|observed|witness|witnessed|recorded|captured|measured|timed|counted|checked|read|watched)\b/gi;

const COUNT_REGEX =
  /\b(?:once|twice|thrice|three times|four times|five times|six times|seven times|eight times|nine times|ten times|\d+[\d,:]*\s?(?:times?|minutes?|hours?|days?|weeks?|months?|years?|emails?|messages?|calls?|people|instances?|occasions?))\b/gi;

export const OBSERVATION_FORMULA_SLOTS = [
  {
    id: 'time',
    label: 'When it happened',
    noun: 'time anchor',
    overlayPrompt: 'When ⟨time anchor⟩',
    summary: 'Pin the moment to a specific day, date, or time.',
    guidance: {
      question: 'When did it happen?',
      summary: 'Add a day, date, or timeframe so the moment is anchored in time.',
      examples: ['Yesterday at 3 p.m.…', 'On Monday around noon…'],
    },
    highlightKeys: [
      'timeanchors',
      'weekdayanchors',
      'calendaranchors',
      'numericdates',
      'clocktimes',
      'timeofday',
      'whenanchors',
    ],
    detectors: [
      { id: 'relative-day', type: 'regex', regex: RELATIVE_DAY_REGEX },
      { id: 'weekday', type: 'regex', regex: WEEKDAY_REGEX },
      { id: 'calendar', type: 'regex', regex: CALENDAR_REGEX },
      { id: 'numeric-date', type: 'regex', regex: NUMERIC_DATE_REGEX },
      { id: 'clock-time', type: 'regex', regex: CLOCK_TIME_REGEX },
      { id: 'time-of-day', type: 'regex', regex: TIME_OF_DAY_REGEX },
    ],
  },
  {
    id: 'context',
    label: 'Where and with whom',
    noun: 'setting or people',
    overlayPrompt: 'Where/with whom ⟨setting or people⟩',
    summary: 'Show who was present and where the moment took place.',
    guidance: {
      question: 'Where did it happen and who was involved?',
      summary: 'Name the space or people so the scene is easy to picture.',
      examples: ['In the conference room with Alex…', 'With my kids in the kitchen…'],
    },
    highlightKeys: ['locationanchorsplaces', 'locationanchorsrooms'],
    detectors: [
      { id: 'location-place', type: 'regex', regex: LOCATION_PLACES_REGEX },
      { id: 'location-room', type: 'regex', regex: LOCATION_ROOMS_REGEX },
      { id: 'participants', type: 'regex', regex: CONTEXT_PARTICIPANT_REGEX },
    ],
  },
  {
    id: 'sensory',
    label: 'What you directly sensed',
    noun: 'sensory detail',
    overlayPrompt: 'I saw/heard ⟨camera-ready action⟩',
    summary: 'Describe what a camera or microphone would capture.',
    guidance: {
      question: 'What did you see or hear?',
      summary: 'Use sensory verbs and direct quotes so the observation stays factual.',
      examples: ['I saw him close the laptop.', 'I heard “Please wrap this up.”'],
    },
    highlightKeys: ['sensoryverbs', 'directquotes'],
    detectors: [
      { id: 'sensory-verb', type: 'regex', regex: SENSORY_VERB_REGEX },
      { id: 'direct-quote', type: 'regex', regex: DIRECT_QUOTE_REGEX },
    ],
  },
  {
    id: 'measure',
    label: 'Counts and quotes',
    noun: 'measurement',
    overlayPrompt: 'Counted/quoted ⟨number or exact words⟩',
    summary: 'Ground the moment with numbers or exact wording.',
    guidance: {
      question: 'What can be counted or quoted?',
      summary: 'Mention quantities or repeat the exact words to make it verifiable.',
      examples: ['They called three times.', 'She said “I’ll handle it tomorrow.”'],
    },
    highlightKeys: ['countsmeasures', 'directquotes'],
    detectors: [
      { id: 'count', type: 'regex', regex: COUNT_REGEX },
      { id: 'direct-quote', type: 'regex', regex: DIRECT_QUOTE_REGEX },
    ],
  },
];

export const OBSERVATION_FORMULA_SLOT_MAP = OBSERVATION_FORMULA_SLOTS.reduce((map, slot) => {
  map[slot.id] = slot;
  return map;
}, {});

const HIGHLIGHT_SLOT_INDEX = new Map([
  ['timeanchors', ['time']],
  ['weekdayanchors', ['time']],
  ['calendaranchors', ['time']],
  ['numericdates', ['time']],
  ['clocktimes', ['time']],
  ['timeofday', ['time']],
  ['whenanchors', ['time']],
  ['locationanchorsplaces', ['context']],
  ['locationanchorsrooms', ['context']],
  ['sensoryverbs', ['sensory']],
  ['countsmeasures', ['measure']],
  ['directquotes', ['sensory', 'measure']],
]);

export function evaluateObservationFormula(text, options = {}) {
  const source = typeof text === 'string' ? text : '';
  const highlights = Array.isArray(options.highlights) ? options.highlights : [];
  const signals = collectFormulaSignals(source, highlights);
  const slots = {};
  let satisfiedCount = 0;

  OBSERVATION_FORMULA_SLOTS.forEach(slot => {
    const entry = signals[slot.id] || createEmptySlotSignals(slot.id);
    const satisfied = Boolean(entry.highlights.length || entry.matches.length);
    if (satisfied) {
      satisfiedCount += 1;
    }
    slots[slot.id] = {
      id: slot.id,
      satisfied,
      highlights: entry.highlights,
      matches: entry.matches,
      detectors: entry.detectors,
      slot,
    };
  });

  const order = OBSERVATION_FORMULA_SLOTS.map(slot => slot.id);
  const completedIds = order.filter(id => slots[id]?.satisfied);
  const missingIds = order.filter(id => !slots[id]?.satisfied);

  return {
    slots,
    order,
    satisfiedCount,
    totalSlots: order.length,
    completedIds,
    missingIds,
    completedSlots: completedIds.map(id => OBSERVATION_FORMULA_SLOT_MAP[id]).filter(Boolean),
    missingSlots: missingIds.map(id => OBSERVATION_FORMULA_SLOT_MAP[id]).filter(Boolean),
  };
}

export function getObservationFormulaSlotById(id) {
  return OBSERVATION_FORMULA_SLOT_MAP[id] || null;
}

export function resolveObservationFormulaSlotsForHighlightKey(key) {
  if (typeof key !== 'string') {
    return [];
  }
  const normalized = key.trim().toLowerCase();
  return HIGHLIGHT_SLOT_INDEX.get(normalized) || [];
}

export function formatObservationFormulaSlotSummary(slotIds, options = {}) {
  const slots = normalizeSlotIds(slotIds).map(id => getObservationFormulaSlotById(id)).filter(Boolean);
  if (!slots.length) {
    return '';
  }
  const nouns = slots.map(slot => slot?.noun || slot?.label || slot?.id).filter(Boolean);
  const conjunction = options.conjunction || 'and';
  const list = joinWithConjunction(nouns, conjunction);
  const suffixSingle = options.suffixSingle || 'slot';
  const suffixPlural = options.suffixPlural || 'slots';
  const suffix = nouns.length === 1 ? suffixSingle : suffixPlural;
  const article = options.includeArticle ? 'the ' : '';
  return `${article}${list} ${suffix}`.trim();
}

export function createEmptyObservationFormulaState() {
  return evaluateObservationFormula('');
}

function collectFormulaSignals(text, highlights) {
  const slots = {};
  OBSERVATION_FORMULA_SLOTS.forEach(slot => {
    slots[slot.id] = createEmptySlotSignals(slot.id);
  });

  const highlightMap = mapHighlightsToSlots(highlights);
  highlightMap.forEach((entries, slotId) => {
    const slot = slots[slotId];
    if (!slot) {
      return;
    }
    entries.forEach(entry => addHighlight(slot, entry));
  });

  if (!text) {
    return slots;
  }

  OBSERVATION_FORMULA_SLOTS.forEach(slot => {
    const detectors = Array.isArray(slot.detectors) ? slot.detectors : [];
    detectors.forEach(detector => {
      if (!detector || detector.type !== 'regex' || !(detector.regex instanceof RegExp)) {
        return;
      }
      const matches = findAllMatches(detector.regex, text);
      if (!matches.length) {
        return;
      }
      matches.forEach(value => addMatch(slots[slot.id], value, detector.id));
    });
  });

  return slots;
}

function createEmptySlotSignals(slotId) {
  return {
    id: slotId,
    highlights: [],
    matches: [],
    detectors: [],
  };
}

function mapHighlightsToSlots(highlights) {
  const map = new Map();
  if (!Array.isArray(highlights)) {
    return map;
  }
  highlights.forEach(entry => {
    const normalized = normalizeHighlight(entry);
    if (!normalized.value) {
      return;
    }
    const slotIds = resolveObservationFormulaSlotsForHighlightKey(normalized.key);
    if (!slotIds.length) {
      return;
    }
    slotIds.forEach(slotId => {
      if (!map.has(slotId)) {
        map.set(slotId, []);
      }
      map.get(slotId).push({
        value: normalized.value,
        key: normalized.key,
        label: normalized.label,
        message: normalized.message,
      });
    });
  });
  return map;
}

function addHighlight(target, entry) {
  if (!target) {
    return;
  }
  const key = `${entry.value.toLowerCase()}|${(entry.key || '').toLowerCase()}`;
  if (!target.highlightIndex) {
    target.highlightIndex = new Set();
  }
  if (target.highlightIndex.has(key)) {
    return;
  }
  target.highlightIndex.add(key);
  target.highlights.push({
    value: entry.value,
    key: entry.key || '',
    label: entry.label || '',
    message: entry.message || '',
  });
}

function addMatch(target, value, detectorId) {
  if (!target || !value) {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  const key = trimmed.toLowerCase();
  if (!target.matchIndex) {
    target.matchIndex = new Set();
  }
  if (!target.matchIndex.has(key)) {
    target.matchIndex.add(key);
    target.matches.push({ value: trimmed, detectorId: detectorId || '' });
  }
  if (detectorId && !target.detectors.includes(detectorId)) {
    target.detectors.push(detectorId);
  }
}

function findAllMatches(regex, text) {
  if (!(regex instanceof RegExp) || !text) {
    return [];
  }
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const global = new RegExp(regex.source, flags);
  const matches = [];
  let result;
  while ((result = global.exec(text)) !== null) {
    const match = result[0];
    if (!match) {
      if (global.lastIndex === result.index) {
        global.lastIndex += 1;
      }
      continue;
    }
    matches.push(match);
    if (global.lastIndex === result.index) {
      global.lastIndex += match.length || 1;
    }
  }
  return matches;
}

function normalizeHighlight(entry) {
  if (!entry) {
    return { value: '', key: '', label: '', message: '' };
  }
  if (typeof entry === 'string') {
    const value = entry.trim();
    return { value, key: '', label: '', message: '' };
  }
  const value = typeof entry.token === 'string'
    ? entry.token.trim()
    : typeof entry.value === 'string'
      ? entry.value.trim()
      : '';
  const key = typeof entry.key === 'string' ? entry.key.trim() : '';
  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  const message = typeof entry.message === 'string' ? entry.message.trim() : '';
  return { value, key, label, message };
}

function joinWithConjunction(items, conjunction = 'and') {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) {
    return '';
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} ${conjunction} ${values[1]}`;
  }
  const head = values.slice(0, -1).join(', ');
  const tail = values[values.length - 1];
  return `${head}, ${conjunction} ${tail}`;
}

function normalizeSlotIds(slotIds) {
  if (!Array.isArray(slotIds)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  slotIds.forEach(id => {
    const normalized = typeof id === 'string' ? id.trim() : '';
    if (!normalized || seen.has(normalized)) {
      return;
    }
    if (!OBSERVATION_FORMULA_SLOT_MAP[normalized]) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

