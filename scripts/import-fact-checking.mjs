import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EVIDENCE_DIR = path.join(ROOT, "_evidence");
const INPUT_DIR = path.join(ROOT, "fact-checking");

function parseCsv(text) {
  const rows = [];
  let current = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      current.push(cell);
      cell = "";
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      current.push(cell);
      rows.push(current);
      current = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }

  const [header, ...data] = rows.filter((row) => row.length > 0);
  const trimmedHeader = header.map((h) => h.trim());

  return data
    .map((row) => {
      const obj = {};
      trimmedHeader.forEach((key, index) => {
        obj[key] = (row[index] ?? "").trim();
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((value) => value !== ""));
}

async function readCsvFile(name) {
  const text = await fs.readFile(path.join(INPUT_DIR, name), "utf8");
  return parseCsv(text);
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function restoreObservationTaxonomy() {
  const rows = await readCsvFile("observation-taxonomy.csv");
  const families = new Map();
  for (const row of rows) {
    if (!row.familyId) continue;
    if (!families.has(row.familyId)) {
      families.set(row.familyId, { id: row.familyId, label: row.familyLabel, patterns: [] });
    }
    const family = families.get(row.familyId);
    family.patterns.push({
      id: row.patternId,
      label: row.patternLabel,
      example: row.example,
      feelings: row.feelings ? row.feelings.split("|") : [],
      needs: row.needs ? row.needs.split("|") : []
    });
  }
  await fs.writeFile(path.join(DATA_DIR, "observation_taxonomy.json"), JSON.stringify({ families: Array.from(families.values()) }, null, 2) + "\n");
  console.log("• restored data/observation_taxonomy.json from fact-checking/observation-taxonomy.csv");
}

async function restoreObservationLexicon() {
  const rows = await readCsvFile("observation-lexicon.csv");
  const lexicon = {};
  for (const row of rows) {
    if (!row.lexiconKey) continue;
    if (!lexicon[row.lexiconKey]) {
      lexicon[row.lexiconKey] = [];
    }
    const extra = row.extra ? JSON.parse(row.extra) : {};
    lexicon[row.lexiconKey].push({
      pattern: row.pattern,
      prompt: row.prompt || undefined,
      tags: row.tags ? row.tags.split("|") : [],
      tokens: row.tokens ? row.tokens.split("|") : [],
      words: row.words ? row.words.split("|") : [],
      ...extra
    });
  }
  await fs.writeFile(path.join(DATA_DIR, "observation_lexicon.json"), JSON.stringify(lexicon, null, 2) + "\n");
  console.log("• restored data/observation_lexicon.json from fact-checking/observation-lexicon.csv");
}

async function restoreObservationTemplates() {
  const rows = await readCsvFile("observation-templates.csv");
  const templates = {};
  for (const row of rows) {
    if (!row.need) continue;
    if (!templates[row.need]) {
      templates[row.need] = { slotIds: row.slots ? row.slots.split("|") : [], cues: [] };
    }
    templates[row.need].cues.push({
      suffix: row.suffix,
      example: row.example,
      patterns: row.patterns ? row.patterns.split("|") : []
    });
  }
  await fs.writeFile(path.join(DATA_DIR, "observation_need_templates.json"), JSON.stringify(templates, null, 2) + "\n");
  console.log("• restored data/observation_need_templates.json from fact-checking/observation-templates.csv");
}

async function restoreObservationModules() {
  const rows = await readCsvFile("observation-modules.csv");
  const modules = rows.map((row) => ({
    id: row.id,
    label: row.label,
    summary: row.summary,
    slotIds: row.slotIds ? row.slotIds.split("|") : [],
    lexiconKeys: row.lexiconKeys ? row.lexiconKeys.split("|") : [],
    feelings: row.feelings ? row.feelings.split("|") : [],
    needs: row.needs ? row.needs.split("|") : [],
    examples: row.examples ? row.examples.split("|") : [],
    detectors: row.detectorsJson ? JSON.parse(row.detectorsJson) : []
  }));
  await fs.writeFile(path.join(DATA_DIR, "observation_module_blueprints.json"), JSON.stringify({ modules }, null, 2) + "\n");
  console.log("• restored data/observation_module_blueprints.json from fact-checking/observation-modules.csv");
}

async function restoreDetectorStats() {
  const rows = await readCsvFile("observation-detector-stats.csv");
  const row = rows[0] ?? {};
  const payload = {
    updatedAt: row.updatedAt,
    feelings: {
      totalLibraryCount: parseNumber(row.feelingsTotalLibraryCount),
      uniqueCueCount: parseNumber(row.feelingsUniqueCueCount),
      exactMatchCount: parseNumber(row.feelingsExactMatchCount),
      exactMatchRatio: parseNumber(row.feelingsExactMatchRatio),
      exactMatchPercentage: parseNumber(row.feelingsExactMatchPercentage),
      libraryCoverageRatio: parseNumber(row.feelingsLibraryCoverageRatio),
      libraryCoveragePercentage: parseNumber(row.feelingsLibraryCoveragePercentage),
      missingFromLibrary: row.feelingsMissingFromLibrary ? row.feelingsMissingFromLibrary.split("|") : []
    }
  };
  await fs.writeFile(path.join(DATA_DIR, "observation_detector_stats.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log("• restored data/observation_detector_stats.json from fact-checking/observation-detector-stats.csv");
}

async function restoreObservationGuide() {
  const text = await fs.readFile(path.join(INPUT_DIR, "observation-guide.csv"), "utf8");
  const [row] = parseCsv(text);
  if (!row?.json) {
    throw new Error("observation-guide.csv must include a 'json' column with the serialized observation guide");
  }
  await fs.writeFile(path.join(DATA_DIR, "observation-guide.json"), `${row.json}\n`);
  console.log("• restored data/observation-guide.json from fact-checking/observation-guide.csv");
}

async function copyCsvBack(name, targetPath) {
  const source = path.join(INPUT_DIR, name);
  await fs.access(source);
  await fs.copyFile(source, targetPath);
}

async function run() {
  await fs.access(INPUT_DIR);

  await copyCsvBack("Needs.csv", path.join(DATA_DIR, "Needs.csv"));
  await copyCsvBack("Feelings.csv", path.join(DATA_DIR, "Feelings.csv"));
  await copyCsvBack("Faux Feelings.csv", path.join(DATA_DIR, "Faux Feelings.csv"));
  await copyCsvBack("Strategies.csv", path.join(DATA_DIR, "Strategies.csv"));
  await copyCsvBack("color-palettes.csv", path.join(DATA_DIR, "color-palettes.csv"));
  await copyCsvBack("citations.csv", path.join(EVIDENCE_DIR, "citations.csv"));
  console.log("• copied authoritative core CSVs and citations back into place");

  // Body Cues is authored in data/Feelings.csv and rebuilt from those cue rows.
  // reverse-inference.json currently contains curated production fields that the
  // historical CSV export cannot round-trip without data loss. Keep the
  // body-regions.csv and reverse-inference.csv exports as review/reference
  // snapshots only; never let a fact-checking import overwrite newer canonical
  // production data from either of them.
  console.log("• kept body-regions.csv and reverse-inference.csv reference-only; neither overwrites canonical production data");

  await restoreObservationTaxonomy();
  await restoreObservationLexicon();
  await restoreObservationTemplates();
  await restoreObservationModules();
  await restoreDetectorStats();
  await restoreObservationGuide();

  console.log("Fact-checking spreadsheets applied. Re-run npm run build:data && npm run build:pages to regenerate owned site artifacts.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
