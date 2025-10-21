#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SOURCE = path.resolve("data", "next", "generated", "cues.bundle.json");
const DEST_DIR = path.resolve("data", "next", "generated");
const DEST_FILE = path.join(DEST_DIR, "cues.nearest.json");

function loadBundle() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing cues bundle at ${SOURCE}`);
  }
  const raw = fs.readFileSync(SOURCE, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed?.cues)) {
    return parsed.cues;
  }
  return [];
}

function tokenize(value) {
  if (typeof value !== "string") {
    return [];
  }
  const lowered = value.toLowerCase();
  const matches = lowered.match(/[a-z0-9'’]+/g);
  return matches ? matches.map(token => token.replace(/’/g, "'")) : [];
}

function patternTokens(pattern) {
  const normalized = typeof pattern === "string" ? pattern : "";
  if (!normalized) {
    return [];
  }
  const stripped = normalized
    .replace(/\\b/g, " ")
    .replace(/[\^$]/g, " ")
    .replace(/[.*+?()[\]{}\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return tokenize(stripped);
}

function buildNearestEntry(cue) {
  const cueValue = cue?.cue ? String(cue.cue).trim() : "";
  if (!cueValue) {
    return null;
  }
  const sources = [];
  sources.push(cueValue);
  if (cue.label) {
    sources.push(String(cue.label));
  }
  if (cue.example) {
    sources.push(String(cue.example));
  }
  if (Array.isArray(cue.phrases)) {
    sources.push(...cue.phrases.map(String));
  }
  if (cue.phrase) {
    sources.push(String(cue.phrase));
  }
  const tokens = new Set();
  sources.forEach(source => {
    tokenize(source).forEach(token => tokens.add(token));
  });
  if (Array.isArray(cue.patterns)) {
    cue.patterns.forEach(pattern => {
      patternTokens(pattern).forEach(token => tokens.add(token));
    });
  }
  return {
    cue: cueValue,
    label: String(cue.label || cueValue),
    example: typeof cue.example === "string" ? cue.example : "",
    feelings: Array.isArray(cue.feelings) ? cue.feelings : [],
    needs: Array.isArray(cue.needs) ? cue.needs : [],
    tokens: [...tokens],
  };
}

function main() {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  const bundle = loadBundle();
  const nearest = bundle
    .map(buildNearestEntry)
    .filter(entry => entry && (entry.tokens.length || entry.feelings.length || entry.needs.length));
  fs.writeFileSync(DEST_FILE, JSON.stringify(nearest, null, 2));
  console.log(
    JSON.stringify({
      ok: true,
      dest: path.relative(process.cwd(), DEST_FILE),
      entries: nearest.length,
    })
  );
}

main();
