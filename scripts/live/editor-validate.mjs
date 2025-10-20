#!/usr/bin/env node
/**
 * Live editor validator (prototype) — NOT wired to production.
 * Implements 5 passes, evaluates per-sentence, returns a JSON summary.
 * Usage: node scripts/live/editor-validate.mjs tests/live/editor-fixture.txt
 */
import fs from "node:fs";
import path from "node:path";

const CUES_JSON = path.join("data", "generated", "cues.bundle.json");

function loadCues() {
  try {
    const raw = JSON.parse(fs.readFileSync(CUES_JSON, "utf8"));
    const compiled = [];
    for (const c of raw.cues || []) {
      for (const p of c.patterns || []) {
        try {
          compiled.push({
            cue: c.cue,
            re: new RegExp(p, "i"),
            feelings: c.feelings,
            needs: c.needs,
            pattern: p
          });
        } catch {
          // ignore patterns that fail to compile in JS regex engine
        }
      }
    }
    return compiled;
  } catch (err) {
    return [];
  }
}

function splitSentences(text) {
  // basic splitter: periods/exclamations/questions/newlines; keeps content simple
  return String(text)
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Pass 1: cue match
function passCue(sent, compiled) {
  const hits = [];
  for (const r of compiled) {
    if (r.re.test(sent)) hits.push(r);
  }
  return hits;
}

// Pass 2: speech act (detect quoted speech + communication verb)
const speechVerb = /\b(?:said|told|wrote|texted|posted|emailed|commented)\b/i;
const quoted = /["“”„](?:[^"“”„\\]|\\.)+["“”„]/;
function passSpeech(sent) {
  return speechVerb.test(sent) && quoted.test(sent);
}

// Pass 3: action (actor + observable verb)
const actor = /\b(?:i|we|they|he|she|someone|my\s+(?:boss|manager|supervisor|partner|teacher|professor|landlord)|the\s+(?:host|team|call|meeting))\b/i;
const verb = /\b(?:arrived|started|ended|closed|left|muted|recorded|forwarded|posted|tagged|opened|changed|added|removed|ignored|declined|denied|reassigned|replied|escalated|overwrote|cut|revoked|said|looked)\b/i;
function passAction(sent) {
  return actor.test(sent) && verb.test(sent);
}

// Pass 4: perception
const perception = /\bI\s+(?:saw|heard|read|received|noticed)\b/i;
function passPerception(sent) {
  return perception.test(sent);
}

// Pass 5: time anchor + event noun
const anchor = /\b(?:yesterday|today|at\s+\d{1,2}(?::\d{2})?\s?(?:am|pm)?|on\s+(?:mon|tue|wed|thu|fri|sat|sun)|on\s+[A-Za-z]+\s+\d{1,2})\b/i;
const eventNoun = /\b(?:invite|deadline|recording|camera|notes|seat|access|channel|event|policy|payment|shift|schedule|meeting|call)\b/i;
function passTimeEvent(sent) {
  return anchor.test(sent) && eventNoun.test(sent);
}

function evaluate(text, compiled) {
  const sentences = splitSentences(text);
  const results = [];
  const passes = {
    cue: false,
    speech: false,
    action: false,
    perception: false,
    time_event: false
  };
  let ready = false;

  for (const s of sentences) {
    const cueHits = passCue(s, compiled);
    const speech = passSpeech(s);
    const action = passAction(s);
    const perceptionHit = passPerception(s);
    const timeEvent = passTimeEvent(s);

    if (cueHits.length) passes.cue = true;
    if (speech) passes.speech = true;
    if (action) passes.action = true;
    if (perceptionHit) passes.perception = true;
    if (timeEvent) passes.time_event = true;

    if (cueHits.length > 0 || speech || action || perceptionHit || timeEvent) {
      ready = true;
    }

    results.push({
      sentence: s,
      cue_hits: cueHits.map(h => h.cue),
      pass_speech: speech,
      pass_action: action,
      pass_perception: perceptionHit,
      pass_time_event: timeEvent
    });
  }

  return { readyToSubmit: ready, passes, sentences: results };
}

function escapeCSV(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

// CLI
(function main() {
  const file = process.argv[2];
  if (!file) {
    process.stdout.write(JSON.stringify({ error: "usage: node scripts/live/editor-validate.mjs <path-to-fixture.txt>" }) + "\n");
    process.exit(0);
  }

  const compiled = loadCues();
  const input = fs.readFileSync(file, "utf8");
  const lines = input.split(/\r?\n/).filter(Boolean);
  let matched = 0;
  const details = [];

  for (const line of lines) {
    const evaluation = evaluate(line, compiled);
    if (evaluation.readyToSubmit) matched++;
    const matchedCues = Array.from(new Set(evaluation.sentences.flatMap(s => s.cue_hits)));
    details.push({
      input: line,
      ready: evaluation.readyToSubmit,
      matched_cues: matchedCues.join("|"),
      passes: evaluation.passes
    });
  }

  const summary = {
    total_inputs: lines.length,
    ready_inputs: matched,
    ready_percent: Math.round((matched / (lines.length || 1)) * 100)
  };

  const outDir = path.join("scripts", "live", "out");
  fs.mkdirSync(outDir, { recursive: true });
  const csvLines = ["input,ready,matched_cues"];
  for (const d of details) {
    csvLines.push(`${escapeCSV(d.input)},${d.ready ? "true" : "false"},${escapeCSV(d.matched_cues)}`);
  }
  fs.writeFileSync(path.join(outDir, "editor-detail.csv"), csvLines.join("\n") + "\n", "utf8");

  process.stdout.write(JSON.stringify(summary) + "\n");
})();
