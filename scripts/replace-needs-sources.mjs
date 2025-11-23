import fs from "fs/promises";
import path from "path";

const REPO_ROOT = process.cwd();
const CITATIONS_CSV_PATH = path.join(REPO_ROOT, "_evidence", "citations.csv");
const CITATIONS_JSON_PATH = path.join(REPO_ROOT, "_evidence", "citations.json");
const NEEDS_DIR = path.join(REPO_ROOT, "needs");
const NEEDS_DATA_PATH = path.join(REPO_ROOT, "data", "Needs.csv");

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = "";
    } else if (ch === '\r') {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (text[i + 1] === '\n') {
        i += 1;
      }
    } else if (ch === '\n') {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (inQuotes) {
    throw new Error("Unterminated quoted field in CSV");
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) {
    return { header: [], records: [] };
  }

  const header = rows[0].map((name) => name.replace(/^\ufeff/, ""));
  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.length) {
      continue;
    }
    const obj = {};
    for (let j = 0; j < header.length; j += 1) {
      obj[header[j]] = row[j] ?? "";
    }
    records.push(obj);
  }

  return { header, records };
}

function stringifyCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value = "") => {
          const str = String(value);
          if (/[",\n\r]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");
}

function objectsToRows(header, records) {
  const rows = [header];
  for (const record of records) {
    rows.push(header.map((key) => record[key] ?? ""));
  }
  return rows;
}

function formatFindingLabel(label = "") {
  const trimmed = label.replace(/^(finding:\s*)+/i, "").trim();
  if (!trimmed) {
    return "";
  }

  const replacements = [
    { pattern: /^study on (how\s+)?/i, replacement: "found that " },
    { pattern: /^study showing\s+/i, replacement: "found " },
    { pattern: /^study linking\s+/i, replacement: "found " },
    { pattern: /^longitudinal study\s+(?:found\s+)?/i, replacement: "longitudinal study found " },
    { pattern: /^research on\s+/i, replacement: "research found that " },
    { pattern: /^research showing\s+/i, replacement: "research found " },
    { pattern: /^cross-cultural research\s+/i, replacement: "cross-cultural research found " },
    { pattern: /^review detailing\s+/i, replacement: "review found that " },
    { pattern: /^review on\s+/i, replacement: "review found that " },
    { pattern: /^review of\s+/i, replacement: "review found that " },
    { pattern: /^meta-analysis showing\s+/i, replacement: "meta-analysis found " },
    { pattern: /^summary of\s+/i, replacement: "summary found that " },
    { pattern: /^discussion on\s+/i, replacement: "discussion noted that " },
    { pattern: /^meta-analysis\s+/i, replacement: "meta-analysis found " },
    { pattern: /^analysis\s+/i, replacement: "analysis found " },
    { pattern: /^(?:apa\s+)?press release on\s+/i, replacement: "press release reported that " },
    { pattern: /^hbr article on\s+/i, replacement: "article reported that " },
    { pattern: /^article on\s+/i, replacement: "article reported that " },
    { pattern: /^self-determination theory research:?\s*/i, replacement: "self-determination theory research found that " },
    { pattern: /^Self-Determination Theory review:?\s*/i, replacement: "review concluded that " },
  ];

  let updated = trimmed.replace(/\u00a0/g, " ");
  for (const { pattern, replacement } of replacements) {
    if (pattern.test(updated)) {
      updated = updated.replace(pattern, replacement);
      break;
    }
  }

    updated = updated
      .replace(/\bfound showing\b/i, "found that")
      .replace(/found(?:\s+found)+/gi, "found")
      .replace(/(found that\s+){2,}/gi, "found that ")
      .replace(/\breported that how\b/i, "reported that")
    .replace(/\bfound that that\b/i, "found that")
    .replace(/^longitudinal study:\s*/i, "longitudinal study found that ")
    .replace(/^meta-analysis:\s*/i, "meta-analysis found that ")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = updated[0].toUpperCase() + updated.slice(1);
  if (/\b(found|shows?|showed|reported|demonstrates?|indicates)\b/i.test(normalized)) {
    return normalized;
  }

  return `Finding: ${normalized}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, "&#96;");
}

function buildNeedSourcesMap(records) {
  const bySlug = new Map();

  records.forEach((record, index) => {
    const filePath = record.file ? record.file.trim() : "";
    const url = record.url ? record.url.trim() : "";
    const label = record.label ? record.label.trim() : "";

    if (!filePath || !url) {
      return;
    }

    const rel = path.relative(REPO_ROOT, filePath);
    const parts = rel.split(path.sep);
    if (parts[0] !== "needs" || parts.length < 3 || parts[2] !== "index.html") {
      return;
    }

    const slug = parts[1];
    if (!slug) {
      return;
    }

    const entry = {
      label,
      url,
      line: Number.parseInt(record.line, 10) || 0,
      order: index,
    };

    if (!bySlug.has(slug)) {
      bySlug.set(slug, []);
    }
    bySlug.get(slug).push(entry);
  });

  for (const [slug, entries] of bySlug.entries()) {
    entries.sort((a, b) => {
      if (a.line !== b.line) {
        return a.line - b.line;
      }
      return a.order - b.order;
    });
  }

  return bySlug;
}

function buildListItem({ label, url }) {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeAttr(url);
  const displayUrl = escapeHtml(url);
  return `<li class="need-evidence__item"><a class="need-evidence__link" href="${safeUrl}" target="_blank" rel="noreferrer noopener">${safeLabel}</a><span class="need-evidence__source-url"> (${displayUrl})</span></li>`;
}

function buildNeedSourcesHtml(entries) {
  const inlineCitations = entries.map((source, index) => {
    const number = index + 1;
    const safeUrl = escapeAttr(source.url);
    const safeTitle = source.label ? ` title="${escapeHtml(source.label)}"` : "";
    return `<span class="need-evidence__citation-ref">[<a class="need-evidence__link" href="${safeUrl}" target="_blank" rel="noreferrer noopener"${safeTitle}>${number}</a>]</span>`;
  });

  const citationDetails = entries.map((source, index) => {
    const number = index + 1;
    const safeDescription = escapeHtml(source.label || source.url || `Source ${number}`);
    const safeUrl = escapeAttr(source.url);
    return `<li class="need-evidence__citation-item">`
      + `<span class="need-evidence__citation-number">${number}</span>`
      + `<div class="need-evidence__citation-body">`
      + `<span class="need-evidence__citation-description">${safeDescription}</span>`
      + `<a class="need-evidence__citation-url" href="${safeUrl}" target="_blank" rel="noreferrer noopener">${escapeHtml(source.url)}</a>`
      + `</div>`
      + `</li>`;
  });

  return `<div class="need-evidence__sources"><h3 class="need-evidence__subheading">Supporting sources</h3><div class="need-evidence__citation-row" aria-label="Supporting sources">${inlineCitations.join('')}</div><details class="need-evidence__details need-evidence__citations"><summary class="need-evidence__details-toggle need-evidence__citations-toggle">Citations</summary><ol class="need-evidence__citation-list">${citationDetails.join('')}</ol></details></div>`;
}

async function updateNeedsPage(slug, entries) {
  const filePath = path.join(NEEDS_DIR, slug, "index.html");
  let html;
  try {
    html = await fs.readFile(filePath, "utf8");
  } catch (error) {
    console.warn(`Skipping ${slug}: unable to read ${filePath}`);
    return false;
  }

  const sourcesPattern = /<div class="need-evidence__sources">[\s\S]*?(?=<div class="strategy-quick-actions">)/;
  if (!sourcesPattern.test(html)) {
    console.warn(`Skipping ${slug}: supporting sources block not found in ${filePath}`);
    return false;
  }

  const updatedSources = buildNeedSourcesHtml(entries);
  const updatedHtml = html.replace(sourcesPattern, updatedSources);

  if (updatedHtml !== html) {
    await fs.writeFile(filePath, updatedHtml, "utf8");
    return true;
  }
  return false;
}

function formatSupportingSources(entries) {
  if (!entries.length) {
    return "";
  }
  return entries.map((entry) => `- ${entry.url} (${entry.label})`).join("\n");
}

async function updateNeedsSpreadsheet(slugMap) {
  let csvText;
  try {
    csvText = await fs.readFile(NEEDS_DATA_PATH, "utf8");
  } catch (error) {
    console.warn(`Unable to read ${NEEDS_DATA_PATH}:`, error.message);
    return false;
  }

  const rows = parseCsv(csvText);
  const header = rows[0] ?? [];
  const slugIndex = header.findIndex((name) => name.replace(/^\ufeff/, "") === "Slug Override");
  const legacySlugIndex =
    slugIndex === -1 ? header.findIndex((name) => name.replace(/^\ufeff/, "") === "Slug") : slugIndex;
  const sourcesIndex = header.findIndex((name) => name.replace(/^\ufeff/, "") === "Source Links");
  const legacySourcesIndex =
    sourcesIndex === -1
      ? header.findIndex((name) => name.replace(/^\ufeff/, "") === "Supporting Sources")
      : sourcesIndex;

  if (legacySlugIndex === -1 || legacySourcesIndex === -1) {
    console.warn("Needs.csv missing expected columns (Slug Override, Source Links)");
    return false;
  }

  let changed = false;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const slug = row[legacySlugIndex];
    if (!slug || !slugMap.has(slug)) {
      continue;
    }
    const entries = slugMap.get(slug);
    const newValue = formatSupportingSources(entries);
    if ((row[legacySourcesIndex] ?? "") !== newValue) {
      row[legacySourcesIndex] = newValue;
      changed = true;
    }
  }

  if (changed) {
    const output = stringifyCsv(rows);
    await fs.writeFile(NEEDS_DATA_PATH, output + (output.endsWith("\n") ? "" : "\n"), "utf8");
    return true;
  }

  return false;
}

async function writeCitationsJson(records) {
  const normalized = records.map((record) => ({
    ...record,
    line: record.line ? Number.parseInt(record.line, 10) : undefined,
  }));
  await fs.writeFile(CITATIONS_JSON_PATH, JSON.stringify(normalized, null, 2) + "\n", "utf8");
}

async function writeCitationsCsv(header, records) {
  const rows = objectsToRows(header, records);
  const csvText = stringifyCsv(rows);
  await fs.writeFile(CITATIONS_CSV_PATH, csvText + (csvText.endsWith("\n") ? "" : "\n"), "utf8");
}

async function main() {
  let csvText;
  try {
    csvText = await fs.readFile(CITATIONS_CSV_PATH, "utf8");
  } catch (error) {
    console.error(`Unable to read ${CITATIONS_CSV_PATH}:`, error.message);
    process.exitCode = 1;
    return;
  }

  const { header, records } = rowsToObjects(parseCsv(csvText));
  if (!records.length) {
    console.warn("No citation records found in citations.csv");
  }

  const findingRecords = records.map((record) => ({
    ...record,
    label: formatFindingLabel(record.label),
  }));

  const slugMap = buildNeedSourcesMap(findingRecords);

  let htmlUpdated = 0;
  for (const [slug, entries] of slugMap.entries()) {
    const updated = await updateNeedsPage(slug, entries);
    if (updated) {
      htmlUpdated += 1;
    }
  }

  const spreadsheetUpdated = await updateNeedsSpreadsheet(slugMap);
  await writeCitationsCsv(header, findingRecords);
  await writeCitationsJson(findingRecords);

  console.log(`Updated ${htmlUpdated} needs page${htmlUpdated === 1 ? "" : "s"}.`);
  if (spreadsheetUpdated) {
    console.log("Updated data/Needs.csv supporting sources.");
  } else {
    console.log("No changes applied to data/Needs.csv.");
  }
  console.log("Wrote _evidence/citations.csv with updated finding-focused labels.");
  console.log("Wrote _evidence/citations.json from citations.csv.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
