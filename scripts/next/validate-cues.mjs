#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUNDLE_PATH = path.join(ROOT, "data/generated/cues.bundle.json");
const OUT_DIR = path.join(ROOT, "scripts/next/out");
const CSV_OUT = path.join(OUT_DIR, "validate-failures.csv");

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

function parseCSV(content) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  const text = content.replace(/^\uFEFF/, "");

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

function normalizeAdvisoryText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDelimitedField(value) {
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
  if (!file) return null;
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

function loadFauxCatalog(filename) {
  const file = findCatalog(filename);
  if (!file) return null;
  const content = fs.readFileSync(file, "utf8");
  const rows = parseCSV(content);
  const objects = rowsToObjects(rows);
  const items = [];
  for (const row of objects) {
    const title = row["Faux Feeling Title"] || row["Slug Override"] || "";
    const slug = toSlug(row["Slug Override"] || title || "");
    if (!slug) continue;
    const normalizedTitle = normalizeAdvisoryText(title);
    items.push({ slug, normalizedTitle });
  }
  return items;
}

function main() {
  ensureDir(OUT_DIR);
  if (!fs.existsSync(BUNDLE_PATH)) {
    throw new Error("Bundle not found. Run build-cues first.");
  }

  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8"));
  const cues = bundle.cues || [];

  const feelingsCatalog = loadCatalogSet("Feelings.csv", ["Slug Override"], ["Feeling Title"]);
  const needsCatalog = loadCatalogSet("Needs.csv", ["Slug Override"], ["Need Title"]);
  const fauxCatalog = loadFauxCatalog("Faux Feelings.csv") || [];
  const fauxSlugSet = new Set(fauxCatalog.map(item => item.slug).filter(Boolean));
  const fauxTitleSet = new Set(fauxCatalog.map(item => item.normalizedTitle).filter(Boolean));

  const failures = [];
  const stats = {
    cues: cues.length,
    pattern_strings: 0,
    compiled_ok: 0,
    compile_errors: 0,
    unknown_feelings: 0,
    unknown_needs: 0,
    faux_hits_feelings: 0,
    faux_mentions_nonblocking: 0,
    faux_hits: 0
  };

  for (const cue of cues) {
    const patterns = cue.patterns || [];
    const feelingsList = parseDelimitedField(cue.feelings);
    const needsList = parseDelimitedField(cue.needs);

    const feelingsEntries = feelingsList.map(value => ({ value, slug: toSlug(value) }));
    const feelingsSlugs = feelingsEntries.map(entry => entry.slug);

    const unknownFeelings = feelingsEntries
      .filter(entry => feelingsCatalog && !feelingsCatalog.has(entry.slug))
      .map(entry => entry.value);
    const unknownNeeds = needsList.filter(n => needsCatalog && !needsCatalog.has(toSlug(n)));

    if (unknownFeelings.length) stats.unknown_feelings += unknownFeelings.length;
    if (unknownNeeds.length) stats.unknown_needs += unknownNeeds.length;

    const fauxInFeelings = [...new Set(feelingsSlugs.filter(slug => fauxSlugSet.has(slug)))];
    const hasBlockingFaux = fauxInFeelings.length > 0;
    if (hasBlockingFaux) stats.faux_hits_feelings++;

    if ((fauxSlugSet.size || fauxTitleSet.size) && (cue.example || patterns.length)) {
      const scanParts = [];
      if (cue.example) scanParts.push(String(cue.example));
      if (patterns.length) {
        for (const pattern of patterns) {
          if (pattern != null) scanParts.push(String(pattern));
        }
      }
      const joinedScan = scanParts.join(" ");
      const scanLower = joinedScan.toLowerCase();
      const scanNormalized = normalizeAdvisoryText(joinedScan);
      const mentionTokens = new Set();
      for (const slug of fauxSlugSet) {
        if (slug && scanLower.includes(slug)) mentionTokens.add(slug);
      }
      for (const title of fauxTitleSet) {
        if (title && scanNormalized.includes(title)) mentionTokens.add(title);
      }
      if (mentionTokens.size) stats.faux_mentions_nonblocking += mentionTokens.size;
    }

    let metadataLogged = false;

    for (const pattern of patterns) {
      stats.pattern_strings++;
      const dialectErrors = validatePatternDialect(pattern);
      let compileError = "";
      if (!dialectErrors.length) {
        try {
          new RegExp(pattern, "i");
          stats.compiled_ok++;
        } catch (err) {
          compileError = err instanceof Error ? err.message : String(err);
          stats.compile_errors++;
        }
      }

      if (dialectErrors.length || compileError || unknownFeelings.length || unknownNeeds.length || hasBlockingFaux) {
        failures.push({
          cue: cue.cue,
          pattern,
          error: [...dialectErrors, compileError].filter(Boolean).join("; "),
          unknown_feelings: unknownFeelings.join("|"),
          unknown_needs: unknownNeeds.join("|"),
          faux_hit: fauxInFeelings.join("|")
        });
        metadataLogged = true;
      }
    }

    if (!metadataLogged && (unknownFeelings.length || unknownNeeds.length || hasBlockingFaux)) {
      failures.push({
        cue: cue.cue,
        pattern: "",
        error: "",
        unknown_feelings: unknownFeelings.join("|"),
        unknown_needs: unknownNeeds.join("|"),
        faux_hit: fauxInFeelings.join("|")
      });
    }
  }

  const lines = ["cue,pattern,error,unknown_feelings,unknown_needs,faux_hit"];
  for (const fail of failures) {
    lines.push([
      csvEscape(fail.cue),
      csvEscape(fail.pattern),
      csvEscape(fail.error),
      csvEscape(fail.unknown_feelings),
      csvEscape(fail.unknown_needs),
      csvEscape(fail.faux_hit)
    ].join(","));
  }
  const csvOutput = lines.join("\n") + "\n";
  fs.writeFileSync(CSV_OUT, csvOutput, "utf8");

  stats.faux_hits = stats.faux_hits_feelings;
  process.stdout.write(JSON.stringify(stats) + "\n");
}

main();
