#!/usr/bin/env node
import fs from "node:fs";
import vm from "node:vm";

let code = fs.readFileSync("public/next/observations-page.js", "utf8");
const catalogsPath = "public/next/catalog-slugs.json";
if (fs.existsSync(catalogsPath)) {
  const catalogs = JSON.parse(fs.readFileSync(catalogsPath, "utf8"));
  const feelings = JSON.stringify((catalogs.feelings || []).map((s) => String(s || "").toLowerCase()));
  const faux = JSON.stringify((catalogs.faux_feelings || []).map((s) => String(s || "").toLowerCase()));
  const needs = JSON.stringify((catalogs.needs || []).map((s) => String(s || "").toLowerCase()));
  code += `\nFEELING_SLUGS = new Set(${feelings});`;
  code += `\nFAUX_FEELING_SLUGS = new Set(${faux});`;
  code += `\nNEED_SLUGS = new Set(${needs});`;
}
const context = {
  console,
  document: { addEventListener(){}, querySelector(){ return null; } },
  window: {},
  module: { exports: {} },
  exports: {}
};
context.exports = context.module.exports;
vm.runInNewContext(code + "\nmodule.exports = { detectEvaluation, detectCatalogHints };", context, { filename:"observations-page.js" });
const { detectEvaluation, detectCatalogHints } = context.module.exports;

const CASES = [
  ["RED-ABSOLUTE", "You are always late."],
  ["RED-SHOULD", "They should care about my time."],
  ["RED-LABEL", "That was rude."],
  ["RED-INTENT", "He did it on purpose."],
  ["GREEN", "A notification said \"You have been muted by the host.\""],
  ["YELLOW", "By the time I walked into the room, the presentation had already started."],
  ["HINT-FEELING", "I felt anxious when the door slammed."],
  ["HINT-NEED", "I need more autonomy at work."],
  ["HINT-FAUX", "I feel ignored by them."]
];

for (const [tag, text] of CASES){
  const evalRes = detectEvaluation(text);
  const catRes = detectCatalogHints(text);
  const blocking = evalRes.hits.some(h => h.blocking);
  const hintKeys = [...evalRes.hints, ...catRes.hints].map(h=>h.key);
  console.log(JSON.stringify({ tag, text, blocking, hintKeys }));
}
