import { DIRECT_QUOTE_REGEX } from './nvcLint.js';


const TIME_RELATIVE_PHRASES = [
  'yesterday',
  'today',
  'tonight',
  'this morning',
  'this afternoon',
  'this evening',
  'earlier today',
  'earlier this week',
  'earlier tonight',
  'earlier this month',
  'earlier this morning',
  'earlier this afternoon',
  'earlier this evening',
  'later that day',
  'later that night',
  'later this week',
  'later today',
  'later tonight',
  'last night',
  'last week',
  'last weekend',
  'last month',
  'last year',
  'this week',
  'this weekend',
  'this past weekend',
  'next week',
  'next month',
  'next year',
  'the day before',
  'the night before',
  'the morning before',
  'the afternoon before',
  'the evening before',
  'over the weekend',
  'over the holidays',
  'over spring break',
  'over winter break',
  'that morning',
  'that afternoon',
  'that evening',
  'that night',
  'that weekend',
  'first thing this morning',
];

const TIME_SEASON_PHRASES = [
  'this spring',
  'this summer',
  'this fall',
  'this autumn',
  'this winter',
  'last spring',
  'last summer',
  'last fall',
  'last autumn',
  'last winter',
  'next spring',
  'next summer',
  'next fall',
  'next autumn',
  'next winter',
];

const TIME_EVENT_KEYWORDS = [
  'meeting',
  'team meeting',
  'standup',
  'stand-up',
  'check in',
  'check-in',
  'checkup',
  'check-up',
  'one on one',
  'one-on-one',
  '1:1',
  'call',
  'phone call',
  'video call',
  'video meeting',
  'video conference',
  'zoom call',
  'zoom meeting',
  'teams call',
  'google meet',
  'webex',
  'session',
  'appointment',
  'practice',
  'game',
  'shift',
  'class',
  'lesson',
  'interview',
  'presentation',
  'training',
  'workshop',
  'webinar',
  'review',
  'retro',
  'retrospective',
  'demo',
  'ceremony',
  'service',
];

const TIME_MEAL_KEYWORDS = [
  'breakfast',
  'lunch',
  'dinner',
  'brunch',
  'coffee break',
  'coffee',
  'tea break',
  'snack',
  'bedtime',
];

const TIME_RELATIVE_WINDOW_REGEX = /\b(?:earlier|later)\s+in\s+(?:the\s+)?(?:day|week|month|year)\b/gi;
const TIME_WITHIN_RANGE_REGEX = /\bwithin\s+(?:the\s+)?(?:last|next)\s+\d+[\d,]*(?:\.\d+)?\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/gi;

const RELATIVE_DAY_REGEX = buildRegexFromPhrases(TIME_RELATIVE_PHRASES);
const SEASON_REGEX = buildRegexFromPhrases(TIME_SEASON_PHRASES);
const WEEKDAY_REGEX = /\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
const WEEKDAY_PART_REGEX =
  /\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:morning|afternoon|evening|night)\b/gi;
const CALENDAR_REGEX =
  /\bon\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{2,4})?\b/gi;
const NUMERIC_DATE_REGEX = /\bon\s+(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\b/gi;
const CLOCK_TIME_REGEX =
  /\b(?:at|around|by)\s+(?:\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?|am|pm)|(?:[01]\d|2[0-3]):[0-5]\d(?:\:[0-5]\d)?)\b/gi;
const TIME_RANGE_REGEX =
  /\bfrom\s+\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?|am|pm)?\s+(?:to|through|until)\s+\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?|am|pm)?\b/gi;
const TIME_EVENT_REGEX = new RegExp(
  `\\b(?:before|after|during|by|around|throughout)\\s+(?:our\\s+|my\\s+|their\\s+|the\\s+|this\\s+|that\\s+)?(?:${buildWordAlternation(
    TIME_EVENT_KEYWORDS,
  )})\\b`,
  'gi',
);
const TIME_MEAL_REGEX = new RegExp(
  `\\b(?:before|after|around|during|by)\\s+(?:our\\s+|my\\s+|their\\s+|the\\s+|this\\s+|that\\s+)?(?:${buildWordAlternation(
    TIME_MEAL_KEYWORDS,
  )})\\b`,
  'gi',
);
const TIME_OF_DAY_REGEX =
  /\b(?:at\s+(?:noon|midnight)|that\s+morning|that\s+evening|that\s+afternoon|sunrise|sunset|dawn|dusk)\b/gi;

