export async function loadCueRows(csvUrl) {
  const text = await fetch(csvUrl).then(r => r.text());
  const rows = parseCSV(text);
  return rows.slice(1).filter(r => r.length >= 5).map(cols => {
    const [cue, patternsRaw, feelingsRaw, needsRaw, example] = cols;
    const rawPatterns = splitCuePatterns(patternsRaw);
    const patterns = rawPatterns
      .map(p => compilePattern(p))
      .filter(Boolean);
    const feelings = (feelingsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
    const needs = (needsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
    const patternHints = rawPatterns.map(p => formatCuePhrase(p)).filter(Boolean);
    const cueValue = (cue || '').trim();
    return {
      cue: cueValue,
      label: formatCueLabel(cueValue),
      patterns,
      feelings,
      needs,
      example: (example || '').trim(),
      phrase: chooseCuePhrase(patternHints, cueValue),
      phrases: patternHints,
    };
  });
}

const PIPE_SENTINEL = '\u001F';

export function splitCuePatterns(raw) {
  const value = typeof raw === 'string' ? raw : '';
  if (!value) {
    return [];
  }

  const parts = [];
  let current = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const next = value[i + 1];
    if (ch === '\\' && next === '|') {
      current += PIPE_SENTINEL;
      i += 1;
    } else if (ch === '|') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);

  const sentinelRegex = new RegExp(PIPE_SENTINEL, 'g');
  return parts
    .map(part => (part || '').replace(sentinelRegex, '|').trim())
    .filter(Boolean);
}

export function preparePattern(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return null;
  }

  const hasMeta = hasRegexMeta(trimmed);
  if (!hasMeta) {
    return {
      source: trimmed,
      attempts: [escapeLiteralPattern(trimmed)],
      isLiteral: true,
    };
  }

  const validation = validatePatternDialect(trimmed);
  if (!validation.ok) {
    return {
      source: trimmed,
      attempts: [],
      isLiteral: false,
      error: validation.reason,
    };
  }

  const attempts = [trimmed];
  const sanitized = trimmed.replace(/\.\?\*/g, '.*');
  if (sanitized !== trimmed) {
    attempts.push(sanitized);
  }

  return {
    source: trimmed,
    attempts,
    isLiteral: false,
  };
}

export function compilePattern(raw) {
  const prepared = preparePattern(raw);
  if (!prepared || !prepared.attempts.length) {
    if (prepared && prepared.error) {
      console.warn('Skipping invalid observation cue pattern', prepared.source, prepared.error);
    }
    return null;
  }

  let lastError = null;
  for (const attempt of prepared.attempts) {
    try {
      const compiled = new RegExp(attempt, 'i');
      compiled.__patternMeta = {
        raw: prepared.source,
        isLiteral: prepared.isLiteral,
      };
      return compiled;
    } catch (error) {
      lastError = error;
    }
  }

  console.warn('Skipping invalid observation cue pattern', prepared.source, lastError?.message || 'compile failed');
  return null;
}

function escapeLiteralPattern(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasRegexMeta(str) {
  if (!str) {
    return false;
  }
  if (/\\b/.test(str)) {
    return true;
  }
  if (/\\['’]/.test(str)) {
    return true;
  }
  if (/\(\?(?:[:=!<])/.test(str)) {
    return true;
  }
  if (/[|^$]/.test(str)) {
    return true;
  }
  if (str.includes('.*')) {
    return true;
  }
  if (/\[/.test(str) || /\]/.test(str)) {
    return true;
  }
  return false;
}

function validatePatternDialect(pattern) {
  if (/\(\?<[-=]/.test(pattern)) {
    return { ok: false, reason: 'lookbehind is not supported' };
  }
  if (/\\[1-9]/.test(pattern)) {
    return { ok: false, reason: 'backreferences are not supported' };
  }

  const groupStack = [];
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    const prev = pattern[i - 1];
    const next = pattern[i + 1];

    if (ch === '\\') {
      if (!next) {
        return { ok: false, reason: 'dangling escape' };
      }
      if (!['b', '\\', '|', "'", '’'].includes(next)) {
        return { ok: false, reason: `unsupported escape \\${next}` };
      }
      i += 1;
      continue;
    }

    if (ch === '[') {
      const closeIndex = pattern.indexOf(']', i + 1);
      if (closeIndex === -1) {
        return { ok: false, reason: 'unterminated character class' };
      }
      const content = pattern.slice(i + 1, closeIndex);
      if (!/^['’]+$/.test(content)) {
        return { ok: false, reason: 'only apostrophes may appear in []' };
      }
      i = closeIndex;
      continue;
    }

    if (ch === '(') {
      if (groupStack.length > 0) {
        return { ok: false, reason: 'nested groups are not supported' };
      }
      if (pattern.slice(i, i + 3) !== '(?:') {
        return { ok: false, reason: 'only non-capturing groups (?: ) are supported' };
      }
      groupStack.push('?:');
      i += 2;
      continue;
    }

    if (ch === ')') {
      if (!groupStack.length) {
        return { ok: false, reason: 'unmatched )' };
      }
      groupStack.pop();
      if (pattern[i + 1] === '?' && groupStack.length > 0) {
        return { ok: false, reason: 'optional groups cannot be nested' };
      }
      continue;
    }

    if (ch === '?') {
      if (prev !== ')') {
        return { ok: false, reason: 'standalone ? is not supported' };
      }
      continue;
    }

    if (ch === '+') {
      return { ok: false, reason: '+ quantifier is not supported' };
    }

    if (ch === '{' || ch === '}') {
      return { ok: false, reason: 'bounded quantifiers {n} are not supported' };
    }

    if (ch === '.') {
      if (prev === '\\') {
        continue;
      }
      if (next !== '*') {
        return { ok: false, reason: 'only .* wildcards are supported' };
      }
      continue;
    }

    if (ch === '*') {
      if (prev !== '.') {
        return { ok: false, reason: '* must follow . for .* wildcard' };
      }
      continue;
    }
  }

  if (groupStack.length) {
    return { ok: false, reason: 'unclosed group' };
  }

  return { ok: true };
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
  const lower = (text || '').toLowerCase();
  const hits = cues.filter(row => row.patterns.some(rx => rx.test(lower)));
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
