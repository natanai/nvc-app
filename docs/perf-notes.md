# Cue performance harness

Run the local benchmark with:

```bash
node scripts/measure-cues.mjs
```

The script reads `data/observation_cues.sanitized.csv`, uses the same CSV parser and regex compiler as `loadCueRows`, and then exercises the browser matcher 100 times against a 200-character sample to estimate average latency.【F:scripts/measure-cues.mjs†L1-L104】【F:lib/observationSuggest.js†L1-L62】【F:lib/observationSuggest.js†L91-L97】

Example output:

```json
{
  "rows": 562,
  "patterns": 1442,
  "regexCompileMs": 34.371954,
  "matchInputLength": 200,
  "matchIterations": 100,
  "matchAverageMs": 0.8811416400000002
}
```

【0ed2de†L1-L8】

Values will vary by machine; the JSON blob is suitable for copy/paste into perf notes or dashboards.
