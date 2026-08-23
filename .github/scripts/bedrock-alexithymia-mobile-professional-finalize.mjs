import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value);

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Missing ${label}`);
  }
  return source.replace(before, after);
}

function replaceAllExact(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Missing ${label}`);
  }
  return source.split(before).join(after);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Missing ${label}`);
  }
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

// 1) The hand-maintained Support Lane owns its route-known mobile geometry and
// static explanatory copy. Make the route intrinsically wider on phones rather
// than masking overflow or adding post-load layout repair.
{
  const path = 'alexithymia-support/index.html';
  let source = read(path);

  source = replaceAllExact(
    source,
    'Follow a guided check-in that links body sensations with emotions while keeping your care strategies in your browser&#39;s localStorage inventory.',
    'Use a structured check-in with body sensations and affect dimensions to consider possible emotion labels and regulation options.',
    'Alexithymia metadata description',
  );

  source = replaceExact(
    source,
    `            About one in ten people live with alexithymia. If naming a feeling is hard, this step-by-step lane offers gentle\n            structure so you can notice your body, explore possible emotions, and choose caring next steps.`,
    `            Alexithymia can make it difficult to identify, distinguish, or describe emotions. This step-by-step check-in uses\n            body sensations and affect dimensions to help you consider possible feeling labels and decide what may be useful next.`,
    'Alexithymia page introduction',
  );

  source = replaceExact(
    source,
    `<h3 class="support-step__title">Start with reassurance</h3>\n            <p>\n              There are no wrong answers here. Treat every sensation you notice as valuable information. Move at the pace that\n              feels kind to you.\n            </p>`,
    `<h3 class="support-step__title">Start with what you can observe</h3>\n            <p>\n              There is no single correct response. Use any sensations you notice as observations, and skip or revise a step if it\n              does not fit your experience.\n            </p>`,
    'intro step copy',
  );

  source = replaceExact(
    source,
    `<h3 class="support-step__title">Optional pause: settle your body</h3>\n            <p>\n              If you feel revved up, try a short breathing cycle before checking in. Slow, counted breaths can help your nervous\n              system shift toward safety.\n            </p>`,
    `<h3 class="support-step__title">Optional pause: paced breathing</h3>\n            <p>\n              If activation feels high, you can try a brief paced-breathing exercise before continuing. Skip it if breathing\n              exercises are not useful for you.\n            </p>`,
    'breathing step copy',
  );

  source = replaceExact(
    source,
    `            <p>\n              Invite awareness to your body. Open the areas that speak up. We'll surface a few sensations at a time and ask how\n              strong they feel (0–10) after you choose.\n            </p>`,
    `            <p>\n              Notice any body sensations that stand out. Open a region to see examples, choose any that fit, then rate their\n              intensity from 0–10.\n            </p>`,
    'body step copy',
  );

  source = replaceExact(
    source,
    `            <p>\n              If the body suggestions feel uncertain, try plotting your state on the emotion compass. Estimate your energy and how\n              pleasant or unpleasant things feel right now. Your emotion matches will collect in the next step.\n            </p>`,
    `            <p>\n              Use the compass to estimate current activation (energy) and pleasantness. These two dimensions provide another way\n              to generate possible emotion matches.\n            </p>`,
    'compass step copy',
  );

  source = replaceExact(
    source,
    `            <p>\n              Review the matches from your body check-in or compass plot, then choose an emotion to explore in depth. Ready to pick?\n              <a class="support-jump-link" href="#compass-suggestions">Jump to the list of emotions</a> and load one here.\n            </p>`,
    `            <p>\n              Review the candidates from the body check-in and emotion compass. Select one to compare its definition, possible body\n              cues, common contexts, and related needs. <a class="support-jump-link" href="#compass-suggestions">Jump to emotion candidates</a>.\n            </p>`,
    'emotion library step copy',
  );

  source = replaceExact(source, 'Step 5: Care for what you feel', 'Step 5: Consider regulation options', 'regulation step title');
  source = replaceExact(source, 'Step 6: Share if you want to', 'Step 6: Put it into words', 'communication step title');
  source = replaceExact(
    source,
    `              Putting a feeling into words—just for yourself or with a trusted person—can build confidence. Use this starter\n              sentence or edit it to fit your voice.`,
    `              If useful, use the suggested sentence as a starting point and edit it to match what you mean. You can also leave\n              the feeling uncertain and revise it later.`,
    'communication step copy',
  );
  source = replaceExact(source, 'Keep practicing gently', 'Review and repeat as useful', 'closing step title');
  source = replaceExact(
    source,
    `              You did courageous work by checking in. Emotional vocabulary grows with repetition. Return whenever you want a guide,\n              and celebrate every moment of connection you create with yourself.`,
    `              Emotion identification can become easier with repeated observation and comparison. Return to the flow when it is\n              useful, and revise earlier labels as new information becomes available.`,
    'closing step copy',
  );

  source = replaceRegex(
    source,
    /@media \(max-width: 640px\) \{\n  \.alexithymia-support-page \.sensation-region__title \{[\s\S]*?\n\}\n    <\/style>/,
    `@media (max-width: 640px) {\n  body.alexithymia-support-page {\n    padding-left: max(0.5rem, env(safe-area-inset-left));\n    padding-right: max(0.5rem, env(safe-area-inset-right));\n  }\n\n  .alexithymia-support-page .page-wrapper {\n    width: 100%;\n    gap: 0.85rem;\n  }\n\n  .alexithymia-support-page .breadcrumbs {\n    padding: 0.45rem 0.65rem;\n    border-width: 2px;\n    box-shadow: 0 7px 0 color-mix(in srgb, var(--outline) 24%, transparent);\n  }\n\n  .alexithymia-support-page .page {\n    padding: 1rem 0.72rem 1.15rem;\n    gap: 0.9rem;\n    border-width: 3px;\n    box-shadow: 0 14px 0 color-mix(in srgb, var(--outline) 32%, transparent);\n  }\n\n  .alexithymia-support-page .page-header {\n    gap: 0.55rem;\n  }\n\n  .alexithymia-support-page .page-title {\n    font-size: clamp(1.15rem, 7.4vw, 1.55rem);\n    letter-spacing: 0.045em;\n  }\n\n  .alexithymia-support-page .page-subtitle {\n    font-size: 0.96rem;\n    line-height: 1.45;\n  }\n\n  .alexithymia-support-page .support-flow {\n    gap: 0.9rem;\n  }\n\n  .alexithymia-support-page .support-step {\n    min-width: 0;\n    gap: 0.78rem;\n    padding: 0.82rem 0.78rem;\n    border-width: 2px;\n    border-radius: var(--radius-xl);\n    box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 24%, transparent);\n  }\n\n  .alexithymia-support-page .support-step--has-next {\n    padding-bottom: 1rem;\n  }\n\n  .alexithymia-support-page .support-step > p {\n    margin: 0;\n    line-height: 1.45;\n  }\n\n  .alexithymia-support-page .support-step__title {\n    font-size: 0.96rem;\n    line-height: 1.28;\n    letter-spacing: 0.045em;\n  }\n\n  .alexithymia-support-page .emotion-suggestions {\n    min-width: 0;\n    max-width: 100%;\n    gap: 0.55rem;\n    padding: 0.62rem;\n    border-width: 1.5px;\n    border-radius: var(--radius-md);\n  }\n\n  .alexithymia-support-page .emotion-library {\n    min-width: 0;\n    max-width: 100%;\n    gap: 0.72rem;\n    padding: 0.7rem 0 0;\n    border: 0;\n    border-top: 1px solid color-mix(in srgb, var(--outline) 20%, transparent);\n    border-radius: 0;\n    background: transparent;\n  }\n\n  .alexithymia-support-page .emotion-detail {\n    display: grid;\n    min-width: 0;\n    gap: 0.68rem;\n  }\n\n  .alexithymia-support-page .emotion-detail > div {\n    display: grid;\n    min-width: 0;\n    gap: 0.25rem;\n  }\n\n  .alexithymia-support-page .emotion-detail__name {\n    font-size: 1.18rem;\n    letter-spacing: 0.025em;\n  }\n\n  .alexithymia-support-page .emotion-detail__definition {\n    font-size: 0.96rem;\n    line-height: 1.43;\n  }\n\n  .alexithymia-support-page .emotion-suggestions__title {\n    margin: 0;\n    font-size: 0.88rem;\n    line-height: 1.3;\n  }\n\n  .alexithymia-support-page .emotion-detail__list {\n    min-width: 0;\n    margin: 0;\n    padding-left: 1.05rem;\n    font-size: 0.94rem;\n    line-height: 1.4;\n  }\n\n  .alexithymia-support-page .emotion-detail__list li {\n    margin-bottom: 0.18rem;\n    overflow-wrap: anywhere;\n  }\n\n  .alexithymia-support-page .emotion-detail__list--links {\n    padding-left: 0;\n    gap: 0.35rem;\n  }\n\n  .alexithymia-support-page .sensation-region__title {\n    font-size: 1rem;\n  }\n\n  .alexithymia-support-page .support-step__nav {\n    gap: 0.45rem;\n  }\n\n  .alexithymia-support-page .support-step__nav .support-button {\n    padding-inline: 0.65rem;\n    letter-spacing: 0.025em;\n  }\n\n  .alexithymia-support-page .support-step__nav .support-button--continue {\n    min-width: 6.8rem;\n  }\n}\n    </style>`,
    'Support Lane mobile width owner',
  );

  for (const retired of [
    'gentle structure',
    'caring next steps',
    'areas that speak up',
    'If you feel revved up',
    'Keep practicing gently',
    'You did courageous work',
  ]) {
    if (source.includes(retired)) {
      throw new Error(`Retired conversational Support copy remains: ${retired}`);
    }
  }

  write(path, source);
}

