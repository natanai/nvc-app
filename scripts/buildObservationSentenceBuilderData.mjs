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
  'First thing this morning',
];

const SENTENCE_BUILDER_CALENDAR_DATES = [
  'March 2',
  'April 18',
  'June 1',
  'July 12',
  'September 15',
  '2024-09-15',
];

const SENTENCE_BUILDER_TIMES_OF_DAY = [
  '7:30 a.m.',
  '9:00 a.m.',
  '11:30 a.m.',
  '2:00 p.m.',
  '4:45 p.m.',
  '7:00 p.m.',
  '8:45 p.m.',
];

const SENTENCE_BUILDER_SEEDED_MOMENTS = [
  'Yesterday at 9:00 a.m.',
  'This morning at 8:30 a.m.',
  "On Monday around noon",
  'Last night at 10:15 p.m.',
  "During Tuesday's 2:00 p.m. meeting",
  'Earlier today at 4:45 p.m.',
  'On 2024-09-15 at 11:00 a.m.',
  'First thing this morning',
  'On Friday evening around 7 p.m.',
  'At 3:30 p.m. last Wednesday',
];

const SENTENCE_BUILDER_CONTEXT_LOCATIONS = [
  'in the conference room',
  'at home in the kitchen',
  'on our Zoom call',
  'in the classroom',
  'at the grocery store checkout',
  'in the hospital waiting room',
  'on the phone',
  'at the park',
  'on the group chat',
  'in the living room',
  'at the coffee shop counter',
  'in the break room',
  'on the project channel',
];

const SENTENCE_BUILDER_CONTEXT_COMPANIONS = [
  '',
  'with my team',
  'with my family',
  'with the client',
  'with the students',
  'with my coworkers',
  'with my manager',
  'with my partner',
  'by myself',
  'with my dad',
  'with the support agent',
  'with my kids',
  'with the vendor',
];

const SENTENCE_BUILDER_CONTEXT_MODIFIERS = [
  '',
  'during our check-in',
  'during the meeting',
  'while we reviewed the agenda',
  'while we waited for updates',
  'as we wrapped up for the day',
];

