import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileObservationCueLibrary,
  parseObservationCueCSV,
  parseObservationCueModules,
} from '../lib/observationCueData.js';
import { suggestFromObservation } from '../lib/observationSuggest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function loadLibrary() {
  const csvPath = path.join(rootDir, 'data', 'observation_cues.sanitized.csv');
  const modulesPath = path.join(rootDir, 'data', 'observation_cue_modules.json');
  const [csvText, modulesText] = await Promise.all([
    fs.readFile(csvPath, 'utf8'),
    fs.readFile(modulesPath, 'utf8'),
  ]);
  const cues = parseObservationCueCSV(csvText);
  const moduleDefs = parseObservationCueModules(modulesText);
  return compileObservationCueLibrary({ cues, modules: moduleDefs });
}

const SCENARIOS = [
  {
    text: 'My manager rolled his eyes in front of everyone when I asked about the budget this morning.',
    moduleId: 'dismissive-responses',
  },
  {
    text: 'My partner keeps saying I never listen whenever we talk about chores.',
    moduleId: 'listening-boundaries',
  },
  {
    text: 'A coworker slammed her notebook shut and walked out during my presentation yesterday.',
    moduleId: 'presentation-departures',
  },
  {
    text: 'My teenager muttered "whatever" and shut their bedroom door after I asked about homework tonight.',
    moduleId: 'dismissive-responses',
  },
  {
    text: 'During last night\'s game, the referee ignored three fouls against our team.',
    moduleId: 'sports-officiating',
  },
  {
    text: 'The barista skipped me and served two people who arrived later in line this afternoon.',
    moduleId: 'queue-respect',
  },
  {
    text: 'My roommate left dirty dishes piled in the sink again before leaving for work.',
    moduleId: 'shared-upkeep',
  },
  {
    text: 'The email from HR said my contract wasn\'t renewed with no explanation.',
    moduleId: 'job-security',
  },
  {
    text: 'A friend told everyone at dinner that I\'m "too sensitive" when I declined a joke.',
    moduleId: 'dismissive-responses',
  },
  {
    text: 'The landlord hasn\'t responded to three messages about the leak this week.',
    moduleId: 'housing-reliability',
  },
  {
    text: 'My doctor glanced at the clock twice while I was describing my symptoms today.',
    moduleId: 'care-attention',
  },
  {
    text: 'During our video call, the client talked over me whenever I proposed a change.',
    moduleId: 'listening-boundaries',
  },
  {
    text: 'My sibling borrowed my car without asking and returned it with the tank empty.',
    moduleId: 'shared-upkeep',
  },
  {
    text: 'I caught myself scrolling for an hour instead of calling my grandmother back.',
    moduleId: 'self-accountability',
  },
  {
    text: 'My colleague whispered to another teammate and they both laughed after I shared an idea.',
    moduleId: 'dismissive-responses',
  },
  {
    text: 'The teacher handed back my child\'s assignment with "sloppy" written across the top.',
    moduleId: 'feedback-clarity',
  },
  {
    text: 'A cyclist sped through the crosswalk even though the light was red this morning.',
    moduleId: 'safety-commute',
  },
  {
    text: 'My boss sent me three Slack messages between 11 p.m. and midnight about tomorrow\'s report.',
    moduleId: 'workload-boundaries',
  },
  {
    text: 'At the grocery store, another shopper reached over me to grab the last carton of eggs.',
    moduleId: 'queue-respect',
  },
  {
    text: 'The contractor missed today\'s 8 a.m. appointment and hasn\'t texted or called.',
    moduleId: 'housing-reliability',
  },
  {
    text: 'My neighbor\'s dog barked loudly for 30 minutes starting at 6 a.m. on Saturday.',
    moduleId: 'noise-disturbance',
  },
  {
    text: 'During last week\'s meeting, the project lead assigned me all the follow-up tasks again.',
    moduleId: 'workload-boundaries',
  },
  {
    text: 'My partner scrolled through their phone during dinner instead of looking up.',
    moduleId: 'connection-presence',
  },
  {
    text: 'The rideshare driver talked loudly on speakerphone for the entire trip yesterday.',
    moduleId: 'ride-environment',
  },
  {
    text: 'I received a performance review that only listed mistakes without any concrete examples.',
    moduleId: 'feedback-clarity',
  },
  {
    text: 'My coworker double-checked the expense report and caught a mistake before we sent it.',
    moduleId: 'collaboration-safeguards',
  },
  {
    text: 'The gym trainer high-fived me when I hit a new personal best on squats.',
    moduleId: 'milestone-celebration',
  },
  {
    text: 'My neighbor shoveled our sidewalk after the snowstorm while we were at work.',
    moduleId: 'neighbor-support',
  },
  {
    text: 'The school principal emailed to say my volunteer hours made a big difference at the book fair.',
    moduleId: 'specific-appreciation',
  },
  {
    text: 'During therapy, my counselor paused and reflected back exactly what I said before offering input.',
    moduleId: 'reflective-presence',
  },
  {
    text: 'My partner cooked dinner and cleaned the kitchen while I finished my deadline.',
    moduleId: 'supportive-rebalancing',
  },
  {
    text: 'Our project manager balanced the workload so everyone only took two follow-ups this time.',
    moduleId: 'supportive-rebalancing',
  },
  {
    text: 'A stranger returned the wallet I dropped with all the cash still inside.',
    moduleId: 'integrity-returns',
  },
  {
    text: 'My boss approved my vacation request the same day I submitted it.',
    moduleId: 'responsive-approvals',
  },
  {
    text: 'The nurse checked in twice during the night to make sure my dad was comfortable.',
    moduleId: 'care-attentive-support',
  },
  {
    text: 'The delivery app marked my order as delivered, but nothing arrived at my door.',
    moduleId: 'delivery-gaps',
  },
  {
    text: 'My friend arrived 30 minutes late to lunch without texting.',
    moduleId: 'punctuality-boundaries',
  },
  {
    text: 'Our HOA sent a warning letter about lawn length without asking first.',
    moduleId: 'policy-warnings',
  },
  {
    text: 'My colleague took credit for my idea during the pitch meeting.',
    moduleId: 'recognition-boundaries',
  },
  {
    text: 'The daycare forgot to call when my child had a fever.',
    moduleId: 'care-communication-gaps',
  },
  {
    text: 'My dentist explained each step before starting the procedure.',
    moduleId: 'care-attentive-support',
  },
  {
    text: 'The bus driver waited for me when I was running toward the stop.',
    moduleId: 'commute-kindness',
  },
  {
    text: 'My teammate ignored the shared sprint board updates for a week.',
    moduleId: 'collaboration-visibility',
  },
  {
    text: 'Our landlord repaired the leaky faucet the day after we reported it.',
    moduleId: 'housing-responsiveness',
  },
  {
    text: 'My sibling promised to pay me back Friday but still hasn\'t sent anything.',
    moduleId: 'commitment-followthrough',
  },
  {
    text: 'The restaurant served my meal with peanuts after I noted my allergy.',
    moduleId: 'food-safety',
  },
  {
    text: 'My manager scheduled a meeting over my lunch break without asking.',
    moduleId: 'schedule-respect',
  },
  {
    text: 'The volunteer coordinator sent a heartfelt thank-you card with specific moments she appreciated.',
    moduleId: 'specific-appreciation',
  },
  {
    text: 'The support agent walked me through the fix step by step and followed up the next day.',
    moduleId: 'support-followthrough',
  },
  {
    text: 'The city finally fixed the streetlight after months of emails.',
    moduleId: 'infrastructure-response',
  },
  {
    text: 'A friend saw my 2 a.m. help text and left me on read for two days.',
    moduleId: 'digital-communication-gaps',
  },
  {
    text: "The intake nurse kept calling me 'sir' after I introduced myself with she/her pronouns.",
    moduleId: 'identity-respect-harms',
  },
  {
    text: 'The company livestream started without the captions we requested.',
    moduleId: 'accessibility-accommodations-denied',
  },
  {
    text: 'Insurance marked the pre-authorization for my top surgery consultation as denied with no human contact to appeal.',
    moduleId: 'healthcare-access-barriers',
  },
  {
    text: 'Border agents separated our family for secondary screening without telling us why or how long it would take.',
    moduleId: 'civic-process-obstacles',
  },
  {
    text: 'Utility alerts gave only minutes of warning before a rolling blackout, leaving my refrigerated meds at risk.',
    moduleId: 'environmental-safety-disruptions',
  },
  {
    text: "The Slack channel showed my request as 'seen' but no one replied or reacted.",
    moduleId: 'digital-communication-gaps',
  },
  {
    text: 'They insisted on calling my partner her girlfriend even after I said they use they/them pronouns.',
    moduleId: 'identity-respect-harms',
  },
  {
    text: 'Leadership kept our daily check-in at 6 a.m. despite the accommodation letter about my chronic illness.',
    moduleId: 'accessibility-accommodations-denied',
  },
  {
    text: 'The utility email gave barely any notice before a planned outage, so my insulin in the fridge was at risk.',
    moduleId: 'environmental-safety-disruptions',
  },
  {
    text: 'My manager keeps using the shortened English version of my name even though I updated the directory with my chosen name.',
    moduleId: 'identity-respect-harms',
  },
  {
    text: 'During the heatwave, the cooling centre stayed locked with no staff when we arrived.',
    moduleId: 'environmental-safety-disruptions',
  },
];

async function run() {
  const library = await loadLibrary();

  SCENARIOS.forEach((scenario, index) => {
    const result = suggestFromObservation(scenario.text, library, 6, { maxModules: 12 });
    assert.ok(result.hits.length > 0, `Expected at least one module hit for scenario ${index + 1}`);
    const moduleIds = result.hits.map(hit => hit.module?.id).filter(Boolean);
    assert.ok(
      moduleIds.includes(scenario.moduleId),
      `Scenario ${index + 1} should include module ${scenario.moduleId}, found ${moduleIds.join(', ')}`,
    );
    assert.ok(result.feelings.length > 0, `Scenario ${index + 1} should surface feeling suggestions`);
    assert.ok(result.needs.length > 0, `Scenario ${index + 1} should surface need suggestions`);
  });

  console.log('Scenario coverage checks passed.');
}

run().catch(error => {
  console.error('Scenario coverage test failed');
  throw error;
});
