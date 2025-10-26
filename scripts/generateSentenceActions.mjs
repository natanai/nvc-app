import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCueMatchers } from '../lib/observationCueMatcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const blueprintPath = path.join(rootDir, 'data', 'observation_module_blueprints.json');
const outputPath = path.join(rootDir, 'data', 'observation_sentence_actions.json');

const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
const modules = Array.isArray(blueprint?.modules) ? blueprint.modules : [];

const SELF_MODULES = new Set([
  'self-accountability',
]);

const SUBJECTLESS_MODULES = new Set([
  'collaboration-visibility',
  'delivery-gaps',
  'audit-login-breaches',
  'maintenance-dashboard-alerts',
  'monitor-distress-alerts',
  'radar-unknown-transponder',
  'lab-fluorescence-variance',
  'irrigation-pump-alarms',
  'meeting-overflow',
]);

const ACTION_OVERRIDES = new Map([
  [
    'courtroom-delays',
    {
      verb: 'I heard',
      detailAriaLabel: 'What the court announced',
      details: [
        {
          value: 'the judge said we would reconvene next month with no new date',
        },
        {
          value: 'the clerk announced our hearing was pushed to next month without an explanation',
        },
      ],
    },
  ],
  [
    'intake-walkaways',
    {
      verb: 'I saw',
      details: [
        {
          value: 'the coordinator walked off with the clipboard before finishing our intake',
        },
        {
          value: 'the coordinator set the clipboard down and left the families waiting',
        },
      ],
    },
  ],
  [
    'lab-fluorescence-variance',
    {
      verb: 'I noticed',
      details: [
        {
          value: 'the assay read 0.42 yesterday and 0.91 today on the same sample set',
        },
      ],
    },
  ],
  [
    'security-footage-breach',
    {
      verb: 'I saw',
      details: [
        {
          value: 'the footage shows two contractors inside the restricted lab after hours',
        },
        {
          value: 'the footage shows two contractors walk through the locked stairwell',
        },
      ],
    },
  ],
  [
    'structured-direct-quote',
    {
      verb: 'I heard',
      detailAriaLabel: 'Exact words you heard',
      details: [
        { value: 'them say "We need this done today."' },
        { value: 'them say "Let\'s wrap this up now."' },
      ],
    },
  ],
  [
    'structured-interruption',
    {
      verb: 'I heard',
      detailAriaLabel: 'What started while you were speaking',
      details: [
        { value: 'them start speaking while I was still mid-sentence' },
        { value: 'them speak over my update before I finished sharing' },
      ],
    },
  ],
  [
    'structured-boundary-crossing',
    {
      verb: 'I saw',
      details: [
        { value: 'them open the file we agreed to keep private' },
        { value: 'them walk into the lab without the badge we said was required' },
      ],
    },
  ],
  [
    'structured-late-arrival',
    {
      verb: 'I saw',
      details: [
        { value: 'them arrive ten minutes after our agreed start time' },
        { value: 'them walk in after we had already begun the 9 a.m. check-in' },
      ],
    },
  ],
  [
    'structured-left-early',
    {
      verb: 'I saw',
      details: [
        { value: 'them pack up and leave before we finished the conversation' },
        { value: 'them step out while I was still sharing my update' },
      ],
    },
  ],
  [
    'structured-no-response',
    {
      verb: 'I noticed',
      details: [
        { value: 'them stay silent after I asked for feedback' },
        { value: 'them look away and offer no response to my question' },
      ],
    },
  ],
  [
    'structured-support-offered',
    {
      verb: 'I heard',
      details: [
        { value: 'them say they would cover the childcare swap rotation this week' },
        { value: 'them offer to take the next shift so I could rest' },
      ],
    },
  ],
  [
    'structured-digital-message',
    {
      verb: 'I read',
      detailAriaLabel: 'What the message said',
      details: [
        { value: 'a message that said "Please finish the report tonight."' },
        { value: 'a message that said "Reminder: please submit the forms today."' },
      ],
    },
  ],
]);


const LEADING_SUBJECT_PATTERN = /^(?:my|the|our|a|an|their|his|her)\s+[a-z0-9'-]+(?:\s+(?![a-z]+(?:ed|ing|s)\b|said\b|say\b|says\b|told\b|tell\b|tells\b|emailed\b|emailed\b|email\b)[a-z0-9'-]+){0,3}\s+/i;