// 2) Affect-zone and emotion descriptions are structured reference data, so
// professional language belongs here rather than being rewritten at render time.
{
  const path = 'scripts/alexithymia-support-data.js';
  let source = read(path);

  const replacements = [
    ['Feeling heavy, foggy, or slowed down often pairs with sadness, grief, or depletion.', 'Low activation with unpleasant affect can be associated with sadness, grief, fatigue, or loneliness.'],
    ['Uneasy steadiness can align with anxiousness, guilt, or shame when something important feels off.', 'Moderate activation with unpleasant affect can be associated with anxiety, guilt, shame, or stress.'],
    ['Revved-up distress can accompany anxiety, anger, fear, or overwhelm.', 'High activation with unpleasant affect can be associated with anxiety, fear, anger, or overwhelm.'],
    ['Feeling flat or disconnected might relate to numbness, boredom, or simple fatigue.', 'Low activation with neutral affect can occur with numbness, boredom, or fatigue.'],
    ['Balanced energy can signal curiosity or being deep in thought while you evaluate what comes next.', 'Moderate activation with neutral affect can occur with curiosity, reflection, or uncertainty.'],
    ['Buzzing but not distressed may indicate determination or anticipation before taking action.', 'High activation without clear distress can occur with determination, focus, or anticipation.'],
    ['Easeful and grounded sensations often pair with calm or relief after effort.', 'Low activation with pleasant affect can occur with calm, relief, or contentment.'],
    ['Balanced warmth can signal feeling contented, hopeful, or grateful.', 'Moderate activation with pleasant affect can occur with contentment, hope, or gratitude.'],
    ['Sparkly energy often aligns with feeling joyful, excited, or proud.', 'High activation with pleasant affect can occur with joy, excitement, or pride.'],

    ['Offer gentle comfort: wrap in a blanket, hold a warm mug, or play soothing sounds.', 'Reduce stimulation and choose a physically comfortable setting if possible.'],
    ['If it feels right, reach out to someone who can sit with you or send a caring message.', 'Consider contacting someone you trust for company or practical support.'],
    ['Try progressive muscle relaxation or a gentle stretch to reassure weighted muscles.', 'Try slow breathing, stretching, or progressive muscle relaxation and notice whether tension changes.'],
    ['Name what feels out of alignment and what value or need wants attention.', 'Identify the situation, thought, value, or need that seems most relevant.'],
    ['Follow a mindful stretch or mobility flow to ease tension as you journal patterns.', 'Use a brief grounding or movement exercise and note whether activation changes.'],
    ['Lengthen your exhale or press your feet into the floor to remind your body it is supported.', 'Lengthen the exhale or press your feet into the floor and notice whether arousal changes.'],
    ['Shake out your hands or shoulders to release excess adrenaline before responding.', 'Use brief movement if remaining still increases agitation.'],
    ['Move through progressive muscle relaxation or mindful stretching to discharge the surge.', 'Delay non-urgent responses until activation has decreased when possible.'],
    ['Take a sensory inventory: notice texture, temperature, or gentle movement to wake up interoception.', 'Check basic sensory information such as texture, temperature, pressure, or movement and note what is easiest to detect.'],
    ['Try a small action such as stretching, stepping outside, or sipping water.', 'Try one small change in movement, light, temperature, or activity and notice whether the state changes.'],
    ['Experiment with mindful stretching or tai chi to invite subtle sensations back online.', 'Use slow movement or stretching if it helps make body sensations easier to notice.'],
    ['Jot down what you know and what questions you still have—naming them can clarify direction.', 'Write down what is known, what remains uncertain, and what information would help.'],
    ['Check whether you need more information, reassurance, or time before acting.', 'Allow additional time before deciding if the situation remains unclear.'],
    ['Tag the situation in your journal so you can track what helps clarity return.', 'Record the context if you want to compare it with future patterns.'],
    ['Channel the energy into a clear next step or into movement like a brisk walk.', 'Direct the energy toward one specific next step or a brief period of movement.'],
    ['Double-check your plan with a supportive person if you want validation before moving forward.', 'Check whether urgency is necessary before acting, and seek another perspective if useful.'],
    ['Try mindful stretching, dance, or shaking to partner with the momentum without burning out.', 'Plan a transition or break if sustained activation or focus is becoming tiring.'],
    ['Savor the ease—lengthen the exhale, stretch gently, or notice what feels safe.', 'Notice what conditions are present while the state feels calm or relieved.'],
    ['Thank your body for the steadiness.', 'Use the state as an opportunity for rest or recovery if needed.'],
    ['Take a slow stretch or relaxation pause to anchor the memory so you can revisit it later.', 'Record the context if it may be useful to recreate later.'],
    ['Write down what is working right now so you can return to it later.', 'Identify what is contributing to the state.'],
    ['Share appreciation with someone involved if that feels good.', 'Express appreciation if another person contributed and you want to.'],
    ['Log a gratitude entry with tags so future-you can spot what supports you.', 'Record the context if tracking supportive conditions is useful.'],
    ['Let yourself celebrate—move, dance, or tell someone the good news.', 'Enjoy or express the positive activation in a way that fits the situation.'],
    ['Anchor the moment by noting what contributed to the joy.', 'Notice what contributed to the experience.'],
    ['Capture quick journal tags so you remember what sparked the delight.', 'Record it if you want to compare positive patterns over time.'],

    ['An activated, future-focused alert that wants to keep you prepared for possible danger.', 'A state of apprehension or heightened arousal associated with anticipated threat, uncertainty, or possible negative outcomes.'],
    ['A protective alarm that signals you may be in danger or facing something threatening.', 'An emotional response to a perceived immediate or specific threat.'],
    ['A fiery surge that appears when a boundary, value, or need for respect is threatened.', 'An activated emotional state that often occurs in response to perceived obstruction, unfairness, threat, or boundary violation.'],
    ['A sense that there is more input or responsibility than you can process at once.', 'A state in which demands, sensory input, or emotional load feel greater than available processing capacity.'],
    ['High, sparkling energy that appears when something desired is about to happen.', 'A high-arousal positive state associated with anticipation, interest, or a desired event.'],
    ['A low, heavy feeling that accompanies loss or unmet needs for connection or meaning.', 'A low-arousal unpleasant state commonly associated with loss, disappointment, or unmet expectations.'],
    ['A deep ache that honors the loss of someone, something, or a future you hoped for.', 'An emotional response to significant loss that may include sadness, yearning, anger, numbness, or changes in energy.'],
    ['Low physical or emotional fuel signalling the need for rest or recovery.', 'A state of reduced physical or mental energy associated with a need for rest or recovery.'],
    ['A signal that you long for connection, understanding, or companionship.', 'Distress associated with a perceived gap between desired and available social connection.'],
    ['An uneasy feeling that signals you may have stepped away from your values or impacted someone.', 'An unpleasant self-evaluative emotion associated with believing that a specific action or omission violated your standards or harmed someone.'],
    ['A painful belief that who you are is unworthy of belonging.', 'A painful self-evaluative emotion associated with a negative judgment of the self and concern about rejection or social exposure.'],
    ['The tension of carrying more demands than the current resources make comfortable.', 'A state of psychological or physiological strain that can occur when perceived demands exceed available resources.'],
    ['Irritated energy that shows up when progress feels blocked.', 'An unpleasant activated state that commonly occurs when progress toward a goal is blocked or delayed.'],
    ['A muted state where feelings feel distant or inaccessible.', 'A state of reduced emotional awareness, intensity, or access to feeling.'],
    ['Low stimulation that longs for novelty, purpose, or engagement.', 'An unpleasant low-engagement state associated with insufficient stimulation, interest, or meaning.'],
    ['Open, exploratory interest in learning more about something.', 'An interest-driven state characterized by motivation to seek information, explore, or understand.'],
    ['A reflective mood that turns inward to process meaning or possibilities.', 'A reflective state characterized by sustained attention to meaning, decisions, or possibilities.'],
    ['Not yet sure what to feel or choose because information is incomplete.', 'A state of unresolved judgment or choice when available information does not support a clear conclusion.'],
    ['Focused drive to push toward a goal despite challenges.', 'A goal-directed state marked by sustained motivation despite difficulty or delay.'],
    ['Sharpened attention directed at a task or outcome.', 'A state of concentrated attention directed toward a task, problem, or goal.'],
    ['Settled ease when your body senses safety and nothing demands urgent action.', 'A low-arousal state marked by relative physiological and emotional steadiness.'],
    ['Release of tension after a feared outcome does not happen or support arrives.', 'A reduction in tension or distress after a threat, demand, or uncertainty decreases.'],
    ['Quiet satisfaction when needs feel sufficiently met.', 'A low-to-moderate arousal positive state characterized by satisfaction with current conditions.'],
    ['A forward-looking belief that improvement or support is possible.', 'A future-oriented positive state associated with perceiving that a desired outcome remains possible.'],
    ['Warm appreciation for kindness, support, or meaningful experiences.', 'Positive appreciation in response to a valued benefit, experience, or contribution.'],
    ['Expansive delight when something deeply meaningful or playful lands well.', 'A positive emotional state associated with pleasure, connection, accomplishment, or other valued experiences.'],
    ['A warm sense of achievement or self-respect after meeting a challenge.', 'A positive self-evaluative emotion associated with achievement, effort, competence, or acting in accordance with your values.'],
  ];

  for (const [before, after] of replacements) {
    source = replaceExact(source, before, after, `clinical language: ${before.slice(0, 42)}`);
  }

  for (const retired of [
    'future-you',
    'Sparkly energy',
    'future-focused alert that wants',
    'protective alarm',
    'fiery surge',
    'High, sparkling energy',
    'deep ache that honors',
    'Low stimulation that longs',
    'reassure weighted muscles',
    'wake up interoception',
    'back online',
    'partner with the momentum',
    'Thank your body',
  ]) {
    if (source.includes(retired)) {
      throw new Error(`Retired anthropomorphic data copy remains: ${retired}`);
    }
  }

  write(path, source);
}

