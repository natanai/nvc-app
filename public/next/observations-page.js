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

function escapeAttr(str) {
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

function quoteRanges(s){
  const ranges = [];
  const rx = /"[^"]*"|‘[^’]*’|“[^”]*”/g;
  let m;
  while ((m = rx.exec(s))) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function inRanges(i, ranges){
  for (const [a, b] of ranges) if (i >= a && i < b) return true;
  return false;
}

function stripQuoted(s){
  return String(s || "").replace(/"[^"]*"|‘[^’]*’|“[^”]*”/g, " ");
}

function detectEvaluation(text){
  const source = String(text || "");
  const qr = quoteRanges(source);
  const hits = [];
  const hints = [];
  const seen = new Set();
  for (const rule of EVAL_RULES){
    const flags = rule.rx.flags.includes("g") ? rule.rx.flags : rule.rx.flags + "g";
    const finder = new RegExp(rule.rx.source, flags);
    let match;
    let any = false;
    while ((match = finder.exec(source))) {
      const textMatch = match[0];
      if (!textMatch) {
        if (finder.lastIndex === match.index) finder.lastIndex++;
        continue;
      }
      if (inRanges(match.index, qr)) {
        if (finder.lastIndex === match.index) finder.lastIndex++;
        continue;
      }
      any = true;
      const end = match.index + textMatch.length;
      hits.push({ pattern: rule.rx.source, match: textMatch, key: rule.key, blocking: !!rule.blocking, start: match.index, end });
      if (finder.lastIndex === match.index) finder.lastIndex++;
    }
    if (any && rule.hint && !seen.has(rule.key)) {
      hints.push({ key: rule.key, message: rule.hint, blocking: !!rule.blocking });
      seen.add(rule.key);
    }
  }
  return { hits, hints, blocking: hits.some(h => h.blocking) };
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
    if (container.classList && typeof container.classList.remove === "function") {
      container.classList.remove("is-visible");
    }
    return;
  }
  const items = hints.map(h => `<li class="obs-hints__item">${escapeHtml(h.message || "")}</li>`).join("");
  container.innerHTML = `
    <div class="obs-hints__header">
      <span class="obs-hints__eyebrow">Try this</span>
      <h3 class="obs-hints__title">Make it purely observational</h3>
    </div>
    <ul class="obs-hints__list">${items}</ul>
  `;
  container.style.display = "grid";
  if (container.classList && typeof container.classList.add === "function") {
    container.classList.add("is-visible");
  }
}

function renderExamples(container, pairs) {
  if (!container) return;
  if (!Array.isArray(pairs) || !pairs.length) {
    container.innerHTML = "<p class=\"obs-muted\">No examples available right now.</p>";
    return;
  }
  const rows = pairs.map((pair) => {
    const evaluation = escapeHtml(pair?.evaluation ?? "");
    const observation = escapeHtml(pair?.observation ?? "");
    return `<article class="obs-example">
      <p class="obs-example__label">Evaluation</p>
      <p class="obs-example__text">${evaluation}</p>
      <p class="obs-example__label">Observation</p>
      <p class="obs-example__text">${observation}</p>
    </article>`;
  }).join("");
  container.innerHTML = `<div class="obs-examples__list">${rows}</div>`;
}

const BLOCKING_HL_KEYS = new Set(["absolutes", "shoulds", "labels", "intent", "intensifiers"]);

function renderOverlay(el, text, spans) {
  if (!el) return;
  const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const ordered = Array.isArray(spans) ? [...spans].sort((a, b) => (a.start ?? 0) - (b.start ?? 0)) : [];
  let i = 0;
  let out = "";
  const source = String(text || "");
  for (const sp of ordered) {
    const start = Math.max(0, Math.min(source.length, sp.start ?? 0));
    const end = Math.max(start, Math.min(source.length, sp.end ?? start));
    out += esc(source.slice(i, start));
    const keyAttr = sp?.key ? ` data-flag="${escapeAttr(sp.key)}"` : "";
    out += `<mark class="obs-overlay__flag"${keyAttr}>${esc(source.slice(start, end))}</mark>`;
    i = end;
  }
  out += esc(source.slice(i));
  el.innerHTML = out;
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
    needs: it.needs || [],
    example: it.example || ""
  }))
    .filter(x => x.score >= thr)
    .sort((a,b) => b.score - a.score)
    .slice(0,k);
  return scored;
}

