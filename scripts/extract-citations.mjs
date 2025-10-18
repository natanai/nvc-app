import fs from "fs/promises";
import path from "path";

const REPO_ROOT = process.cwd();
const TARGET_DIRS = [path.join(REPO_ROOT, "needs")];

const EXTS = [".md", ".mdx", ".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".json"];
const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "out", ".cache", "coverage"]);

// URL detection (keeps trailing )] out; tolerates query/anchors)
const URL_RE = /(https?:\/\/[^\s)\]}>"]+)/g;

// Markdown [label](url)
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

// Lines like: "Some source label ..." then next line: "(https://...)"
const PARENS_URL_LINE_RE = /^\((https?:\/\/[^\s)]+)\)\s*$/;

// Lines like: "Some source label: ... (https://...)"
const INLINE_LABEL_URL_RE = /^(.{3,}?)\s*\((https?:\/\/[^\s)]+)\)\s*$/;

// Headed blocks: "Supporting sources" (case-insensitive)
const SUPPORTING_HDR_RE = /^\s{0,3}#{1,6}\s*supporting\s+sources\b|^\s*supporting\s+sources\s*$/i;

function domainOf(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function csvEscape(s) {
  if (s == null) return "";
  const str = String(s);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(full);
    } else if (EXTS.includes(path.extname(ent.name))) {
      yield full;
    }
  }
}

function pushRecord(records, rec) {
  // Normalize whitespace
  if (rec.label) rec.label = rec.label.trim();
  rec.url = rec.url.trim();
  rec.domain = domainOf(rec.url);
  // cheap label/domain hint
  rec.label_domain_hint = rec.label && rec.domain ? (rec.label.toLowerCase().includes(rec.domain.split(".").slice(-2).join(".")) ? "label~domain" : "") : "";
  records.push(rec);
}

async function processFile(file) {
  const text = await fs.readFile(file, "utf8");
  const lines = text.split(/\r?\n/);
  const records = [];

  // Pass A: strict Markdown [label](url)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    while ((m = MD_LINK_RE.exec(line)) !== null) {
      const [ , label, url ] = m;
      pushRecord(records, {
        file, line: i+1,
        label,
        url,
        how: "md_link",
        context: line.trim().slice(0, 400)
      });
    }
  }

  // Pass B: Supporting sources block with label line followed by parens URL line
  // Also accept "• Label" or "- Label" formats
  let inSupport = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SUPPORTING_HDR_RE.test(line)) {
      inSupport = true;
      continue;
    }
    // leave supporting block on blank line followed by new header or double blank
    if (inSupport && /^#{1,6}\s|\S.*: *$/.test(line)) {
      // a new header or a lone key ending with colon likely ends block; but we stay conservative
    }

    if (inSupport) {
      // Try pair on current + next line
      const labelLine = line.trim().replace(/^[−•\*\u2022]\s*/, "");
      const next = lines[i+1] ?? "";
      const mNext = next.match(PARENS_URL_LINE_RE);
      if (labelLine && mNext) {
        pushRecord(records, {
          file, line: i+1,
          label: labelLine,
          url: mNext[1],
          how: "supporting_block_pair",
          context: `${labelLine} ${next}`.slice(0, 400)
        });
        i++; // consume next line
        continue;
      }
      // Also support inline: "Label (https://...)"
      const inline = line.match(INLINE_LABEL_URL_RE);
      if (inline) {
        pushRecord(records, {
          file, line: i+1,
          label: inline[1],
          url: inline[2],
          how: "supporting_block_inline",
          context: line.slice(0, 400)
        });
        continue;
      }
      // exit condition: blank line followed by non-bullet content may mean block ended—skip; we keep scanning anyway
    }
  }

  // Pass C: generic URL catcher with a guessed label (previous non-empty line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    while ((m = URL_RE.exec(line)) !== null) {
      const url = m[1];
      // Skip if already captured in previous passes for this line
      const duplicate = records.some(r => r.line === i+1 && r.url === url);
      if (duplicate) continue;

      // guess label: prefer same-line prefix before '(' or previous non-empty line
      let labelGuess = "";
      const inl = line.match(INLINE_LABEL_URL_RE);
      if (inl && inl[2] === url) {
        labelGuess = inl[1];
      } else {
        // previous non-empty non-URL line
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prev = lines[j].trim();
          if (!prev) continue;
          if (URL_RE.test(prev)) continue;
          labelGuess = prev.replace(/^[−•\*]\s*/, "");
          break;
        }
      }

      pushRecord(records, {
        file, line: i+1,
        label: labelGuess,
        url,
        how: "generic_url_with_label_guess",
        context: [
          (lines[i-1]??"").trim(),
          line.trim(),
          (lines[i+1]??"").trim()
        ].join(" | ").slice(0, 400)
      });
    }
  }

  return records;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const all = [];
  const searchRoots = [];

  for (const dir of TARGET_DIRS) {
    if (await pathExists(dir)) {
      searchRoots.push(dir);
    }
  }

  if (searchRoots.length === 0) {
    console.warn("No needs directories found – nothing to scan.");
  }

  for (const root of searchRoots) {
    for await (const file of walk(root)) {
      const recs = await processFile(file);
      all.push(...recs);
    }
  }

  // De-dup (file,line,url,how)
  const seen = new Set();
  const deduped = [];
  for (const r of all) {
    const key = `${r.file}|${r.line}|${r.url}|${r.how}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Write JSON
  await fs.mkdir("_evidence", { recursive: true });
  await fs.writeFile("_evidence/citations.json", JSON.stringify(deduped, null, 2), "utf8");

  // Write CSV
  const header = ["file","line","how","label","url","domain","label_domain_hint","context"].map(csvEscape).join(",");
  const rows = deduped.map(r => [
    r.file, r.line, r.how, r.label ?? "", r.url, r.domain ?? "", r.label_domain_hint ?? "", r.context ?? ""
  ].map(csvEscape).join(","));
  const csv = [header, ...rows].join("\n");
  await fs.writeFile("_evidence/citations.csv", csv, "utf8");

  console.log(`Extracted ${deduped.length} citations -> _evidence/citations.{json,csv}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
