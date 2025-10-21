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
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  const list = Array.isArray(hints) ? hints.filter(Boolean) : [];
  if (!list.length) {
    container.innerHTML = "";
    container.style.display = "none";
    container.hidden = true;
    return;
  }
  const items = list
    .map((h) => {
      const key = escapeAttr(h?.key || "");
      const dataKey = key ? ` data-hint-key="${key}"` : "";
      const message = escapeHtml(h?.message || "");
      return `<li${dataKey}><span class="hint-text">${message}</span></li>`;
    })
    .join("");
  container.innerHTML = `<ul class="hint-list">${items}</ul>`;
  container.style.display = "block";
  container.hidden = false;
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
    out += `<mark class="hl" style="background:rgba(220,50,47,0.28);border-radius:3px;">${esc(source.slice(start, end))}</mark>`;
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
  const txt = root.querySelector("#builderInput");
  if (!txt) return;
  const overlay = root.querySelector("#overlay");
  const submitBtn = root.querySelector("#submitBtn");
  const readyDot = root.querySelector("#readyDot");
  const readyLabel = root.querySelector("#readyLabel");
  const wordCountEl = root.querySelector("#wordCount");
  const hintStack = root.querySelector("#hintStack");
  const nearestBanner = root.querySelector("#nearestBanner");
  const exactPanel = root.querySelector("#exactPanel");
  const exactBody = root.querySelector("#exactBody");
  const nearestPanel = root.querySelector("#nearestPanel");
  const nearestBody = root.querySelector("#nearestBody");
  const nearPrev = root.querySelector("#nearPrev");
  const nearNext = root.querySelector("#nearNext");
  const nearIdxEl = root.querySelector("#nearIdx");
  const resultsHeader = root.querySelector("#resultsHeader");
  const quickstartBtns = root.querySelectorAll(".quickstart .ex");
  const guidedChips = root.querySelectorAll(".chip.add");
  const tplInsert = root.querySelector("#tplInsert");
  const tplWhen = root.querySelector("#tplWhen");
  const tplWhere = root.querySelector("#tplWhere");
  const tplWho = root.querySelector("#tplWho");
  const tplWhat = root.querySelector("#tplWhat");

  const TEXT_STORAGE_KEY = "builder:text";
  const NEAR_STORAGE_KEY = "obs-nearest-last";

  let nearList = [];
  let nearIdx = 0;
  let lastNearHash = null;
  let showNearestNotice = false;
  let lastContext = null;

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

  const persistText = () => {
    try {
      sessionStorage.setItem(TEXT_STORAGE_KEY, txt.value);
    } catch {}
  };

  function insertAtCaret(str, caretAdjust = 0) {
    const s = txt.selectionStart;
    const e = txt.selectionEnd;
    const value = typeof str === "string" ? str : "";
    txt.setRangeText(value, s, e, "end");
    if (caretAdjust !== 0) {
      const pos = txt.selectionStart + caretAdjust;
      txt.setSelectionRange(pos, pos);
    }
    txt.focus();
    render(true);
  }

  quickstartBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      txt.value = btn.getAttribute("data-ex") || "";
      render(true);
      txt.focus();
    });
  });

  if (tplInsert) {
    tplInsert.addEventListener("click", (e) => {
      e.preventDefault();
      const when = (tplWhen?.value || "").trim();
      const where = (tplWhere?.value || "").trim();
      const who = (tplWho?.value || "").trim();
      const what = (tplWhat?.value || "").trim();
      const parts = [];
      if (when) parts.push(when);
      if (where) parts.push(where);
      let body = "";
      if (who && what) body = `${who} ${what}`;
      else if (what) body = what;
      const sentence = [parts.filter(Boolean).join(" "), body].filter(Boolean).join(", ");
      if (sentence) {
        insertAtCaret(sentence);
      }
    });
  }

  guidedChips.forEach((ch) => {
    ch.addEventListener("click", () => {
      const s = ch.getAttribute("data-insert") || "";
      const caretRaw = parseInt(ch.getAttribute("data-caret") || "0", 10);
      const caretAdj = Number.isNaN(caretRaw) ? 0 : caretRaw;
      insertAtCaret(s, caretAdj);
    });
  });

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

  if (hintStack) {
    hintStack.style.display = "none";
    hintStack.hidden = true;
  }

  function buildPillMarkup(items, kind) {
    const list = uniqueSorted(Array.isArray(items) ? items.filter(Boolean) : []);
    if (!list.length) return "";
    const wrapper = document.createElement("div");
    renderSuggestionPills(wrapper, list, kind);
    const html = wrapper.innerHTML.trim();
    return html ? `<div class="pill-group">${html}</div>` : "";
  }

  function clearResults() {
    nearList = [];
    nearIdx = 0;
    lastNearHash = null;
    showNearestNotice = false;
    if (exactBody) exactBody.innerHTML = "";
    if (exactPanel) exactPanel.hidden = true;
    if (nearestBody) nearestBody.innerHTML = "";
    if (nearestPanel) nearestPanel.hidden = true;
    if (nearestBanner) nearestBanner.hidden = true;
    if (nearIdxEl) nearIdxEl.textContent = "";
    if (nearPrev) nearPrev.disabled = true;
    if (nearNext) nearNext.disabled = true;
  }

  function updateWordCount(value) {
    const wc = (String(value || "").trim().match(/\S+/g) || []).length;
    if (wordCountEl) {
      wordCountEl.textContent = wc ? `${wc} words` : "";
    }
  }

  function setStatus(state) {
    if (!readyDot || !readyLabel || !submitBtn) return;
    readyDot.className = `dot ${state}`;
    if (state === "green") {
      readyLabel.textContent = "Ready — exact match";
    } else if (state === "yellow") {
      readyLabel.textContent = "Almost — similar situations available";
    } else {
      readyLabel.textContent = "Not ready — keep only what a camera/mic would capture";
    }
    submitBtn.disabled = state === "red";
    if (state !== "yellow" && nearestBanner) {
      nearestBanner.hidden = true;
    }
  }

  function attachHintActions(hints) {
    if (!hintStack) return;
    const list = Array.isArray(hints) ? hints : [];
    if (!list.length) return;
    const ensureActions = (item) => {
      if (!item) return null;
      let actions = item.querySelector(".hint-actions");
      if (actions) {
        actions.innerHTML = "";
        return actions;
      }
      actions = document.createElement("span");
      actions.className = "hint-actions";
      item.appendChild(actions);
      return actions;
    };
    list.forEach((hint) => {
      const key = hint?.key;
      if (!key) return;
      const item = hintStack.querySelector(`[data-hint-key="${key}"]`);
      if (!item) return;
      const actions = ensureActions(item);
      if (!actions) return;
      if (key === "absolutes") {
        const options = [
          { label: "this week", insert: "this week " },
          { label: "today at", insert: "today at " },
          { label: "yesterday at", insert: "yesterday at " },
        ];
        options.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "hint-chip";
          btn.textContent = opt.label;
          btn.addEventListener("click", () => {
            txt.focus();
            insertAtCaret(opt.insert);
          });
          actions.appendChild(btn);
        });
      } else if (key === "labels") {
        const sample = 'said “This is a waste of time.”';
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hint-chip";
        btn.textContent = "Swap to a quote";
        btn.addEventListener("click", () => {
          const text = txt.value;
          const rx = new RegExp(LABELS_RX.source, LABELS_RX.flags);
          const match = rx.exec(text);
          if (match && typeof match.index === "number") {
            const start = match.index;
            const end = start + match[0].length;
            txt.focus();
            txt.setSelectionRange(start, end);
            insertAtCaret(sample);
          } else {
            txt.focus();
            insertAtCaret(sample);
          }
        });
        actions.appendChild(btn);
      }
      if (!actions.childElementCount) {
        actions.remove();
      }
    });
  }

  function renderNearest() {
    if (!nearestPanel || !nearestBody) return;
    if (!nearList.length) {
      nearestPanel.hidden = true;
      nearestBody.innerHTML = "";
      if (nearestBanner) nearestBanner.hidden = true;
      if (nearIdxEl) nearIdxEl.textContent = "";
      if (nearPrev) nearPrev.disabled = true;
      if (nearNext) nearNext.disabled = true;
      return;
    }
    nearestPanel.hidden = false;
    if (nearestBanner) nearestBanner.hidden = !showNearestNotice;
    const cur = nearList[nearIdx] || {};
    const uniq = (xs) => uniqueSorted(Array.isArray(xs) ? xs : []);
    const feelingsMarkup = buildPillMarkup(uniq(cur.feelings), "feeling");
    const needsMarkup = buildPillMarkup(uniq(cur.needs), "need");
    const parts = [];
    if (cur.example) {
      parts.push(`<div class="result-note"><div class="muted small">Example</div><p>${escapeHtml(cur.example)}</p></div>`);
    }
    if (feelingsMarkup) {
      parts.push(`<div class="result-block"><span class="muted small">Feelings to explore</span>${feelingsMarkup}</div>`);
    }
    if (needsMarkup) {
      parts.push(`<div class="result-block"><span class="muted small">Needs to consider</span>${needsMarkup}</div>`);
    }
    if (!parts.length) {
      parts.push(`<p class="muted small">No catalog suggestions available yet.</p>`);
    }
    parts.push(`<p class="muted small">Use ◀ ▶ buttons or arrow keys to cycle similar situations.</p>`);
    nearestBody.innerHTML = parts.join("\n");
    if (nearIdxEl) nearIdxEl.textContent = `${nearIdx + 1}/${nearList.length}`;
    if (nearPrev) nearPrev.disabled = nearList.length <= 1;
    if (nearNext) nearNext.disabled = nearList.length <= 1;
    persistNearSelection();
  }

  function stepNearest(delta) {
    if (!nearList.length) return;
    const total = nearList.length;
    nearIdx = ((nearIdx + delta) % total + total) % total;
    renderNearest();
  }

  nearPrev?.addEventListener("click", (evt) => {
    evt.preventDefault();
    stepNearest(-1);
  });
  nearNext?.addEventListener("click", (evt) => {
    evt.preventDefault();
    stepNearest(1);
  });

  function handleNearestKeys(evt) {
    if (!nearList.length) return;
    if (!nearestPanel || nearestPanel.hidden) return;
    if (evt.target === txt) return;
    if (evt.key === "ArrowLeft") {
      evt.preventDefault();
      stepNearest(-1);
    } else if (evt.key === "ArrowRight") {
      evt.preventDefault();
      stepNearest(1);
    }
  }

  document.addEventListener("keydown", handleNearestKeys);

  function showExactResults(ctx) {
    if (!exactPanel || !exactBody) return;
    const hitsCount = Array.isArray(ctx?.hits) ? ctx.hits.length : 0;
    const agg = aggregateSuggestions(ctx?.hits || []);
    const feelingsMarkup = buildPillMarkup(agg.feelings || [], "feeling");
    const needsMarkup = buildPillMarkup(agg.needs || [], "need");
    const parts = [];
    let note = "Ready to explore feelings and needs.";
    if (hitsCount > 1) {
      note = `Direct matches found — suggestions prioritized from ${hitsCount} cues.`;
    } else if (hitsCount === 1) {
      note = "Direct match found — suggestions prioritized from the matching cue.";
    }
    parts.push(`<p class="muted small">${escapeHtml(note)}</p>`);
    if (feelingsMarkup) {
      parts.push(`<div class="result-block"><span class="muted small">Feelings to explore</span>${feelingsMarkup}</div>`);
    }
    if (needsMarkup) {
      parts.push(`<div class="result-block"><span class="muted small">Needs to consider</span>${needsMarkup}</div>`);
    }
    if (!feelingsMarkup && !needsMarkup) {
      parts.push(`<p class="muted small">No catalog suggestions available yet.</p>`);
    }
    exactBody.innerHTML = parts.join("\n");
    exactPanel.hidden = false;
    if (nearestPanel) nearestPanel.hidden = true;
    if (nearestBody) nearestBody.innerHTML = "";
    if (nearestBanner) nearestBanner.hidden = true;
  }

  function handleSubmit(auto = false, context = null) {
    const ctx = context || lastContext;
    if (!ctx) return;
    const stateNow = ctx.state ?? computeState(ctx);
    if (stateNow === "red") {
      showNearestNotice = false;
      if (nearestBanner) nearestBanner.hidden = true;
      return;
    }
    if (stateNow === "green") {
      showNearestNotice = false;
      showExactResults(ctx);
    } else if (stateNow === "yellow") {
      nearList = nearestForTextMinHash(ctx.txt, NEAR_TOP_K, NEAR_THRESHOLD);
      lastNearHash = nearList.length ? hashText(ctx.txt) : null;
      const storedIdx = lastNearHash != null ? loadNearSelection() : null;
      nearIdx =
        typeof storedIdx === "number" && nearList.length && storedIdx >= 0 && storedIdx < nearList.length
          ? storedIdx
          : 0;
      showNearestNotice = true;
      renderNearest();
    }
    if (resultsHeader) {
      try {
        resultsHeader.focus({ preventScroll: true });
      } catch {
        if (typeof resultsHeader.focus === "function") {
          resultsHeader.focus();
        }
      }
      try {
        resultsHeader.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        resultsHeader.scrollIntoView();
      }
    }
  }

  function render(force = false) {
    persistText();
    clearResults();
    const value = txt.value;
    const { reasons, hits } = evalText(value);
    const evalCheck = detectEvaluation(value);
    const catalogCheck = detectCatalogHints(value);
    const allHints = [...(evalCheck.hints || []), ...(catalogCheck.hints || [])];
    syncOverlayMetrics();
    const overlaySpans = (evalCheck.hits || [])
      .filter(
        (h) => h && h.blocking && BLOCKING_HL_KEYS.has(h.key) && Number.isFinite(h.start) && Number.isFinite(h.end)
      )
      .map(({ start, end, match, key }) => ({ start, end, match, key }));
    renderOverlay(overlay, value, overlaySpans);
    syncOverlayScroll();
    renderHints(hintStack, allHints);
    attachHintActions(allHints);
    const passCue = reasons.has("cue");
    const passSpeech = reasons.has("speech");
    const passAction = reasons.has("action");
    const passPerception = reasons.has("perception");
    const passTimeEvent = reasons.has("timeEvent");
    const state = computeState({
      hits,
      evalHits: evalCheck.hits,
      passCue,
      passSpeech,
      passAction,
      passPerception,
      passTimeEvent,
      txt: value,
      blockingEval: evalCheck.blocking,
    });
    setStatus(state);
    updateWordCount(value);
    lastContext = {
      hits,
      evalHits: evalCheck.hits,
      passCue,
      passSpeech,
      passAction,
      passPerception,
      passTimeEvent,
      txt: value,
      blockingEval: evalCheck.blocking,
      state,
    };
    if (force && state !== "red") {
      handleSubmit(true, lastContext);
    }
  }

  try {
    const stored = sessionStorage.getItem(TEXT_STORAGE_KEY);
    if (stored && !txt.value) {
      txt.value = stored;
    }
  } catch {}

  txt.addEventListener("input", () => {
    render();
  });
  txt.addEventListener("scroll", syncOverlayScroll);
  window.addEventListener("resize", syncOverlayMetrics);
  submitBtn?.addEventListener("click", (evt) => {
    evt.preventDefault();
    handleSubmit(false);
  });

  syncOverlayMetrics();
  render();
}


document.addEventListener("DOMContentLoaded", boot);