const LOCATION_PLACE_KEYWORDS = [
  'home',
  'house',
  'apartment',
  'condo',
  'loft',
  'kitchen',
  'living room',
  'dining room',
  'bedroom',
  'garage',
  'driveway',
  'yard',
  'garden',
  'porch',
  'patio',
  'balcony',
  'deck',
  'office',
  'home office',
  'workspace',
  'desk',
  'coworking space',
  'coworking office',
  'conference room',
  'meeting room',
  'boardroom',
  'auditorium',
  'library',
  'lab',
  'laboratory',
  'clinic',
  'hospital',
  'ward',
  'nurse station',
  'waiting room',
  'exam room',
  'operating room',
  'therapy room',
  'studio',
  'sound stage',
  'rehearsal space',
  'classroom',
  'lecture hall',
  'campus',
  'school',
  'gym',
  'fitness center',
  'locker room',
  'field',
  'court',
  'track',
  'stadium',
  'arena',
  'pool',
  'restaurant',
  'cafe',
  'coffee shop',
  'coffeehouse',
  'bar',
  'pub',
  'diner',
  'bakery',
  'store',
  'shop',
  'grocery store',
  'supermarket',
  'pharmacy',
  'market',
  'warehouse',
  'factory',
  'plant',
  'workshop',
  'construction site',
  'job site',
  'site',
  'hallway',
  'corridor',
  'lobby',
  'reception',
  'waiting area',
  'front desk',
  'parking lot',
  'parking garage',
  'car',
  'truck',
  'van',
  'bus',
  'train',
  'subway',
  'platform',
  'station',
  'airport',
  'terminal',
  'gate',
  'hotel',
  'hotel lobby',
  'hotel room',
  'elevator',
  'stairs',
  'break room',
  'breakroom',
  'kitchenette',
  'porch swing',
  'playground',
  'park',
  'trail',
  'beach',
  'campground',
  'campsite',
];

const LOCATION_VIRTUAL_KEYWORDS = [
  'zoom',
  'zoom call',
  'zoom meeting',
  'video call',
  'video meeting',
  'video conference',
  'phone',
  'phone call',
  'facetime',
  'whatsapp',
  'signal',
  'discord',
  'discord channel',
  'discord server',
  'teams',
  'microsoft teams',
  'google meet',
  'meet call',
  'webex',
  'slack',
  'slack channel',
  'telegram',
  'telegram chat',
  'telegram channel',
  'telegram group',
  'group chat',
  'chat thread',
  'text thread',
  'text message',
  'sms',
  'email thread',
  'email',
  'email inbox',
  'inbox',
  'voicemail',
  'voice mail',
  'voicemail message',
  'letter',
  'mailed notice',
  'postal mail',
  'mailbox',
];

