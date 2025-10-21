#!/usr/bin/env node
/**
 * Copies data/generated/cues.bundle.json → public/next/cues.bundle.json
 * Prints one JSON line: { copied, from, to, cues, patterns, nearestItems }
 */
import fs from "node:fs";
import path from "node:path";

const SRC = "data/generated/cues.bundle.json";
const DEST_DIR = "public/next";
const DEST = path.join(DEST_DIR, "cues.bundle.json");
const NEAR_SRC = "data/generated/cues.nearest.json";
const NEAR_DEST = path.join(DEST_DIR, "cues.nearest.json");

(function main(){
  if (!fs.existsSync(SRC)) {
    process.stdout.write(JSON.stringify({ copied:false, error:`missing ${SRC}` }) + "\n");
    process.exit(0);
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
  fs.writeFileSync(DEST, JSON.stringify(raw, null, 2), "utf8");
  let nearestItems = 0;
  if (fs.existsSync(NEAR_SRC)) {
    const rawN = JSON.parse(fs.readFileSync(NEAR_SRC,"utf8"));
    fs.writeFileSync(NEAR_DEST, JSON.stringify(rawN, null, 2), "utf8");
    nearestItems = Array.isArray(rawN.items) ? rawN.items.length : 0;
  }
  const counts = {
    cues: Array.isArray(raw.cues) ? raw.cues.length : 0,
    patterns: Array.isArray(raw.cues) ? raw.cues.reduce((n,c)=>n+(Array.isArray(c.patterns)?c.patterns.length:0),0) : 0,
    nearestItems
  };
  process.stdout.write(JSON.stringify({ copied:true, from:SRC, to:DEST, ...counts }) + "\n");
})();