// 3) Runtime-generated content is legitimately stateful, but its deterministic
// headings and explanatory wording must remain neutral and professionally framed.
{
  const path = 'scripts/alexithymia-support.js';
  let source = read(path);
  const replacements = [
    ['Suggestions are hypotheses based on affect science; tap “Why these?” for sources.', 'Suggestions are hypotheses based on affect science, not diagnoses. Use “Why these?” to review sources and limitations.'],
    ['• Affective zone estimate: not clear yet (that’s okay).', '• Affective zone estimate: indeterminate.'],
    ['Use these as invitations, not rules.', 'Treat these as possibilities rather than conclusions.'],
    ['Possible needs this feeling can point to (hypotheses)', 'Needs that may be relevant'],
    ['Common body cues', 'Possible body cues'],
    ['Typical thoughts', 'Possible thoughts'],
    ['When it often appears', 'Common contexts'],
    ['Care ideas to experiment with', 'Regulation options to consider'],
    ['Everyone feels emotions uniquely. Use these clues as invitations, not rules.', 'These patterns vary by person. Treat them as possibilities rather than conclusions.'],
    ['Support when you feel ${quadrantInfo.label.toLowerCase()}', 'Options for ${quadrantInfo.label.toLowerCase()}'],
    ['Matched breathing option', 'Breathing option'],
    ['Try one of these nurturing steps', 'Regulation options to consider'],
    ['Experiment kindly. If none of these help, it simply means your body wants something different today. Track what works or needs tweaking so future-you can adjust with care.', 'Responses vary. If these options are not useful, another strategy may fit better. Record what changes, if anything, so you can compare patterns over time.'],
    ['Affect labeling and exhale-biased breathing can reduce distress (see “Why these?”).', 'Evidence for affect labeling and paced breathing is summarized in “Why these?”.'],
    ['It is okay to say, “I’m still figuring out my feelings.” The goal is practice, not perfection.', 'It is also valid to say, “I’m still figuring out what I feel.” A label can remain uncertain or change with more information.'],
  ];
  for (const [before, after] of replacements) {
    source = replaceExact(source, before, after, `runtime professional language: ${before.slice(0, 44)}`);
  }

  for (const retired of [
    'invitations, not rules',
    'nurturing steps',
    'your body wants something different',
    'future-you',
    'practice, not perfection',
  ]) {
    if (source.includes(retired)) {
      throw new Error(`Retired conversational runtime copy remains: ${retired}`);
    }
  }
  write(path, source);
}

