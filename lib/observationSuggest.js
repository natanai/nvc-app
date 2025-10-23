import { createCueMatchers, createObservationProfile, matchCueRow } from './observationCueMatcher.js';

export async function loadCueCatalog({ schemaUrl, modulesUrl } = {}) {
  const schema = schemaUrl ? await loadObservationSchema(schemaUrl) : null;
  const modules = modulesUrl ? await loadCueModules(modulesUrl, schema) : [];
  return { schema, modules };
}

export async function loadObservationSchema(url) {
  const raw = await fetchJson(url);
  return parseObservationSchema(raw);
}

export async function loadCueModules(url, schema) {
  const raw = await fetchJson(url);
  return parseCueModules(raw, schema);
}

export function parseObservationSchema(raw) {
  const schema = { schemaVersion: Number(raw?.schemaVersion) || 1, slots: [] };
  const slots = Array.isArray(raw?.slots) ? raw.slots : [];
  const seen = new Set();
  slots.forEach(slot => {
    if (!slot || typeof slot !== 'object') {
      return;
    }
    const id = typeof slot.id === 'string' ? slot.id.trim() : '';
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    const prompt = typeof slot.prompt === 'string' ? slot.prompt.trim() : '';
    const label = typeof slot.label === 'string' ? slot.label.trim() : '';
    const description = typeof slot.description === 'string' ? slot.description.trim() : '';
    const group = slot.group === 'lead' || slot.group === 'tail' ? slot.group : 'tail';
    const order = Number.isFinite(Number(slot.order)) ? Number(slot.order) : 0;
    const chips = Array.isArray(slot.chips) ? slot.chips.filter(Boolean) : [];
    const suggestions = Array.isArray(slot.suggestions) ? slot.suggestions.filter(Boolean) : [];
    const patterns = Array.isArray(slot.patterns) ? slot.patterns.filter(Boolean) : [];
    const compiledPatterns = patterns
      .map(pattern => compilePattern(pattern))
      .filter(Boolean);
    const traitTokens = Array.isArray(slot.traits?.tokens)
      ? slot.traits.tokens
          .map(token => (typeof token === 'string' ? token.toLowerCase().trim() : ''))
          .filter(Boolean)
      : [];
    const traitAnchors = Array.isArray(slot.traits?.anchors)
      ? slot.traits.anchors.map(anchor => (typeof anchor === 'string' ? anchor.trim() : '')).filter(Boolean)
      : [];
    const traitSyntactic = Array.isArray(slot.traits?.syntactic)
      ? slot.traits.syntactic.map(entry => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)
      : [];

    schema.slots.push({
      ...slot,
      id,
      prompt,
      label,
      description,
      group,
      order,
      chips,
      suggestions,
      patterns,
      compiledPatterns,
      detectorTokens: traitTokens,
      traitAnchors,
      traitSyntactic,
      traits: {
        tokens: traitTokens,
        anchors: traitAnchors,
        syntactic: traitSyntactic,
      },
    });
  });
  schema.slots.sort((a, b) => a.order - b.order);
  return schema;
}

export function parseCueModules(raw, schema) {
  const slotIds = new Set(Array.isArray(schema?.slots) ? schema.slots.map(slot => slot.id) : []);
  const motifs = Array.isArray(raw?.motifs) ? raw.motifs : [];
  return motifs
    .map(motif => normalizeMotif(motif, slotIds))
    .filter(module => module.entries.length > 0);
}

