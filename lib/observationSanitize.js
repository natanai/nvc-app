import { lintObservation, DIRECT_QUOTE_REGEX } from './nvcLint.js';

export function sanitizeObservationText(text, catalog) {
  const source = typeof text === 'string' ? text : '';
  const trimmed = source.trim();
  if (!trimmed) {
    return '';
  }

  const catalogRef = catalog || { feelings: new Map(), needs: new Map(), fauxFeelings: new Map() };
  const initialLint = lintObservation(trimmed, catalogRef);
  if (initialLint.ok) {
    return normalizeWhitespace(trimmed);
  }

  const segments = splitIntoSegments(trimmed);
  if (!segments.length) {
    return sanitizeSegment(trimmed, catalogRef);
  }

  const sanitizedSegments = segments
    .map(segment => sanitizeSegment(segment, catalogRef))
    .filter(Boolean);

  const result = sanitizedSegments.join(' ').trim();
  return result;
}

function sanitizeSegment(segment, catalog) {
  const trimmed = typeof segment === 'string' ? segment.trim() : '';
  if (!trimmed) {
    return '';
  }

  const lint = lintObservation(trimmed, catalog);
  if (lint.ok) {
    return normalizeWhitespace(trimmed);
  }

  if (hasBlockingFlags(lint)) {
    return '';
  }

  const stripped = stripFlaggedTokens(trimmed, lint);
  if (!stripped) {
    return '';
  }

  const finalLint = lintObservation(stripped, catalog);
  if (!finalLint.ok) {
    return '';
  }

  return stripped;
}

function stripFlaggedTokens(text, lint) {
  const tokens = collectFlaggedTokens(lint);
  if (!tokens.length) {
    return normalizeWhitespace(text);
  }

  let sanitized = text;
  tokens.forEach(token => {
    const regex = buildPreviewTokenRegex(token);
    if (!regex) return;
    sanitized = replaceOutsideQuotes(sanitized, regex);
  });

  const normalized = normalizeWhitespace(sanitized);
  return /[\p{L}\p{N}]/u.test(normalized) ? normalized : '';
}

function hasBlockingFlags(lint) {
  if (!lint || typeof lint !== 'object') {
    return true;
  }

  const salvageableGroups = new Set(['speculationLanguage', 'thinkingLanguage', 'vagueQuantifiers']);
  const flaggedKeys = new Set((lint.flaggedGroups || []).map(group => group?.key).filter(Boolean));
  const hasHardGroup = [...flaggedKeys].some(key => !salvageableGroups.has(key));

  const hasCatalogFlags =
    (lint.fauxFeelings && lint.fauxFeelings.length > 0) ||
    (lint.feelings && lint.feelings.length > 0) ||
    (lint.needs && lint.needs.length > 0);

  const hasEvaluationFlags =
    (lint.evaluationMarkers && lint.evaluationMarkers.length > 0) ||
    (lint.agentiveMarkers && lint.agentiveMarkers.length > 0);

  return hasHardGroup || hasCatalogFlags || hasEvaluationFlags;
}

function collectFlaggedTokens(lint) {
  if (!lint || typeof lint !== 'object') {
    return [];
  }

  const matches = [];
  const groups = Array.isArray(lint.flaggedGroups) ? lint.flaggedGroups : [];
  groups.forEach(group => {
    (group.matches || []).forEach(match => {
      const token = typeof match === 'string' ? match.trim() : '';
      if (token) {
        matches.push(token);
      }
    });
  });

  const evaluations = uniqueStrings([...(lint.evaluationMarkers || []), ...(lint.agentiveMarkers || [])]);
  evaluations.forEach(token => {
    if (token) {
      matches.push(token);
    }
  });

  return uniqueStrings(matches);
}

function splitIntoSegments(text) {
  if (typeof text !== 'string') {
    return [];
  }
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function replaceOutsideQuotes(text, regex) {
  if (!text) {
    return '';
  }
  const ranges = findQuoteRanges(text);
  return text.replace(regex, (match, ...args) => {
    const offset = typeof args[args.length - 2] === 'number' ? args[args.length - 2] : 0;
    const insideQuote = ranges.some(range => offset >= range.start && offset < range.end);
    if (insideQuote) {
      return match;
    }
    return ' '.repeat(match.length);
  });
}

function buildPreviewTokenRegex(token) {
  const trimmed = typeof token === 'string' ? token.trim() : '';
  if (!trimmed) {
    return null;
  }
  const escaped = escapeRegExpLiteral(trimmed);
  if (!escaped) {
    return null;
  }
  const needsWordBoundary = /^[\w\s]+$/.test(trimmed);
  const pattern = needsWordBoundary ? `\\b${escaped}\\b` : escaped;
  return new RegExp(pattern, 'gi');
}

function escapeRegExpLiteral(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findQuoteRanges(text) {
  if (typeof text !== 'string' || !text) {
    return [];
  }
  const ranges = [];
  const regex = new RegExp(DIRECT_QUOTE_REGEX.source, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    const segment = match[0] || '';
    ranges.push({ start: match.index, end: match.index + segment.length });
    if (segment.length === 0) {
      regex.lastIndex++;
    }
  }
  return ranges;
}

function normalizeWhitespace(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])(\s*[,.!?;:]+)/g, '$1')
    .trim();
}

function uniqueStrings(items) {
  if (!Array.isArray(items)) {
    return [];
  }
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