function detectVerb(example) {
  const text = example.toLowerCase();
  if (/(emailed|email|wrote|texted|message|voicemail|read\s+a)/.test(text)) {
    return 'I read';
  }
  if (/(said\s+"|said\s+“|told\s+me|phoned|called|voicemail|announced|yelled|shouted|laughed|sang)/.test(text)) {
    return 'I heard';
  }
  if (/(noticed|notice)/.test(text)) {
    return 'I noticed';
  }
  if (/(recorded|captured|flashed|flagged|double-booked|turned|overflowed|saw)/.test(text)) {
    return 'I saw';
  }
  return 'I saw';
}

function cleanClause(example, subjectless) {
  let clause = example.trim();
  if (!clause) {
    return clause;
  }

  clause = clause.replace(/\s+/g, ' ');
  const lastComma = clause.lastIndexOf(',');
  if (lastComma !== -1) {
    clause = clause.slice(lastComma + 1).trim();
  }
  clause = clause.replace(/^and\s+/i, '');
  clause = clause.replace(/\.$/, '');

  clause = clause.replace(/^(?:I\s+(?:saw|heard|noticed|read|watched|caught|counted)\s+)/i, '');

  if (!subjectless) {
    clause = clause.replace(LEADING_SUBJECT_PATTERN, '');
  }

  clause = clause
    .replace(/\bhis\b/gi, 'their')
    .replace(/\bher\b/gi, 'their')
    .replace(/\bhe\b/gi, 'they')
    .replace(/\bshe\b/gi, 'they')
    .replace(/\bhim\b/gi, 'them')
    .replace(/\bhers\b/gi, 'theirs')
    .replace(/\b(to|with)\s+[A-Z][a-z]+\b/g, (_, prep) => `${prep} someone else`);

  clause = clause.trim();
  if (!clause) {
    return clause;
  }
  return clause.charAt(0).toLowerCase() + clause.slice(1);
}

function buildLabel(text) {
  if (!text) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const actions = modules.map(module => {
  const subjectless = SUBJECTLESS_MODULES.has(module.id);
  const override = ACTION_OVERRIDES.get(module.id) || {};
  const subjectGroup =
    override.subjectGroup !== undefined
      ? override.subjectGroup
      : subjectless
        ? null
        : SELF_MODULES.has(module.id)
          ? 'self'
          : 'default';
  const cues = Array.isArray(module?.cues) ? module.cues : [];
  const details = [];
  const phrases = new Set();

  if (Array.isArray(override.details) && override.details.length) {
    override.details.forEach(detail => {
      if (!detail || typeof detail.value !== 'string') {
        return;
      }
      const normalized = { value: detail.value, label: detail.label || buildLabel(detail.value) };
      details.push(normalized);
      expandDetailPhrases(normalized.value, phrases);
    });
  } else {
    cues.forEach(cue => {
      const example = cue?.example;
      if (!example || typeof example !== 'string') {
        return;
      }
      const cleaned = cleanClause(example, subjectless);
      if (!cleaned) {
        return;
      }
      details.push({
        value: cleaned,
        label: buildLabel(cleaned),
      });
      expandDetailPhrases(cleaned, phrases);
    });
  }

  if (!details.length) {
    details.push({
      value: `describe ${module.id.replace(/-/g, ' ')}`,
      label: `Describe ${module.label.toLowerCase()}`,
    });
    expandDetailPhrases(`describe ${module.id.replace(/-/g, ' ')}`, phrases);
  }

  const customPlaceholder = subjectless
    ? 'describe what happened'
    : 'describe what they did';

  details.push({
    value: '',
    label: subjectless ? 'describe what you observed…' : 'describe another detail…',
    input: {
      placeholder: customPlaceholder,
      ariaLabel: `${module.label} custom detail`,
    },
  });

  const matcherList = buildActionMatchers(Array.from(phrases));

  return {
    id: module.id,
    label: module.label,
    moduleId: module.id,
    verb: override.verb || detectVerb(cues[0]?.example || module.summary || ''),
    subjectGroup,
    detailAriaLabel: override.detailAriaLabel || 'What happened',
    details,
    phrases: Array.from(phrases),
    matchers: matcherList,
  };
});

fs.writeFileSync(outputPath, `${JSON.stringify({ actions }, null, 2)}\n`);

function expandDetailPhrases(detail, target) {
  if (!target || typeof target.add !== 'function') {
    return;
  }
  const raw = typeof detail === 'string' ? detail.trim() : '';
  if (!raw) {
    return;
  }
  target.add(raw);
  const withoutPrefix = raw.replace(/^(?:them|they|someone|somebody|my\s+[a-z]+|the\s+[a-z]+)\s+/i, '').trim();
  if (withoutPrefix && withoutPrefix.length > 4) {
    target.add(withoutPrefix);
  }
  const withoutQuotes = raw.replace(/["“”]/g, '').trim();
  if (withoutQuotes && withoutQuotes !== raw) {
    target.add(withoutQuotes);
  }
}

function buildActionMatchers(phrases) {
  const matchers = createCueMatchers({ patterns: phrases, sourceType: 'builder' });
  return dedupeSerializedMatchers(matchers.map(serializeMatcher));
}

function serializeMatcher(matcher) {
  if (!matcher) {
    return null;
  }
  const pattern = matcher.regex ? matcher.regex.source : '';
  const flags = matcher.regex ? matcher.regex.flags : 'iu';
  const tokens = Array.isArray(matcher.tokens) ? matcher.tokens.slice() : [];
  return {
    key: matcher.key || tokens.join('|'),
    pattern,
    flags,
    tokens,
    tokenThreshold: matcher.tokenThreshold || (tokens.length >= 2 ? 2 : tokens.length === 1 ? 1 : 0),
    sourceType: matcher.sourceType || 'builder',
    sources: Array.isArray(matcher.sources) ? matcher.sources.slice() : [],
  };
}

function dedupeSerializedMatchers(matchers) {
  const seen = new Set();
  const result = [];
  (Array.isArray(matchers) ? matchers : []).forEach(matcher => {
    if (!matcher) {
      return;
    }
    const key = matcher.key || `${matcher.pattern}/${matcher.flags}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(matcher);
  });
  return result;
}