function formatEntryLabel(slug) {
  if (!slug) {
    return '';
  }
  return slug
    .split(/[-_]+/)
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

export function suggestFromObservation(text, modules = [], schema, options = {}) {
  const maxEach = typeof options.maxEach === 'number' ? options.maxEach : 6;
  const profile = createObservationProfile(text, { schema });
  const hits = [];
  const motifMatches = [];

  modules.forEach(module => {
    const entryHits = [];
    (module.entries || []).forEach(entry => {
      const match = matchCueRow(profile, entry, { schema });
      if (match) {
        const wrapped = { module, entry, match };
        hits.push(wrapped);
        entryHits.push(wrapped);
      }
    });
    if (entryHits.length) {
      motifMatches.push({ module, entries: entryHits });
    }
  });

  const feelings = uniqueList(hits.flatMap(hit => hit.entry.feelings || [])).slice(0, maxEach);
  const needs = uniqueList(hits.flatMap(hit => hit.entry.needs || [])).slice(0, maxEach);
  const why = hits.map(hit => hit.entry.id);
  const slotCoverage = buildSlotCoverage(schema, profile, hits, modules);

  return { feelings, needs, why, hits, motifs: motifMatches, profile, slotCoverage, features: profile.features };
}

function buildSlotCoverage(schema, profile, hits, modules) {
  const result = {};
  const slotList = Array.isArray(schema?.slots) ? schema.slots : [];
  slotList.forEach(slot => {
    const slotProfile = profile.slots?.[slot.id] || { tokens: [], patterns: [] };
    result[slot.id] = {
      id: slot.id,
      slot,
      filled: Boolean((slotProfile.tokens?.length || 0) + (slotProfile.patterns?.length || 0)),
      tokens: Array.from(slotProfile.tokens || []),
      patterns: Array.from(slotProfile.patterns || []),
      count: Number(slotProfile.count) || 0,
      modules: [],
      prompts: Array.isArray(slot.suggestions) ? Array.from(new Set(slot.suggestions)) : [],
    };
  });

  hits.forEach(hit => {
    (hit.match?.slots || []).forEach(slotMatch => {
      if (!result[slotMatch.id]) {
        result[slotMatch.id] = {
          id: slotMatch.id,
          slot: slotList.find(item => item.id === slotMatch.id) || null,
          filled: false,
          tokens: [],
          patterns: [],
          modules: [],
          prompts: [],
        };
      }
      const entryCoverage = result[slotMatch.id];
      entryCoverage.tokens = uniqueList([...(entryCoverage.tokens || []), ...(slotMatch.tokens || [])]);
      entryCoverage.patterns = uniqueList([...(entryCoverage.patterns || []), ...(slotMatch.patterns || [])]);
      if (slotMatch.matched) {
        entryCoverage.filled = true;
      }
      const modulePrompts = Array.isArray(hit.module?.slotPrompts?.[slotMatch.id])
        ? hit.module.slotPrompts[slotMatch.id]
        : [];
      entryCoverage.prompts = uniqueList([...(entryCoverage.prompts || []), ...modulePrompts]);
      entryCoverage.modules = entryCoverage.modules || [];
      const slotFeature = Array.isArray(hit.match?.features?.slots)
        ? hit.match.features.slots.find(item => item.id === slotMatch.id)
        : null;
      entryCoverage.modules.push({
        moduleId: hit.module?.id || '',
        entryId: hit.entry?.id || '',
        prompts: modulePrompts,
        example: hit.entry?.example || '',
        slotFeature,
      });
    });
  });

  modules.forEach(module => {
    const prompts = module.slotPrompts || {};
    Object.keys(prompts).forEach(slotId => {
      if (!result[slotId]) {
        result[slotId] = {
          id: slotId,
          slot: slotList.find(item => item.id === slotId) || null,
          filled: false,
          tokens: [],
          patterns: [],
          modules: [],
          prompts: uniqueList(prompts[slotId] || []),
        };
      } else {
        result[slotId].prompts = uniqueList([...(result[slotId].prompts || []), ...(prompts[slotId] || [])]);
      }
    });
  });

  return result;
}

function normalizeMotif(motif, slotIds) {
  const entries = Array.isArray(motif?.entries) ? motif.entries.map(entry => normalizeEntry(entry, slotIds)) : [];
  const filteredEntries = entries.filter(entry => entry !== null);
  const slotPrompts = motif?.slotPrompts && typeof motif.slotPrompts === 'object' ? motif.slotPrompts : {};
  const traits = normalizeMotifTraits(motif?.traits);
  return {
    id: typeof motif?.id === 'string' ? motif.id.trim() : '',
    label: typeof motif?.label === 'string' ? motif.label.trim() : '',
    summary: typeof motif?.summary === 'string' ? motif.summary.trim() : '',
    slots: Array.isArray(motif?.slots) ? motif.slots.filter(slotId => slotIds.has(slotId)) : [],
    slotPrompts,
    slotCoverage: motif?.slotCoverage || {},
    traits,
    traitTokens: traits.tokens,
    traitCompiledPatterns: traits.compiledPatterns,
    examples: Array.isArray(motif?.examples) ? motif.examples.filter(Boolean) : [],
    entries: filteredEntries,
  };
}

function normalizeEntry(entry, slotIds) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id) {
    return null;
  }
  const label = typeof entry.label === 'string' ? entry.label.trim() : formatEntryLabel(id);
  const example = typeof entry.example === 'string' ? entry.example.trim() : '';
  const patterns = Array.isArray(entry.patterns) ? entry.patterns.filter(Boolean) : [];
  const compiledPatterns = patterns.map(pattern => compilePattern(pattern)).filter(Boolean);
  const matchers = createCueMatchers({ patterns, example });
  const feelings = Array.isArray(entry.feelings) ? entry.feelings.filter(Boolean) : [];
  const needs = Array.isArray(entry.needs) ? entry.needs.filter(Boolean) : [];
  const slots = Array.isArray(entry.slots) ? entry.slots.filter(slotId => slotIds.has(slotId)) : [];
  const slotEvidenceRaw = entry.slotEvidence && typeof entry.slotEvidence === 'object' ? entry.slotEvidence : {};
  const slotEvidenceCompiled = {};
  Object.entries(slotEvidenceRaw).forEach(([slotId, evidence]) => {
    if (!slotIds.has(slotId) || !evidence) {
      return;
    }
    const evidenceTokens = Array.isArray(evidence.tokens)
      ? evidence.tokens.map(token => (typeof token === 'string' ? token.toLowerCase().trim() : '')).filter(Boolean)
      : [];
    const evidencePatterns = Array.isArray(evidence.patterns) ? evidence.patterns.filter(Boolean) : [];
    slotEvidenceCompiled[slotId] = {
      tokens: evidenceTokens,
      compiledPatterns: evidencePatterns.map(pattern => compilePattern(pattern)).filter(Boolean),
    };
  });

  return {
    ...entry,
    id,
    cue: entry.cue || id,
    label,
    example,
    patterns,
    compiledPatterns,
    matchers,
    feelings,
    needs,
    slots,
    slotEvidence: slotEvidenceRaw,
    slotEvidenceCompiled,
  };
}