const SENTENCE_BUILDER_SEEDED_CONTEXTS = [
  'in the conference room with my team',
  'at home in the kitchen with my family',
  'on our Zoom call with the client',
  'in the classroom with the students',
  'at the grocery store checkout',
  'in the hospital waiting room with my dad',
  'on the phone with the support agent',
  'at the park with my kids',
  'on the group chat with my coworkers',
  'in the living room with my partner',
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

function createSentenceBuilderMomentLexicon() {
  return {
    daysOfWeek: [...SENTENCE_BUILDER_DAYS_OF_WEEK],
    relative: [...SENTENCE_BUILDER_RELATIVE_MOMENTS],
    calendarDates: [...SENTENCE_BUILDER_CALENDAR_DATES],
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

function buildBuilderActionText(example) {
  const trimmed = typeof example === 'string' ? example.trim() : '';
  if (!trimmed) {
    return '';
  }
  if (/^I\s+(?:saw|see|heard|hear|notice|noticed|observe|observed|watch|watched|record|recorded|smell|smelled|taste|tasted)/i.test(trimmed)) {
    return ensureSentencePunctuation(trimmed);
  }
  const sense = determineBuilderSense(trimmed);
  const suffix = /[.!?]$/.test(trimmed) ? '' : '.';
  if (sense === 'heard') {
    return `I heard this: ${trimmed}${suffix}`;
  }
  if (sense === 'saw') {
    return `I saw this happen: ${trimmed}${suffix}`;
  }
  return `I noticed this: ${trimmed}${suffix}`;
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
      const actionText = buildBuilderActionText(example);
      if (!actionText) {
        return;
      }
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
      const actionText = buildBuilderActionText(example);
      if (!actionText) {
        return;
      }
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

function buildSentenceBuilderWhenOptionsFromLexicon(lexicon) {
  const options = new Map();

  const addOption = value => {
    const normalized = normalizeBuilderSegment(value);
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (!options.has(key)) {
      options.set(key, capitalizeFirst(normalized));
    }
  };

  if (Array.isArray(lexicon.seeded)) {
    lexicon.seeded.forEach(addOption);
  }

  const timesOfDay = Array.isArray(lexicon.timesOfDay) ? lexicon.timesOfDay : [];
  const relativeTimes = timesOfDay.slice(0, Math.max(4, Math.min(6, timesOfDay.length)));
  const dayTimes = timesOfDay.slice(0, Math.max(3, Math.min(5, timesOfDay.length)));
  const calendarTimes = timesOfDay.slice(0, Math.max(2, Math.min(4, timesOfDay.length)));

  if (Array.isArray(lexicon.relative)) {
    lexicon.relative.forEach(relative => {
      const base = normalizeBuilderSegment(relative);
      if (base) {
        addOption(base);
      }
      relativeTimes.forEach(time => {
        addOption(`${relative} at ${time}`);
      });
    });
  }

  if (Array.isArray(lexicon.daysOfWeek)) {
    lexicon.daysOfWeek.forEach(day => {
      addOption(`On ${day}`);
      dayTimes.forEach(time => {
        addOption(`On ${day} at ${time}`);
      });
    });
  }

  if (Array.isArray(lexicon.calendarDates)) {
    lexicon.calendarDates.forEach(date => {
      addOption(`On ${date}`);
      calendarTimes.forEach(time => {
        addOption(`On ${date} at ${time}`);
      });
    });
  }

  [
    'On (day)',
    'On (date)',
    'At (time)',
    'On (date) at (time)',
    '(moment)',
  ].forEach(addOption);

  return Array.from(options.values()).sort((a, b) => a.localeCompare(b));
}

function buildSentenceBuilderWhereOptionsFromLexicon(lexicon) {
  const options = new Map();

  const addOption = value => {
    const normalized = normalizeBuilderSegment(value);
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (!options.has(key)) {
      options.set(key, normalized);
    }
  };

  if (Array.isArray(lexicon.seeded)) {
    lexicon.seeded.forEach(addOption);
  }

  const companions = Array.isArray(lexicon.companions) ? lexicon.companions : [''];
  const modifiers = Array.isArray(lexicon.modifiers) ? lexicon.modifiers : [''];
  const companionCombos = companions.filter(Boolean);
  const modifierCombos = modifiers.filter(Boolean);
  const limitedCompanions = companionCombos.slice(0, 6);
  const limitedModifiers = modifierCombos.slice(0, 5);

  if (Array.isArray(lexicon.locations)) {
    lexicon.locations.forEach(location => {
      const base = normalizeBuilderSegment(location);
      if (!base) {
        return;
      }
      addOption(base);
      limitedCompanions.forEach(companion => {
        addOption(`${base} ${companion}`);
      });
      limitedModifiers.forEach(modifier => {
        addOption(`${base} ${modifier}`);
      });
      limitedCompanions.forEach(companion => {
        limitedModifiers.forEach(modifier => {
          addOption(`${base} ${companion} ${modifier}`);
        });
      });
    });
  }

  [
    'at (location)',
    'in (location)',
    'in the (location)',
    'on (channel)',
    'with (person)',
    'with (people)',
    'with (role)',
    'with (group)',
    'at (location) with (person)',
    'on (channel) with (person)',
    'during (event)',
    'at (location) during (event)',
    'during (event) with (person)',
    'at (location) with (person) during (event)',
    'on (channel) during (event)',
  ].forEach(addOption);

  return Array.from(options.values()).sort((a, b) => a.localeCompare(b));
}

function tokenizeWithTrailingComma(source, { capitalize } = {}) {
  const normalized = normalizeBuilderSegment(source);
  if (!normalized) {
    return { value: '', tokens: [] };
  }
  const text = capitalize ? capitalizeFirst(normalized) : normalized;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return { value: text, tokens: [] };
  }
  const lastIndex = tokens.length - 1;
  const lastToken = tokens[lastIndex].replace(/,+$/g, '');
  tokens[lastIndex] = `${lastToken},`;
  return { value: text, tokens };
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

function buildWhenSequences(whenOptions) {
  return whenOptions.map((option, index) => {
    const { value, tokens } = tokenizeWithTrailingComma(option, { capitalize: true });
    return {
      id: `when-${index}`,
      value,
      raw: normalizeBuilderSegment(option),
      tokens,
    };
  });
}

function buildWhereSequences(whereOptions) {
  return whereOptions.map((option, index) => {
    const { value, tokens } = tokenizeWithTrailingComma(option, { capitalize: false });
    return {
      id: `where-${index}`,
      value,
      raw: normalizeBuilderSegment(option),
      tokens,
    };
  });
}

function buildActionItems(actions) {
  return actions.map(action => {
    const sentence = ensureSentencePunctuation(action.text);
    const tokens = sentence.split(/\s+/).filter(Boolean);
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
  const whenOptions = buildSentenceBuilderWhenOptionsFromLexicon(lexiconMoment);
  const whereOptions = buildSentenceBuilderWhereOptionsFromLexicon(lexiconContext);
  const actions = buildSentenceBuilderActions(modules, cueMap);

  const whenSequences = buildWhenSequences(whenOptions);
  const whereSequences = buildWhereSequences(whereOptions);
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

  const outputPath = path.join(DATA_DIR, 'observation_sentence_builder_data.json');
  await fs.writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}
`);
  console.log(`Wrote sentence builder dataset to ${path.relative(ROOT_DIR, outputPath)}`);
}

main().catch(error => {
  console.error('Failed to build observation sentence builder data', error);
  process.exitCode = 1;
});
