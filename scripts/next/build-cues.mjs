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

function readJSON(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function trimSpaces(s) { return String(s).replace(/\s+/g, " ").trim(); }
function csvEscape(v){ const s = String(v ?? ""); return '"' + s.replace(/"/g,'""') + '"'; }

// Expand ${slot} with the FIRST provided variant (small step 1); later we’ll expand into compact alternations.
function expandSlots(pattern, slots){
  return pattern.replace(/\$\{(\w+)\}/g, (_, key) => {
    const arr = slots?.[key];
    return Array.isArray(arr) && arr.length ? arr[0] : "";
  });
}

function compileFamily(filePath){
  const fam = readJSON(filePath);
  const rows = [];
  for (const cue of fam.cues || []) {
    const feelings = (cue.feelings ?? fam.defaults?.feelings ?? []).join("|");
    const needs = (cue.needs ?? fam.defaults?.needs ?? []).join("|");
    const patterns = (cue.patterns || []).map(p => trimSpaces(expandSlots(p, cue.slots || {})));
    rows.push({
      cue: cue.id,
      patterns,
      feelings,
      needs,
      example: cue.example || ""
    });
  }
  return rows;
}

(function main(){
  ensureDir(OUT_DIR);
  const rows = [];
  const famPath = path.join(ROOT, FAM_DIR);
  for (const f of fs.readdirSync(famPath)) {
    if (f.endsWith(".json")) rows.push(...compileFamily(path.join(famPath, f)));
  }

  // Write JSON bundle
  const jsonBundle = rows.map(r => ({
    cue: r.cue,
    patterns: r.patterns,
    feelings: r.feelings.split("|").filter(Boolean),
    needs: r.needs.split("|").filter(Boolean),
    example: r.example
  }));
  fs.writeFileSync(JSON_OUT, JSON.stringify({ cues: jsonBundle }, null, 2), "utf8");

  // Write CSV
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    const line = [
      csvEscape(r.cue),
      csvEscape(r.patterns.join("|")),
      csvEscape(r.feelings),
      csvEscape(r.needs),
      csvEscape(r.example)
    ].join(",");
    lines.push(line);
  }
  fs.writeFileSync(CSV_OUT, lines.join("\n"), "utf8");

  // Console summary
  process.stdout.write(JSON.stringify({
    families: fs.readdirSync(famPath).filter(n=>n.endsWith(".json")).length,
    cues: rows.length,
    json: JSON_OUT,
    csv: CSV_OUT
  }) + "\n");
})();
