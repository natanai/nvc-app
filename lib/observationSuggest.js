import { createCueMatchers, createObservationProfile, matchCueRow } from './observationCueMatcher.js';

export async function loadCueRows(csvUrl) {
  const text = await fetch(csvUrl).then(r => r.text());
  const rows = parseCSV(text);
  return rows.slice(1).filter(r => r.length >= 5).map(cols => {
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
  });
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
