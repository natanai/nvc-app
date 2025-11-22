import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EVIDENCE_DIR = path.join(ROOT, "_evidence");
const OUTPUT_DIR = path.join(ROOT, "fact-checking");

function ensureDir(dir) {
  return fs.mkdir(dir, { recursive: true });
}

function csvEscape(value) {
  if (value == null) return "";
  const str = String(value);
  if (/[,\n"\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function serializeCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(row[key])).join(","));
  }
  return lines.join("\n") + "\n";
}

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
        i += 1; // skip escaped quote
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

async function copyCsv(sourcePath, targetName) {
  const text = await fs.readFile(sourcePath, "utf8");
  await fs.writeFile(path.join(OUTPUT_DIR, targetName), text);
}

function parseList(value, separator = "|") {
  return value
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function flattenReverseInference(data) {
  const rows = [];
  for (const [feeling, entry] of Object.entries(data)) {
    const zones = (entry?.zones ?? []).join("|");
    for (const cue of entry?.bodyCues ?? []) {
      rows.push({
        feeling,
        zones,
        regionId: cue.regionId ?? "",
        regionLabel: cue.regionLabel ?? "",
        optionId: cue.optionId ?? "",
        title: cue.title ?? "",
        note: cue.note ?? "",
        intensityMin: cue.intensityBand?.[0] ?? "",
        intensityMax: cue.intensityBand?.[1] ?? "",
        arousal: cue.arousal ?? "",
        relativeWeight: cue.relativeWeight ?? "",
        evidenceKey: cue.evidenceKey ?? ""
      });
    }
  }
  return rows;
}

function parseFormattedPoems(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let current = null;

  const finishCurrent = () => {
    if (!current) return;
    const rawQuote = current.lines.join("\n").replace(/[\s\u00A0]+$/u, "");
    entries.push({
      title: current.title.trim(),
      poemQuote: rawQuote,
      poemUrl: current.url.trim()
    });
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!current) {
      if (!trimmed) continue;
      current = { title: trimmed, lines: [], url: "" };
      continue;
    }

    if (!trimmed && !current.url) {
      current.lines.push("");
      continue;
    }

    if (!trimmed && current.url) {
      continue;
    }

    if (trimmed === "-") {
      finishCurrent();
      continue;
    }

    if (!current.url && /^https?:\/\//i.test(trimmed)) {
      current.url = trimmed;
      continue;
    }

    current.lines.push(line.replace(/\r$/, ""));
  }

  finishCurrent();

  return entries;
}

function flattenBodyRegions(regions) {
  const rows = [];
  for (const region of regions) {
    for (const option of region.options ?? []) {
      const emotions = option.emotions
        ? Object.entries(option.emotions)
            .map(([emotion, weight]) => `${emotion}:${weight}`)
            .join("|")
        : "";
      rows.push({
        regionId: region.id ?? "",
        regionLabel: region.label ?? "",
        prompt: region.prompt ?? "",
        optionId: option.id ?? "",
        optionTitle: option.title ?? "",
        optionNote: option.note ?? "",
        optionInsight: option.insight ?? "",
        emotions
      });
    }
  }
  return rows;
}

function flattenObservationTaxonomy(taxonomy) {
  const rows = [];
  for (const family of taxonomy.families ?? []) {
    for (const pattern of family.patterns ?? []) {
      rows.push({
        familyId: family.id ?? "",
        familyLabel: family.label ?? "",
        patternId: pattern.id ?? "",
        patternLabel: pattern.label ?? "",
        example: pattern.example ?? "",
        feelings: (pattern.feelings ?? []).join("|"),
        needs: (pattern.needs ?? []).join("|")
      });
    }
  }
  return rows;
}

function flattenObservationLexicon(lexicon) {
  const rows = [];
  for (const [key, entries] of Object.entries(lexicon)) {
    for (const entry of entries) {
      const { pattern = "", prompt = "", tags = [], tokens = [], words = [], ...rest } = entry;
      rows.push({
        lexiconKey: key,
        pattern,
        prompt,
        tags: (tags ?? []).join("|"),
        tokens: (tokens ?? []).join("|"),
        words: (words ?? []).join("|"),
        extra: Object.keys(rest).length ? JSON.stringify(rest) : ""
      });
    }
  }
  return rows;
}

function flattenObservationTemplates(templates) {
  const rows = [];
  for (const [need, entry] of Object.entries(templates)) {
    for (const cue of entry.cues ?? []) {
      rows.push({
        need,
        slots: (entry.slotIds ?? []).join("|"),
        suffix: cue.suffix ?? "",
        example: cue.example ?? "",
        patterns: (cue.patterns ?? []).join("|")
      });
    }
  }
  return rows;
}

function flattenObservationModules(blueprints) {
  const rows = [];
  for (const module of blueprints.modules ?? []) {
    rows.push({
      id: module.id ?? "",
      label: module.label ?? "",
      summary: module.summary ?? "",
      slotIds: (module.slotIds ?? []).join("|"),
      lexiconKeys: (module.lexiconKeys ?? []).join("|"),
      feelings: (module.feelings ?? []).join("|"),
      needs: (module.needs ?? []).join("|"),
      examples: (module.examples ?? []).join("|"),
      detectorsJson: JSON.stringify(module.detectors ?? [])
    });
  }
  return rows;
}

async function exportJsonCsv(sourcePath, rows, targetName) {
  if (!rows.length) return;
  await fs.writeFile(path.join(OUTPUT_DIR, targetName), serializeCsv(rows), "utf8");
  console.log(`• exported ${targetName}`);
}

async function run() {
  await ensureDir(OUTPUT_DIR);

  // Core CSV sources and citations
  await copyCsv(path.join(DATA_DIR, "Needs.csv"), "Needs.csv");
  await copyCsv(path.join(DATA_DIR, "Feelings.csv"), "Feelings.csv");
  await copyCsv(path.join(DATA_DIR, "Faux Feelings.csv"), "Faux Feelings.csv");
  await copyCsv(path.join(DATA_DIR, "Strategies.csv"), "Strategies.csv");
  await copyCsv(path.join(EVIDENCE_DIR, "citations.csv"), "citations.csv");
  console.log("• copied core CSV sources and citations");

  const poemText = await fs.readFile(path.join(DATA_DIR, "poems_formatted.txt"), "utf8");
  await exportJsonCsv(
    "poems_formatted.txt",
    parseFormattedPoems(poemText),
    "poems.csv"
  );

  const reverseInference = JSON.parse(await fs.readFile(path.join(DATA_DIR, "reverse-inference.json"), "utf8"));
  await exportJsonCsv("reverse-inference.json", flattenReverseInference(reverseInference), "reverse-inference.csv");

  const bodyRegions = JSON.parse(await fs.readFile(path.join(DATA_DIR, "body-regions.json"), "utf8"));
  await exportJsonCsv("body-regions.json", flattenBodyRegions(bodyRegions), "body-regions.csv");

  const taxonomy = JSON.parse(await fs.readFile(path.join(DATA_DIR, "observation_taxonomy.json"), "utf8"));
  await exportJsonCsv("observation_taxonomy.json", flattenObservationTaxonomy(taxonomy), "observation-taxonomy.csv");

  const lexicon = JSON.parse(await fs.readFile(path.join(DATA_DIR, "observation_lexicon.json"), "utf8"));
  await exportJsonCsv("observation_lexicon.json", flattenObservationLexicon(lexicon), "observation-lexicon.csv");

  const templates = JSON.parse(await fs.readFile(path.join(DATA_DIR, "observation_need_templates.json"), "utf8"));
  await exportJsonCsv("observation_need_templates.json", flattenObservationTemplates(templates), "observation-templates.csv");

  const blueprints = JSON.parse(await fs.readFile(path.join(DATA_DIR, "observation_module_blueprints.json"), "utf8"));
  await exportJsonCsv("observation_module_blueprints.json", flattenObservationModules(blueprints), "observation-modules.csv");

  const detectorStats = JSON.parse(await fs.readFile(path.join(DATA_DIR, "observation_detector_stats.json"), "utf8"));
  const detectorRows = [
    {
      updatedAt: detectorStats.updatedAt ?? "",
      feelingsTotalLibraryCount: detectorStats.feelings?.totalLibraryCount ?? "",
      feelingsUniqueCueCount: detectorStats.feelings?.uniqueCueCount ?? "",
      feelingsExactMatchCount: detectorStats.feelings?.exactMatchCount ?? "",
      feelingsExactMatchRatio: detectorStats.feelings?.exactMatchRatio ?? "",
      feelingsExactMatchPercentage: detectorStats.feelings?.exactMatchPercentage ?? "",
      feelingsLibraryCoverageRatio: detectorStats.feelings?.libraryCoverageRatio ?? "",
      feelingsLibraryCoveragePercentage: detectorStats.feelings?.libraryCoveragePercentage ?? "",
      feelingsMissingFromLibrary: (detectorStats.feelings?.missingFromLibrary ?? []).join("|")
    }
  ];
  await exportJsonCsv("observation_detector_stats.json", detectorRows, "observation-detector-stats.csv");

  const observationGuide = await fs.readFile(path.join(DATA_DIR, "observation-guide.json"), "utf8");
  await fs.writeFile(path.join(OUTPUT_DIR, "observation-guide.csv"), serializeCsv([{ json: observationGuide.trim() }]), "utf8");
  console.log("• exported observation guide JSON into spreadsheet form");

  console.log(`Fact-checking spreadsheets are ready in ${OUTPUT_DIR}/`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
