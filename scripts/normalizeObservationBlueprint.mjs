import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeObservationPlaceholders } from '../lib/observationPlaceholders.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const blueprintPath = join(rootDir, 'data', 'observation_module_blueprints.json');

const raw = String.raw;

const NUMBER_WORD_PATTERN = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)';

function regex(pattern, flags = 'iu') {
  return { type: 'regex', pattern, flags };
}

const PATTERN_UPDATES = {
  'budget-freeze-alerts': {
    detectors: [
      regex(raw`\bbudget\b[^\n]{0,120}\bfreeze\b[^\n]{0,120}\b(?:effective|takes\s+effect|in\s+effect|starting|starts|begins)\b[^\n]{0,80}\b(?:immediately|now|today|right\s+away|as\s+of\s+today)\b`),
    ],
    cues: {
      'budget-freeze-alerts': [
        raw`\bbudget\b[^\n]{0,120}\bfreeze\b[^\n]{0,120}\b(?:effective|takes\s+effect|in\s+effect|starting|starts|begins)\b[^\n]{0,80}\b(?:immediately|now|today|right\s+away|as\s+of\s+today)\b`,
      ],
    },
  },
  'civic-nonresponse': {
    detectors: [
      regex(raw`\b(?:still\s+)?(?:haven'?t|have\s+not)\b[^\n]{0,80}\b(?:replied|responded|answered)\b[^\n]{0,80}\b(?:email|message|note|letter)s?\b`),
    ],
    cues: {
      'civic-nonresponse': [
        raw`\b(?:still\s+)?(?:haven'?t|have\s+not)\b[^\n]{0,80}\b(?:replied|responded|answered)\b[^\n]{0,80}\b(?:email|message|note|letter)s?\b`,
      ],
    },
  },
  'courtroom-delays': {
    detectors: [
      regex(raw`\b(?:court|judge|hearing)\b[^\n]{0,120}\b(?:postponed|rescheduled|reconven\w*|continued)\b[^\n]{0,80}\b(?:next|following)\s+month\b`),
    ],
    cues: {
      'courtroom-delays': [
        raw`\b(?:court|judge|hearing)\b[^\n]{0,120}\b(?:postponed|rescheduled|reconven\w*|continued)\b[^\n]{0,80}\b(?:next|following)\s+month\b`,
      ],
    },
  },
  'customer-mess-followup': {
    detectors: [
      regex(raw`\bcount(?:ed|ing)?\b[^\n]{0,80}\b(?:tables?|seats?|surfaces?|booths?|areas?)\b[^\n]{0,80}\b(?:left|still|remaining)\b[^\n]{0,80}\b(?:dirty|messy|unclean|uncleared|covered|sticky)\b`),
    ],
    cues: {
      'customer-mess-followup': [
        raw`\bcount(?:ed|ing)?\b[^\n]{0,80}\b(?:tables?|seats?|surfaces?|booths?|areas?)\b[^\n]{0,80}\b(?:left|still|remaining)\b[^\n]{0,80}\b(?:dirty|messy|unclean|uncleared|covered|sticky)\b`,
      ],
    },
  },
  'delivery-exposure': {
    detectors: [
      regex(raw`\b(?:doorbell|entry|porch)\s+(?:cam|camera|video)\b[^\n]{0,120}\b(?:left|leaving|dropped|set)\b[^\n]{0,120}\b(?:package|parcel|delivery|order|box)\b[^\n]{0,120}\b(?:for|in)\b[^\n]{0,40}\b\d+\s+(?:minutes?|hours?)\b`),
    ],
    cues: {
      'delivery-exposure': [
        raw`\b(?:doorbell|entry|porch)\s+(?:cam|camera|video)\b[^\n]{0,120}\b(?:left|leaving|dropped|set)\b[^\n]{0,120}\b(?:package|parcel|delivery|order|box)\b[^\n]{0,120}\b(?:for|in)\b[^\n]{0,40}\b\d+\s+(?:minutes?|hours?)\b`,
      ],
    },
  },
  'divorce-paper-silence': {
    detectors: [
      regex(raw`\bstare(?:d|s)?\b[^\n]{0,160}\bdivorce\s+papers?\b[^\n]{0,80}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:seconds?|minutes?)\b`),
      regex(raw`\bdivorce\s+papers?\b[^\n]{0,160}\b(?:stare|stared|staring|silent|silence|silently|without\s+(?:saying|speaking))\b[^\n]{0,80}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:seconds?|minutes?)\b`),
    ],
    cues: {
      'divorce-paper-silence': [
        raw`\bstare(?:d|s)?\b[^\n]{0,160}\bdivorce\s+papers?\b[^\n]{0,80}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:seconds?|minutes?)\b`,
        raw`\bdivorce\s+papers?\b[^\n]{0,160}\b(?:stare|stared|staring|silent|silence|silently|without\s+(?:saying|speaking))\b[^\n]{0,80}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:seconds?|minutes?)\b`,
      ],
    },
  },
  'ensemble-dropoff': {
    detectors: [
      regex(raw`\bboth\b[^\n]{0,80}\btenors\b[^\n]{0,120}\b(?:stared|staring|look(?:ed|ing))\b[^\n]{0,40}\b(?:down|at\s+the\s+floor)\b`),
    ],
    cues: {
      'ensemble-dropoff': [
        raw`\bboth\b[^\n]{0,80}\btenors\b[^\n]{0,120}\b(?:stared|staring|look(?:ed|ing))\b[^\n]{0,40}\b(?:down|at\s+the\s+floor)\b`,
      ],
    },
  },
  'housing-eviction-notices': {
    detectors: [
      regex(raw`\beviction\b[^\n]{0,80}\b(?:warning|notice|letter|posting)\b`),
    ],
    cues: {
      'housing-eviction-notices': [
        raw`\beviction\b[^\n]{0,80}\b(?:warning|notice|letter|posting)\b`,
      ],
    },
  },
  'intake-walkaways': {
    detectors: [
      regex(raw`\bcoordinator\b[^\n]{0,120}\b(?:walk(?:ed)?|step(?:ped)?)\s+away\b[^\n]{0,120}\b(?:clipboard|intake\s+form|paperwork|forms)\b`),
    ],
    cues: {
      'intake-walkaways': [
        raw`\bcoordinator\b[^\n]{0,120}\b(?:walk(?:ed)?|step(?:ped)?)\s+away\b[^\n]{0,120}\b(?:clipboard|intake\s+form|paperwork|forms)\b`,
      ],
    },
  },
  'irrigation-pump-alarms': {
    detectors: [
      regex(raw`\b(?:pump|irrigation)\b[^\n]{0,120}\b(?:alarm|alert|siren)\b[^\n]{0,120}\b(?:stop(?:ped|ping)|halt(?:ed|ing)|shut\s+down)\b[^\n]{0,120}\b(?:watering|irrigation|cycle)\b`),
    ],
    cues: {
      'irrigation-pump-alarms': [
        raw`\b(?:pump|irrigation)\b[^\n]{0,120}\b(?:alarm|alert|siren)\b[^\n]{0,120}\b(?:stop(?:ped|ping)|halt(?:ed|ing)|shut\s+down)\b[^\n]{0,120}\b(?:watering|irrigation|cycle)\b`,
      ],
    },
  },
  'last-minute-scope-shifts': {
    detectors: [
      regex(raw`\bneed\s+to\s+(?:redo|rework|revise|update)\b[^\n]{0,120}\b(?:deck|slides?|presentation|deliverable|report|slide\s+deck)\b[^\n]{0,80}\b(?:tonight|by\s+tonight|before\s+morning|before\s+tomorrow|end\s+of\s+day)\b`),
    ],
    cues: {
      'last-minute-scope-shifts': [
        raw`\bneed\s+to\s+(?:redo|rework|revise|update)\b[^\n]{0,120}\b(?:deck|slides?|presentation|deliverable|report|slide\s+deck)\b[^\n]{0,80}\b(?:tonight|by\s+tonight|before\s+morning|before\s+tomorrow|end\s+of\s+day)\b`,
      ],
    },
  },
  'maintenance-dashboard-alerts': {
    detectors: [
      regex(raw`\bmaintenance\s+dashboard\b[^\n]{0,120}\b(?:flashed|flash(?:ed|es)|showed|displayed|raised)\b[^\n]{0,80}\b(?:red|critical|alert|alarm|warning)\b`),
    ],
    cues: {
      'maintenance-dashboard-alerts': [
        raw`\bmaintenance\s+dashboard\b[^\n]{0,120}\b(?:flashed|flash(?:ed|es)|showed|displayed|raised)\b[^\n]{0,80}\b(?:red|critical|alert|alarm|warning)\b`,
      ],
    },
  },
  'mediation-body-language': {
    detectors: [
      regex(raw`\bboth\s+partners\b[^\n]{0,120}\b(?:folded|crossed)\b[^\n]{0,40}\barms\b[^\n]{0,120}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:seconds?|minutes?)\b`),
    ],
    cues: {
      'mediation-body-language': [
        raw`\bboth\s+partners\b[^\n]{0,120}\b(?:folded|crossed)\b[^\n]{0,40}\barms\b[^\n]{0,120}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:seconds?|minutes?)\b`,
      ],
    },
  },
  'meeting-overflow': {
    detectors: [
      regex(raw`\b(?:meeting|agenda)\b[^\n]{0,120}\b(?:ran|run|kept|went|overran)\b[^\n]{0,80}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:minutes?|mins?)\b[^\n]{0,80}\b(?:past|beyond|over)\b[^\n]{0,80}\b(?:dismissal|end|finish|stop|scheduled\s+time)\b`),
    ],
    cues: {
      'meeting-overflow': [
        raw`\b(?:meeting|agenda)\b[^\n]{0,120}\b(?:ran|run|kept|went|overran)\b[^\n]{0,80}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:minutes?|mins?)\b[^\n]{0,80}\b(?:past|beyond|over)\b[^\n]{0,80}\b(?:dismissal|end|finish|stop|scheduled\s+time)\b`,
      ],
    },
  },
  'monitor-distress-alerts': {
    detectors: [
      regex(raw`\bbaby\s+monitor\b[^\n]{0,120}\b(?:cry|crying|wail|wailing|scream|screaming|alarm)\b[^\n]{0,120}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:minutes?|mins?|hours?)\b`),
    ],
    cues: {
      'monitor-distress-alerts': [
        raw`\bbaby\s+monitor\b[^\n]{0,120}\b(?:cry|crying|wail|wailing|scream|screaming|alarm)\b[^\n]{0,120}\b(?:\d+|${NUMBER_WORD_PATTERN})\s+(?:minutes?|mins?|hours?)\b`,
      ],
    },
  },
  'on-call-chaos': {
    detectors: [
      regex(raw`\bDr\.?\b[^\n]{0,120}\b(?:page|paged|paging|pages)\b[^\n]{0,80}\b(?:\d+|${NUMBER_WORD_PATTERN}|multiple|several)\s+(?:times?|alerts?|pages?|calls?)\b`),
      regex(raw`\b(?:\d+|${NUMBER_WORD_PATTERN}|multiple|several)\s+pages\b[^\n]{0,80}\b(?:came\s+through|arrived|hit)\b`),
    ],
    cues: {
      'on-call-chaos': [
        raw`\bDr\.?\b[^\n]{0,120}\b(?:page|paged|paging|pages)\b[^\n]{0,80}\b(?:\d+|${NUMBER_WORD_PATTERN}|multiple|several)\s+(?:times?|alerts?|pages?|calls?)\b`,
        raw`\b(?:\d+|${NUMBER_WORD_PATTERN}|multiple|several)\s+pages\b[^\n]{0,80}\b(?:came\s+through|arrived|hit)\b`,
      ],
    },
  },
  'orchestra-cuts': {
    detectors: [
      regex(raw`\bconductor\b[^\n]{0,120}\b(?:cut|drop(?:ped|ping)|stopp(?:ed|ing)|pulled)\b[^\n]{0,120}\b(?:percussion|entrance|section|part)\b`),
    ],
    cues: {
      'orchestra-cuts': [
        raw`\bconductor\b[^\n]{0,120}\b(?:cut|drop(?:ped|ping)|stopp(?:ed|ing)|pulled)\b[^\n]{0,120}\b(?:percussion|entrance|section|part)\b`,
      ],
    },
  },
  'performance-reassignment': {
    detectors: [
      regex(raw`\bsolo\b[^\n]{0,120}\b(?:give|gave|giving|hand(?:ed|ing)|assign(?:ed|ing)|switch(?:ed|ing))\b[^\n]{0,120}\b(?:to|over\s+to)\b[^\n]{0,120}\b(?:someone\s+else|another|different)\b`),
    ],
    cues: {
      'performance-reassignment': [
        raw`\bsolo\b[^\n]{0,120}\b(?:give|gave|giving|hand(?:ed|ing)|assign(?:ed|ing)|switch(?:ed|ing))\b[^\n]{0,120}\b(?:to|over\s+to)\b[^\n]{0,120}\b(?:someone\s+else|another|different)\b`,
      ],
    },
  },
  'relationship-breakup-text': {
    detectors: [
      regex(raw`\b(?:text|message)\b[^\n]{0,160}\b(?:we'?re|we\s+are|it'?s|i'?m|this\s+is)\b[^\n]{0,80}\b(?:over|done|finished|ending|through)\b`),
      regex(raw`\b(?:text|message)\b[^\n]{0,160}\b(?:break(?:ing)?\s+up|can't\s+do\s+this\s+anymore|end(?:ing)?\s+this)\b`),
    ],
    cues: {
      'relationship-breakup-text': [
        raw`\b(?:text|message)\b[^\n]{0,160}\b(?:we'?re|we\s+are|it'?s|i'?m|this\s+is)\b[^\n]{0,80}\b(?:over|done|finished|ending|through)\b`,
        raw`\b(?:text|message)\b[^\n]{0,160}\b(?:break(?:ing)?\s+up|can't\s+do\s+this\s+anymore|end(?:ing)?\s+this)\b`,
      ],
    },
  },
  'school-discipline-calls': {
    detectors: [
      regex(raw`\b(?:principal|school|teacher|office)\b[^\n]{0,120}\b(?:called|calling|phoned|rang)\b[^\n]{0,120}\b(?:disrupt(?:ed|ion)|incident|issue|behavior)\b[^\n]{0,80}\b(?:class|classroom)\b`),
      regex(raw`\b(?:your|my)\b[^\n]{0,40}\b(?:kid|child|student)\b[^\n]{0,40}\b(?:disrupt(?:ed|ing)|caus(?:ed|ing)\s+disruption)\b[^\n]{0,80}\b(?:class|classroom)\b`),
    ],
    cues: {
      'school-discipline-calls': [
        raw`\b(?:principal|school|teacher|office)\b[^\n]{0,120}\b(?:called|calling|phoned|rang)\b[^\n]{0,120}\b(?:disrupt(?:ed|ion)|incident|issue|behavior)\b[^\n]{0,80}\b(?:class|classroom)\b`,
        raw`\b(?:your|my)\b[^\n]{0,40}\b(?:kid|child|student)\b[^\n]{0,40}\b(?:disrupt(?:ed|ing)|caus(?:ed|ing)\s+disruption)\b[^\n]{0,80}\b(?:class|classroom)\b`,
      ],
    },
  },
  'security-footage-breach': {
    detectors: [
      regex(raw`\bfootage\b[^\n]{0,120}\b(?:shows|showed|captured|caught|recorded)\b[^\n]{0,120}\b(?:contractor|vendor|worker|person|people)s?\b[^\n]{0,120}\b(?:climb(?:ing)?|jump(?:ing)?|cross(?:ing)?)\b[^\n]{0,80}\b(?:fence|gate|wall|barrier)\b`),
    ],
    cues: {
      'security-footage-breach': [
        raw`\bfootage\b[^\n]{0,120}\b(?:shows|showed|captured|caught|recorded)\b[^\n]{0,120}\b(?:contractor|vendor|worker|person|people)s?\b[^\n]{0,120}\b(?:climb(?:ing)?|jump(?:ing)?|cross(?:ing)?)\b[^\n]{0,80}\b(?:fence|gate|wall|barrier)\b`,
      ],
    },
  },
  'shelter-capacity-turnaway': {
    detectors: [
      regex(raw`\bno\s+beds?\b[^\n]{0,120}\b(?:for|left\s+for|available\s+for|next\s+for)\b[^\n]{0,60}\bfamil(?:y|ies)\b`),
    ],
    cues: {
      'shelter-capacity-turnaway': [
        raw`\bno\s+beds?\b[^\n]{0,120}\b(?:for|left\s+for|available\s+for|next\s+for)\b[^\n]{0,60}\bfamil(?:y|ies)\b`,
      ],
    },
  },
  'urgent-email-demands': {
    detectors: [
      regex(raw`\b(?:emailed|email|messaged|ping(?:ed)?)\b[^\n]{0,120}\b(?:need|want|expect|require)\b[^\n]{0,80}\b(?:deck|slides?|presentation|report|deliverable|document)\b[^\n]{0,80}\b(?:tonight|by\s+tonight|by\s+end\s+of\s+day|before\s+tomorrow|before\s+morning)\b`),
    ],
    cues: {
      'urgent-email-demands': [
        raw`\b(?:emailed|email|messaged|ping(?:ed)?)\b[^\n]{0,120}\b(?:need|want|expect|require)\b[^\n]{0,80}\b(?:deck|slides?|presentation|report|deliverable|document)\b[^\n]{0,80}\b(?:tonight|by\s+tonight|by\s+end\s+of\s+day|before\s+tomorrow|before\s+morning)\b`,
      ],
    },
  },
  'voicemail-insults': {
    detectors: [
      regex(raw`\bvoicemail\b[^\n]{0,120}\b(?:you(?:'|\s*are)|you're|ur)\b[^\n]{0,80}\b(?:useless|worthless|terrible|incompetent|awful|garbage)\b`),
    ],
    cues: {
      'voicemail-insults': [
        raw`\bvoicemail\b[^\n]{0,120}\b(?:you(?:'|\s*are)|you're|ur)\b[^\n]{0,80}\b(?:useless|worthless|terrible|incompetent|awful|garbage)\b`,
      ],
    },
  },
};