const PASS_LABELS = { cue:"Cue", speech:"Speech", action:"Action", perception:"Perception", timeEvent:"Time+Event" };
const PASS_DESCRIPTIONS = {
  cue: "Matches a known situation from our library.",
  speech: "Includes the exact words that were spoken or written.",
  action: "Describes a concrete action someone took.",
  perception: "Uses language like ‘I saw/heard/read…’.",
  timeEvent: "Anchors the observation with timing or frequency.",
};
const EVAL_DESCRIPTION = "Keep judgment words out of this sentence for a clean observation.";

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
  const keys = ["cue","speech","action","perception","timeEvent"];
  const stateText = {
    pass: "Complete",
    todo: "Not yet detected",
    alert: "Remove evaluation language",
  };
  const buildItem = (item) => {
    const state = item.state;
    const icon = state === "pass" ? "✓" : state === "alert" ? "!" : "•";
    const srLabel = stateText[state] ? ` <span class="visually-hidden">— ${escapeHtml(stateText[state])}</span>` : "";
    const kindAttr = item.kind ? ` data-kind="${escapeAttr(item.kind)}"` : "";
    const description = item.description ? `<span class="obs-checklist__description">${escapeHtml(item.description)}</span>` : "";
    return `<li class="obs-checklist__item" data-state="${escapeAttr(state)}"${kindAttr}>`
      + `<span class="obs-checklist__icon" aria-hidden="true">${icon}</span>`
      + `<div class="obs-checklist__content">`
      + `<span class="obs-checklist__label">${escapeHtml(item.label)}${srLabel}</span>`
      + `${description}</div>`
      + `</li>`;
  };
  const items = keys.map((key) => ({
    label: PASS_LABELS[key] || key,
    description: PASS_DESCRIPTIONS[key] || "",
    state: reasons.has(key) ? "pass" : "todo",
  }));
  items.push({ label: "Evaluation language", description: EVAL_DESCRIPTION, state: blockingEval ? "alert" : "pass", kind: "eval" });
  container.innerHTML = `<ul class="obs-checklist__list">${items.map(buildItem).join("")}</ul>`;
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
  const overlay = root.querySelector("#overlay");
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
  const nearBanner = root.querySelector("#nearBanner");
  const nearExample = root.querySelector("#nearExample");
  const nearFeelings = root.querySelector("#nearFeelings");
  const nearNeeds = root.querySelector("#nearNeeds");
  const nearPager = root.querySelector("#nearPager");
  const btnPrev = root.querySelector("#prevNear");
  const btnNext = root.querySelector("#nextNear");

  let nearList = [];
  let nearIdx = 0;
  let lastNearHash = null;

  const NEAR_STORAGE_KEY = "obs-nearest-last";

  const ensureOverlayBase = () => {
    if (!overlay) return;
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.whiteSpace = "pre-wrap";
    overlay.style.color = "transparent";
    overlay.style.overflow = "hidden";
    overlay.style.zIndex = "1";
    overlay.style.userSelect = "none";
    overlay.style.wordBreak = "break-word";
  };

  const syncOverlayMetrics = () => {
    if (!overlay) return;
    ensureOverlayBase();
    const cs = window.getComputedStyle(txt);
    overlay.style.padding = cs.padding;
    overlay.style.font = cs.font;
    overlay.style.lineHeight = cs.lineHeight;
    overlay.style.letterSpacing = cs.letterSpacing;
    overlay.style.textAlign = cs.textAlign;
    overlay.style.borderRadius = cs.borderRadius;
    overlay.style.boxSizing = cs.boxSizing;
  };

  const syncOverlayScroll = () => {
    if (!overlay) return;
    overlay.style.transform = `translate(${-txt.scrollLeft}px, ${-txt.scrollTop}px)`;
  };

  const readNearStorage = () => {
    try {
      const raw = sessionStorage.getItem(NEAR_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeNearStorage = (data) => {
    try {
      sessionStorage.setItem(NEAR_STORAGE_KEY, JSON.stringify(data));
    } catch {}
  };

  const persistNearSelection = () => {
    if (!lastNearHash || !nearList.length) return;
    const data = readNearStorage();
    data[lastNearHash] = nearIdx;
    writeNearStorage(data);
  };

  const loadNearSelection = () => {
    if (!lastNearHash) return null;
    const data = readNearStorage();
    const value = data[lastNearHash];
    return typeof value === "number" ? value : null;
  };

  const hashText = (s) => fnv1a32(String(s || ""), 0x811c9dc5).toString(16);

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
    const statusWrap = readyDot.parentElement;
    if (statusWrap && statusWrap.classList && statusWrap.classList.contains("obs-status")) {
      statusWrap.setAttribute("data-state", state);
    }
    readyLabel.textContent = state === "green" ? "Ready — direct matches unlocked"
      : state === "yellow" ? "Almost there — submit to explore similar situations"
      : "Not ready yet — focus on observable details";
    submitBtn.disabled = (state === "red");
  }

  function renderNearest(){
    if (!nearestPanel) return;
    if (!nearList.length){
      nearestPanel.style.display = "none";
      if (nearBanner) nearBanner.style.display = "none";
      if (nearExample) {
        nearExample.style.display = "none";
        nearExample.innerHTML = "";
      }
      return;
    }
    nearestPanel.style.display = "block";
    if (nearBanner) nearBanner.style.display = "block";
    const cur = nearList[nearIdx];
    const uniq = xs => uniqueSorted(Array.isArray(xs) ? xs : []);
    renderSuggestionPills(nearFeelings, uniq(cur.feelings), "feeling");
    renderSuggestionPills(nearNeeds, uniq(cur.needs), "need");
    if (nearExample) {
      if (cur.example) {
        nearExample.innerHTML = `<div class="muted">Example</div><div>${escapeHtml(cur.example)}</div>`;
        nearExample.style.display = "block";
      } else {
        nearExample.innerHTML = "";
        nearExample.style.display = "none";
      }
    }
    if (nearPager) nearPager.textContent = `Similar suggestion ${nearIdx+1} of ${nearList.length} — use ← → to cycle.`;
    persistNearSelection();
  }

  const stepNearest = (delta) => {
    if (!nearList.length) return;
    const total = nearList.length;
    nearIdx = ((nearIdx + delta) % total + total) % total;
    renderNearest();
  };

  btnPrev?.addEventListener("click", ()=>{
    stepNearest(-1);
  });
  btnNext?.addEventListener("click", ()=>{
    stepNearest(1);
  });

  const handleNearestKeys = (evt) => {
    if (!nearList.length) return;
    if (!nearestPanel || nearestPanel.style.display === "none") return;
    if (evt.target === txt) return;
    if (evt.key === "ArrowLeft") {
      evt.preventDefault();
      stepNearest(-1);
    } else if (evt.key === "ArrowRight") {
      evt.preventDefault();
      stepNearest(1);
    }
  };

  document.addEventListener("keydown", handleNearestKeys);

  function render() {
    const { reasons, hits } = evalText(txt.value);
    const evalCheck = detectEvaluation(txt.value);
    const catalogCheck = detectCatalogHints(txt.value);
    const allHints = [...(evalCheck.hints || []), ...(catalogCheck.hints || [])];
    syncOverlayMetrics();
    const overlaySpans = (evalCheck.hits || [])
      .filter(h => h && h.blocking && BLOCKING_HL_KEYS.has(h.key) && Number.isFinite(h.start) && Number.isFinite(h.end))
      .map(({ start, end, match, key }) => ({ start, end, match, key }));
    renderOverlay(overlay, txt.value, overlaySpans);
    syncOverlayScroll();
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
    if (nearBanner) nearBanner.style.display = "none";
    if (nearExample) {
      nearExample.style.display = "none";
      nearExample.innerHTML = "";
    }
    nearList = [];
    nearIdx = 0;
    lastNearHash = null;
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
        const chipHtml = chips.map(word => `<span class="obs-warning__token">${escapeHtml(word)}</span>`).join("");
        const tokens = chipHtml ? `<div class="obs-warning__tokens">${chipHtml}</div>` : "";
        evalWarnings.innerHTML = `
          <div class="obs-warning__header">
            <strong class="obs-warning__title">Judgment words detected</strong>
            <p class="obs-warning__message">Swap these words for what you literally observed.</p>
          </div>
          ${tokens}
        `;
        evalWarnings.style.display = "grid";
        if (evalWarnings.classList && typeof evalWarnings.classList.add === "function") {
          evalWarnings.classList.add("is-visible");
        }
      } else {
        evalWarnings.innerHTML = "";
        evalWarnings.style.display = "none";
        if (evalWarnings.classList && typeof evalWarnings.classList.remove === "function") {
          evalWarnings.classList.remove("is-visible");
        }
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
        lastNearHash = nearList.length ? hashText(txt.value) : null;
        const storedIdx = lastNearHash != null ? loadNearSelection() : null;
        nearIdx = typeof storedIdx === "number" && nearList.length && storedIdx >= 0 && storedIdx < nearList.length ? storedIdx : 0;
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
  txt.addEventListener("input", () => { render(); });
  txt.addEventListener("scroll", syncOverlayScroll);
  window.addEventListener("resize", syncOverlayMetrics);
  render();
}

document.addEventListener("DOMContentLoaded", boot);
