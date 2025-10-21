#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SOURCE_BRANCH = "observations:data/observation_cues.csv";
const FALLBACK_PATHS = [
  path.join(ROOT, "data/observation_cues.csv"),
  path.join(ROOT, "data/observation_cues.sanitized.csv"),
];
const OUT_DIR = path.join(ROOT, "scripts/next/out");
const REPORT_PATH = path.join(OUT_DIR, "migration-report.json");
const DROPPED_PATH = path.join(OUT_DIR, "migration-dropped.csv");
const FAMILY_DIR = path.join(ROOT, "data/next/families/legacy_port");
const FAMILY_NAME = "legacy_port";
const CHUNK_SIZE = 200;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseCSV(content) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  const text = String(content || "").replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ',') {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some(cell => cell !== "")) rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0];
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? "";
    });
    data.push(obj);
  }
  return data;
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSlug(value) {
  if (!value) return null;
  let slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[,.;:!?]+$/g, "")
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) return null;

  const VARIANTS = new Map([
    ["love/caring", "love-caring"],
    ["love-caring", "love-caring"],
    ["love--caring", "love-caring"],
    ["to-be-heard", "to-be-heard"],
    ["to-be-seen", "to-be-seen"],
  ]);

  if (VARIANTS.has(slug)) slug = VARIANTS.get(slug);

  return slug;
}

function splitPipeList(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v || "").trim()).filter(Boolean);
  }
  if (!value) return [];
  return String(value)
    .split("|")
    .map(part => part.trim())
    .filter(Boolean);
}

const CATALOG_DIRS = ["data", "data/catalogs", "docs"];

function findCatalog(name) {
  for (const dir of CATALOG_DIRS) {
    const candidate = path.join(ROOT, dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function loadCatalogSet(filename, slugColumns, fallbackColumns) {
  const file = findCatalog(filename);
  if (!file) return new Set();
  const content = fs.readFileSync(file, "utf8");
  const rows = parseCSV(content);
  const objects = rowsToObjects(rows);
  const slugs = new Set();
  for (const row of objects) {
    let added = false;
    for (const column of slugColumns) {
      const value = row[column];
      if (value && value.trim()) {
        slugs.add(toSlug(value));
        added = true;
      }
    }
    if (!added) {
      for (const column of fallbackColumns) {
        const value = row[column];
        if (value && value.trim()) {
          slugs.add(toSlug(value));
        }
      }
    }
  }
  return slugs;
}

function fetchSource() {
  const result = spawnSync("git", ["show", SOURCE_BRANCH], { encoding: "utf8" });
  if (result.status === 0 && result.stdout) {
    return { source: SOURCE_BRANCH, content: result.stdout };
  }
  for (const candidate of FALLBACK_PATHS) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, "utf8");
      return { source: path.relative(ROOT, candidate), content };
    }
  }
  return { source: null, content: null };
}

