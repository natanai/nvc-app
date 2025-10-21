#!/usr/bin/env node
/**
 * Copies data/generated/cues.bundle.json → public/next/cues.bundle.json
 * Prints one JSON line summarizing the publish + cleanup
 */
import fs from "node:fs";
import path from "node:path";
import { access, copyFile, mkdir, readFile, rm } from "node:fs/promises";

const SRC = "data/generated/cues.bundle.json";
const DEST_DIR = "public/next";
const DEST = path.join(DEST_DIR, "cues.bundle.json");
const NEAR_SRC = "data/generated/cues.nearest.json";
const NEAR_DEST = path.join(DEST_DIR, "cues.nearest.json");

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

  const summary = {
    copied: true,
    public_next: {
      cues: Array.isArray(raw.cues) ? raw.cues.length : 0,
      patterns: Array.isArray(raw.cues)
        ? raw.cues.reduce((n,c)=>n+(Array.isArray(c.patterns)?c.patterns.length:0),0)
        : 0,
      nearest: 0
    },
    cleanupRemoved: false
  };

  if (await exists(NEAR_SRC)) {
    const rawNText = await readFile(NEAR_SRC, "utf8");
    const rawN = JSON.parse(rawNText);
    await safeCopy(NEAR_SRC, NEAR_DEST);
    summary.public_next.nearest = Array.isArray(rawN.items) ? rawN.items.length : 0;
  }

  for (const target of ["next/cues.bundle.json", "next/cues.nearest.json"]) {
    if (await exists(target)) {
      await rm(target, { force: true });
      summary.cleanupRemoved = true;
    }
  }

  process.stdout.write(JSON.stringify(summary) + "\n");
})();