// 4) Lock the screenshot-derived mobile hierarchy and language standard into
// the permanent Site Quality suite.
{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = read(path);
  const marker = "test('Alexithymia Support uses mobile-first width and neutral professional language'";
  if (!source.includes(marker)) {
    source += `\n\ntest('Alexithymia Support uses mobile-first width and neutral professional language', async () => {\n  const html = await load('alexithymia-support/index.html');\n  const runtime = await load('scripts/alexithymia-support.js');\n  const data = await load('scripts/alexithymia-support-data.js');\n\n  assert.ok(html.includes('body.alexithymia-support-page {\\n    padding-left: max(0.5rem, env(safe-area-inset-left));'), 'Support Lane must reduce the route-level phone gutter at its prepaint owner');\n  assert.ok(html.includes('.alexithymia-support-page .page {\\n    padding: 1rem 0.72rem 1.15rem;'), 'Support Lane page shell must use phone-appropriate inline padding');\n  assert.ok(html.includes('.alexithymia-support-page .support-step {\\n    min-width: 0;'), 'Support steps must shrink inside the phone viewport by construction');\n  assert.ok(html.includes('.alexithymia-support-page .emotion-suggestions {\\n    min-width: 0;'), 'emotion candidate surfaces must not export nested intrinsic width');\n  assert.ok(html.includes('.alexithymia-support-page .emotion-library {\\n    min-width: 0;'), 'selected-emotion detail must own a shrinkable mobile surface');\n  assert.ok(html.includes('border-top: 1px solid color-mix(in srgb, var(--outline) 20%, transparent);'), 'selected-emotion detail must flatten its nested card on mobile');\n  assert.ok(html.includes('Alexithymia can make it difficult to identify, distinguish, or describe emotions.'), 'page introduction must explain the construct directly');\n  assert.ok(html.includes('body sensations and affect dimensions'), 'page introduction must describe the actual method');\n\n  assert.ok(data.includes('A state of apprehension or heightened arousal associated with anticipated threat, uncertainty, or possible negative outcomes.'), 'emotion definitions must use neutral descriptive language');\n  assert.ok(data.includes('High activation with pleasant affect can occur with joy, excitement, or pride.'), 'affect-zone copy must use descriptive rather than decorative language');\n  assert.ok(runtime.includes("renderListSection('Possible body cues', emotion.bodySignals)"), 'selected-emotion details must use probabilistic section framing');\n  assert.ok(runtime.includes('These patterns vary by person. Treat them as possibilities rather than conclusions.'), 'selected-emotion detail must state its uncertainty plainly');\n  assert.ok(runtime.includes('Suggestions are hypotheses based on affect science, not diagnoses.'), 'the evidence notice must state the non-diagnostic boundary');\n\n  const combined = [html, runtime, data].join('\\n');\n  for (const retired of [\n    'gentle structure',\n    'caring next steps',\n    'areas that speak up',\n    'If you feel revved up',\n    'Keep practicing gently',\n    'You did courageous work',\n    'future-focused alert that wants',\n    'protective alarm',\n    'fiery surge',\n    'High, sparkling energy',\n    'deep ache that honors',\n    'Low stimulation that longs',\n    'future-you',\n    'your body wants something different',\n  ]) {\n    assert.equal(combined.includes(retired), false, 'retired anthropomorphic/conversational copy must stay retired: ' + retired);\n  }\n});\n`;
  }
  write(path, source);
}

// 5) Make real-device acceptance explicitly cover the two defects from the
// screenshots rather than treating Alexithymia as a generic page spot-check.
{
  const path = 'docs/bedrock-acceptance-checklist.md';
  let source = read(path);
  source = replaceExact(
    source,
    '- Alexithymia Support;',
    '- Alexithymia Support: on phone, confirm the lane uses most of the available viewport width, Step 3 selected-emotion details are not trapped inside a heavily inset nested card, explanatory language is neutral/professional rather than anthropomorphic, and Journal opens once from Step 4;',
    'Alexithymia real-device acceptance bullet',
  );
  write(path, source);
}
