const FLAG_GUIDANCE = 'Try swapping in a time/place anchor, a quote, a count or measure, or a link to an artifact.';
let flagConfig = createEmptyFlagConfig();
let flagLoadPromise = null;

export async function loadObservationFlags(csvUrl = '/data/observation_flags.csv') {
  if (!csvUrl) {
    return flagConfig;
  }
  if (typeof fetch !== 'function') {
    return flagConfig;
  }
  if (!flagLoadPromise) {
    flagLoadPromise = fetch(csvUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load observation flags: ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        try {
          const rows = parseCSV(text);
          const config = buildFlagConfig(rows);
          flagConfig = config;
          return config;
        } catch (error) {
          console.error('Unable to parse observation flags CSV', error);
          return flagConfig;
        }
      })
      .catch(error => {
        console.error('Failed to load observation flags', error);
        return flagConfig;
      });
  }
  return flagLoadPromise;
}

export function lintObservation(text, catalog) {
  const source = typeof text === 'string' ? text : '';
  const evaluationMatches = collectPatternMatches(source, flagConfig.evaluationPatterns);
  const evaluationMarkers = evaluationMatches.map(match => match.label);
  const agentiveMatches = collectRegexMatches(source, flagConfig.agentivePatterns);
  const agentiveMarkers = agentiveMatches.map(match => match.label);
  const flaggedGroups = collectFlaggedGroups(source, flagConfig.groups);
  const evaluationReasonMap = createReasonMap(evaluationMatches);
  const agentiveReasonMap = createReasonMap(agentiveMatches);
  const fauxFeelings = matchCatalogTerms(source, catalog, 'fauxFeelings');
  const feelings = matchCatalogTerms(source, catalog, 'feelings');
  const needs = matchCatalogTerms(source, catalog, 'needs');

  const nonObservationalCount =
    evaluationMarkers.length +
    agentiveMarkers.length +
    flaggedGroups.reduce((sum, group) => sum + (group.matches?.length || 0), 0) +
    fauxFeelings.length +
    feelings.length +
    needs.length;

  const groupMatches = flaggedGroups.flatMap(group => group.matches || []);
  const hits = uniqueStrings([...evaluationMarkers, ...agentiveMarkers, ...groupMatches]);

  return {
    ok: nonObservationalCount === 0,
    hits,
    evaluationMarkers: uniqueStrings(evaluationMarkers),
    agentiveMarkers,
    flaggedGroups,
    fauxFeelings,
    feelings,
    needs,
    flagReasons: {
      evaluation: evaluationReasonMap,
      agentive: agentiveReasonMap,
    },
  };
}

export function scaffoldRewrite(input = {}) {
  const parts = [];
  if (input.when) parts.push(input.when.trim());
  if (input.what) parts.push(input.what.trim());
  const core = parts.filter(Boolean).join(', ');
  const gap = input.gap && input.gap.trim() ? ` I had hoped ${input.gap.trim()}.` : '';
  return core ? core + '.' + gap : '';
}

function collectPatternMatches(text, patterns) {
  if (!Array.isArray(patterns)) return [];
  const seen = new Set();
  const matches = [];
  patterns.forEach(item => {
    if (!item || !item.regex) return;
    if (item.regex.test(text)) {
      const label = item.label || item.regex.source;
      if (!label) return;
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({ label, reason: item.reason || '', advice: item.advice || '' });
      }
    }
  });
  return matches;
}

function collectRegexMatches(text, patterns) {
  if (!Array.isArray(patterns)) return [];
  const seen = new Set();
  const matches = [];
  patterns.forEach(item => {
    const regex = item instanceof RegExp ? item : item?.regex;
    if (!(regex instanceof RegExp)) return;
    const exec = regex.exec(text);
    if (exec && exec[0]) {
      const label = item?.label || exec[0];
      if (!label) return;
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({ label, reason: item?.reason || '', advice: item?.advice || '' });
      }
    }
  });
  return matches;
}

function collectFlaggedGroups(text, groupsConfig) {
  if (!Array.isArray(groupsConfig) || !groupsConfig.length) return [];
  const groups = [];
  groupsConfig.forEach(group => {
    const matches = collectPatternMatches(text, group.patterns);
    if (matches.length) {
      groups.push({
        key: group.key,
        label: group.label,
        advice: group.advice,
        why: group.why,
        matches: matches.map(match => match.label),
        matchReasons: createReasonMap(matches),
      });
    }
  });
  return groups;
}