const LOCATION_PLACES_REGEX = new RegExp(
  `\\b(?:at|in|inside|within|outside|near|by|around|throughout|from)\\s+(?:the\\s+|my\\s+|our\\s+|this\\s+|that\\s+|their\\s+)?(?:${buildWordAlternation(
    LOCATION_PLACE_KEYWORDS,
  )})(?:\\s+[A-Za-z0-9#-]+)?\\b`,
  'gi',
);
const LOCATION_ROOMS_REGEX =
  /\b(?:at|in|inside|outside|near|by)\s+(?:the\s+)?(?:room|suite|unit|apartment|apt\.?|rm\.?|classroom|office|floor)\s*(?:[#-]?\s*\d+[A-Za-z]?|\s+[A-Za-z]\d{0,3})\b/gi;
const LOCATION_VIRTUAL_REGEX = new RegExp(
  `\\b(?:on|over|in|via|through)\\s+(?:a\\s+|an\\s+|the\\s+|my\\s+|our\\s+|this\\s+|that\\s+|their\\s+)?(?:${buildWordAlternation(
    LOCATION_VIRTUAL_KEYWORDS,
  )})\\b`,
  'gi',
);

const LOCATION_GENERIC_EXCLUDED_TERMS = [
  'time',
  'times',
  'timing',
  'moment',
  'moments',
  'noon',
  'midnight',
  'sunrise',
  'sunset',
  'dawn',
  'dusk',
  'morning',
  'afternoon',
  'evening',
  'tonight',
  'today',
  'yesterday',
  'tomorrow',
  'am',
  'pm',
  'a.m.',
  'p.m.',
  'a.m',
  'p.m',
];
const LOCATION_GENERIC_DETERMINERS = [
  'the',
  'a',
  'an',
  'my',
  'our',
  'this',
  'that',
  'their',
  'his',
  'her',
  'its',
  'your',
  'yours',
  'my own',
  'our own',
  'your own',
];
const LOCATION_GENERIC_CONNECTORS = [
  'of',
  'and',
  '&',
  'the',
  'for',
  'at',
  'on',
  'in',
  'by',
  'de',
  'del',
  'de la',
  'de los',
  'de las',
  'da',
  'do',
  'dos',
  'das',
  'von',
  'van',
  'der',
  'di',
  'du',
  'des',
  'saint',
  'santa',
  'san',
  'st.',
  'jr.',
  'sr.',
  'y',
];
const LOCATION_GENERIC_EXCLUSION_PATTERN = buildWordAlternation(LOCATION_GENERIC_EXCLUDED_TERMS);
const LOCATION_GENERIC_EXCLUSION_ASSERT = LOCATION_GENERIC_EXCLUSION_PATTERN
  ? `(?:${LOCATION_GENERIC_EXCLUSION_PATTERN})\\b`
  : '';
const LOCATION_GENERIC_WORD_PATTERN = LOCATION_GENERIC_EXCLUSION_ASSERT
  ? `(?:(?!${LOCATION_GENERIC_EXCLUSION_ASSERT})(?=[A-Za-z0-9'’&.-]*[A-Za-z])[A-Za-z0-9][\\w'’&.-]*)`
  : `(?:(?=[A-Za-z0-9'’&.-]*[A-Za-z])[A-Za-z0-9][\\w'’&.-]*)`;
const LOCATION_GENERIC_DETERMINER_PATTERN = buildWordAlternation(LOCATION_GENERIC_DETERMINERS);
const LOCATION_GENERIC_CONNECTOR_PATTERN = buildWordAlternation(LOCATION_GENERIC_CONNECTORS);
const LOCATION_GENERIC_REGEX = new RegExp(
  `\\b(?:at|in|inside|within|outside|near|by|around|throughout|from|on)\\s+(?:(?:${LOCATION_GENERIC_DETERMINER_PATTERN})\\s+)?${LOCATION_GENERIC_WORD_PATTERN}(?:\\s+(?:(?:${LOCATION_GENERIC_CONNECTOR_PATTERN})\\s+)?${LOCATION_GENERIC_WORD_PATTERN}){0,4}`,
  'gi',
);

const CONTEXT_PARTICIPANT_REGEX =
  /\b(?:with|alongside|next to|together with)\s+(?:[A-Z][\w.-]*(?:\s+[A-Z][\w.-]*)*|(?:my|our|the|this|that|your|their|a|an)\s+(?:[A-Za-z0-9&][\w&'\-]*(?:\s+[A-Za-z0-9&][\w&'\-]*){0,4}))\b/g;
const CONTEXT_GROUP_REGEX =
  /\b(?:with|alongside|next to|together with)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a\s+couple(?:\s+of)?|a\s+few|several)\s+(?:coworkers?|colleagues?|teammates?|classmates?|students?|friends?|neighbors?|clients?|customers?|participants?|attendees?|family(?:\s+members)?|siblings?|brothers?|sisters?|parents?|kids?|children|patients?)\b/gi;
const CONTEXT_FROM_REGEX =
  /\b(?:at|from)\s+(?:my|our|the|this|that|their)?\s*(?:home|house|apartment|condo|office|desk|workspace)\b/gi;
const CONTEXT_COMMUNICATION_ACTOR_PATTERN =
  "(?:[A-Z][\\w.-]*(?:\\s+[A-Z][\\w.-]*)*|(?:my|our|the|this|that|your|their|a|an)\\s+(?:[A-Za-z0-9&][\\w&'\\-]*(?:\\s+[A-Za-z0-9&][\\w&'\\-]*){0,4}))";
