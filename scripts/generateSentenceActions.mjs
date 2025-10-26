import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  if (Array.isArray(override.details) && override.details.length) {
    override.details.forEach(detail => {
      if (!detail || typeof detail.value !== 'string') {
        return;
      }
      const normalized = { value: detail.value, label: detail.label || buildLabel(detail.value) };
      details.push(normalized);
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
    });
  }

  if (!details.length) {
    details.push({
      value: `describe ${module.id.replace(/-/g, ' ')}`,
      label: `Describe ${module.label.toLowerCase()}`,
    });
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

  return {
    id: module.id,
    label: module.label,
    moduleId: module.id,
    verb: override.verb || detectVerb(cues[0]?.example || module.summary || ''),
    subjectGroup,
    detailAriaLabel: override.detailAriaLabel || 'What happened',
    details,
  };
});

fs.writeFileSync(outputPath, `${JSON.stringify({ actions }, null, 2)}\n`);
