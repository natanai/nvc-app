#!/usr/bin/env node
import fs from "node:fs";

const SRC = "data/generated/cues.bundle.json";
const DEST = "data/generated/cues.nearest.json";

// simple tokenization (same as editor)
const STOP = new Set(["i","me","my","we","our","you","your","they","their","he","she","it","the","a","an","and","or","but","to","of","for","on","in","at","with","without","by","from","as","that","this","these","those","was","were","is","are","be","been","am","do","did","does","have","has","had","will","would","can","could","while","when","before","after","yesterday","today","tomorrow"]);
function tokenize(s){
  return String(s||"").toLowerCase().replace(/["“”„'’]/g," ").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(x=>x && x.length>=3 && !STOP.has(x)).map(x=>x.replace(/(ing|ed|ly|s)$/,""));
}
function deRegexPattern(pat){
  return String(pat||"").replace(/\\b/g," ").replace(/\\[^\s]/g," ").replace(/\(\?:/g,"(").replace(/[()*+?{}|^\$\\\[\].]/g," ").replace(/\s+/g," ").trim();
}

// 64 seeded 32-bit hash functions (FNV-1a with unique seeds)
const SEEDS = Array.from({length:64}, (_,i)=> 0x811c9dc5 ^ (i*0x27d4eb2d));
function fnv1a32(str, seed){
  let h = seed>>>0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h>>>0) + ((h<<1)>>>0) + ((h<<4)>>>0) + ((h<<7)>>>0) + ((h<<8)>>>0) + ((h<<24)>>>0); // * 16777619
  }
  return h>>>0;
}
function minhash(tokens){
  const sig = new Array(SEEDS.length).fill(0xffffffff);
  for (const t of tokens){
    for (let i=0;i<SEEDS.length;i++){
      const hv = fnv1a32(t, SEEDS[i]);
      if (hv < sig[i]) sig[i] = hv;
    }
  }
  return sig;
}

(function main(){
  if (!fs.existsSync(SRC)) {
    console.log(JSON.stringify({ built:false, error:`missing ${SRC}` }));
    return;
  }
  const bundle = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const items = [];
  for (const c of (bundle.cues||[])){
    const pats = (c.patterns||[]).map(deRegexPattern).join(" ");
    const toks = new Set([...tokenize(c.example||""), ...tokenize(pats)]);
    if (toks.size === 0) continue;
    const sig = minhash(Array.from(toks));
    items.push({
      // no cue id, no tokens, no patterns shipped
      sig,
      feelings: c.feelings||[],
      needs: c.needs||[],
      example: c.example || ""
    });
  }
  const out = { builtAt: new Date().toISOString(), count: items.length, sigLen: 64 };
  fs.writeFileSync(DEST, JSON.stringify({ meta: out, items }, null, 2), "utf8");
  console.log(JSON.stringify({ built:true, src:SRC, dest:DEST, items: items.length, sigLen: 64 }));
})();
