import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');

const schemaPath = path.join(dataDir, 'observation_formula_schema.json');
const csvPath = path.join(dataDir, 'observation_cues.sanitized.csv');
const outputPath = path.join(dataDir, 'observation_cue_modules.json');

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'without',
  'at',
  'by',
  'from',
  'it',
  'its',
  'my',
  'our',
  'your',
  'their',
  'his',
  'her',
  'they',
  'them',
  'we',
  'us',
  'you',
  'is',
  'was',
  'were',
  'be',
  'been',
  'are',
  'as',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'he',
  'she',
  'itself',
  'him',
  'her',
  'their',
  'his',
  'hers',
  'ours',
]);

const MOTIF_TEMPLATES = [
  {
    id: 'async-replies',
    label: 'Delayed or missing replies',
    summary: 'Messages that were seen, delayed, or never answered across chat, email, and calls.',
    keywords: [
      /\b(?:reply|respond|response|responded|responding|replied|no reply|left on read)\b/i,
      /\b(?:message|dm|text|email|inbox|thread|chat|voicemail|call back)\b/i,
      /\bseen\b/i,
    ],
    slotHints: ['date', 'time', 'place', 'actor', 'action', 'count'],
    slotPrompts: {
      date: ['Mention when the unanswered message was sent or seen.'],
      time: ['Add how long you waited or the cut-off time.'],
      place: ['Name the channel or inbox where it happened.'],
      action: ['Quote the last message or note that no reply arrived.'],
      count: ['Include how many follow-ups you sent or hours you waited.'],
    },
    traits: { anchors: ['asynchronous', 'communication'] },
  },
  {
    id: 'topic-flow',
    label: 'Topic shifts or derailments',
    summary: 'Moments where the topic, agenda, or question was ignored, redirected, or skipped.',
    keywords: [
      /\b(topic|agenda|redirect|redirected|switched topics|went off-topic|side conversation|derailed|tangent|shifted)\b/i,
    ],
    slotHints: ['date', 'place', 'actor', 'action'],
    slotPrompts: {
      action: ['Write what was said when the topic shifted.'],
      actor: ['Clarify who redirected the conversation.'],
    },
    traits: { anchors: ['conversation'] },
  },
  {
    id: 'meeting-structure',
    label: 'Meeting logistics and tools',
    summary: 'Changes to meeting logistics, tech, or facilitation (agenda, camera, mute, screen share).',
    keywords: [
      /\b(meeting|standup|sync|huddle|call|zoom|video|camera|microphone|mic|muted|screen share|slide|deck|presentation)\b/i,
      /\b(calendar|invite|agenda|minutes|recording|transcript|caption)\b/i,
    ],
    slotHints: ['date', 'time', 'place', 'actor', 'action', 'count'],
    slotPrompts: {
      place: ['Name the room or video call where it happened.'],
      action: ['Describe the observable tech change or facilitation move.'],
    },
    traits: { anchors: ['meeting', 'collaboration'] },
  },
  {
    id: 'recognition-credit',
    label: 'Recognition and attribution',
    summary: 'Who received credit, acknowledgement, or mention for specific work.',
    keywords: [
      /\b(credit|credited|acknowledg|recognition|shout ?out|named|attributed|tagged)\b/i,
    ],
    slotHints: ['actor', 'action', 'count'],
    slotPrompts: {
      actor: ['List who was or was not acknowledged.'],
      action: ['Quote the words that assigned credit.'],
    },
    traits: { anchors: ['recognition'] },
  },
  {
    id: 'boundary-consent',
    label: 'Consent and privacy boundaries',
    summary: 'Information or access shared without permission (forwards, posts, tags, opened items).',
    keywords: [
      /\bwithout (?:asking|permission|consent|checking|telling)\b/i,
      /\b(forwarded|shared|posted|tagged|opened|access|added|invited|recording started)\b/i,
      /\bdoor|entered|walked in|touched|picked up|borrowed\b/i,
    ],
    slotHints: ['place', 'actor', 'action', 'count'],
    slotPrompts: {
      place: ['Note where the boundary was crossed (room, channel, inbox).'],
      action: ['Describe exactly what was shared or accessed.'],
    },
    traits: { anchors: ['privacy', 'consent'] },
  },
  {
    id: 'physical-environment',
    label: 'Shared physical spaces',
    summary: 'Noise, messes, items moved, or physical conditions in shared environments.',
    keywords: [
      /\b(room|desk|kitchen|trash|dishes|sink|noise|loud|music|thermostat|temperature|smoke|line|queue|seat|chair)\b/i,
    ],
    slotHints: ['place', 'action', 'count'],
    slotPrompts: {
      place: ['Identify the exact location in the shared space.'],
      count: ['Include how long the condition lasted or how many times you noticed it.'],
    },
    traits: { anchors: ['environment'] },
  },
  {
    id: 'timeliness-scheduling',
    label: 'Timing and scheduling boundaries',
    summary: 'Arrivals, departures, deadlines, cancellations, or timing agreements that shifted.',
    keywords: [
      /\b(late|early|hours?|minutes?|deadline|schedule|arrived|left|waited|delayed|overdue|no show|rescheduled|cancelled)\b/i,
    ],
    slotHints: ['date', 'time', 'actor', 'count'],
    slotPrompts: {
      date: ['State the original and actual timing.'],
      count: ['Quantify how long the delay or gap was.'],
    },
    traits: { anchors: ['temporal', 'agreements'] },
  },
  {
    id: 'documentation-changes',
    label: 'Document and record changes',
    summary: 'Edits, deletions, or updates made in shared documents, notes, or systems.',
    keywords: [
      /\b(document|doc|notes?|summary|report|spreadsheet|slide|deck|comment|resolved|edited|overwrite|version|draft|file)\b/i,
    ],
    slotHints: ['place', 'actor', 'action', 'count'],
    slotPrompts: {
      action: ['Specify which part of the document changed.'],
    },
    traits: { anchors: ['documentation'] },
  },
  {
    id: 'resource-support',
    label: 'Support and resources delivered',
    summary: 'Promises of help, materials, or follow-through that were or were not completed.',
    keywords: [
      /\b(supplies|equipment|support|help|deliver|delivered|provide|provided|sent|brought|restocked|setup|followed up)\b/i,
    ],
    slotHints: ['actor', 'action', 'count'],
    slotPrompts: {
      action: ['Describe what was or was not delivered.'],
      count: ['Mention quantities or number of attempts.'],
    },
    traits: { anchors: ['support'] },
  },
  {
    id: 'tone-and-expression',
    label: 'Tone, volume, and expression',
    summary: 'How people spoke or expressed themselves (interruptions, laughter, raised voices).',
    keywords: [
      /\b(shout|yell|tone|sarcas|laughed|mocked|raised voice|snapped|voice note|voice message|talked over|interrupt)\b/i,
    ],
    slotHints: ['sensory', 'actor', 'action', 'count'],
    slotPrompts: {
      sensory: ['Lead with “I heard…” or “I saw…” for tone-related cues.'],
      action: ['Quote the words or describe the expression (laughed, shouted).'],
    },
    traits: { anchors: ['tone'] },
  },
  {
    id: 'general-observation',
    label: 'Other observation motifs',
    summary: 'Cues that do not yet map cleanly to another motif cluster.',
    keywords: [],
    slotHints: ['date', 'place', 'actor', 'action'],
    slotPrompts: {
      action: ['Describe exactly what happened in observable terms.'],
    },
    traits: { anchors: ['general'] },
  },
];