function sanitizePattern(raw, { cueSlug, cueId, recordDrop }) {
  if (!raw) {
    recordDrop({ reason: "disallowed", detail: "empty", value: raw });
    return null;
  }
  let pattern = String(raw || "").trim();
  if (!pattern) {
    recordDrop({ reason: "disallowed", detail: "empty", value: raw });
    return null;
  }

  if (/\(\?<=/.test(pattern) || /\(\?<!/.test(pattern)) {
    recordDrop({ reason: "disallowed", detail: "lookbehind", value: raw });
    return null;
  }

  if (/\\k<|\\k'|\(\?P</.test(pattern)) {
    recordDrop({ reason: "disallowed", detail: "backreference", value: raw });
    return null;
  }

  let inClass = false;
  let sanitized = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    const prev = pattern[i - 1];
    if (ch === "[" && prev !== "\\") {
      inClass = true;
      sanitized += ch;
      continue;
    }
    if (ch === "]" && prev !== "\\") {
      inClass = false;
      sanitized += ch;
      continue;
    }
    if (!inClass && (ch === "'" || ch === "’")) {
      sanitized += "[’']";
      continue;
    }
    if (inClass && ch === "’") {
      sanitized += "'";
      continue;
    }
    if (!inClass && ch === "(" && prev !== "\\") {
      if (pattern[i + 1] === "?") {
        sanitized += ch;
      } else {
        sanitized += "(?:";
      }
      continue;
    }
    sanitized += ch;
  }
  pattern = sanitized;

  pattern = pattern.replace(/(^|[^\\])\.\*(\??)/g, (_, prefix) => `${prefix}[^.!?]*`);

  if (/(\?\*|\+\*|\*\+|\?\+)/.test(pattern)) {
    recordDrop({ reason: "disallowed", detail: "nested_quantifier", value: raw });
    return null;
  }

  if (/\{[^}]*,\?[^}]*\}/.test(pattern)) {
    recordDrop({ reason: "disallowed", detail: "quantifier_question", value: raw });
    return null;
  }

  if (!/\\b/.test(pattern) && /^[A-Za-z][A-Za-z\s'’/-]*$/.test(pattern)) {
    const tokens = pattern
      .trim()
      .split(/\s+/)
      .map(token => token.replace(/[’']/g, "[’']"));
    const joined = tokens.join("\\s+");
    pattern = `\\b${joined}\\b`;
  }

  pattern = pattern.replace(/\s+/g, match => (match.length > 1 ? "\\s+" : " "));

  pattern = pattern.trim();
  if (!pattern) {
    recordDrop({ reason: "disallowed", detail: "empty", value: raw });
    return null;
  }

  try {
    new RegExp(pattern, "i");
  } catch (error) {
    recordDrop({ reason: "compile", detail: String(error.message || error), value: raw, sanitized: pattern });
    return null;
  }

  return pattern;
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function main() {
  ensureDir(OUT_DIR);
  ensureDir(FAMILY_DIR);

  // remove old family files
  for (const file of fs.readdirSync(FAMILY_DIR)) {
    if (file.startsWith(`${FAMILY_NAME}_`) && file.endsWith(".json")) {
      fs.unlinkSync(path.join(FAMILY_DIR, file));
    }
  }

  const feelingsCatalog = loadCatalogSet("Feelings.csv", ["Slug Override"], ["Feeling Title"]);
  const needsCatalog = loadCatalogSet("Needs.csv", ["Slug Override"], ["Need Title"]);

  const { source, content } = fetchSource();
  if (!content) {
    console.error("Legacy observation cues CSV not found.");
    process.exitCode = 1;
    return;
  }

  const rows = parseCSV(content);
  const objects = rowsToObjects(rows);

  const stats = {
    source,
    rows_read: 0,
    cues_emitted: 0,
    families_written: 0,
    patterns_in: 0,
    patterns_kept: 0,
    patterns_dropped_compile: 0,
    patterns_dropped_disallowed: 0,
    unknown_feelings_dropped: 0,
    unknown_needs_dropped: 0,
    cues_skipped_no_valid_patterns: 0,
    files: [],
  };

  const dropped = [];
  const cues = [];
  const seenKeys = new Set();

  for (const row of objects) {
    stats.rows_read++;
    const cueName = String(row["cue"] || "").trim();
    const cueSlug = toSlug(cueName);
    if (!cueSlug) {
      dropped.push({ cue: cueName, id: "", reason: "invalid_cue", detail: "Missing cue slug", pattern_or_slug: "" });
      continue;
    }

    const cueId = `${cueSlug}_legacy_next`;
    const recordDrop = ({ reason, detail, value, sanitized }) => {
      const patternValue = sanitized ? `${sanitized} <= ${value}` : value;
      if (reason === "compile") {
        stats.patterns_dropped_compile++;
      } else {
        stats.patterns_dropped_disallowed++;
      }
      dropped.push({ cue: cueName, id: cueId, reason: reason === "compile" ? "pattern_compile" : "pattern_disallowed", detail, pattern_or_slug: String(patternValue ?? "") });
    };

    const patternsRaw = splitPipeList(row["patterns (|)"]);
    stats.patterns_in += patternsRaw.length;
    const patterns = [];
    const patternSeen = new Set();
    for (const raw of patternsRaw) {
      const sanitized = sanitizePattern(raw, { cueSlug, cueId, recordDrop });
      if (!sanitized) continue;
      if (patternSeen.has(sanitized)) continue;
      patternSeen.add(sanitized);
      patterns.push(sanitized);
    }

    if (!patterns.length) {
      stats.cues_skipped_no_valid_patterns++;
      dropped.push({ cue: cueName, id: cueId, reason: "no_valid_patterns", detail: "All patterns dropped", pattern_or_slug: "" });
      continue;
    }

    stats.patterns_kept += patterns.length;

    const feelingsRaw = splitPipeList(row["feelings (|)"]);
    const feelings = [];
    for (const f of feelingsRaw) {
      const slug = normalizeSlug(f);
      if (!slug) continue;
      if (!feelingsCatalog.has(slug)) {
        stats.unknown_feelings_dropped++;
        dropped.push({ cue: cueName, id: cueId, reason: "unknown_feeling", detail: "Not in catalog", pattern_or_slug: slug });
        continue;
      }
      if (!feelings.includes(slug)) feelings.push(slug);
    }

    const needsRaw = splitPipeList(row["needs (|)"]);
    const needs = [];
    for (const n of needsRaw) {
      const slug = normalizeSlug(n);
      if (!slug) continue;
      if (!needsCatalog.has(slug)) {
        stats.unknown_needs_dropped++;
        dropped.push({ cue: cueName, id: cueId, reason: "unknown_need", detail: "Not in catalog", pattern_or_slug: slug });
        continue;
      }
      if (!needs.includes(slug)) needs.push(slug);
    }

    const example = String(row["example"] || "").trim();

    const cueRecord = { id: cueId, patterns };
    if (feelings.length) cueRecord.feelings = feelings;
    if (needs.length) cueRecord.needs = needs;
    if (example) cueRecord.example = example;

    const key = `${cueId}|${patterns.join("__")}|${(feelings || []).join("__")}|${(needs || []).join("__")}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    cues.push(cueRecord);
  }

  cues.sort((a, b) => a.id.localeCompare(b.id));

  const chunks = chunk(cues, CHUNK_SIZE);
  chunks.forEach((group, index) => {
    const filename = `${FAMILY_NAME}_${String(index + 1).padStart(3, "0")}.json`;
    const filePath = path.join(FAMILY_DIR, filename);
    const payload = {
      family: FAMILY_NAME,
      defaults: { feelings: [], needs: [] },
      cues: group,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    stats.files.push(path.relative(ROOT, filePath));
  });

  stats.cues_emitted = cues.length;
  stats.families_written = chunks.length;

  fs.writeFileSync(REPORT_PATH, JSON.stringify(stats, null, 2) + "\n", "utf8");

  const droppedLines = ["cue,id,reason,detail,pattern_or_slug"];
  for (const item of dropped) {
    const line = [item.cue, item.id, item.reason, item.detail, item.pattern_or_slug]
      .map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"')
      .join(",");
    droppedLines.push(line);
  }
  fs.writeFileSync(DROPPED_PATH, droppedLines.join("\n") + "\n", "utf8");

  console.log(`Migration complete: ${cues.length} cues written to ${chunks.length} file(s).`);
}

main();
