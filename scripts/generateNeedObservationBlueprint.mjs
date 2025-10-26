import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeObservationPlaceholders } from '../lib/observationPlaceholders.js';
import { slugify as slugifyLabel } from '../lib/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const needsCsvPath = join(rootDir, 'data', 'Needs.csv');
const blueprintPath = join(rootDir, 'data', 'observation_module_blueprints.json');

const CATEGORY_TEMPLATES = new Map([
  [
    'Love/Caring',
    {
      slotIds: ['time', 'context', 'social', 'actions'],
      cues: [
        {
          suffix: 'comfort-turned-away',
          example:
            'At (time detail) I reached to hug (other person) and they stepped back toward the doorway.',
          patterns: [
            '\\b(?:reached|leaned|offered)\\b[^\\n]{0,80}\\b(?:hug|hand|embrace|touch|hold)\\b[^\\n]{0,80}\\b(?:pulled\\s+away|stepp(?:ed|ing)\\s+back|turned\\s+away|kept\\s+(?:arms|hands)\\s+(?:at\\s+their\\s+sides|still))\\b',
          ],
        },
        {
          suffix: 'no-check-in',
          example: 'During (context detail) nobody checked how (person detail) was holding up.',
          patterns: [
            '\\b(?:no\\s+one|nobody)\\b[^\\n]{0,80}\\b(?:checked|asked|looked\\s+in)\\b[^\\n]{0,80}\\b(?:how|if)\\b[^\\n]{0,80}\\b(?:doing|feeling|holding\\s+up)',
          ],
        },
        {
          suffix: 'ignored-distress',
          example:
            'While (other person) wiped their eyes, the group kept typing on (device detail).',
          patterns: [
            '\\b(?:crying|sobbing|shaking|tearing\\s+up|wiping\\s+their\\s+eyes)\\b[^\\n]{0,80}\\b(?:kept|continued|stayed)\\b[^\\n]{0,80}\\b(?:typing|talking|scrolling|working|reviewing)'
          ],
        },
      ],
    },
  ],
  [
    'Community/Belonging',
    {
      slotIds: ['time', 'context', 'social'],
      cues: [
        {
          suffix: 'meeting-without',
          example: 'They started a meeting in (context detail) without adding me to the invite.',
          patterns: [
            '\\b(?:meeting|call|gathering|hangout)\\b[^\\n]{0,80}\\b(?:started|held|scheduled|happened)\\b[^\\n]{0,80}\\b(?:without|w\\/o|minus|excluding)\\b[^\\n]{0,80}\\b(?:me|us|them)'
          ],
        },
        {
          suffix: 'door-closed-outside',
          example: 'The door closed while I was still in the hallway.',
          patterns: [
            '\\bdoor\\b[^\\n]{0,80}\\b(?:closed|shut|locked)\\b[^\\n]{0,80}\\b(?:while|with)\\b[^\\n]{0,80}\\b(?:still\\s+outside|in\\s+the\\s+hall|on\\s+the\\s+stairs)'
          ],
        },
        {
          suffix: 'thread-without',
          example: 'A group chat about (project detail) went on without my name anywhere.',
          patterns: [
            '\\b(?:group\\s+chat|thread|channel)\\b[^\\n]{0,80}\\b(?:without|minus|excluding)\\b[^\\n]{0,80}\\b(?:me|them|inviting)'
          ],
        },
      ],
    },
  ],
  [
    'Sustenance/Health',
    {
      slotIds: ['time', 'context', 'actions'],
      cues: [
        {
          suffix: 'no-breaks',
          example:
            'After three (task detail) in a row there still was no time for a break.',
          patterns: [
            '\\b(?:back-?to-?back|no\\s+breaks?|without\\s+breaks?)\\b[^\\n]{0,80}\\b(?:shift|shifts|meetings?|appointments?|lessons?|cases?)'
          ],
        },
        {
          suffix: 'skipped-meal',
          example: 'We skipped (meal detail) to finish (task detail).',
          patterns: [
            '\\b(?:skipp(?:ed|ing)|miss(?:ed|ing)|delayed)\\b[^\\n]{0,80}\\b(?:meal|lunch|dinner|breakfast|snack)\\b'
          ],
        },
        {
          suffix: 'no-cover',
          example: 'I asked for cover so I could rest and nobody was available.',
          patterns: [
            '\\b(?:asked|request(?:ed)?)\\b[^\\n]{0,80}\\b(?:cover|relief|backup|break)\\b[^\\n]{0,80}\\b(?:no\\s+one|nobody|none)\\b[^\\n]{0,80}\\b(?:available|free|responded|could)'
          ],
        },
      ],
    },
  ],
  [
    'Empathy/Understanding',
    {
      slotIds: ['time', 'context', 'social', 'actions'],
      cues: [
        {
          suffix: 'interrupted',
          example:
            'While I was finishing a sentence, (other person) interrupted to change the subject.',
          patterns: [
            '\\b(?:interrupted|cut\\s+me\\s+off|talked\\s+over)\\b[^\\n]{0,80}\\b(?:while|as)\\b[^\\n]{0,80}\\b(?:I\\s+was|we\\s+were)'
          ],
        },
        {
          suffix: 'dismissed-feelings',
          example:
            'When I said I was hurt, they replied "you\'re overreacting" without asking more.',
          patterns: [
            "\\b(?:said|told)\\b[^\\n]{0,80}\\b(?:you'?re|I'?m|they're)\\s+(?:overreacting|too\\s+sensitive|fine|dramatic|making\\s+it\\s+up)"
          ],
        },
        {
          suffix: 'ignored-clarify',
          example:
            'I asked them to repeat what they heard and they kept reading from their notes.',
          patterns: [
            "\\b(?:asked|requested)\\b[^\\n]{0,80}\\b(?:repeat|say\\s+back|clarify|explain)\\b[^\\n]{0,80}\\b(?:they\\s+kept|they\\s+continued|they\\s+didn'?t)"
          ],
        },
      ],
    },
  ],
  [
    'Meaning/Contribution',
    {
      slotIds: ['time', 'context', 'actions'],
      cues: [
        {
          suffix: 'credit-omitted',
          example:
            'The project announcement went out without my name on the contributors list.',
          patterns: [
            '\\b(?:report|deck|presentation|announcement|summary)\\b[^\\n]{0,80}\\b(?:left|omitted|without|missing)\\b[^\\n]{0,80}\\b(?:my\\s+name|credit|attribution)'
          ],
        },
        {
          suffix: 'idea-set-aside',
          example: 'They set my proposal aside without any discussion.',
          patterns: [
            '\\b(?:idea|proposal|plan|draft|contribution)\\b[^\\n]{0,80}\\b(?:ignored|dismissed|set\\s+aside|shelved)\\b[^\\n]{0,80}\\b(?:without|no)\\b[^\\n]{0,80}\\b(?:discussion|feedback)'
          ],
        },
        {
          suffix: 'redo-without-why',
          example: 'We reworked the plan without explaining why the initial work did not count.',
          patterns: [
            '\\b(?:redo|rework|start\\s+over|scrap)\\b[^\\n]{0,80}\\b(?:without|no)\\b[^\\n]{0,80}\\b(?:explanation|reason|context)'
          ],
        },
      ],
    },
  ],
  [
    'Safety/Security',
    {
      slotIds: ['time', 'context', 'actions'],
      cues: [
        {
          suffix: 'door-unsecured',
          example: 'The security door was propped open all evening.',
          patterns: [
            '\\b(?:door|gate|entrance|exit)\\b[^\\n]{0,80}\\b(?:propped|left|kept)\\b[^\\n]{0,80}\\b(?:open|unlocked|ajar)'
          ],
        },
        {
          suffix: 'alarm-offline',
          example: 'The alarm panel showed the sensor offline and nobody addressed it.',
          patterns: [
            '\\b(?:alarm|detector|safety\\s+system|sensor)\\b[^\\n]{0,80}\\b(?:fault|offline|not\\s+working|failed|silenced)'
          ],
        },
        {
          suffix: 'protocol-skipped',
          example: 'They skipped the safety check before starting (task detail).',
          patterns: [
            '\\b(?:skipped|ignored|bypassed)\\b[^\\n]{0,80}\\b(?:safety|security|checklist|protocol|inspection)'
          ],
        },
      ],
    },
  ],
  [
    'Autonomy/Freedom',
    {
      slotIds: ['time', 'context', 'actions'],
      cues: [
        {
          suffix: 'forced-decision',
          example: 'They asked me to sign immediately without time to review.',
          patterns: [
            '\\b(?:told|forced|required|had\\s+to)\\b[^\\n]{0,80}\\b(?:sign|agree|commit|decide)\\b[^\\n]{0,80}\\b(?:immediately|on\\s+the\\s+spot|right\\s+away|without\\s+review)'
          ],
        },
        {
          suffix: 'schedule-overwrite',
          example: 'My calendar block was overwritten with another meeting.',
          patterns: [
            '\\b(?:calendar|schedule|availability)\\b[^\\n]{0,80}\\b(?:overridden|overrode|replaced|ignored)'
          ],
        },
        {
          suffix: 'permission-for-routine',
          example: 'I had to get permission before sending a routine update.',
          patterns: [
            '\\b(?:had\\s+to|needed\\s+to)\\b[^\\n]{0,80}\\b(?:ask|get)\\b[^\\n]{0,80}\\b(?:permission|approval)\\b[^\\n]{0,80}\\b(?:before|to)'
          ],
        },
      ],
    },
  ],
  [
    'Beauty/Peace/Play',
    {
      slotIds: ['time', 'context', 'sensory'],
      cues: [
        {
          suffix: 'harsh-lighting',
          example: 'The fluorescent lights flickered through the entire evening.',
          patterns: [
            '\\b(?:fluorescent|harsh|blaring|flickering)\\b[^\\n]{0,80}\\b(?:lights?|lighting)'
          ],
        },
        {
          suffix: 'constant-noise',
          example: 'There was a steady hum from the generator all night.',
          patterns: [
            '\\b(?:constant|steady|continuous|loud)\\b[^\\n]{0,80}\\b(?:noise|hum|buzz|clatter|din|drone)'
          ],
        },
        {
          suffix: 'play-canceled',
          example: 'Our music break was canceled to squeeze in another briefing.',
          patterns: [
            '\\b(?:canceled|cancelled|cut|stopped|skipped)\\b[^\\n]{0,80}\\b(?:game|practice|music|break|art|recess|play)'
          ],
        },
      ],
    },
  ],
  [
    'Authenticity',
    {
      slotIds: ['time', 'context', 'actions'],
      cues: [
        {
          suffix: 'tone-it-down',
          example: 'They asked me to tone down my description before the meeting.',
          patterns: [
            '\\b(?:asked|told)\\b[^\\n]{0,80}\\b(?:tone\\s+down|hide|mask|pretend|act\\s+like|smile\\s+through)'
          ],
        },
        {
          suffix: 'edited-without-ok',
          example: 'My statement was edited without checking with me.',
          patterns: [
            '\\b(?:edited|rewrote|changed|revised)\\b[^\\n]{0,80}\\b(?:statement|testimony|draft|bio)\\b[^\\n]{0,80}\\b(?:without|before)\\b[^\\n]{0,80}\\b(?:asking|my\\s+ok|my\\s+consent)'
          ],
        },
        {
          suffix: 'blocked-sharing',
          example: 'I was not allowed to mention the actual numbers during the briefing.',
          patterns: [
            "\\b(?:wasn'?t|not)\\b[^\\n]{0,80}\\b(?:allowed|permitted)\\b[^\\n]{0,80}\\b(?:to\\s+share|to\\s+say|to\\s+mention|to\\s+name)"
          ],
        },
      ],
    },
  ],
]);

