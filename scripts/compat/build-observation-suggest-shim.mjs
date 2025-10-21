#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const source = path.resolve("scripts", "compat", "observation-suggest-shim.source.js");
const dest = path.resolve("lib", "observationSuggest.js");

if (!fs.existsSync(source)) {
  console.error(`Missing shim source at ${source}`);
  process.exitCode = 1;
  process.exit(1);
}

const code = fs.readFileSync(source, "utf8");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, code, "utf8");

console.log(
  JSON.stringify({
    built: true,
    source: path.relative(process.cwd(), source),
    dest: path.relative(process.cwd(), dest),
    bytes: Buffer.byteLength(code, "utf8"),
  })
);
