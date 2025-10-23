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
    text: 'Yesterday at 4:15 p.m. in the war room with Jenna, I heard my manager say "We need to redo the launch deck tonight."',
    moduleId: 'last-minute-scope-shifts',
  },
  {
    text: 'At 8:30 p.m. last night in the nursery with our twins, I heard my partner say "You\'re on bedtime again."',
    moduleId: 'bedtime-load-gaps',
  },
  {
    text: 'On Monday at 2 p.m. at city hall with the clerk, I heard the staffer say "We still haven\'t replied to your emails."',
    moduleId: 'civic-nonresponse',
  },
  {
    text: 'During Tuesday\'s advisory meeting in room 214 with the grade-level team, I saw the agenda run 12 minutes past dismissal.',
    moduleId: 'meeting-overflow',
  },
  {
    text: 'At 11:45 p.m. on last night\'s ICU shift with Dr. Lee, I heard three pages come through after the schedule changed.',
    moduleId: 'on-call-chaos',
  },
  {
    text: 'Yesterday at 6 p.m. in the cafe lobby with our closing crew, I counted four tables left covered in cups.',
    moduleId: 'customer-mess-followup',
  },
  {
    text: 'At 9:05 a.m. today at my desk, my boss emailed "I need that deck tonight."',
    moduleId: 'urgent-email-demands',
  },
  {
    text: 'At 10:12 a.m. today in the back office, a customer left a voicemail saying "You\'re useless."',
    moduleId: 'voicemail-insults',
  },
  {
    text: 'This morning at 7:30 a.m. in my kitchen with the speakerphone on, the principal phoned me saying "Your kid disrupted class."',
    moduleId: 'school-discipline-calls',
  },
  {
    text: 'At 3:45 p.m. today in the finance Slack channel, Finance posted "Budget freeze effective immediately."',
    moduleId: 'budget-freeze-alerts',
  },
  {
    text: 'Yesterday at noon in my apartment, the landlord mailed a letter stamped "Eviction warning."',
    moduleId: 'housing-eviction-notices',
  },
  {
    text: 'At 6:15 p.m. tonight on our sofa with my partner, I read a text that said "We\'re done."',
    moduleId: 'relationship-breakup-text',
  },
  {
    text: 'At 9 p.m. last night in the security office, the footage shows two contractors climbing the fence.',
    moduleId: 'security-footage-breach',
  },
  {
    text: 'At 2 a.m. this morning in the nursery, the baby monitor recorded crying for 20 minutes straight.',
    moduleId: 'monitor-distress-alerts',
  },
  {
    text: 'At 5 p.m. yesterday on our porch, the doorbell cam captured the delivery driver leaving the package in the rain for 12 minutes.',
    moduleId: 'delivery-exposure',
  },
  {
    text: 'At 8:20 a.m. today in the SOC, the audit logs listed five unauthorized logins this week.',
    moduleId: 'audit-login-breaches',
  },
  {
    text: 'Throughout last night in the control room, the maintenance dashboard flashed red for the conveyor belt for three hours.',
    moduleId: 'maintenance-dashboard-alerts',
  },
  {
    text: 'During tonight\'s rehearsal at the arts center, I watched both tenors stare at the floor for 10 seconds.',
    moduleId: 'ensemble-dropoff',
  },
  {
    text: 'At 11 a.m. today in my office with my client, I heard them sigh for eight seconds without saying a word.',
    moduleId: 'session-silent-sighs',
  },
  {
    text: "This afternoon at my parents' dining table with my brother, I saw him stare silently at the divorce papers for 30 seconds.",
    moduleId: 'divorce-paper-silence',
  },
  {
    text: 'At 4 p.m. today in the shelter intake room, I noticed the coordinator close the intake clipboard and walk away for two minutes.',
    moduleId: 'intake-walkaways',
  },
  {
    text: 'During tonight\'s mediation session in room B with both partners, I watched both partners fold their arms for five seconds.',
    moduleId: 'mediation-body-language',
  },
  {
    text: 'At 02:14 during tonight\'s shift in the tower, radar flagged an unknown transponder ID 5487.',
    moduleId: 'radar-unknown-transponder',
  },
  {
    text: 'At 9 a.m. today in the lab with Priya, the assay produced inconsistent fluorescence versus the control plate with readings of 0.42 and 0.91.',
    moduleId: 'lab-fluorescence-variance',
  },
  {
    text: 'At 3 p.m. during rehearsal in studio A with the cast, I heard the choreographer say "I\'m giving your solo to Maya."',
    moduleId: 'performance-reassignment',
  },
  {
    text: 'At 10 a.m. in courtroom 2B with my client, the judge postponed our hearing and said "We\'ll reconvene next month."',
    moduleId: 'courtroom-delays',
  },
  {
    text: 'At 7 p.m. yesterday in the shelter gym with our intake team, I heard the volunteer say "We have no beds for the next two families."',
    moduleId: 'shelter-capacity-turnaway',
  },
  {
    text: 'At dawn today out by the west field with Luis, the irrigation pump alarm sounded and stopped the watering cycle after 4 minutes.',
    moduleId: 'irrigation-pump-alarms',
  },
  {
    text: 'During tonight\'s concert at the civic hall with the orchestra, the conductor cut the percussion entrance after two measures.',
    moduleId: 'orchestra-cuts',
  },
  {
    text: 'At 11 p.m. last night at the observatory with the scheduler, I heard them say "I double-booked the telescope you reserved."',
    moduleId: 'telescope-double-book',
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