const CONTEXT_MESSAGE_REGEX = new RegExp(
  `\\b${CONTEXT_COMMUNICATION_ACTOR_PATTERN}\\s+(?:` +
    `(?:emailed|emailed\\s+me|emailed\\s+us|emailed\\s+back|emailed\\s+saying|emailed\\s+to\\s+say|texted|texted\\s+me|texted\\s+us|texted\\s+saying|texted\\s+to\\s+say|messaged|messaged\\s+me|messaged\\s+us|sent\\s+me\\s+an?\\s+email|sent\\s+us\\s+an?\\s+email|sent\\s+an?\\s+email|sent\\s+me\\s+a\\s+text|sent\\s+us\\s+a\\s+text|sent\\s+a\\s+text|sent\\s+me\\s+a\\s+message|sent\\s+us\\s+a\\s+message|sent\\s+a\\s+message|slacked|slacked\\s+me|slacked\\s+us|pinged|pinged\\s+me|pinged\\s+us|posted|posted\\s+in|posted\\s+that|announced|announced\\s+that|called|called\\s+me|called\\s+us|phoned|phoned\\s+me|phoned\\s+us|mailed|mailed\\s+me|mailed\\s+us|mailed\\s+a\\s+letter|mailed\\s+a\\s+notice)` +
    `|left\\s+(?:me\\s+|us\\s+)?a\\s+voicemail|left\\s+voicemail` +
  `)\\b`,
  'gi',
);
const CONTEXT_MESSAGE_SOURCE_REGEX = new RegExp(
  `\\b(?:an?\\s+(?:email|message|text|voicemail|letter)\\s+from)\\s+${CONTEXT_COMMUNICATION_ACTOR_PATTERN}\\b`,
  'gi',
);

const SENSORY_VERB_REGEX =
  /\b(?:i|we)\s+(?:was\s+|were\s+|am\s+|are\s+)?(?:see|see(?:ing)?|saw|hear|hear(?:ing)?|heard|listen|listened|listening|notice|noticed|noticing|observe|observed|observing|witness|witnessed|witnessing|record|recorded|recording|capture|captured|capturing|measure|measured|measuring|time|timed|timing|count|counted|counting|check|checked|checking|read|reading|watch|watched|watching|spot|spotted|spotting|glimpse|glimpsed|glimpsing|monitor|monitored|monitoring|track|tracked|tracking|document|documented|documenting|log|logged|logging|screenshot|screenshotted|screenshotting|overhear|overheard|overhearing|smell|smelled|smelling|sniff|sniffed|sniffing|taste|tasted|tasting|touch|touched|touching|feel(?!\s+(?:like|that))|feels(?!\s+(?:like|that))|felt(?!\s+(?:like|that))|feeling(?!\s+(?:like|that)))\b/gi;
const DEVICE_SENSORY_REGEX =
  /\b(?:security|surveillance|doorbell|doorbell\s+cam|camera|footage|monitor|baby\s+monitor|dashboard|maintenance\s+dashboard|audit\s+logs?|system\s+logs?|logs?|radar|sensor|alarm|assay|control\s+panel)\s+(?:shows?|showed|showing|captures?|captured|capturing|records?|recorded|recording|lists?|listed|flagged|flags|flashed|flashes|displayed|displays|detected|detects|reported|reports)\b/gi;

const COUNT_FREQUENCY_PHRASES = [
  'once',
  'twice',
  'thrice',
  'three times',
  'four times',
  'five times',
  'six times',
  'seven times',
  'eight times',
  'nine times',
  'ten times',
];

const COUNT_NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'both',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
  'hundred',
  'thousand',
];

const COUNT_APPROXIMATE_PARTS = [
  'a couple of',
  'couple of',
  'a few',
  'several',
  'dozens of',
  'hundreds of',
  'thousands of',
  'half dozen',
  'half a dozen',
  'two dozen',
  'three dozen',
  'dozen',
];

const COUNT_UNIT_PARTS = [
  'times?',
  'minutes?',
  'hours?',
  'days?',
  'weeks?',
  'months?',
  'years?',
  'seconds?',
  'moments?',
  'emails?',
  'messages?',
  'texts?',
  'text messages?',
  'slack messages?',
  'pings?',
  'notifications?',
  'calls?',
  'voicemails?',
  'meetings?',
  'sessions?',
  'appointments?',
  'visits?',
  'reminders?',
  'updates?',
  'tickets?',
  'tasks?',
  'items?',
  'deliveries?',
  'orders?',
  'requests?',
  'incidents?',
  'occurrences?',
  'complaints?',
  'reports?',
  'notes?',
  'pages?',
  'slides?',
  'points?',
  'percent(?:age)?s?',
  '%',
  'laps?',
  'rounds?',
  'attempts?',
  'tries',
  'check-?ins?',
  'follow-?ups?',
  'people',
  'teammates?',
  'coworkers?',
  'colleagues?',
  'students?',
  'participants?',
  'attendees?',
  'clients?',
  'customers?',
  'patients?',
  'guests?',
  'visitors?',
  'children',
  'kids?',
  'parents?',
  'siblings?',
  'units?',
  'steps?',
  'miles?',
  'kilometers?',
  'meters?',
  'centimeters?',
  'inches?',
  'feet',
  'yards?',
];

