#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const shimPath = path.resolve("lib", "observationSuggest.js");
const publicNext = path.resolve("public", "next");
const csvPath = path.resolve("data", "observation_cues.sanitized.csv");

if (!fs.existsSync(shimPath)) {
  console.error("Shim not built yet.");
  process.exit(1);
}

const urlFor = file => {
  if (file.endsWith("cues.bundle.json")) {
    return path.join(publicNext, "cues.bundle.json");
  }
  if (file.endsWith("cues.nearest.json")) {
    return path.join(publicNext, "cues.nearest.json");
  }
  if (file.endsWith("observation_cues.sanitized.csv")) {
    return csvPath;
  }
  if (file.startsWith("data/")) {
    return path.resolve(file);
  }
  return path.resolve(file);
};

globalThis.window = {};
globalThis.fetch = async url => {
  const normalized = typeof url === "string" ? url : String(url);
  const filename = normalized.replace(/^.*\//, "");
  const target = urlFor(filename === normalized ? normalized : filename);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing fixture for ${url}`);
  }
  if (target.endsWith(".json")) {
    return {
      ok: true,
      async json() {
        return JSON.parse(fs.readFileSync(target, "utf8"));
      },
    };
  }
  if (target.endsWith(".csv")) {
    return {
      ok: true,
      async text() {
        return fs.readFileSync(target, "utf8");
      },
    };
  }
  throw new Error(`Unhandled fetch target ${target}`);
};

globalThis.console = console;

const moduleUrl = pathToFileURL(shimPath).href;
const shim = await import(moduleUrl);
const cues = await shim.loadCueRows();
const cases = [
  'A notification said "You have been muted by the host."',
  'By the time I walked into the room, the presentation had already started.',
  'They arrived twenty minutes late without a message.'
];

for (const text of cases) {
  const suggestion = shim.suggestFromObservation(text, cues, 8);
  const summary = {
    text,
    feelings: suggestion.feelings.slice(0, 3),
    needs: suggestion.needs.slice(0, 3),
    hits: suggestion.hits.length,
  };
  console.log(JSON.stringify(summary));
}

const OS = globalThis.window.ObservationSuggest;
if (OS) {
  const demo = await OS.suggest(cases[0]);
  console.log(JSON.stringify({ viaWindow: true, matches: demo.matches.length, feelings: demo.feelings.slice(0, 2).map(item => item.slug) }));
}
