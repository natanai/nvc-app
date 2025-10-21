#!/usr/bin/env node
/**
 * Copies data/generated/cues.bundle.json → public/next/cues.bundle.json
 * Prints one JSON line: { copied, from, to, cues, patterns, nearestItems }
 */
import fs from "node:fs";
import path from "node:path";
import { access, copyFile, mkdir, readFile } from "node:fs/promises";

const SRC = "data/generated/cues.bundle.json";
const DEST_DIR = "public/next";
const DEST = path.join(DEST_DIR, "cues.bundle.json");
const NEAR_SRC = "data/generated/cues.nearest.json";
const NEAR_DEST = path.join(DEST_DIR, "cues.nearest.json");
const NEXT_DIR = "next";
const NEXT_DEST = path.join(NEXT_DIR, "cues.bundle.json");
const NEXT_NEAR_DEST = path.join(NEXT_DIR, "cues.nearest.json");

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function safeCopy(src, dest) {
  try {
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(src, dest);
    return true;
  } catch {
    return false;
  }
}

(async function main(){
  if (!fs.existsSync(SRC)) {
    process.stdout.write(JSON.stringify({ copied:false, error:`missing ${SRC}` }) + "\n");
    return;
  }

  const rawText = await readFile(SRC, "utf8");
  const raw = JSON.parse(rawText);
  await safeCopy(SRC, DEST);

  let nearestItems = 0;
  if (await exists(NEAR_SRC)) {
    const rawNText = await readFile(NEAR_SRC, "utf8");
    const rawN = JSON.parse(rawNText);
    await safeCopy(NEAR_SRC, NEAR_DEST);
    nearestItems = Array.isArray(rawN.items) ? rawN.items.length : 0;
  }

  await safeCopy(DEST, NEXT_DEST);
  if (await exists(NEAR_DEST)) {
    await safeCopy(NEAR_DEST, NEXT_NEAR_DEST);
  }

  const counts = {
    cues: Array.isArray(raw.cues) ? raw.cues.length : 0,
    patterns: Array.isArray(raw.cues) ? raw.cues.reduce((n,c)=>n+(Array.isArray(c.patterns)?c.patterns.length:0),0) : 0,
    nearestItems
  };
  process.stdout.write(JSON.stringify({ copied:true, from:SRC, to:DEST, ...counts }) + "\n");
})();