const BODY_LANGUAGE_SUBJECTS = [
  'partners?',
  'tenors?',
  'performers?',
  'singers?',
  'musicians?',
  'clients?',
  'family(?:\s+members)?',
  'families',
  'volunteers?',
  'contractors?',
  'participants?',
  'teammates?',
  'coworkers?',
  'colleagues?',
  'siblings?',
  'brothers?',
  'sisters?',
  'parents?',
  'kids?',
  'children',
  'coordinators?',
  'couples?',
];

const COUNT_FREQUENCY_PATTERN = buildWordAlternation(COUNT_FREQUENCY_PHRASES);
const COUNT_NUMBER_PATTERN = `(?:\d+[\d,]*(?:\.\d+)?|${buildWordAlternation(COUNT_NUMBER_WORDS)})`;
const COUNT_APPROXIMATE_PATTERN = buildWordAlternation(COUNT_APPROXIMATE_PARTS);
const COUNT_UNIT_PATTERN = `(?:${COUNT_UNIT_PARTS.join('|')})`;
const COUNT_QUANTITY_PATTERN = `(?:${COUNT_APPROXIMATE_PATTERN}|${COUNT_NUMBER_PATTERN})(?:\s+(?:more|additional|extra))?\s+${COUNT_UNIT_PATTERN}`;
const COUNT_REGEX = new RegExp(`\b(?:${COUNT_FREQUENCY_PATTERN}|${COUNT_QUANTITY_PATTERN})\b`, 'gi');
const COUNT_BODY_LANGUAGE_REGEX = new RegExp(
  `\\b(?:both|all\\s+(?:two|three|four|five|six|seven|eight|nine|ten)|the\\s+(?:two|three|four|five|six|seven|eight|nine|ten)|each)\\s+(?:${buildWordAlternation(
    BODY_LANGUAGE_SUBJECTS,
  )})\\b`,
  'gi',
);


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
      { id: 'seasonal', type: 'regex', regex: SEASON_REGEX },
      { id: 'weekday', type: 'regex', regex: WEEKDAY_REGEX },
      { id: 'weekday-part', type: 'regex', regex: WEEKDAY_PART_REGEX },
      { id: 'calendar', type: 'regex', regex: CALENDAR_REGEX },
      { id: 'numeric-date', type: 'regex', regex: NUMERIC_DATE_REGEX },
      { id: 'clock-time', type: 'regex', regex: CLOCK_TIME_REGEX },
      { id: 'time-range', type: 'regex', regex: TIME_RANGE_REGEX },
      { id: 'time-event', type: 'regex', regex: TIME_EVENT_REGEX },
      { id: 'time-meal', type: 'regex', regex: TIME_MEAL_REGEX },
      { id: 'time-window', type: 'regex', regex: TIME_RELATIVE_WINDOW_REGEX },
      { id: 'time-within-range', type: 'regex', regex: TIME_WITHIN_RANGE_REGEX },
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
      { id: 'location-virtual', type: 'regex', regex: LOCATION_VIRTUAL_REGEX },
      { id: 'location-generic', type: 'regex', regex: LOCATION_GENERIC_REGEX },
      { id: 'participants', type: 'regex', regex: CONTEXT_PARTICIPANT_REGEX },
      { id: 'participant-group', type: 'regex', regex: CONTEXT_GROUP_REGEX },
      { id: 'context-origin', type: 'regex', regex: CONTEXT_FROM_REGEX },
      { id: 'message-actor', type: 'regex', regex: CONTEXT_MESSAGE_REGEX },
      { id: 'message-source', type: 'regex', regex: CONTEXT_MESSAGE_SOURCE_REGEX },
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
      { id: 'device-sensory', type: 'regex', regex: DEVICE_SENSORY_REGEX },
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
      { id: 'body-language-count', type: 'regex', regex: COUNT_BODY_LANGUAGE_REGEX },
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

function buildRegexFromPhrases(phrases, flags = 'gi') {
  const source = buildWordAlternation(phrases);
  if (!source) {
    return new RegExp('(?!)', flags);
  }
  return new RegExp(`\\b(?:${source})\\b`, flags);
}

function buildWordAlternation(words) {
  if (!Array.isArray(words)) {
    return '';
  }
  const parts = words
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .map(segment => escapeRegex(segment).replace(/\s+/g, '\\s+'));
  return parts.join('|');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