function cleanExample(example) {
  if (typeof example !== 'string') {
    return '';
  }
  const squished = example.replace(/\s+/g, ' ').trim();
  return normalizeObservationPlaceholders(squished);
}

const blueprintText = readFileSync(blueprintPath, 'utf8');
const blueprint = JSON.parse(blueprintText);
const modules = Array.isArray(blueprint.modules) ? blueprint.modules : blueprint;

modules.forEach(module => {
  if (Array.isArray(module.examples)) {
    module.examples = module.examples.map(cleanExample);
  }
  if (Array.isArray(module.cues)) {
    module.cues.forEach(cue => {
      if (cue.example) {
        cue.example = cleanExample(cue.example);
      }
      const moduleUpdate = PATTERN_UPDATES[module.id];
      if (moduleUpdate && moduleUpdate.cues && moduleUpdate.cues[cue.id]) {
        cue.patterns = [...moduleUpdate.cues[cue.id]];
      }
    });
  }
  const moduleUpdate = PATTERN_UPDATES[module.id];
  if (moduleUpdate && moduleUpdate.detectors) {
    module.detectors = moduleUpdate.detectors.map(detector => ({ ...detector }));
  }
});

writeFileSync(blueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`);
console.log('Normalized observation blueprint placeholders and patterns.');
