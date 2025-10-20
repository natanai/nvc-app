# CSV parsing rules

- Both the sanitizer and browser use the same hand-written CSV parser: cells split on commas unless the parser is inside double quotes, doubled quotes (`""`) become literal `"`, and CRLF is normalized while honoring quoted sections. Trailing cells are flushed at EOF.【F:lib/observationSuggest.js†L100-L129】【F:scripts/sanitizeObservationCues.mjs†L121-L167】
- Fields that contain commas, pipes, or newlines must be wrapped in double quotes; inner quotes are escaped by doubling them. Newlines are allowed inside a quoted example, because the parser only treats `\n`/`\r` as row breaks when it is not inside quotes.【F:scripts/sanitizeObservationCues.mjs†L121-L153】

## Examples
**Good rows**
1. `arrived-late,"^at 7:05 pm$|arrived late",upset|frustrated,consideration,"At 7:05 pm he walked in."`
2. `saw-chart,"chart showed [0-9]+ red bars",astonished,,"Yesterday in the hallway I saw the chart with 4 red bars."`
3. `quoted-email,"emailed \"I\\'ll send it\"",hopeful|relieved,clarity,"This morning in Slack you wrote, ""I'll send it."""`
4. `multi-line,"door stayed open","anxious|worried",safety,"On Tuesday at 9 am, the door was open.\nIt stayed that way for 10 minutes."`

**Bad rows**
1. `arrived-late,^at 7:05 pm$,upset,consideration,At 7:05 pm, he walked in.` – comma inside the example splits the column because it is not quoted.【F:lib/observationSuggest.js†L100-L118】
2. `saw-chart,"chart showed "red" bars",astonished,,"..."` – inner quotes must be doubled; the parser will toggle out of quote mode prematurely.【F:lib/observationSuggest.js†L107-L110】
3. `multi-line,"door stayed open","anxious|worried",safety,"On Tuesday...` – missing closing quote leaves the parser in quote mode, so the row never flushes correctly.【F:scripts/sanitizeObservationCues.mjs†L121-L153】
4. `extra-field,"pattern",relieved,clarity,"Example",unexpected` – six columns cause validation errors because only five headers are expected.【F:scripts/validateObservationCues.mjs†L92-L115】

## Editing tip
When pasting into GitHub’s editor, wrap any cell that contains commas, line breaks, or quotes in double quotes and double every inner quote (`""`). This matches the parser’s expectations and prevents silent row corruption during sanitization or browser parsing.【F:lib/observationSuggest.js†L100-L129】
