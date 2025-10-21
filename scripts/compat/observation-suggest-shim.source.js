// Auto-generated file. Run scripts/compat/build-observation-suggest-shim.mjs to update.
const BASES = ["/public/next", "/next", "/public"];
const DEFAULT_CSV = "/data/observation_cues.sanitized.csv";

let cuesPromise = null;
let nearestPromise = null;

function dedupe(values) {
  return [...new Set((values || []).map(value => (typeof value === "string" ? value.trim() : "")).filter(Boolean))];
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
}

function cleanSlug(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return "";
  }
  return trimmed.toLowerCase();
}

async function fetchFirst(paths, file, reader = response => response.json()) {
  for (const base of paths) {
    const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
    const url = prefix + "/" + file;
    try {
      const response = await fetch(url);
      if (response && response.ok) {
        return await reader(response);
      }
    } catch (error) {
      // try next
    }
  }
  throw new Error(file + " not found");
}

function compilePattern(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return null;
  }
  const attempts = [trimmed];
  const sanitized = trimmed.replace(/\\.\\?\\*/g, ".*");
  if (sanitized !== trimmed) {
    attempts.push(sanitized);
  }
  for (const attempt of attempts) {
    try {
      return new RegExp(attempt, "i");
    } catch (error) {
      // continue
    }
  }
  return null;
}

function formatCuePhrase(rawPattern) {
  const trimmed = typeof rawPattern === "string" ? rawPattern.trim() : "";
  if (!trimmed) {
    return "";
  }
  const withoutAnchors = trimmed.replace(/^[\\^]/, "").replace(/[\\$]$/, "");
  return withoutAnchors
    .replace(/\\\\b/g, "")
    .replace(/\\.\\*/g, "…")
    .replace(/\\s+/g, " ")
    .trim();
}

function formatCueLabel(slug) {
  const trimmed = typeof slug === "string" ? slug.trim() : "";
  if (!trimmed) {
    return "";
  }
  const spaced = trimmed.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced
    .split(" ")
    .map(token => (token ? token[0].toUpperCase() + token.slice(1) : ""))
    .join(" ");
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
  return fallback || cueValue || "";
}

function createCue(entry) {
  const cueValue = entry && typeof entry.cue === "string" ? entry.cue.trim() : "";
  if (!cueValue) {
    return null;
  }
  const rawPatterns = Array.isArray(entry.patterns) ? entry.patterns : [];
  const compiled = rawPatterns.map(compilePattern).filter(Boolean);
  const feelings = dedupe(toArray(entry.feelings).flat()).map(cleanSlug).filter(Boolean);
  const needs = dedupe(toArray(entry.needs).flat()).map(cleanSlug).filter(Boolean);
  const phraseHints = [
    ...(Array.isArray(entry.phrases) ? entry.phrases : []),
    ...rawPatterns.map(formatCuePhrase),
  ]
    .map(value => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  let phrase = typeof entry.phrase === "string" ? entry.phrase.trim() : "";
  if (!phrase) {
    phrase = chooseCuePhrase(phraseHints, cueValue);
  }
  const phrases = dedupe([...phraseHints, phrase].filter(Boolean));
  return {
    cue: cueValue,
    label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : formatCueLabel(cueValue),
    example: typeof entry.example === "string" ? entry.example.trim() : "",
    patterns: compiled,
    phrases,
    phrase,
    feelings,
    needs,
    rawPatterns,
  };
}

function normalizeBundle(raw) {
  if (Array.isArray(raw?.cues)) {
    return raw.cues.map(createCue).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.map(createCue).filter(Boolean);
  }
  return [];
}

async function loadNextBundle() {
  const payload = await fetchFirst(BASES, "cues.bundle.json");
  return normalizeBundle(payload);
}

function splitPipe(value) {
  return (value || "")
    .split("|")
    .map(part => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
}

async function loadLegacyCsv(csvUrl) {
  if (!csvUrl) {
    return [];
  }
  const reader = response => response.text();
  const text = await fetchFirst([""], csvUrl.startsWith("/") ? csvUrl.slice(1) : csvUrl, reader);
  const rows = parseCSV(text);
  const [, ...dataRows] = rows;
  return dataRows
    .map(cols => {
      const [cue, patternsRaw, feelingsRaw, needsRaw, example] = cols;
      return createCue({
        cue,
        patterns: splitPipe(patternsRaw),
        feelings: splitPipe(feelingsRaw),
        needs: splitPipe(needsRaw),
        example,
      });
    })
    .filter(Boolean);
}

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch === "\"") {
      if (inQ && str[i + 1] === "\"") {
        cur += "\"";
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      row.push(cur);
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (cur.length || row.length) {
        row.push(cur);
        out.push(row);
        row = [];
        cur = "";
      }
      if (ch === "\r" && str[i + 1] === "\n") {
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

async function ensureCues(csvUrl = DEFAULT_CSV) {
  if (!cuesPromise) {
    cuesPromise = (async () => {
      try {
        const nextCues = await loadNextBundle();
        if (nextCues.length) {
          return nextCues;
        }
      } catch (error) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("Falling back to legacy observation cues", error);
        }
      }
      try {
        return await loadLegacyCsv(csvUrl);
      } catch (legacyError) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("Unable to load legacy observation cues", legacyError);
        }
        return [];
      }
    })();
  }
  return cuesPromise;
}

