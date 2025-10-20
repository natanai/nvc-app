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
  "regexCompileMs": 41.25295799999998,
  "matchInputLength": 200,
  "matchIterations": 100,
  "matchAverageMs": 0.9671927199999999
}
```

【9a5962†L1-L8】

Values will vary by machine; the JSON blob is suitable for copy/paste into perf notes or dashboards.

## Pattern Contract Impact

```
Before: {"rows":562,"patterns":1442,"regexCompileMs":41.25295799999998,"matchInputLength":200,"matchIterations":100,"matchAverageMs":0.9671927199999999}
After:  {"rows":562,"patterns":1442,"regexCompileMs":52.60512299999999,"matchInputLength":200,"matchIterations":100,"matchAverageMs":1.4605467599999997}
```

Compile time increased by ~27% and the average match loop slowed by ~51%. The extra literal escaping and dialect validation add work to each pattern, so the higher numbers are expected for the safer contract.【9a5962†L1-L8】【ee3e0a†L1-L8】
