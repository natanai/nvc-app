const state = { compiled: [], };

const FALLBACK = [
  { kw: /\bdeadline|due\b/i, feelings: ["anxious", "pressured"], needs: ["predictability", "clarity"] },
  { kw: /\bmeeting|call|recording\b/i, feelings: ["tense", "anxious"], needs: ["respect", "to-be-heard", "predictability"] },
  { kw: /\bcamera\b/i, feelings: ["lonely", "anxious"], needs: ["connection", "to-be-seen"] },
  { kw: /\bmuted|mute\b/i, feelings: ["embarrassed", "confused"], needs: ["to-be-heard", "respect"] },
  { kw: /\btime\s+off|pto|vacation|leave\b/i, feelings: ["disappointed", "frustrated"], needs: ["consideration", "respect", "predictability"] },
  { kw: /\blate|minutes?\s+late\b/i, feelings: ["disappointed", "irritated"], needs: ["reliability", "consideration"] },
  { kw: /\breply\s+all|cc['’]?d\b/i, feelings: ["anxious", "embarrassed"], needs: ["privacy", "clarity", "respect"] },
  { kw: /\bcalendar|invite\b/i, feelings: ["anxious", "confused"], needs: ["predictability", "clarity"] }
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

function compileCues(json) {
  const compiled = [];
  for (const c of (json.cues || [])) {
    for (const p of (c.patterns || [])) {
      try { compiled.push({ cue: c.cue, re: new RegExp(p, "i"), feelings: c.feelings || [], needs: c.needs || [] }); } catch {}
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

async function boot() {
  // Load cues
  try {
    const res = await fetch("/next/cues.bundle.json", { cache: "no-store" });
    const json = await res.json();
    state.compiled = compileCues(json);
  } catch (e) { console.error("Failed to load cues bundle:", e); }

  const root = document.getElementById("obs-editor-root");
  const txt = root.querySelector("#txt");
  const check = root.querySelector("#check");
  const why = root.querySelector("#why");
  const btn = root.querySelector("#submit");
  const sug = root.querySelector("#suggestions");
  const feelings = root.querySelector("#feelings");
  const needs = root.querySelector("#needs");
  const matchedCues = root.querySelector("#matchedCues");

  function render() {
    const { ok, reasons, hits } = evalText(txt.value);
    check.className = "check " + (ok ? "ok" : "no");
    why.textContent = ok
      ? "Ready — passes: " + Array.from(reasons).join(", ")
      : "Not ready — add something you saw/heard, a quoted phrase, or who did what.";
    btn.disabled = !ok;
    btn.onclick = () => {
      let f = uniqueSorted(hits.flatMap(h => h.feelings));
      let n = uniqueSorted(hits.flatMap(h => h.needs));
      if (hits.length === 0) {
        const fb = deriveFallback(txt.value);
        f = uniqueSorted([...(f || []), ...(fb.feelings || [])]);
        n = uniqueSorted([...(n || []), ...(fb.needs || [])]);
      }
      feelings.innerHTML = f.map(s => `<span class="pill">${s}</span>`).join("");
      needs.innerHTML = n.map(s => `<span class="pill">${s}</span>`).join("");
      matchedCues.textContent = hits.length
        ? `Matched cues: ${uniqueSorted(hits.map(h => h.cue)).join(", ")}`
        : "No direct cue hits — suggestions are generalized.";
      sug.style.display = "block";
    };
  }
  txt.addEventListener("input", render);
  render();
}

document.addEventListener("DOMContentLoaded", boot);
