import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeObservationPlaceholders } from '../lib/observationPlaceholders.js';
import { slugify as slugifyLabel } from '../lib/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const needsCsvPath = join(rootDir, 'data', 'Needs.csv');
const blueprintPath = join(rootDir, 'data', 'observation_module_blueprints.json');
const needTemplatePath = join(rootDir, 'data', 'observation_need_templates.json');


function main() {
  const categoryTemplates = loadCategoryTemplates(needTemplatePath);
  const { needs, feelingsByCategory } = loadNeeds();
  const modules = [];
  needs.forEach(need => {
    const module = createModuleForNeed(need, feelingsByCategory, categoryTemplates);
    if (module) {
      modules.push(module);
    }
  });
  const blueprint = { modules };
  writeFileSync(blueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`);
}

function loadCategoryTemplates(path = needTemplatePath) {
  const text = readFileSync(path, 'utf8');
  const data = JSON.parse(text);
  const templates = new Map();
  if (!data || typeof data !== 'object') {
    return templates;
  }
  Object.entries(data).forEach(([category, template]) => {
    if (!category || !template || typeof template !== 'object') {
      return;
    }
    const slotIds = Array.isArray(template.slotIds) ? template.slotIds.filter(Boolean) : [];
    const cues = Array.isArray(template.cues)
      ? template.cues
          .map(cue => ({
            suffix: String(cue?.suffix || '').trim(),
            example: String(cue?.example || '').trim(),
            patterns: Array.isArray(cue?.patterns) ? cue.patterns.filter(Boolean).map(String) : [],
          }))
          .filter(cue => cue.suffix && cue.example && cue.patterns.length)
      : [];
    if (!slotIds.length || !cues.length) {
      return;
    }
    templates.set(category, { slotIds, cues });
  });
  return templates;
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

function createModuleForNeed(need, feelingsByCategory, categoryTemplates) {
  const template = categoryTemplates.get(need.category);
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
