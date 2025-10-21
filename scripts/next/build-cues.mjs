#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SOURCE = path.resolve("data", "observation_cues.sanitized.csv");
const DEST_DIR = path.resolve("data", "next", "generated");
const DEST_FILE = path.join(DEST_DIR, "cues.bundle.json");

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

function splitPipe(value) {
  return (value || "")
    .split("|")
    .map(v => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
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

function formatCuePhrase(rawPattern) {
  const trimmed = typeof rawPattern === "string" ? rawPattern.trim() : "";
  if (!trimmed) {
    return "";
  }
  const withoutAnchors = trimmed.replace(/^[\^]/, "").replace(/[\$]$/, "");
  return withoutAnchors
    .replace(/\\b/g, "")
    .replace(/\.\*/g, "…")
    .replace(/\s+/g, " ")
    .trim();
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

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildCue(row) {
  const [cueRaw, patternsRaw, feelingsRaw, needsRaw, exampleRaw] = row;
  const cue = (cueRaw || "").trim();
  if (!cue) {
    return null;
  }
  const patterns = splitPipe(patternsRaw);
  const feelings = dedupe(splitPipe(feelingsRaw));
  const needs = dedupe(splitPipe(needsRaw));
  const example = typeof exampleRaw === "string" ? exampleRaw.trim() : "";
  const patternHints = patterns.map(formatCuePhrase).filter(Boolean);
  const phrase = chooseCuePhrase(patternHints, cue);
  const phrases = dedupe([...patternHints, phrase].filter(Boolean));
  return {
    cue,
    label: formatCueLabel(cue),
    example,
    patterns,
    feelings,
    needs,
    phrase,
    phrases,
  };
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Unable to find source CSV at ${SOURCE}`);
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });
  const raw = fs.readFileSync(SOURCE, "utf8");
  const rows = parseCSV(raw);
  const [, ...dataRows] = rows;
  const cues = dataRows
    .map(buildCue)
    .filter(Boolean);
  const payload = {
    generatedAt: new Date().toISOString(),
    cues,
    counts: {
      cues: cues.length,
      patterns: cues.reduce((total, cue) => total + (Array.isArray(cue.patterns) ? cue.patterns.length : 0), 0),
    },
    source: path.relative(process.cwd(), SOURCE),
  };
  fs.writeFileSync(DEST_FILE, JSON.stringify(payload, null, 2));
  console.log(
    JSON.stringify({
      ok: true,
      dest: path.relative(process.cwd(), DEST_FILE),
      cues: payload.counts.cues,
      patterns: payload.counts.patterns,
    })
  );
}

main();
