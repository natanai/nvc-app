const state = { compiled: [], };

let FEELING_SLUGS = new Set();
let FAUX_FEELING_SLUGS = new Set();
let NEED_SLUGS = new Set();

let EXAMPLE_PAIRS = [];

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

const NEAR_THRESHOLD = 0.22;
const NEAR_TOP_K = 7;

function splitSentences(text) {
  return String(text).replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

const ABSOLUTES_RX = /\b(always|never|constantly|every\s+time|nothing\s+ever|no\s+one\s+ever)\b/i;
const SHOULD_RX = /\b(should(?:n['’]t)?|must|have\s+to|ought(?:\s+to)?)\b/i;
const INTENT_RX = /\b(on\s+purpose|intentionally|to\s+(?:hurt|get\s+back)|for\s+no\s+reason|they\s+(?:meant|wanted)\s+to)\b/i;
const LABELS_RX = /\b(rude|selfish|lazy|aggressive|unprofessional|inconsiderate|immature|arrogant|disrespectful|toxic|careless|liar|stupid|dumb|incompetent)\b/i;
const INTENS_RX = /\b(clearly|obviously|plainly)\b/i;
const BLAME_RX = /\bbecause\s+of\s+you\b/i;

const EVAL_RULES = [
  { key: "absolutes", rx: ABSOLUTES_RX, blocking: true, hint: "Observations avoid ‘always/never’. Try a timeframe or count (e.g., ‘three times this week’)." },
  { key: "shoulds", rx: SHOULD_RX, blocking: true, hint: "‘Should/must’ is evaluative. Describe what you saw/heard." },
  { key: "labels", rx: LABELS_RX, blocking: true, hint: "Words like ‘rude’ are judgments. What would a camera/mic capture?" },
  { key: "intent", rx: INTENT_RX, blocking: true, hint: "We can’t know motives. Remove ‘on purpose/for no reason’; describe the action." },
  { key: "blame", rx: BLAME_RX, blocking: true, hint: "Skip blame phrases like ‘because of you’. Describe what happened instead." },
  { key: "intensifiers", rx: INTENS_RX, blocking: true, hint: "Words like ‘obviously’ lean judgment. Stick to what you noticed." }
];

function stripQuoted(s){
  return String(s || "").replace(/"[^"]*"|‘[^’]*’|“[^”]*”/g, " ");
}

function findMatches(text, rx) {
  const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
  const finder = new RegExp(rx.source, flags);
  const matches = [];
  let match;
  while ((match = finder.exec(text))) {
    if (match[0]) {
      matches.push(match[0]);
    }
    if (finder.lastIndex === match.index) finder.lastIndex++;
  }
  return matches;
}

function detectEvaluation(text){
  const t = stripQuoted(text);
  const hits = [];
  const hints = [];
  const seen = new Set();
  for (const rule of EVAL_RULES){
    const matches = findMatches(t, rule.rx);
    if (!matches.length) continue;
    for (const m of matches){
      hits.push({ pattern: rule.rx.source, match: m, key: rule.key, blocking: !!rule.blocking });
    }
    if (rule.hint && !seen.has(rule.key)) {
      hints.push({ key: rule.key, message: rule.hint, blocking: !!rule.blocking });
      seen.add(rule.key);
    }
  }
  return { hits, hints, blocking: hints.some(h => h.blocking) };
}

function detectCatalogHints(text){
  const stripped = stripQuoted(text).toLowerCase();
  const tokens = stripped.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
  const feelings = new Set();
  const faux = new Set();
  const needs = new Set();
  for (const rawToken of tokens){
    const token = rawToken.toLowerCase();
    if (FAUX_FEELING_SLUGS.has(token)) {
      faux.add(token);
    } else if (FEELING_SLUGS.has(token)) {
      feelings.add(token);
    } else if (NEED_SLUGS.has(token)) {
      needs.add(token);
    }
  }
  const hints = [];
  if (faux.size) {
    const list = formatWordList(Array.from(faux));
    const msg = list
      ? `Words like ${list} describe interpretations. Focus on the observable behavior.`
      : "Words that describe interpretations belong outside the observation.";
    hints.push({ key: "faux_feelings", message: msg, blocking: false });
  }
  if (feelings.size || needs.size) {
    const combined = Array.from(new Set([...feelings, ...needs]));
    const list = formatWordList(combined);
    const prefix = "Save feelings/needs for the next step. Keep this sentence to observable actions/quotes.";
    const msg = list ? `${prefix} (${list})` : prefix;
    hints.push({ key: "feelings_needs", message: msg, blocking: false });
  }
  return { hints, blocking: false };
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

function formatWordList(words) {
  const sorted = uniqueSorted(words.map(w => String(w || "").toLowerCase()).filter(Boolean));
  if (!sorted.length) return "";
  if (sorted.length === 1) {
    return `“${escapeHtml(sorted[0])}”`;
  }
  const last = sorted[sorted.length - 1];
  const rest = sorted.slice(0, -1).map(w => `“${escapeHtml(w)}”`).join(", ");
  return `${rest} and “${escapeHtml(last)}”`;
}

function renderHints(container, hints) {
  if (!container) return;
  if (!Array.isArray(hints) || !hints.length) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }
  const items = hints.map(h => `<li>${escapeHtml(h.message || "")}</li>`).join("");
  container.innerHTML = `<ul style="margin:0;padding-left:18px;">${items}</ul>`;
  container.style.display = "block";
}

function renderExamples(container, pairs) {
  if (!container) return;
  if (!Array.isArray(pairs) || !pairs.length) {
    container.innerHTML = "<div class=\"muted\">No examples available right now.</div>";
    return;
  }
  const rows = pairs.map((pair) => {
    const evaluation = escapeHtml(pair?.evaluation ?? "");
    const observation = escapeHtml(pair?.observation ?? "");
    return `<div class="example-pair" style="margin-bottom:8px;">
      <div><span class="muted">Evaluation:</span> ${evaluation}</div>
      <div><span class="muted">Observation:</span> ${observation}</div>
    </div>`;
  }).join("");
  container.innerHTML = rows;
}

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

function computeState({ hits, evalHits, passCue, passSpeech, passAction, passPerception, passTimeEvent, txt, blockingEval }) {
  if (blockingEval) return "red";
  if (hits.length > 0) return "green";
  const passesOK = passCue && passSpeech && passAction && passPerception && passTimeEvent;
  if (passesOK && evalHits.length === 0) {
    const near = nearestForTextMinHash(txt, NEAR_TOP_K, NEAR_THRESHOLD);
    return near.length ? "yellow" : "red";
  }
  return "red";
}

function renderBadges(container, reasons, evalHits, blockingEval) {
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
  const evalOk = !blockingEval;
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

  let catalogs = null;
  try {
    catalogs = await fetchFirst(BASES.map(b => `${b}/catalog-slugs.json`));
  } catch {}
  const toSet = (arr) => new Set(Array.isArray(arr) ? arr.map(x => String(x || "").toLowerCase()) : []);
  if (catalogs) {
    FEELING_SLUGS = toSet(catalogs.feelings);
    FAUX_FEELING_SLUGS = toSet(catalogs.faux_feelings);
    NEED_SLUGS = toSet(catalogs.needs);
  } else {
    FEELING_SLUGS = new Set();
    FAUX_FEELING_SLUGS = new Set();
    NEED_SLUGS = new Set();
  }

  try {
    const examples = await fetchFirst(BASES.map(b => `${b}/observation-examples.json`));
    EXAMPLE_PAIRS = Array.isArray(examples?.pairs) ? examples.pairs : [];
  } catch {
    EXAMPLE_PAIRS = [];
  }

  const root = document.getElementById("obs-editor-root");
  if (!root) return;
  const txt = root.querySelector("#txt");
  if (!txt) return;
  const submitBtn = root.querySelector("#submitBtn");
  const readyDot = root.querySelector("#readyDot");
  const readyLabel = root.querySelector("#readyLabel");
  const sug = root.querySelector("#suggestions");
  const feelingsHeading = root.querySelector("#feelingsHeading");
  const feelings = root.querySelector("#feelings");
  const needsHeading = root.querySelector("#needsHeading");
  const needs = root.querySelector("#needs");
  const matchedCues = root.querySelector("#matchedCues");
  const noteEl = root.querySelector("#suggestionNote");
  const passBadges = root.querySelector("#passBadges");
  const evalWarnings = root.querySelector("#evalWarnings");
  const hintStack = root.querySelector("#hintStack");
  const examplesPanel = root.querySelector("#examplesPanel");
  const examplesBody = root.querySelector("#examplesBody");
  const nearestPanel = root.querySelector("#nearestPanel");
  const nearFeelings = root.querySelector("#nearFeelings");
  const nearNeeds = root.querySelector("#nearNeeds");
  const nearPager = root.querySelector("#nearPager");
  const btnPrev = root.querySelector("#prevNear");
  const btnNext = root.querySelector("#nextNear");

  let nearList = [];
  let nearIdx = 0;

  if (hintStack) hintStack.style.display = "none";
  if (examplesBody) {
    renderExamples(examplesBody, EXAMPLE_PAIRS);
    if (examplesPanel) {
      examplesPanel.style.display = EXAMPLE_PAIRS.length ? "block" : "none";
    }
  }

  function setStatus(state){
    if (!readyDot || !readyLabel || !submitBtn) return;
    readyDot.className = `dot ${state}`;
    readyLabel.textContent = state === "green" ? "Ready — exact match"
      : state === "yellow" ? "Almost — submit to see similar situations"
      : "Not ready — make it purely observational";
    submitBtn.disabled = (state === "red");
  }

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

  function render() {
    const { reasons, hits } = evalText(txt.value);
    const evalCheck = detectEvaluation(txt.value);
    const catalogCheck = detectCatalogHints(txt.value);
    const allHints = [...(evalCheck.hints || []), ...(catalogCheck.hints || [])];
    if (passBadges) renderBadges(passBadges, reasons, evalCheck.hits, evalCheck.blocking);
    renderHints(hintStack, allHints);
    const passCue = reasons.has("cue");
    const passSpeech = reasons.has("speech");
    const passAction = reasons.has("action");
    const passPerception = reasons.has("perception");
    const passTimeEvent = reasons.has("timeEvent");
    const state = computeState({ hits, evalHits: evalCheck.hits, passCue, passSpeech, passAction, passPerception, passTimeEvent, txt: txt.value, blockingEval: evalCheck.blocking });
    setStatus(state);
    if (nearestPanel) nearestPanel.style.display = "none";
    nearList = [];
    nearIdx = 0;
    if (noteEl) noteEl.textContent = "";
    if (sug) sug.style.display = "none";
    if (feelingsHeading) feelingsHeading.style.display = "none";
    if (feelings) feelings.innerHTML = "";
    if (needsHeading) needsHeading.style.display = "none";
    if (needs) needs.innerHTML = "";
    if (matchedCues) matchedCues.textContent = "";

    if (evalWarnings) {
      if (evalCheck.hits.length) {
        const chips = uniqueSorted(evalCheck.hits.map(h => h.match?.trim()).filter(Boolean));
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
    if (!submitBtn) return;

    submitBtn.onclick = () => {
      const stateNow = computeState({ hits, evalHits: evalCheck.hits, passCue, passSpeech, passAction, passPerception, passTimeEvent, txt: txt.value, blockingEval: evalCheck.blocking });
      if (stateNow === "red") {
        if (noteEl) noteEl.textContent = "Not ready — please make the statement purely observational.";
        return;
      }
      if (stateNow === "green") {
        const agg = aggregateSuggestions(hits);
        const f = agg.feelings;
        const n = agg.needs;
        if (feelingsHeading) feelingsHeading.style.display = f.length ? "block" : "none";
        renderSuggestionPills(feelings, f, "feeling");
        if (needsHeading) needsHeading.style.display = n.length ? "block" : "none";
        renderSuggestionPills(needs, n, "need");
        if (matchedCues) matchedCues.textContent = hits.length
          ? `Direct matches found — suggestions prioritized from ${hits.length} cue${hits.length === 1 ? "" : "s"}.`
          : "Direct matches found.";
        if (noteEl) noteEl.textContent = "Direct matches found — suggestions prioritized from exact cues.";
        if (nearestPanel) nearestPanel.style.display = "none";
        if (sug) sug.style.display = "block";
      } else if (stateNow === "yellow") {
        nearList = nearestForTextMinHash(txt.value, NEAR_TOP_K, NEAR_THRESHOLD);
        nearIdx = 0;
        if (feelings) feelings.innerHTML = "";
        if (needs) needs.innerHTML = "";
        if (matchedCues) matchedCues.textContent = "";
        if (sug) sug.style.display = "block";
        if (feelingsHeading) feelingsHeading.style.display = "none";
        if (needsHeading) needsHeading.style.display = "none";
        renderNearest();
        if (nearestPanel) nearestPanel.style.display = "block";
        if (noteEl) noteEl.textContent = "No exact match — showing similar situations you can cycle through.";
      }
    };
  }
  txt.addEventListener("input", render);
  render();
}

document.addEventListener("DOMContentLoaded", boot);
