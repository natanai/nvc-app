import { createCueMatchers, createObservationProfile, matchCueRow } from './observationCueMatcher.js';

export async function loadCueCatalog({ cuesUrl, guidesUrl } = {}) {
  const cuesPromise = cuesUrl ? loadCueRows(cuesUrl) : Promise.resolve([]);
  const guidesPromise = guidesUrl ? loadCueGuides(guidesUrl) : Promise.resolve([]);
  const [cues, guides] = await Promise.all([cuesPromise, guidesPromise]);
  return { cues, guides };
}

export async function loadCueRows(csvUrl) {
  const text = await fetch(csvUrl).then(r => r.text());
  const rows = parseCSV(text);
  return rows
    .slice(1)
    .filter(r => r.length >= 5)
    .map(cols => createCueEntry(cols))
    .filter(Boolean);
}

async function loadCueGuides(jsonUrl) {
  let response;
  try {
    response = await fetch(jsonUrl);
  } catch (error) {
    console.warn('Unable to load observation cue guides', error);
    return [];
  }

  if (!response || !response.ok) {
    console.warn('Observation cue guides request failed', response && response.status);
    return [];
  }

  const payloadText = await response.text();
  let raw;
  try {
    raw = JSON.parse(payloadText);
  } catch (error) {
    console.warn('Unable to parse observation cue guides', error);
    return [];
  }

  const list = Array.isArray(raw?.guides)
    ? raw.guides
    : Array.isArray(raw)
    ? raw
    : [];

  return list
    .map((entry, index) => createGuideEntry(entry, index))
    .filter(Boolean);
}

function createCueEntry(cols) {
  if (!Array.isArray(cols) || cols.length < 5) {
    return null;
  }

  const [cue, patternsRaw, feelingsRaw, needsRaw, example] = cols;
  const rawPatterns = (patternsRaw || '')
    .split('|')
    .map(p => (p || '').trim())
    .filter(Boolean);
  const patterns = rawPatterns.map(p => compilePattern(p)).filter(Boolean);
  const feelings = (feelingsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
  const needs = (needsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
  const patternHints = rawPatterns.map(p => formatCuePhrase(p)).filter(Boolean);
  const cueValue = (cue || '').trim();
  const exampleText = (example || '').trim();
  const matchers = createCueMatchers({ patterns: rawPatterns, example: exampleText });

  return {
    cue: cueValue,
    label: formatCueLabel(cueValue),
    patterns,
    feelings,
    needs,
    example: exampleText,
    phrase: chooseCuePhrase(patternHints, cueValue),
    phrases: patternHints,
    matchers,
  };
}

function createGuideEntry(raw, index = 0) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const idSource = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : null;
  const cueValue = idSource || (typeof raw.cue === 'string' && raw.cue.trim() ? raw.cue.trim() : `guide-${index}`);
  const type = typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim() : 'guide';
  const group = raw.group === 'lead' || raw.group === 'tail' ? raw.group : 'tail';
  const orderValue = Number(raw.order);
  const order = Number.isFinite(orderValue) ? orderValue : 0;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  const patternsRaw = Array.isArray(raw.patterns)
    ? raw.patterns.map(p => (typeof p === 'string' ? p.trim() : '')).filter(Boolean)
    : [];
  const patterns = patternsRaw.map(pattern => compilePattern(pattern)).filter(Boolean);
  const exampleText = typeof raw.example === 'string' ? raw.example.trim() : '';
  const matchers = createCueMatchers({ patterns: patternsRaw, example: exampleText });

  if (!patterns.length && (!matchers || !matchers.length)) {
    return null;
  }

  return {
    id: cueValue,
    cue: cueValue,
    type,
    group,
    order,
    text,
    patterns,
    matchers,
  };
}

function compilePattern(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return null;
  }

  const attempts = [trimmed];
  const sanitized = trimmed.replace(/\.\?\*/g, '.*');
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

  console.warn('Skipping invalid observation cue pattern', trimmed);
  return null;
}

function formatCuePhrase(rawPattern) {
  const trimmed = typeof rawPattern === 'string' ? rawPattern.trim() : '';
  if (!trimmed) {
    return '';
  }
  const withoutAnchors = trimmed.replace(/^[\^]/, '').replace(/[\$]$/, '');
  return withoutAnchors
    .replace(/\\b/g, '')
    .replace(/\.\*/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCueLabel(slug) {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (!trimmed) {
    return '';
  }
  const spaced = trimmed.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced
    .split(' ')
    .map(token => (token ? token[0].toUpperCase() + token.slice(1) : ''))
    .join(' ');
}

function chooseCuePhrase(patternHints, cueValue) {
  const candidates = Array.isArray(patternHints) ? patternHints.filter(Boolean) : [];
  if (candidates.length) {
    const sorted = [...new Set(candidates)].sort((a, b) => a.length - b.length);
    return sorted[0];
  }
  const fallbackLabel = formatCueLabel(cueValue);
  if (fallbackLabel) {
    return fallbackLabel;
  }
  const fallback = formatCuePhrase(cueValue);
  return fallback || cueValue || '';
}

export function suggestFromObservation(text, cues, maxEach = 6) {
  const profile = createObservationProfile(text);
  const hits = cues.filter(row => matchCueRow(profile, row));
  const feelings = [...new Set(hits.flatMap(h => h.feelings))].slice(0, maxEach);
  const needs = [...new Set(hits.flatMap(h => h.needs))].slice(0, maxEach);
  const why = hits.map(h => h.cue);
  return { feelings, needs, why, hits };
}

export function matchCueGuides(text, guides) {
  const profile = createObservationProfile(text);
  const matchedIds = new Set();
  const matches = [];

  (Array.isArray(guides) ? guides : []).forEach(guide => {
    if (!guide) {
      return;
    }
    const matched = matchCueRow(profile, guide);
    if (matched) {
      matchedIds.add(guide.id || guide.cue);
    }
    matches.push({ guide, matched });
  });

  return { matchedIds, matches };
}

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      if (inQ && str[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
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
      if (ch === '\r' && str[i + 1] === '\n') i++;
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
