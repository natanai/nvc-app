#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUNDLE_PATH = path.join(ROOT, "data/generated/cues.bundle.json");
const INPUT_PATH = path.join(ROOT, "tests/next/free-text.txt");
const OUT_DIR = path.join(ROOT, "scripts/next/out");
const CSV_OUT = path.join(OUT_DIR, "coverage-detail.csv");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function csvEscape(v) {
  const s = String(v ?? "");
  return '"' + s.replace(/"/g,'""') + '"';
}

function validatePatternDialect(pattern) {
  const errors = [];
  if (/\(\?<=/.test(pattern)) errors.push("Lookbehind is not allowed in the minimal dialect.");
  if (/\(\?<!/.test(pattern)) errors.push("Negative lookbehind is not allowed in the minimal dialect.");
  if (/\\[1-9]/.test(pattern)) errors.push("Backreferences are not allowed.");
  if (/\(\?[a-zA-Z]/.test(pattern) && !/\(\?:/.test(pattern)) errors.push("Inline flags are not allowed; use non-capturing groups only.");
  const capturingGroupMatch = pattern.match(/(?<!\\)\((?!\?:)/);
  if (capturingGroupMatch) errors.push("Capturing groups are not allowed; use (?: … ).");
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

function main() {
  ensureDir(OUT_DIR);
  if (!fs.existsSync(BUNDLE_PATH)) {
    throw new Error("Bundle not found. Run build-cues first.");
  }
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error("Test input file not found.");
  }

  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8"));
  const cues = bundle.cues || [];

  const compiledCues = cues.map(cue => {
    const compiledPatterns = [];
    for (const pattern of cue.patterns || []) {
      const dialectErrors = validatePatternDialect(pattern);
      if (dialectErrors.length) continue;
      try {
        compiledPatterns.push(new RegExp(pattern, "i"));
      } catch {
        continue;
      }
    }
    return { id: cue.cue, patterns: compiledPatterns };
  });

  const lines = fs.readFileSync(INPUT_PATH, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  let matchedInputs = 0;
  let totalMatches = 0;
  const details = ["input,matched_count,matched_cues"];

  for (const input of lines) {
    const matched = [];
    for (const cue of compiledCues) {
      if (!cue.patterns.length) continue;
      if (cue.patterns.some(re => re.test(input))) {
        matched.push(cue.id);
      }
    }
    if (matched.length) matchedInputs++;
    totalMatches += matched.length;
    details.push([
      csvEscape(input),
      csvEscape(String(matched.length)),
      csvEscape(matched.join("|"))
    ].join(","));
  }

  const csvOutput = details.join("\n") + "\n";
  fs.writeFileSync(CSV_OUT, csvOutput, "utf8");

  const totalInputs = lines.length;
  const coveragePercent = totalInputs === 0 ? 0 : Number(((matchedInputs / totalInputs) * 100).toFixed(2));
  const avgMatches = totalInputs === 0 ? 0 : Number((totalMatches / totalInputs).toFixed(3));

  const summary = {
    total_inputs: totalInputs,
    matched_inputs: matchedInputs,
    coverage_percent: coveragePercent,
    avg_matches_per_input: avgMatches
  };

  process.stdout.write(JSON.stringify(summary) + "\n");
}

main();
