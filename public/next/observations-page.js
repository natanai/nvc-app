const state = { compiled: [], };

let FEELING_SLUGS = new Set();
let FAUX_FEELING_SLUGS = new Set();
let NEED_SLUGS = new Set();

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

function renderHints(container, hints, actions = {}) {
  if (!container) return;
  if (!Array.isArray(hints) || !hints.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }
  container.innerHTML = "";
  container.hidden = false;

  const heading = document.createElement("p");
  heading.className = "hint-intro muted";
  heading.textContent = "Try these tweaks:";
  container.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "hint-list";

  for (const hint of hints) {
    const item = document.createElement("li");
    item.className = "hint-item";
    const message = document.createElement("span");
    message.className = "hint-text";
    message.textContent = hint?.message || "";
    item.appendChild(message);

    if (hint?.key === "absolutes" && typeof actions.insertText === "function") {
      const wrap = document.createElement("span");
      wrap.className = "hint-actions";
      const options = [
        { label: "this week", insert: "this week " },
        { label: "today at …", insert: "today at " },
        { label: "yesterday at …", insert: "yesterday at " },
      ];
      for (const opt of options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hint-action";
        btn.textContent = opt.label;
        btn.addEventListener("click", (evt) => {
          evt.preventDefault();
          actions.insertText(opt.insert, opt.caret ?? 0);
        });
        wrap.appendChild(btn);
      }
      item.appendChild(wrap);
    } else if (hint?.key === "labels" && typeof actions.replaceLabel === "function") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hint-action";
      btn.textContent = "Swap for a quote";
      btn.addEventListener("click", (evt) => {
        evt.preventDefault();
        actions.replaceLabel();
      });
      item.appendChild(btn);
    }

    list.appendChild(item);
  }

  container.appendChild(list);
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
  const resultsHeader = root.querySelector("#resultsHeader");
  const exactPanel = root.querySelector("#exactPanel");
  const exactBody = root.querySelector("#exactBody");
  const nearestPanel = root.querySelector("#nearestPanel");
  const nearestBody = root.querySelector("#nearestBody");
  const nearPrev = root.querySelector("#nearPrev");
  const nearNext = root.querySelector("#nearNext");
  const nearIdxLabel = root.querySelector("#nearIdx");

  const quickstartButtons = root.querySelectorAll(".quickstart .ex");
  const guidedChips = root.querySelectorAll(".chip.add");
  const tplInsert = root.querySelector("#tplInsert");
  const tplWhen = root.querySelector("#tplWhen");
  const tplWhere = root.querySelector("#tplWhere");
  const tplWho = root.querySelector("#tplWho");
  const tplWhat = root.querySelector("#tplWhat");
  const tplDetails = root.querySelector("#tpl");

  const TEXT_STORAGE_KEY = "builder:text";
  const NEAR_STORAGE_KEY = "obs-nearest-last";

  let nearList = [];
  let nearIdx = 0;
  let lastNearHash = null;

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

  const readStoredText = () => {
    try {
      const raw = sessionStorage.getItem(TEXT_STORAGE_KEY);
      return typeof raw === "string" ? raw : "";
    } catch {
      return "";
    }
  };

  const writeStoredText = (value) => {
    try {
      if (value) {
        sessionStorage.setItem(TEXT_STORAGE_KEY, value);
      } else {
        sessionStorage.removeItem(TEXT_STORAGE_KEY);
      }
    } catch {}
  };

  const updateWordCount = () => {
    if (!wordCountEl) return;
    const words = txt.value.trim().match(/\S+/g);
    const count = words ? words.length : 0;
    wordCountEl.textContent = count ? `${count} word${count === 1 ? "" : "s"}` : "";
  };

  const clearResults = () => {
    if (exactBody) exactBody.innerHTML = "";
    if (nearestBody) nearestBody.innerHTML = "";
    if (exactPanel) exactPanel.hidden = true;
    if (nearestPanel) nearestPanel.hidden = true;
    if (nearestBanner) nearestBanner.hidden = true;
    if (nearIdxLabel) nearIdxLabel.textContent = "";
    if (nearPrev) nearPrev.disabled = true;
    if (nearNext) nearNext.disabled = true;
  };

  function setStatus(state) {
    if (!readyDot || !readyLabel || !submitBtn) return;
    readyDot.className = `dot ${state}`;
    readyLabel.textContent = state === "green"
      ? "Ready — exact match"
      : state === "yellow"
        ? "Almost — similar situations available"
        : "Not ready — keep only what a camera/mic would capture";
    submitBtn.disabled = state === "red";
  }

  function renderExactMatches(hits) {
    if (!exactBody) return;
    exactBody.innerHTML = "";
    const agg = aggregateSuggestions(hits);
    const feelings = Array.isArray(agg.feelings) ? agg.feelings : [];
    const needs = Array.isArray(agg.needs) ? agg.needs : [];
    const lead = document.createElement("p");
    lead.className = "muted small";
    if (hits.length) {
      lead.textContent = `Direct matches from ${hits.length} cue${hits.length === 1 ? "" : "s"} — suggestions tailored to your sentence.`;
    } else {
      lead.textContent = "Direct matches found — suggestions tailored to your sentence.";
    }
    exactBody.appendChild(lead);

    const buildGroup = (title, items, kind) => {
      if (!items.length) return;
      const group = document.createElement("div");
      group.className = "result-group";
      const heading = document.createElement("h5");
      heading.className = "h6";
      heading.textContent = title;
      group.appendChild(heading);
      const row = document.createElement("div");
      row.className = "pill-row";
      renderSuggestionPills(row, items, kind);
      group.appendChild(row);
      exactBody.appendChild(group);
    };

    buildGroup("Feelings to explore", feelings, "feeling");
    buildGroup("Needs to explore", needs, "need");

    if (!feelings.length && !needs.length) {
      const empty = document.createElement("p");
      empty.className = "muted small";
      empty.textContent = "No suggestions yet — add a quote, timing, or concrete action to unlock more.";
      exactBody.appendChild(empty);
    }
  }

  function renderNearest() {
    if (!nearestBody) return;
    nearestBody.innerHTML = "";
    if (!nearList.length) {
      if (nearestPanel) nearestPanel.hidden = true;
      if (nearIdxLabel) nearIdxLabel.textContent = "";
      if (nearPrev) nearPrev.disabled = true;
      if (nearNext) nearNext.disabled = true;
      return;
    }
    if (nearestPanel) nearestPanel.hidden = false;

    const current = nearList[nearIdx];
    const intro = document.createElement("p");
    intro.className = "muted small";
    intro.textContent = "Borrow phrasing from this similar situation to turn the light green.";
    nearestBody.appendChild(intro);

    if (current.example) {
      const example = document.createElement("blockquote");
      example.className = "nearest-example";
      example.textContent = current.example;
      nearestBody.appendChild(example);
    }

    const uniq = (xs) => uniqueSorted(Array.isArray(xs) ? xs : []);
    const feelings = uniq(current.feelings);
    const needs = uniq(current.needs);

    const buildGroup = (title, items, kind) => {
      if (!items.length) return;
      const group = document.createElement("div");
      group.className = "result-group";
      const heading = document.createElement("h5");
      heading.className = "h6";
      heading.textContent = title;
      group.appendChild(heading);
      const row = document.createElement("div");
      row.className = "pill-row";
      renderSuggestionPills(row, items, kind);
      group.appendChild(row);
      nearestBody.appendChild(group);
    };

    buildGroup("Feelings to explore", feelings, "feeling");
    buildGroup("Needs to explore", needs, "need");

    if (!feelings.length && !needs.length && !current.example) {
      const empty = document.createElement("p");
      empty.className = "muted small";
      empty.textContent = "We found a close situation, but no suggestions yet. Add the exact words or actions you noticed.";
      nearestBody.appendChild(empty);
    }

    if (nearIdxLabel) nearIdxLabel.textContent = `${nearIdx + 1}/${nearList.length}`;
    if (nearPrev) nearPrev.disabled = nearList.length <= 1;
    if (nearNext) nearNext.disabled = nearList.length <= 1;
    persistNearSelection();
  }

  const stepNearest = (delta) => {
    if (!nearList.length) return;
    const total = nearList.length;
    nearIdx = ((nearIdx + delta) % total + total) % total;
    renderNearest();
  };

  const handleNearestKeys = (evt) => {
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
  };

  function insertAtCaret(str, caretAdjust = 0) {
    const s = txt.selectionStart;
    const e = txt.selectionEnd;
    txt.setRangeText(str, s, e, "end");
    if (caretAdjust) {
      const pos = txt.selectionStart + caretAdjust;
      txt.setSelectionRange(pos, pos);
    }
    render(true);
    txt.focus();
  }

  function replaceLabelExample() {
    const sample = "said “Please join us on time.”";
    const value = txt.value;
    const rx = /\brude\b/i;
    const match = rx.exec(value);
    if (match) {
      const before = value.slice(0, match.index);
      const after = value.slice(match.index + match[0].length);
      txt.value = `${before}${sample}${after}`;
      const pos = before.length + sample.length;
      txt.setSelectionRange(pos, pos);
      render(true);
      txt.focus();
    } else {
      insertAtCaret(sample);
    }
  }

  function render(force = false) {
    updateWordCount();
    writeStoredText(txt.value);
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
    renderHints(hintStack, allHints, {
      insertText: (str, caret = 0) => insertAtCaret(str, caret),
      replaceLabel: replaceLabelExample,
    });

    clearResults();
    nearList = [];
    nearIdx = 0;
    lastNearHash = null;

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
      txt: txt.value,
      blockingEval: evalCheck.blocking,
    });
    setStatus(state);

    if (!submitBtn) return;

    submitBtn.onclick = () => {
      clearResults();
      const stateNow = computeState({
        hits,
        evalHits: evalCheck.hits,
        passCue,
        passSpeech,
        passAction,
        passPerception,
        passTimeEvent,
        txt: txt.value,
        blockingEval: evalCheck.blocking,
      });
      if (stateNow === "red") {
        if (nearestBanner) nearestBanner.hidden = true;
        return;
      }
      if (stateNow === "green") {
        renderExactMatches(hits);
        if (exactPanel) exactPanel.hidden = false;
        if (nearestBanner) nearestBanner.hidden = true;
      } else if (stateNow === "yellow") {
        nearList = nearestForTextMinHash(txt.value, NEAR_TOP_K, NEAR_THRESHOLD);
        lastNearHash = nearList.length ? hashText(txt.value) : null;
        const storedIdx = lastNearHash != null ? loadNearSelection() : null;
        if (typeof storedIdx === "number" && storedIdx >= 0 && storedIdx < nearList.length) {
          nearIdx = storedIdx;
        } else {
          nearIdx = 0;
        }
        renderNearest();
        if (nearestBanner) nearestBanner.hidden = nearList.length === 0;
        if (nearestPanel) nearestPanel.hidden = nearList.length === 0;
      }
      if (resultsHeader) {
        resultsHeader.scrollIntoView({ behavior: "smooth", block: "start" });
        window.requestAnimationFrame(() => {
          try {
            resultsHeader.focus({ preventScroll: true });
          } catch {
            resultsHeader.focus();
          }
        });
      }
    };
  }

  const storedText = readStoredText();
  if (!txt.value && storedText) {
    txt.value = storedText;
  }

  quickstartButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-ex") || "";
      txt.value = value;
      render(true);
      const pos = txt.value.length;
      txt.setSelectionRange(pos, pos);
      txt.focus();
      if (tplDetails) tplDetails.open = false;
    });
  });

  guidedChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const insert = chip.getAttribute("data-insert") || "";
      const caretAdjRaw = chip.getAttribute("data-caret") || "0";
      const caretAdj = parseInt(caretAdjRaw, 10);
      insertAtCaret(insert, Number.isNaN(caretAdj) ? 0 : caretAdj);
    });
  });

  tplInsert?.addEventListener("click", (evt) => {
    evt.preventDefault();
    const when = tplWhen?.value.trim() || "";
    const where = tplWhere?.value.trim() || "";
    const who = tplWho?.value.trim() || "";
    const what = tplWhat?.value.trim() || "";
    const parts = [];
    if (when) parts.push(when);
    if (where) parts.push(where);
    let body = "";
    if (who && what) body = `${who} ${what}`;
    else if (what) body = what;
    const sentence = [parts.filter(Boolean).join(" "), body].filter(Boolean).join(", ").trim();
    if (sentence) {
      insertAtCaret(sentence);
      [tplWhen, tplWhere, tplWho, tplWhat].forEach((field) => {
        if (field) field.value = "";
      });
      if (tplDetails) tplDetails.open = false;
    }
  });

  nearPrev?.addEventListener("click", () => {
    stepNearest(-1);
  });
  nearNext?.addEventListener("click", () => {
    stepNearest(1);
  });

  document.addEventListener("keydown", handleNearestKeys);
  txt.addEventListener("input", () => {
    render();
  });
  txt.addEventListener("scroll", syncOverlayScroll);
  window.addEventListener("resize", syncOverlayMetrics);
  render();
}

document.addEventListener("DOMContentLoaded", boot);
