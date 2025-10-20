#!/usr/bin/env node
/**
 * Next‑Gen scaffold: compile JSON families + lexicons into a single bundle.
 * Outputs:
 *   - data/generated/cues.bundle.json
 *   - data/generated/observation_cues.generated.csv
 * No external deps. Node >= 18.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FAM_DIR = "data/next/families";
const OUT_DIR = "data/generated";
const JSON_OUT = path.join(OUT_DIR, "cues.bundle.json");
const CSV_OUT  = path.join(OUT_DIR, "observation_cues.generated.csv");

const HEADER = ["cue","patterns (|)","feelings (|)","needs (|)","example"];

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function trimSpaces(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

function csvEscape(v) {
  const s = String(v ?? "");
  return '"' + s.replace(/"/g,'""') + '"';
}

const REGEX_META = /[\\^$.|?*+()[\]{}]/g;
function regexEscapeLiteral(text) {
  return String(text).replace(REGEX_META, "\\$&");
}

function buildSlotAlternation(values) {
  if (!Array.isArray(values) || !values.length) return "";
  const escaped = values.map(v => regexEscapeLiteral(String(v)));
  return `(?:${[...new Set(escaped)].join("|")})`;
}

function expandSlots(pattern, slots) {
  if (!pattern) return "";
  return pattern.replace(/\$\{(\w+)\}/g, (_, key) => {
    const arr = slots?.[key];
    return buildSlotAlternation(arr);
  });
}

function validatePatternDialect(pattern) {
  const errors = [];
  if (/(\(\?<=|\(\?<\=)/.test(pattern)) errors.push("Lookbehind is not allowed in the minimal dialect.");
  if (/\(\?<!/.test(pattern)) errors.push("Negative lookbehind is not allowed in the minimal dialect.");
  if (/\\[1-9]/.test(pattern)) errors.push("Backreferences are not allowed.");
  if (/\(\?[a-zA-Z]/.test(pattern) && !/\(\?:/.test(pattern)) errors.push("Inline flags are not allowed; use non-capturing groups only.");

  // Capturing groups (anything like ( ... ) that is not (?: ... ) or escaped)
  const capturingGroupMatch = pattern.match(/(?<!\\)\((?!\?:)/);
  if (capturingGroupMatch) errors.push("Capturing groups are not allowed; use (?: … ).");

  // Bare dot (outside character classes) must be escaped unless part of .*
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    const prev = pattern[i - 1];
    if (ch === "[" && prev !== "\\") {
      inClass = true;
    } else if (ch === "]" && prev !== "\\") {
      inClass = false;
    }
    if (inClass) continue;
    if (ch === ".") {
      const next = pattern[i + 1];
      if (prev === "\\") continue;
      if (next === "*") continue;
      errors.push("Bare dot is not allowed; escape literal dots.");
      break;
    }
  }

  if (/(\+\?|\?\+|\*\?|\?\?|\{[^}]+}\?)/.test(pattern)) {
    errors.push("Nested/non-greedy quantifiers are not allowed in this dialect.");
  }

  return errors;
}

function compileFamily(filePath, stats) {
  const fam = readJSON(filePath);
  const familySlots = fam.slots || {};
  const rows = [];

  for (const cue of fam.cues || []) {
    const slots = { ...familySlots, ...(cue.slots || {}) };
    const feelings = cue.feelings ?? fam.defaults?.feelings ?? [];
    const needs = cue.needs ?? fam.defaults?.needs ?? [];

    const validPatterns = [];
    for (const raw of cue.patterns || []) {
      stats.patternsTotal++;
      const expanded = trimSpaces(expandSlots(raw, slots));
      const dialectErrors = validatePatternDialect(expanded);
      if (dialectErrors.length) {
        stats.patternsInvalid++;
        stats.invalid.push({ cue: cue.id, pattern: raw, expanded, errors: dialectErrors });
        continue;
      }
      validPatterns.push(expanded);
    }

    rows.push({
      cue: cue.id,
      patterns: validPatterns,
      feelings: Array.isArray(feelings) ? feelings : [feelings].filter(Boolean),
      needs: Array.isArray(needs) ? needs : [needs].filter(Boolean),
      example: cue.example || ""
    });
  }

  return rows;
}

(function main(){
  ensureDir(OUT_DIR);
  const rows = [];
  const stats = { patternsTotal: 0, patternsInvalid: 0, invalid: [] };
  const famPath = path.join(ROOT, FAM_DIR);
  const families = fs.readdirSync(famPath).filter(n => n.endsWith(".json"));

  for (const f of families) {
    rows.push(...compileFamily(path.join(famPath, f), stats));
  }

  const jsonBundle = rows.map(r => ({
    cue: r.cue,
    patterns: r.patterns,
    feelings: r.feelings,
    needs: r.needs,
    example: r.example
  }));

  const jsonString = JSON.stringify({ cues: jsonBundle }, null, 2) + "\n";
  fs.writeFileSync(JSON_OUT, jsonString, "utf8");

  const lines = [HEADER.join(",")];
  for (const r of rows) {
    const line = [
      csvEscape(r.cue),
      csvEscape(r.patterns.join("|")),
      csvEscape(r.feelings.join("|")),
      csvEscape(r.needs.join("|")),
      csvEscape(r.example)
    ].join(",");
    lines.push(line);
  }
  const csvString = lines.join("\n") + "\n";
  fs.writeFileSync(CSV_OUT, csvString, "utf8");

  const summary = {
    families: families.length,
    cues: rows.length,
    patterns_total: stats.patternsTotal,
    patterns_invalid: stats.patternsInvalid,
    json: JSON_OUT,
    csv: CSV_OUT
  };
  process.stdout.write(JSON.stringify(summary) + "\n");
})();