function matchCatalogTerms(text, catalog, key) {
  if (!catalog || !catalog[key] || typeof catalog[key].forEach !== 'function') {
    return [];
  }

  const cacheKey = `__${key}Matchers`;
  if (!catalog[cacheKey]) {
    catalog[cacheKey] = buildCatalogMatchers(catalog[key]);
  }

  const matchers = catalog[cacheKey] || [];
  const matches = [];
  const seen = new Set();
  matchers.forEach(matcher => {
    if (!matcher?.regex) return;
    if (matcher.regex.test(text) && !seen.has(matcher.slug)) {
      seen.add(matcher.slug);
      matches.push(matcher.slug);
    }
  });
  return matches;
}

function buildCatalogMatchers(map) {
  const list = [];
  if (!map || typeof map.forEach !== 'function') {
    return list;
  }

  map.forEach((value, slug) => {
    const labels = new Set();
    if (value?.title) labels.add(value.title);
    if (slug) labels.add(slug.replace(/-/g, ' '));
    if (Array.isArray(value?.aliases)) {
      value.aliases.forEach(alias => {
        if (alias) labels.add(alias);
      });
    }
    labels.forEach(label => {
      const regex = buildWordRegex(label);
      if (regex) {
        list.push({ slug, regex });
      }
    });
  });

  return list;
}

function buildWordRegex(term) {
  if (typeof term !== 'string') return null;
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  const tokens = normalized.split(/[^a-z0-9'’]+/).filter(Boolean);
  if (!tokens.length) return null;
  const pattern = tokens
    .map(token => token.replace(/['’]/g, "['’]?"))
    .join('\\s+');
  if (!pattern) return null;
  return new RegExp(`\\b${pattern}(?:['’]s)?\\b`, 'i');
}

function uniqueStrings(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  const seen = new Set();
  items.forEach(item => {
    if (!item) return;
    const key = String(item).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function createEmptyFlagConfig() {
  return {
    evaluationPatterns: [],
    agentivePatterns: [],
    groups: [],
  };
}

function buildFlagConfig(rows) {
  if (!rows || !rows.length) {
    return createEmptyFlagConfig();
  }

  const [header, ...body] = rows;
  const keys = header.map(col => col.replace(/^﻿/, '').trim());
  const records = body
    .map(cols => {
      const record = {};
      for (let i = 0; i < keys.length; i += 1) {
        record[keys[i]] = (cols[i] || '').trim();
      }
      return record;
    })
    .filter(record => record.trigger || record.pattern);

  const evaluationPatterns = [];
  const agentivePatterns = [];
  const groupMap = new Map();

  records.forEach(record => {
    const bucket = (record.bucket || '').toLowerCase();
    const label = record.trigger || record.pattern;
    const pattern = buildPattern(record);
    if (!pattern) return;
    const reason = record.why || '';
    const advice = record.advice || '';

    if (bucket === 'evaluation') {
      evaluationPatterns.push({ label, regex: pattern, reason, advice });
      return;
    }

    if (bucket === 'agentive') {
      agentivePatterns.push({ label, regex: pattern, reason, advice });
      return;
    }

    const key = record.category_key || label || `group-${groupMap.size + 1}`;
    const existing = groupMap.get(key) || {
      key,
      label: record.category_label || key,
      advice: advice || FLAG_GUIDANCE,
      why: reason,
      patterns: [],
    };
    if (record.category_label) {
      existing.label = record.category_label;
    }
    if (reason && !existing.why) {
      existing.why = reason;
    }
    if (advice) {
      existing.advice = advice;
    }
    existing.patterns.push({ label, regex: pattern, reason, advice });
    groupMap.set(key, existing);
  });

  return {
    evaluationPatterns,
    agentivePatterns,
    groups: Array.from(groupMap.values()).map(group => ({
      key: group.key,
      label: group.label,
      advice: group.advice || FLAG_GUIDANCE,
      why: group.why || '',
      patterns: group.patterns,
    })),
  };
}

function buildPattern(record) {
  if (record.pattern) {
    try {
      return new RegExp(record.pattern, 'i');
    } catch (error) {
      console.error('Invalid regex in observation flags', record.pattern, error);
      return null;
    }
  }
  return buildWordRegex(record.trigger);
}

function createReasonMap(matches) {
  const out = {};
  (matches || []).forEach(match => {
    const label = typeof match?.label === 'string' ? match.label.trim() : '';
    if (!label) return;
    const key = label.toLowerCase();
    if (!match.reason && !match.advice) return;
    out[key] = {
      reason: match.reason || '',
      advice: match.advice || '',
    };
  });
  return out;
}

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch === '\"') {
      if (inQ && str[i + 1] === '\"') {
        cur += '\"';
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (cur.length || row.length) {
        row.push(cur);
        out.push(row);
        row = [];
        cur = '';
      }
      if (ch === '\r' && str[i + 1] === '\n') i += 1;
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