export async function loadCueRows(csvUrl = DEFAULT_CSV) {
  return await ensureCues(csvUrl);
}

function dedupeList(values) {
  return [...new Set((values || []).map(value => (typeof value === "string" ? value.trim() : "")))].filter(Boolean);
}

function matchCues(normalized, cues) {
  if (!normalized) {
    return [];
  }
  const matches = [];
  for (const cue of cues || []) {
    const patterns = Array.isArray(cue.patterns) ? cue.patterns : [];
    for (const pattern of patterns) {
      if (pattern && typeof pattern.test === "function" && pattern.test(normalized)) {
        matches.push({
          cue: cue.cue,
          label: cue.label,
          example: cue.example,
          feelings: cue.feelings || [],
          needs: cue.needs || [],
        });
        break;
      }
    }
  }
  return matches;
}

export function suggestFromObservation(text, cues, maxEach = 6) {
  const normalized = (text || "").toLowerCase();
  const matches = matchCues(normalized, cues);
  const feelings = dedupeList(matches.flatMap(match => match.feelings)).slice(0, maxEach);
  const needs = dedupeList(matches.flatMap(match => match.needs)).slice(0, maxEach);
  const why = matches.map(match => match.cue);
  return { feelings, needs, why, hits: matches };
}

function aggregateMatches(matches) {
  const feelings = new Map();
  const needs = new Map();
  matches.forEach(match => {
    (match.feelings || []).forEach(slug => {
      const cleaned = cleanSlug(slug);
      if (!cleaned) {
        return;
      }
      feelings.set(cleaned, (feelings.get(cleaned) || 0) + 1);
    });
    (match.needs || []).forEach(slug => {
      const cleaned = cleanSlug(slug);
      if (!cleaned) {
        return;
      }
      needs.set(cleaned, (needs.get(cleaned) || 0) + 1);
    });
  });
  const order = map => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([slug, count]) => ({ slug, count }));
  return { feelings: order(feelings), needs: order(needs) };
}

function urlFor(type, slug) {
  return "/" + type + "/" + slug + "/";
}

function tokens(value) {
  return (value || "").toLowerCase().match(/[a-z0-9'’]{3,}/g) || [];
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let intersection = 0;
  for (const token of A) {
    if (B.has(token)) {
      intersection += 1;
    }
  }
  const union = A.size + B.size - intersection;
  return union ? intersection / union : 0;
}

function normalizeNearest(raw) {
  if (!Array.isArray(raw)) {
    return null;
  }
  return raw
    .map(entry => {
      const cue = typeof entry?.cue === "string" ? entry.cue.trim() : "";
      if (!cue) {
        return null;
      }
      const tokensList = Array.isArray(entry.tokens)
        ? entry.tokens.map(token => (typeof token === "string" ? token.trim().toLowerCase() : "")).filter(Boolean)
        : [];
      return {
        cue,
        label: typeof entry.label === "string" ? entry.label : cue,
        example: typeof entry.example === "string" ? entry.example : "",
        feelings: Array.isArray(entry.feelings) ? entry.feelings : [],
        needs: Array.isArray(entry.needs) ? entry.needs : [],
        tokens: tokensList,
      };
    })
    .filter(Boolean);
}

async function ensureNearest() {
  if (!nearestPromise) {
    nearestPromise = (async () => {
      try {
        const data = await fetchFirst(BASES, "cues.nearest.json");
        return normalizeNearest(data);
      } catch (error) {
        return null;
      }
    })();
  }
  return nearestPromise;
}

const Shim = {
  async suggest(text) {
    const cues = await ensureCues();
    const matches = matchCues((text || "").toLowerCase(), cues);
    const aggregated = aggregateMatches(matches);
    const mapUrl = (entries, type) => entries.map(entry => ({ ...entry, url: urlFor(type, entry.slug) }));
    return {
      matches,
      feelings: mapUrl(aggregated.feelings, "feelings"),
      needs: mapUrl(aggregated.needs, "needs"),
    };
  },
  async nearest(text, k = 7) {
    const nearest = await ensureNearest();
    if (!nearest || !nearest.length) {
      return [];
    }
    const tokensList = tokens(text || "");
    return nearest
      .map(entry => ({ ...entry, score: jaccard(tokensList, entry.tokens || []) }))
      .filter(entry => entry.score > 0 || !tokensList.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, typeof k === "number" && Number.isFinite(k) ? Math.max(1, Math.floor(k)) : 7);
  },
};

if (typeof window !== "undefined") {
  window.ObservationSuggest = Shim;
  window.suggestObservations = Shim.suggest;
}

export async function suggest(text) {
  return await Shim.suggest(text);
}

export async function nearest(text, k) {
  return await Shim.nearest(text, k);
}

export default { loadCueRows, suggestFromObservation, suggest, nearest };