function normalizeMotifTraits(raw) {
  if (!raw || typeof raw !== 'object') {
    return { anchors: [], tokens: [], patterns: [], compiledPatterns: [] };
  }
  const anchors = Array.isArray(raw.anchors)
    ? raw.anchors.map(anchor => (typeof anchor === 'string' ? anchor.trim() : '')).filter(Boolean)
    : [];
  const tokens = Array.isArray(raw.tokens)
    ? raw.tokens.map(token => (typeof token === 'string' ? token.toLowerCase().trim() : '')).filter(Boolean)
    : [];
  const patterns = Array.isArray(raw.patterns) ? raw.patterns.filter(Boolean) : [];
  const compiledPatterns = patterns.map(pattern => compilePattern(pattern)).filter(Boolean);
  return { anchors, tokens, patterns, compiledPatterns };
}

function uniqueList(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map(item => (typeof item === 'string' ? item.trim() : item)).filter(Boolean)));
}

async function fetchJson(url) {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const response = await window.fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed for ${url}: ${response.status}`);
    }
    return response.json();
  }
  if (typeof fetch === 'function' && /^https?:/i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed for ${url}: ${response.status}`);
    }
    return response.json();
  }
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const cleaned = url.replace(/^\//, '');
  const filePath = resolve(process.cwd(), cleaned);
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

function compilePattern(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return null;
  }
  const attempts = [trimmed];
  const sanitized = trimmed.replace(/\\.\\?\\*/g, '.*');
  if (sanitized !== trimmed) {
    attempts.push(sanitized);
  }
  for (const attempt of attempts) {
    try {
      return new RegExp(attempt, 'i');
    } catch (error) {
      // continue
    }
  }
  return null;
}