function parseCSV(str) {
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
      if (ch === '\r' && str[i + 1] === '\n') {
        i += 1;
      }
      row.push(cur);
      out.push(row);
      row = [];
      cur = '';
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

function slugToLabel(slug) {
  return slug
    .split('-')
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function tokenize(text) {
  if (!text) {
    return [];
  }
  return Array.from(text.matchAll(/[\p{L}\p{N}']+/gu)).map(match => match[0].toLowerCase());
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function derivePatternFromExample(example) {
  const tokens = tokenize(example || '').filter(token => token.length > 2 && !STOPWORDS.has(token));
  if (tokens.length < 2) {
    return null;
  }
  const slice = tokens.slice(0, Math.min(tokens.length, 5));
  const pattern = slice.map(token => escapeRegex(token)).join('\\s+');
  return pattern ? `\\b${pattern}\\b` : null;
}

function compileSlotDetectors(schema) {
  const map = new Map();
  (schema.slots || []).forEach(slot => {
    const regexes = Array.isArray(slot.patterns)
      ? slot.patterns
          .map(pattern => {
            try {
              return new RegExp(pattern, 'i');
            } catch (error) {
              return null;
            }
          })
          .filter(Boolean)
      : [];
    const tokens = Array.isArray(slot.traits?.tokens)
      ? slot.traits.tokens.map(token => token.toLowerCase())
      : [];
    map.set(slot.id, { id: slot.id, regexes, tokens });
  });
  return map;
}

function inferSlotEvidence({ slotDetectors, text, tokens }) {
  const evidence = new Map();
  slotDetectors.forEach(detector => {
    const matches = [];
    const tokenHits = [];
    detector.regexes.forEach(regex => {
      regex.lastIndex = 0;
      const hit = regex.exec(text);
      if (hit && hit[0]) {
        matches.push(hit[0]);
      }
    });
    detector.tokens.forEach(token => {
      if (tokens.includes(token)) {
        tokenHits.push(token);
      }
    });
    if (matches.length || tokenHits.length) {
      evidence.set(detector.id, {
        patterns: matches,
        tokens: [...new Set(tokenHits)],
      });
    }
  });
  return evidence;
}

function resolveMotif(text) {
  for (const motif of MOTIF_TEMPLATES) {
    if (!Array.isArray(motif.keywords) || motif.keywords.length === 0) {
      continue;
    }
    const matched = motif.keywords.some(keyword => {
      if (!keyword) {
        return false;
      }
      if (keyword instanceof RegExp) {
        return keyword.test(text);
      }
      return text.includes(String(keyword).toLowerCase());
    });
    if (matched) {
      return motif.id;
    }
  }
  return 'general-observation';
}

function aggregateCounts(items) {
  const counts = new Map();
  items.forEach(item => {
    const token = String(item || '').trim().toLowerCase();
    if (!token) {
      return;
    }
    counts.set(token, (counts.get(token) || 0) + 1);
  });
  return counts;
}

function topValues(counts, limit = 12) {
  const pairs = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return pairs.slice(0, limit).map(([value]) => value);
}

function unionSet(values) {
  const out = new Set();
  values.forEach(value => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item) {
          out.add(item);
        }
      });
    } else {
      out.add(value);
    }
  });
  return Array.from(out);
}

async function run() {
  const [schemaText, csvText] = await Promise.all([
    fs.readFile(schemaPath, 'utf8'),
    fs.readFile(csvPath, 'utf8'),
  ]);

  const schema = JSON.parse(schemaText);
  const rows = parseCSV(csvText.trim()).slice(1); // skip header
  const slotDetectors = compileSlotDetectors(schema);
  const motifEntries = new Map();
  const motifOrder = new Map();
  MOTIF_TEMPLATES.forEach((motif, index) => {
    motifEntries.set(motif.id, []);
    motifOrder.set(motif.id, index);
  });

  rows.forEach(cols => {
    if (!Array.isArray(cols) || cols.length < 5) {
      return;
    }
    const cue = String(cols[0] || '').trim();
    const rawPatterns = String(cols[1] || '')
      .split('|')
      .map(value => value.trim())
      .filter(Boolean);
    const patterns = rawPatterns.length ? [...rawPatterns] : [];
    const feelings = String(cols[2] || '')
      .split('|')
      .map(value => value.trim())
      .filter(Boolean);
    const needs = String(cols[3] || '')
      .split('|')
      .map(value => value.trim())
      .filter(Boolean);
    const example = String(cols[4] || '').trim();

    if (!cue) {
      return;
    }

    if (!patterns.length && example) {
      const fallbackPattern = derivePatternFromExample(example);
      if (fallbackPattern) {
        patterns.push(fallbackPattern);
      }
    }

    const textBlob = `${cue} ${rawPatterns.join(' ')} ${example}`.toLowerCase();
    const tokens = tokenize(textBlob);
    const evidence = inferSlotEvidence({ slotDetectors, text: textBlob, tokens });
    const slots = Array.from(evidence.keys());
    const motifId = resolveMotif(textBlob);

    const entry = {
      id: cue,
      legacyCue: cue,
      label: slugToLabel(cue),
      patterns,
      feelings,
      needs,
      example,
      slots,
      slotEvidence: Object.fromEntries(
        Array.from(evidence.entries()).map(([slotId, data]) => [slotId, data]),
      ),
    };

    if (!motifEntries.has(motifId)) {
      motifEntries.set(motifId, []);
    }
    motifEntries.get(motifId).push(entry);
  });

  const modules = MOTIF_TEMPLATES.map(template => {
    const entries = motifEntries.get(template.id) || [];
    if (!entries.length && template.id !== 'general-observation') {
      return null;
    }

    const slotSet = new Set(template.slotHints || []);
    const tokenCounts = new Map();
    const patternSet = new Set();
    const exampleSet = new Set();
    const coverage = new Map();

    entries.forEach(entry => {
      entry.patterns.forEach(pattern => {
        if (pattern) {
          patternSet.add(pattern);
        }
      });
      const entryTokens = tokenize(`${entry.patterns.join(' ')} ${entry.example}`);
      entryTokens.forEach(token => {
        if (!token) return;
        if (token.length <= 2) return;
        if (STOPWORDS.has(token)) return;
        tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
      });
      if (entry.example) {
        exampleSet.add(entry.example);
      }
      if (!entry.slots.length && Array.isArray(template.slotHints)) {
        entry.slots = Array.from(new Set(template.slotHints));
      }
      entry.slots.forEach(slotId => {
        slotSet.add(slotId);
        const existing = coverage.get(slotId) || { count: 0 };
        coverage.set(slotId, { count: existing.count + 1 });
      });
    });

    const slotPrompts = Object.assign({}, template.slotPrompts || {});
    const slotCoverage = Object.fromEntries(
      Array.from(coverage.entries()).map(([slotId, info]) => [slotId, info.count]),
    );

    return {
      id: template.id,
      label: template.label,
      summary: template.summary,
      slots: Array.from(slotSet),
      slotPrompts,
      slotCoverage,
      traits: {
        anchors: template.traits?.anchors || [],
        tokens: topValues(tokenCounts, 18),
        patterns: Array.from(patternSet).slice(0, 40),
      },
      examples: Array.from(exampleSet).slice(0, 6),
      entries: entries.sort((a, b) => a.id.localeCompare(b.id)),
    };
  })
    .filter(Boolean)
    .sort((a, b) => {
      const orderA = motifOrder.get(a.id) ?? 0;
      const orderB = motifOrder.get(b.id) ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.id.localeCompare(b.id);
    });

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    motifs: modules,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${modules.length} cue motifs to ${path.relative(root, outputPath)}`);
}

run().catch(error => {
  console.error('Unable to migrate observation cues:', error);
  process.exitCode = 1;
});
