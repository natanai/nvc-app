#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SOURCE_DIR = path.resolve("data", "next", "generated");
const DEST_DIR = path.resolve("public", "next");
const FILES = ["cues.bundle.json", "cues.nearest.json"];

function copyFile(file) {
  const source = path.join(SOURCE_DIR, file);
  const dest = path.join(DEST_DIR, file);
  if (!fs.existsSync(source)) {
    throw new Error(`Generated file missing: ${source}`);
  }
  fs.copyFileSync(source, dest);
  return dest;
}

function main() {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(DEST_DIR, { recursive: true });
  const outputs = FILES.map(file => path.relative(process.cwd(), copyFile(file)));
  console.log(JSON.stringify({ ok: true, files: outputs }));
}

main();