function main() {
  const { needs, feelingsByCategory } = loadNeeds();
  const modules = [];
  needs.forEach(need => {
    const module = createModuleForNeed(need, feelingsByCategory);
    if (module) {
      modules.push(module);
    }
  });
  const blueprint = { modules };
  writeFileSync(blueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`);
}

function loadNeeds() {
  const csvText = readFileSync(needsCsvPath, 'utf8');
  const rows = parseCsv(csvText);
  if (!rows.length) {
    return { needs: [], feelingsByCategory: new Map() };
  }
  const headers = rows.shift().map(col => col.trim());
  const titleIndex = headers.indexOf('Need Title');
  const slugIndex = headers.indexOf('Slug Override');
  const categoryIndex = headers.indexOf('Category Label');
  const summaryIndex = headers.indexOf('Claim Summary');
  const feelingsIndex = headers.indexOf('Related Feelings');
  const needs = [];
  const feelingsByCategory = new Map();
  rows.forEach(cols => {
    if (!cols || !cols.length) {
      return;
    }
    const title = (cols[titleIndex] || '').trim();
    if (!title) {
      return;
    }
    const slug = ((cols[slugIndex] || '').trim()) || slugifyLabel(title);
    const category = (cols[categoryIndex] || '').trim();
    const summary = (cols[summaryIndex] || '').trim();
    const feelingsRaw = (cols[feelingsIndex] || '').trim();
    const feelings = uniqueStrings(
      feelingsRaw
        ? feelingsRaw
            .split(/[,;/]/)
            .map(part => slugifyLabel(part.trim()))
            .filter(Boolean)
        : [],
    );
    needs.push({ title, slug, category, summary, feelings });
    if (category && feelings.length) {
      if (!feelingsByCategory.has(category)) {
        feelingsByCategory.set(category, new Set());
      }
      const bucket = feelingsByCategory.get(category);
      feelings.forEach(feeling => bucket.add(feeling));
    }
  });
  return { needs, feelingsByCategory };
}

function createModuleForNeed(need, feelingsByCategory) {
  const template = CATEGORY_TEMPLATES.get(need.category);
  if (!template) {
    console.warn(`No category template for ${need.title} (${need.category || 'uncategorized'})`);
    return null;
  }
  const categoryFeelings = Array.from(feelingsByCategory.get(need.category) || []);
  const moduleFeelings = need.feelings.length ? need.feelings : categoryFeelings;
  if (!moduleFeelings.length) {
    console.warn(`No feelings available for ${need.title}; skipping module.`);
    return null;
  }
  const cues = template.cues.map(cueTemplate => createCueFromTemplate(need, cueTemplate, moduleFeelings));
  const detectors = buildDetectorsFromTemplates(template.cues);
  const examples = cues.map(cue => cue.example).slice(0, 3);
  const summary = need.summary || `Observations that may highlight the need for ${need.title.toLowerCase()}.`;
  return {
    id: need.slug,
    label: need.title,
    summary,
    slotIds: template.slotIds.slice(),
    lexiconKeys: [],
    feelings: moduleFeelings.slice(),
    needs: [need.slug],
    examples,
    detectors,
    cues,
  };
}

function createCueFromTemplate(need, cueTemplate, feelings) {
  const id = `${need.slug}-${cueTemplate.suffix}`;
  const example = normalizeObservationPlaceholders(cueTemplate.example);
  return {
    id,
    lexiconKeys: [],
    feelings: feelings.slice(),
    needs: [need.slug],
    example,
    patterns: cueTemplate.patterns.slice(),
  };
}

function buildDetectorsFromTemplates(cueTemplates) {
  const detectors = [];
  const seen = new Set();
  cueTemplates.forEach(template => {
    template.patterns.forEach(pattern => {
      const key = `regex:${pattern}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      detectors.push({ type: 'regex', pattern, flags: 'iu' });
    });
  });
  return detectors;
}

function parseCsv(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch === '"') {
      if (inQuotes && str[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur);
        out.push(row);
        row = [];
        cur = '';
      }
      if (ch === '\r' && str[i + 1] === '\n') {
        i += 1;
      }
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    out.push(row);
  }
  return out;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  (Array.isArray(values) ? values : []).forEach(value => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) {
      return;
    }
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

main();
