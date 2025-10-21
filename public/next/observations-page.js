const state = { compiled: [], };

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slug(s) { return String(s || "").trim().toLowerCase(); }
function feelingHref(slugVal) { return `/feelings/${encodeURIComponent(slug(slugVal))}/`; }
function needHref(slugVal) { return `/needs/${encodeURIComponent(slug(slugVal))}/`; }

function renderSuggestionPills(container, items, kind) {
  if (!container) return;
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const href = kind === "feeling" ? feelingHref : needHref;
  container.innerHTML = list.map((s) => {
    const text = escapeHtml(s);
    const target = escapeHtml(href(s));
    const dataSlug = escapeHtml(slug(s));
    return `<a class="pill link" href="${target}" data-slug="${dataSlug}">${text}</a>`;
  }).join("");
}

async function fetchFirst(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.ok) {
        return await r.json();
      }
    } catch {}
  }
  return null;
}

function assetBases() {
  const meta = document.querySelector('meta[name="next-asset-root"]')?.content;
  const bases = [];
  if (meta) bases.push(meta);
  bases.push("/public/next", "/next");
  return Array.from(new Set(bases));
}

const BASES = assetBases();

const FALLBACK = [
  { kw: /\bdeadline|due\b/i, feelings: ["anxious", "pressured"], needs: ["predictability", "clarity"] },
  { kw: /\bmeeting|call|recording\b/i, feelings: ["tense", "anxious"], needs: ["respect", "to-be-heard", "predictability"] },
  { kw: /\bcamera\b/i, feelings: ["lonely", "anxious"], needs: ["connection", "to-be-seen"] },
  { kw: /\bmuted|mute\b/i, feelings: ["embarrassed", "confused"], needs: ["to-be-heard", "respect"] },
  { kw: /\btime\s+off|pto|vacation|leave\b/i, feelings: ["disappointed", "frustrated"], needs: ["consideration", "respect", "predictability"] },
  { kw: /\blate|minutes?\s+late\b/i, feelings: ["disappointed", "irritated"], needs: ["reliability", "consideration"] },
  { kw: /\breply\s+all|cc['’]?d\b/i, feelings: ["anxious", "embarrassed"], needs: ["privacy", "clarity", "respect"] },
  { kw: /\bcalendar|invite\b/i, feelings: ["anxious", "confused"], needs: ["predictability", "clarity"] },
  { kw: /\b(cancel(?:ed|led)|last\s+minute|short\s+notice)\b/i, feelings: ["disappointed", "pressured"], needs: ["reliability", "consideration"] },
  { kw: /\b(interrupted|spoke\s+over|cut\s+me\s+off)\b/i, feelings: ["hurt", "frustrated"], needs: ["to-be-heard", "respect"] },
  { kw: /\b(hung\s+up|left\s+the\s+call|disconnected)\b/i, feelings: ["lonely", "confused"], needs: ["connection", "consideration"] },
  { kw: /\bquestion\b|\basked\b/i, feelings: ["confused", "lonely"], needs: ["clarity", "to-be-heard"] },
  { kw: /\bovertime\b|\bpast\s+the\s+end\b|\bran\s+over\b|\bwent\s+over\b/i, feelings: ["overwhelmed", "tired"], needs: ["consideration", "predictability"] },
  { kw: /\bno\s+response\b|\bsilence\b/i, feelings: ["confused", "hurt"], needs: ["acknowledgement", "connection"] }
];

function deriveFallback(text) {
  const feelings = new Set();
  const needs = new Set();
  for (const rule of FALLBACK) {
    if (rule.kw.test(text)) {
      (rule.feelings || []).forEach(f => feelings.add(f));
      (rule.needs || []).forEach(n => needs.add(n));
    }
  }
  return { feelings: Array.from(feelings), needs: Array.from(needs) };
}

function splitSentences(text) {
  return String(text).replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

const EVAL_PATTERNS = [
  /\b(always|never|every\s+time|nothing\s+ever|no\s+one\s+ever)\b/i,
  /\b(should(?:n['’]t)?|must|have\s+to|ought(?:\s+to)?)\b/i,
  /\b(rude|lazy|selfish|liar|stupid|dumb|incompetent|unprofessional)\b/i,
  /\b(on\s+purpose|intentionally|they\s+just\s+wanted|they\s+meant\s+to)\b/i,
  /\bbecause\s+of\s+you\b/i,
  /\b(clearly|obviously)\b/i
];

function stripQuoted(s){
  return String(s || "").replace(/"[^"]*"|‘[^’]*’|“[^”]*”/g, " ");
}

function detectEvaluation(text){
  const t = stripQuoted(text);
  const hits = [];
  for (const rx of EVAL_PATTERNS){
    const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
    const finder = new RegExp(rx.source, flags);
    let match;
    while ((match = finder.exec(t))){
      if (match[0]) {
        hits.push({ pattern: rx.source, match: match[0] });
      }
      if (finder.lastIndex === match.index) finder.lastIndex++;
    }
  }
  return hits;
}

function compileCues(json) {
  const compiled = [];
  for (const c of (json.cues || [])) {
    for (const p of (c.patterns || [])) {
      try { compiled.push({ cue: c.cue, id: c.cue, re: new RegExp(p, "i"), feelings: c.feelings || [], needs: c.needs || [] }); } catch {}
    }
  }
  return compiled;
}

// speech act
const speechVerb = /\b(?:said|told|wrote|texted|posted|emailed|commented)\b/i;
const quoted = /["“”„](?:[^"“”„\\]|\\.)+["“”„]/;
// action
const actor = /\b(?:i|we|they|he|she|someone|my\s+(?:boss|manager|supervisor|partner|teacher|professor|landlord)|the\s+(?:host|team|call|meeting))\b/i;
const verb = /\b(?:arrived|started|ended|closed|left|muted|recorded|forwarded|posted|tagged|opened|changed|added|removed|ignored|declined|denied|reassigned|replied|escalated|overwrote|cut|revoked)\b/i;
// perception
const perception = /\bI\s+(?:saw|heard|read|received|noticed)\b/i;
// time+event
const anchor = /\b(?:yesterday|today|at\s+\d{1,2}(?::\d{2})?\s?(?:am|pm)?|on\s+(?:mon|tue|wed|thu|fri|sat|sun)|on\s+[A-Za-z]+\s+\d{1,2})\b/i;
const eventNoun = /\b(?:invite|deadline|recording|camera|notes|seat|access|channel|event|policy|payment|shift|schedule|meeting|call)\b/i;

function evalText(text) {
  const sentences = splitSentences(text);
  const hits = [];
  let ok = false;
  const reasons = new Set();
  for (const s of sentences) {
    // cue match
    for (const r of state.compiled) {
      if (r.re.test(s)) { ok = true; reasons.add("cue"); hits.push(r); }
    }
    // speech
    if (speechVerb.test(s) && quoted.test(s)) { ok = true; reasons.add("speech"); }
    // action
    if (actor.test(s) && verb.test(s)) { ok = true; reasons.add("action"); }
    // perception
    if (perception.test(s)) { ok = true; reasons.add("perception"); }
    // time+event
    if (anchor.test(s) && eventNoun.test(s)) { ok = true; reasons.add("timeEvent"); }
  }
  return { ok, reasons, hits };
}

function uniqueSorted(arr) { return Array.from(new Set(arr)).sort((a,b)=>a.localeCompare(b)); }

function aggregateSuggestions(hits){
  const weight = h => /_legacy_next$/.test(h?.id || "") ? 1 : 1.2;
  const add = (map, key, w) => { map.set(key, (map.get(key) || 0) + w); };
  const feelMap = new Map();
  const needMap = new Map();
  for (const h of hits){
    const w = weight(h);
    (h.feelings || []).forEach(x => add(feelMap, x, w));
    (h.needs || []).forEach(x => add(needMap, x, w));
  }
  const top = (map, k=12) => Array.from(map.entries())
    .sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0,k)
    .map(([s]) => s);
  return { feelings: top(feelMap), needs: top(needMap) };
}

let nearestIndex = null;
async function loadNearest(bases){
  const data = await fetchFirst(bases.map(b => `${b}/cues.nearest.json`));
  if (data) {
    nearestIndex = data;
  } else {
    console.warn("Failed to load nearest index");
  }
}

function tokenizeMin(s){
  return String(s||"").toLowerCase().replace(/["“”„'’]/g," ").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/)
    .filter(x=>x && x.length>=3 && !["i","me","my","we","our","you","your","they","their","he","she","it","the","a","an","and","or","but","to","of","for","on","in","at","with","without","by","from","as","that","this","these","those","was","were","is","are","be","been","am","do","did","does","have","has","had","will","would","can","could","while","when","before","after","yesterday","today","tomorrow"].includes(x))
    .map(x=>x.replace(/(ing|ed|ly|s)$/,""));
}

const SEEDS = Array.from({length:64}, (_,i)=> 0x811c9dc5 ^ (i*0x27d4eb2d));
function fnv1a32(str, seed){
  let h = seed>>>0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h>>>0) + ((h<<1)>>>0) + ((h<<4)>>>0) + ((h<<7)>>>0) + ((h<<8)>>>0) + ((h<<24)>>>0);
  }
  return h>>>0;
}

function minhashSig(tokens){
  const sig = new Array(SEEDS.length).fill(0xffffffff);
  for (const t of tokens){
    for (let i=0;i<SEEDS.length;i++){
      const hv = fnv1a32(t, SEEDS[i]);
      if (hv < sig[i]) sig[i] = hv;
    }
  }
  return sig;
}

function jaccardFromMinHash(sigA, sigB){
  let same = 0;
  const L = Math.min(sigA.length, sigB.length);
  for (let i=0;i<L;i++) if (sigA[i] === sigB[i]) same++;
  return L ? same / L : 0;
}

function nearestForTextMinHash(text, k=5, thr=0.22){
  if (!nearestIndex || !Array.isArray(nearestIndex.items)) return [];
  const sigQ = minhashSig(tokenizeMin(text));
  const scored = nearestIndex.items.map(it => ({
    score: jaccardFromMinHash(sigQ, it.sig || []),
    feelings: it.feelings || [],
    needs: it.needs || []
  }))
    .filter(x => x.score >= thr)
    .sort((a,b) => b.score - a.score)
    .slice(0,k);
  return scored;
}

const PASS_LABELS = { cue:"Cue", speech:"Speech", action:"Action", perception:"Perception", timeEvent:"Time+Event" };

function renderBadges(container, reasons, evalHits) {
  if (!container) return;
  const ALL = ["cue","speech","action","perception","timeEvent"];
  const badge = (label, ok, kind="default") => {
    const style = ok
      ? "background:#eaffea;border:1px solid #16a34a"
      : kind === "eval"
        ? "background:#fee2e2;border:1px solid #dc2626;color:#991b1b"
        : "background:#f3f4f6;border:1px solid #e5e7eb";
    return `<span class="pill" style="${style}">${label}</span>`;
  };
  const html = ALL.map(k => badge(PASS_LABELS[k], reasons.has(k))).join(" ");
  const evalOk = !evalHits?.length;
  container.innerHTML = `${html} ${badge("Eval", evalOk, "eval")}`.trim();
}

async function boot() {
  // Load cues
  try {
    const json = await fetchFirst(BASES.map(b => `${b}/cues.bundle.json`));
    if (json) {
      state.compiled = compileCues(json);
    } else {
      console.error("Failed to load cues bundle");
    }
  } catch (e) { console.error("Failed to load cues bundle:", e); }

  await loadNearest(BASES);

  const root = document.getElementById("obs-editor-root");
  const txt = root.querySelector("#txt");
  const check = root.querySelector("#check");
  const why = root.querySelector("#why");
  const btn = root.querySelector("#submit");
  const sug = root.querySelector("#suggestions");
  const feelings = root.querySelector("#feelings");
  const needs = root.querySelector("#needs");
  const matchedCues = root.querySelector("#matchedCues");
  const passBadges = root.querySelector("#passBadges");
  const evalWarnings = root.querySelector("#evalWarnings");
  const nearestPanel = root.querySelector("#nearestPanel");
  const nearFeelings = root.querySelector("#nearFeelings");
  const nearNeeds = root.querySelector("#nearNeeds");
  const nearPager = root.querySelector("#nearPager");
  const nearestCta = root.querySelector("#nearestCta");
  const btnFindNearest = root.querySelector("#findNearest");
  const btnPrev = root.querySelector("#prevNear");
  const btnNext = root.querySelector("#nextNear");

  let nearList = [];
  let nearIdx = 0;

  function renderNearest(){
    if (!nearestPanel) return;
    if (!nearList.length){
      nearestPanel.style.display = "none";
      return;
    }
    nearestPanel.style.display = "block";
    const cur = nearList[nearIdx];
    const uniq = xs => uniqueSorted(Array.isArray(xs) ? xs : []);
    renderSuggestionPills(nearFeelings, uniq(cur.feelings), "feeling");
    renderSuggestionPills(nearNeeds, uniq(cur.needs), "need");
    if (nearPager) nearPager.textContent = `Similar suggestion ${nearIdx+1} of ${nearList.length}`;
  }

  btnPrev?.addEventListener("click", ()=>{
    if (!nearList.length) return;
    nearIdx = (nearIdx + nearList.length - 1) % nearList.length;
    renderNearest();
  });
  btnNext?.addEventListener("click", ()=>{
    if (!nearList.length) return;
    nearIdx = (nearIdx + 1) % nearList.length;
    renderNearest();
  });
  btnFindNearest?.addEventListener("click", ()=>{
    nearList = nearestForTextMinHash(txt.value, 7, 0.22);
    nearIdx = 0;
    renderNearest();
  });

  function render() {
    const { ok: structureOk, reasons, hits } = evalText(txt.value);
    const evalHits = detectEvaluation(txt.value);
    if (passBadges) renderBadges(passBadges, reasons, evalHits);
    const ready = structureOk && evalHits.length === 0;
    check.className = "check " + (ready ? "ok" : "no");
    let message = "Not ready — add something you saw/heard, a quoted phrase, or who did what.";
    if (ready) {
      const passList = Array.from(reasons).map(k => PASS_LABELS[k] || k);
      if (!evalHits.length) passList.push("Eval");
      message = "Ready — passes: " + (passList.length ? passList.join(", ") : "Eval");
    } else if (evalHits.length) {
      message = "Not ready — remove evaluation (‘should’, ‘always’, …) to make it observational.";
    }
    why.textContent = message;
    btn.disabled = !ready;

    if (evalWarnings) {
      if (evalHits.length) {
        const chips = uniqueSorted(evalHits.map(h => h.match?.trim()).filter(Boolean));
        const chipHtml = chips.map(word => `<span class="pill error">${escapeHtml(word)}</span>`).join(" ");
        const prefix = '<div class="muted" style="margin-bottom:4px">Evaluation language detected:</div>';
        const words = chipHtml ? `<div>${chipHtml}</div>` : "";
        evalWarnings.innerHTML = prefix + words;
        evalWarnings.style.display = "block";
      } else {
        evalWarnings.innerHTML = "";
        evalWarnings.style.display = "none";
      }
    }

    if (hits.length === 0) {
      if (nearestCta) nearestCta.style.display = "block";
    } else {
      if (nearestCta) nearestCta.style.display = "none";
      if (nearestPanel) nearestPanel.style.display = "none";
      nearList = [];
      nearIdx = 0;
    }

    btn.onclick = () => {
      if (!ready) return;
      let f = uniqueSorted(hits.flatMap(h => h.feelings));
      let n = uniqueSorted(hits.flatMap(h => h.needs));
      if (hits.length) {
        const agg = aggregateSuggestions(hits);
        f = agg.feelings;
        n = agg.needs;
      } else {
        const fb = deriveFallback(txt.value);
        f = uniqueSorted([...(f || []), ...(fb.feelings || [])]);
        n = uniqueSorted([...(n || []), ...(fb.needs || [])]);
      }
      renderSuggestionPills(feelings, f, "feeling");
      renderSuggestionPills(needs, n, "need");
      matchedCues.textContent = hits.length
        ? `Direct matches found — suggestions prioritized from ${hits.length} cue${hits.length === 1 ? "" : "s"}.`
        : "No direct cue hits — suggestions are generalized.";
      sug.style.display = "block";
    };
  }
  txt.addEventListener("input", render);
  render();
}

document.addEventListener("DOMContentLoaded", boot);
