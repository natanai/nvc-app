# Observation validator reference

## What the sanitizer does
- Trims input, segments by sentence boundaries, and keeps only segments whose lint results are "ok"; whitespace is normalized at the end.【F:lib/observationSanitize.js†L3-L55】【F:lib/observationSanitize.js†L184-L193】
- Collects flagged tokens from evaluation words, phrases, agentive markers, and flagged groups, then removes them outside quoted text before re-linting.【F:lib/observationSanitize.js†L57-L158】【F:lib/nvcLint.js†L1-L205】【F:lib/nvcLint.js†L224-L343】
- Drops the segment entirely when lint still sees evaluation language, faux feelings, catalog matches, or non-salvageable groups (trait labels, moralizing language, global language, etc.). Only speculation/thinking/vague-quantifier groups are eligible for salvage.【F:lib/observationSanitize.js†L74-L93】【F:lib/nvcLint.js†L67-L205】

## PASS / FAIL cases
| Status | Input | Sanitized output | Reason |
| --- | --- | --- | --- |
| PASS | At 3:10 pm in the conference room, Sam said "I can send it tonight." | Same as input | Pure quote + time/place passes lint with no flagged tokens.【45ca30†L1-L18】【F:lib/observationSanitize.js†L35-L55】 |
| PASS | Yesterday in the hallway I saw the chart with 4 red bars. | Same as input | Observable sighting; numbers and neutral nouns do not trigger flags.【45ca30†L18-L20】【F:lib/nvcLint.js†L1-L205】 |
| PASS | On Tuesday at 9 am, the door was locked for 10 minutes. | Same as input | Concrete time/action survives unchanged.【45ca30†L20-L22】【F:lib/observationSanitize.js†L35-L55】 |
| PASS | At 11:45 am I counted three unanswered texts on my phone. | Same as input | Counting language is observational and lint-ok.【45ca30†L22-L24】【F:lib/nvcLint.js†L1-L205】 |
| PASS | During lunch, I heard Maria say, "We shipped 5 orders." | Same as input | Quote preserved; lint ignores protected ranges inside quotes.【45ca30†L24-L26】【F:lib/observationSanitize.js†L131-L143】 |
| PASS | At 8:02 am the log showed 2 failed deployments. | Same as input | Log evidence with timestamp is observational.【45ca30†L26-L28】 |
| PASS | This morning in Slack you wrote, "Let’s skip QA." | Same as input | Direct quote of message; flagged words inside quotes stay because range is protected.【45ca30†L28-L30】【F:lib/observationSanitize.js†L131-L143】 |
| PASS | At 4 pm I noticed the report had 3 errors. | Same as input | Statement survives because lint allows factual noticing with counts.【45ca30†L30-L32】【F:lib/nvcLint.js†L1-L205】 |
| PASS | On 5/2 at 7 pm, the room lights were off. | Same as input | Measurable event; no flagged lexicon.【45ca30†L32-L34】 |
| PASS | Last night at 6:30 pm, Jordan emailed, "I can’t join." | Same as input | Email quote retained, meeting lint expectations.【45ca30†L34-L36】【F:lib/observationSanitize.js†L131-L143】 |
| FAIL | He was rude and unprofessional. | Empty string | Trait labels (`rude`, `unprofessional`) trigger the trait label group, which is unsalvageable.【45ca30†L38-L39】【F:lib/nvcLint.js†L67-L106】【F:lib/observationSanitize.js†L74-L93】 |
| FAIL | You always ignore me. | Empty string | `always` (global/evaluation) and `ignore` flagged as blame language cause lint failure.【45ca30†L39-L40】【F:lib/nvcLint.js†L1-L37】【F:lib/nvcLint.js†L109-L133】 |
| FAIL | I feel like you don’t care. | Empty string | `I feel like` triggers the thoughts-as-feelings group, which is dropped.【45ca30†L40-L41】【F:lib/nvcLint.js†L210-L219】【F:lib/observationSanitize.js†L74-L93】 |
| FAIL | They made me feel small. | Empty string | Agentive pattern `made me feel` is a blocking flag.【45ca30†L41-L42】【F:lib/nvcLint.js†L232-L242】 |
| FAIL | She was manipulative again. | Empty string | `manipulative` is a trait label in the unsalvageable list.【45ca30†L42-L43】【F:lib/nvcLint.js†L67-L106】 |
| FAIL | It seemed like he wanted to hurt me. | Empty string | `seemed` lands in speculation language; combined with intent inference it remains blocked.【45ca30†L43-L44】【F:lib/nvcLint.js†L178-L205】【F:lib/observationSanitize.js†L74-L93】 |
| FAIL | They betrayed us. | Empty string | `betrayed` is cataloged as a faux feeling, which immediately blocks sanitation.【45ca30†L44-L45】【F:lib/nvcLint.js†L140-L143】【F:lib/observationSanitize.js†L83-L93】 |
| FAIL | Everyone was wrong. | Empty string | `Everyone` (global language) and `wrong` (evaluation marker) both block the example.【45ca30†L45-L46】【F:lib/nvcLint.js†L1-L37】【F:lib/nvcLint.js†L117-L124】 |
| FAIL | I was attacked by his words. | Empty string | `attacked` is a faux-feeling story word, causing a catalog hit and drop.【45ca30†L46-L47】【F:lib/nvcLint.js†L138-L145】【F:lib/observationSanitize.js†L83-L93】 |
| FAIL | This was the worst. | Empty string | `worst` is an evaluation marker, so lint rejects the segment with no salvage path.【45ca30†L47-L48】【F:lib/nvcLint.js†L1-L37】【F:lib/observationSanitize.js†L74-L93】 |
