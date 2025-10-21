#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

// Slug discoverers: feelings, faux-feelings, needs (directory names under repo root)
const ROOTS = [
  { dir: "feelings", key: "feelings" },
  { dir: "faux-feelings", key: "faux_feelings" },
  { dir: "needs", key: "needs" }
];

function dirSlugs(dir){
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name.toLowerCase());
}

(function main(){
  const out = {};
  for (const r of ROOTS){
    out[r.key] = dirSlugs(r.dir);
  }
  const dest = "data/generated/catalog-slugs.json";
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ built:true, dest, counts: Object.fromEntries(Object.entries(out).map(([k,v])=>[k, v.length])) }));
})();
