import fs from 'fs/promises';
import path from 'path';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const LEXICON_OUTPUT_PATH = path.join(DATA_DIR, 'observation_lexicon.json');
const MODULE_OUTPUT_PATH = path.join(DATA_DIR, 'observation_module_blueprints.json');
const SITE_INDEX_PATH = path.join(DATA_DIR, 'index.json');

const LEXICON_DEFINITIONS = {
  dismissive_eye_roll: [
    { pattern: '\\broll(?:ed|s|ing)\\b[^\\n]{0,40}\\beyes?\\b', flags: 'iu' },
    { pattern: '\\beye[-\\s]?roll(?:ed|s|ing)?\\b', flags: 'iu' },
  ],
  dismissive_sigh: [
    { pattern: '\\bheavy\\s+sigh\\b', flags: 'iu' },
    { pattern: '\\bsigh(?:ed|s|ing)\\b', flags: 'iu' },
  ],
  dismissive_headshake: [
    { pattern: '\\bshook\\b[^\\n]{0,30}\\bhead\\b', flags: 'iu' },
    { pattern: '\\bhead\\s*shake\\b', flags: 'iu' },
  ],
  dismissive_smirk: [
    { pattern: '\\bsmirk(?:ed|s|ing)\\b', flags: 'iu' },
    { pattern: '\\bsmirking\\b', flags: 'iu' },
  ],
  dismissive_laugh: [
    { pattern: '\\blaugh(?:ed|s|ing)\\b[^\\n]{0,40}\\b(?:at|about)\\b', flags: 'iu' },
    { pattern: '\\bsnicker(?:ed|s|ing)?\\b', flags: 'iu' },
  ],
  invalidating_too_sensitive: [
    { pattern: '\\btoo\\s+sensitive\\b', flags: 'iu' },
    { pattern: '\\boverly\\s+sensitive\\b', flags: 'iu' },
  ],
  invalidating_overreacting: [
    { pattern: '\\boverreact(?:ing|ed)?\\b', flags: 'iu' },
    { pattern: '\\bmaking\\s+too\\s+big\\s+a\\s+deal\\b', flags: 'iu' },
  ],
  invalidating_calmdown: [
    { pattern: '\\bcalm\\s+down\\b', flags: 'iu' },
    { pattern: '\\b(?:relax|chill)\\s+out\\b', flags: 'iu' },
  ],
  invalidating_imagining: [
    { pattern: '\\b(?:imagining|making\\s+up|misremembering)\\b', flags: 'iu' },
    { pattern: '\\byou\\s+made\\s+that\\s+up\\b', flags: 'iu' },
  ],
  invalidating_never_happened: [
    { pattern: '\\bthat\\s+never\\s+happened\\b', flags: 'iu' },
    { pattern: '\\bi\\s+never\\s+said\\s+that\\b', flags: 'iu' },
  ],
  interrupting_cutoff: [
    { pattern: '\\bcut\\s+(?:me|us|them)\\s+off\\b', flags: 'iu' },
    { pattern: '\\bkept\\s+cutting\\s+(?:me|us|them)\\s+off\\b', flags: 'iu' },
  ],
  interrupting_talk_over: [
    { pattern: '\\btalk(?:ed|s|ing)\\s+over\\b', flags: 'iu' },
    { pattern: '\\btalking\\s+over\\s+(?:me|us|them)\\b', flags: 'iu' },
  ],
  interrupting_muted: [
    { pattern: '\\bmuted\\b[^\\n]{0,40}\\bmic\\b', flags: 'iu' },
    { pattern: '\\bmuted\\s+(?:me|us)\\b', flags: 'iu' },
  ],
  interrupting_ignored_hand: [
    { pattern: '\\bignored\\s+(?:my|the)\\s+(?:hand|hands?)\\s+raise\\b', flags: 'iu' },
    { pattern: '\\bdidn\'t\\s+call\\s+on\\s+me\\b', flags: 'iu' },
  ],
  blame_your_fault: [
    { pattern: '\\bit\\s*(?:\'s|\s+is)\\s+your\\s+fault\\b', flags: 'iu' },
    { pattern: '\\byou\\s+caused\\s+this\\b', flags: 'iu' },
  ],
  blame_should_have: [
    { pattern: '\\byou\\s+should\\s+have\\b', flags: 'iu' },
    { pattern: '\\byou\\s+never\\s+should\\s+have\\b', flags: 'iu' },
  ],
  blame_cause_problem: [
    { pattern: '\\bcausing\\s+(?:a\\s+)?problem\\b', flags: 'iu' },
    { pattern: '\\bcreating\\s+(?:issues?|problems?)\\b', flags: 'iu' },
  ],
  credit_took_credit: [
    { pattern: '\\btook\\s+credit\\b', flags: 'iu' },
    { pattern: '\\bclaimed\\s+(?:it\\s+was|it\\s+as)\\b', flags: 'iu' },
  ],
  credit_presented_as_their: [
    { pattern: '\\bpresented\\s+(?:my|our)\\s+work\\s+as\\s+(?:their|his|her)\\s+own\\b', flags: 'iu' },
    { pattern: '\\bcalled\\s+it\\s+their\\s+idea\\b', flags: 'iu' },
  ],
  credit_erased_role: [
    { pattern: '\\bleft\\s+(?:my|our)\\s+name\\s+off\\b', flags: 'iu' },
    { pattern: '\\bremoved\\s+(?:me|us)\\s+from\\s+the\\s+credits?\\b', flags: 'iu' },
  ],
  support_no_followup: [
    { pattern: '\\bnever\\s+followed\\s+up\\b', flags: 'iu' },
    { pattern: '\\bdidn\'t\\s+follow\\s+up\\b', flags: 'iu' },
  ],
  support_left_on_read: [
    { pattern: '\\bleft\\s+(?:me|us)\\s+on\\s+read\\b', flags: 'iu' },
    { pattern: '\\bignored\\s+my\\s+message\\b', flags: 'iu' },
  ],
  support_no_backup: [
    { pattern: '\\bdidn\'t\\s+back\\s+(?:me|us)\\s+up\\b', flags: 'iu' },
    { pattern: '\\bstood\\s+by\\b[^\\n]{0,30}\\bsilent\\b', flags: 'iu' },
  ],
  exclusion_not_invited: [
    { pattern: '\\bwasn\'t\\s+invited\\b', flags: 'iu' },
    { pattern: '\\bleft\\s+(?:me|us)\\s+off\\s+the\\s+invite\\b', flags: 'iu' },
  ],
  exclusion_closed_door: [
    { pattern: '\\bclosed\\s+door\\b[^\\n]{0,30}\\bmeeting\\b', flags: 'iu' },
    { pattern: '\\bclosed\\s+the\\s+door\\s+on\\s+(?:me|us)\\b', flags: 'iu' },
  ],
  exclusion_left_out: [
    { pattern: '\\bleft\\s+(?:me|us)\\s+out\\b', flags: 'iu' },
    { pattern: '\\bkept\\s+(?:me|us)\\s+out\\b', flags: 'iu' },
  ],
  threats_consequence: [
    { pattern: '\\bor\\s+else\\b', flags: 'iu' },
    { pattern: '\\bthere\\s+will\\s+be\\s+consequences\\b', flags: 'iu' },
  ],
  threats_job_security: [
    { pattern: '\\bjob\\s+(?:is|was)\\s+on\\s+the\\s+line\\b', flags: 'iu' },
    { pattern: '\\bfire\\s+you\\b', flags: 'iu' },
  ],
  threats_retaliate: [
    { pattern: '\\bmake\\s+sure\\s+you\\s+regret\\b', flags: 'iu' },
    { pattern: '\\bpay\\s+for\\s+this\\b', flags: 'iu' },
  ],
  micromanage_hover: [
    { pattern: '\\bhover(?:ed|s|ing)\\b', flags: 'iu' },
    { pattern: '\\bstood\\s+over\\s+(?:me|us)\\b', flags: 'iu' },
  ],
  micromanage_rewrite: [
    { pattern: '\\brewrote\\b', flags: 'iu' },
    { pattern: '\\bredid\\s+my\\s+work\\b', flags: 'iu' },
  ],
  micromanage_override: [
    { pattern: '\\boverrid(?:e|ing|es)\\b', flags: 'iu' },
    { pattern: '\\bchanged\\s+my\\s+decision\\b', flags: 'iu' },
  ],
  boundary_ignored: [
    { pattern: '\\bignored\\s+my\\s+boundary\\b', flags: 'iu' },
    { pattern: '\\bblew\\s+past\\s+my\\s+boundary\\b', flags: 'iu' },
  ],
  boundary_shared_private: [
    { pattern: '\\bshared\\s+my\\s+(?:personal|private)\\s+(?:story|information|details)\\b', flags: 'iu' },
    { pattern: '\\btold\\s+everyone\\s+what\\s+I\\s+said\\b', flags: 'iu' },
  ],
  boundary_touch: [
    { pattern: '\\btouched\\s+(?:me|us)\\s+without\\s+permission\\b', flags: 'iu' },
    { pattern: '\\bhugged\\s+(?:me|us)\\s+without\\s+asking\\b', flags: 'iu' },
  ],
  stonewall_silent: [
    { pattern: '\\bsilent\\s+treatment\\b', flags: 'iu' },
    { pattern: '\\brefused\\s+to\\s+talk\\b', flags: 'iu' },
  ],
  stonewall_cancelled: [
    { pattern: '\\bcancelled\\s+at\\s+the\\s+last\\s+minute\\b', flags: 'iu' },
    { pattern: '\\bkept\\s+canceling\\s+our\\s+check-ins\\b', flags: 'iu' },
  ],
  stonewall_walked_away: [
    { pattern: '\\bwalked\\s+away\\s+while\\s+I\\s+was\\s+talking\\b', flags: 'iu' },
    { pattern: '\\bleft\\s+the\\s+conversation\\b', flags: 'iu' },
  ],
  bias_comment_stereotype: [
    { pattern: '\\bstereotyp(?:e|ed|ing)\\b', flags: 'iu' },
    { pattern: "\\bbecause\\s+you're\\s+a\\b", flags: 'iu' },
  ],
  bias_comment_token: [
    { pattern: '\\btoken\\s+hire\\b', flags: 'iu' },
    { pattern: '\\bdiversity\\s+hire\\b', flags: 'iu' },
  ],
  bias_comment_joke: [
    { pattern: '\\bjust\\s+a\\s+joke\\b', flags: 'iu' },
    { pattern: '\\bcan\'t\\s+you\\s+take\\s+a\\s+joke\\b', flags: 'iu' },
  ],
  bias_comment_mispronounce: [
    { pattern: '\\bkept\\s+mispronounc(?:e|ing)\\b', flags: 'iu' },
    { pattern: '\\brefused\\s+to\\s+say\\s+my\\s+name\\b', flags: 'iu' },
  ],
  bias_comment_microaggression: [
    { pattern: '\\bwhere\\s+are\\s+you\\s+really\\s+from\\b', flags: 'iu' },
    { pattern: '\\byou\\s+speak\\s+english\\s+so\\s+well\\b', flags: 'iu' },
  ],
  surveillance_camera: [
    { pattern: '\\bchecked\\s+the\\s+cameras\\b', flags: 'iu' },
    { pattern: '\\bwatched\\s+me\\s+on\\s+camera\\b', flags: 'iu' },
  ],
  surveillance_logs: [
    { pattern: '\\btracked\\s+my\\s+activity\\b', flags: 'iu' },
    { pattern: '\\bpulled\\s+the\\s+logs\\b', flags: 'iu' },
  ],
  surveillance_screenshare: [
    { pattern: '\\bforced\\s+me\\s+to\\s+share\\s+my\\s+screen\\b', flags: 'iu' },
    { pattern: '\\bmade\\s+me\\s+turn\\s+on\\s+my\\s+camera\\b', flags: 'iu' },
  ],
  gossip_rumor: [
    { pattern: '\\bspread\\s+(?:a\\s+)?rumor\\b', flags: 'iu' },
    { pattern: '\\bstarting\\s+rumors\\b', flags: 'iu' },
  ],
  gossip_shared_private: [
    { pattern: '\\bshared\\s+my\\s+business\\b', flags: 'iu' },
    { pattern: '\\btold\\s+everyone\\s+my\\s+news\\b', flags: 'iu' },
  ],
  gossip_public_chat: [
    { pattern: '\\bposted\\s+about\\s+(?:me|us)\\s+in\\s+(?:the|our)\\s+chat\\b', flags: 'iu' },
    { pattern: '\\bblasted\\s+(?:me|us)\\s+in\\s+the\\s+channel\\b', flags: 'iu' },
  ],
  retaliation_schedule: [
    { pattern: '\\bcut\\s+my\\s+hours\\b', flags: 'iu' },
    { pattern: '\\bgave\\s+me\\s+the\\s+worst\\s+shift\\b', flags: 'iu' },
  ],
  retaliation_assignments: [
    { pattern: '\\bassign(?:ed|ing)\\s+busy\\s+work\\b', flags: 'iu' },
    { pattern: '\\bloaded\\s+me\\s+with\\s+extra\\s+work\\b', flags: 'iu' },
  ],
  retaliation_reviews: [
    { pattern: '\\bthreatened\\s+my\\s+review\\b', flags: 'iu' },
    { pattern: '\\bput\\s+me\\s+on\\s+notice\\b', flags: 'iu' },
  ],
};

const MODULE_BLUEPRINTS = [
  {
    id: 'dismissive-gestures',
    label: 'Dismissive gestures and looks',
    summary: 'Gestures that communicate ridicule or dismissal in the moment.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'dismissive_eye_roll',
      'dismissive_sigh',
      'dismissive_headshake',
      'dismissive_smirk',
      'dismissive_laugh',
    ],
    feelings: ['hurt', 'embarrassed', 'frustrated'],
    needs: ['respect', 'consideration', 'to-be-heard'],
    examples: [
      'During (event) at (location), (person-peer) rolled their eyes while I reviewed (object).',
      'At (location) during (event), (person-authority) let out a heavy sigh when I asked a clarifying question.',
    ],
    cues: [
      {
        id: 'gesture-eye-roll',
        lexiconKeys: ['dismissive_eye_roll'],
        phrases: ['rolled their eyes at me'],
        example: 'During (event) at (location), (person-authority) rolled their eyes at (person-general) while we reviewed (object).',
      },
      {
        id: 'gesture-heavy-sigh',
        lexiconKeys: ['dismissive_sigh'],
        phrases: ['gave a heavy sigh'],
        example: 'At (location) during (event), (person-peer) let out a heavy sigh while (person-general) shared (statement).',
      },
      {
        id: 'gesture-head-shake',
        lexiconKeys: ['dismissive_headshake'],
        phrases: ['shook their head at me'],
        example: 'In (location) during (event), (person-partner) shook their head while I described (object).',
      },
      {
        id: 'gesture-smirk',
        lexiconKeys: ['dismissive_smirk'],
        phrases: ['smirked at me'],
        example:
          'During (event) at (location), (person-peer) smirked at (person-general) while repeating "(statement)" back at them.',
      },
      {
        id: 'gesture-group-laugh',
        lexiconKeys: ['dismissive_laugh'],
        phrases: ['laughed at me'],
        example: 'At (location), (group) laughed at (person-general) moments after (statement) during (event).',
      },
    ],
  },
  {
    id: 'invalidating-responses',
    label: 'Invalidating responses to feedback',
    summary: 'Statements that downplay, dismiss, or gaslight concerns.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'invalidating_too_sensitive',
      'invalidating_overreacting',
      'invalidating_calmdown',
      'invalidating_imagining',
      'invalidating_never_happened',
    ],
    feelings: ['frustrated', 'confused', 'angry'],
    needs: ['understanding', 'respect', 'to-be-heard'],
    examples: [
      'During (event) at (location), (person-peer) said "(statement)" telling (person-general) they were too sensitive.',
      'At (location) after (event), (person-authority) insisted "(statement)" claiming nothing happened.',
    ],
    cues: [
      {
        id: 'invalidating-too-sensitive',
        lexiconKeys: ['invalidating_too_sensitive'],
        phrases: ['told me I was too sensitive'],
        example: 'During (event) at (location), (person-peer) said "(statement)" telling (person-general) they were too sensitive about (object).',
      },
      {
        id: 'invalidating-overreacting',
        lexiconKeys: ['invalidating_overreacting'],
        phrases: ['said I was overreacting'],
        example: 'At (location) after (event), (person-authority) said "(statement)" claiming (person-general) was overreacting.',
      },
      {
        id: 'invalidating-calm-down',
        lexiconKeys: ['invalidating_calmdown'],
        phrases: ['told me to calm down'],
        example:
          'During (event), (person-peer) said "Calm down" instead of responding to (statement) about (object).',
      },
      {
        id: 'invalidating-made-up',
        lexiconKeys: ['invalidating_imagining'],
        phrases: ['said I made it up'],
        example: 'While we were at (location), (person-authority) said "(statement)" insisting (person-general) imagined the issue.',
      },
      {
        id: 'invalidating-never-happened',
        lexiconKeys: ['invalidating_never_happened'],
        phrases: ['insisted it never happened'],
        example:
          'After (event) at (location), (person-peer) said "(statement)" insisting nothing like that ever happened.',
      },
    ],
  },
  {
    id: 'interrupting-dynamics',
    label: 'Interrupting and talking over',
    summary: 'Moments where others block or override speaking time.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'interrupting_cutoff',
      'interrupting_talk_over',
      'interrupting_muted',
      'interrupting_ignored_hand',
    ],
    feelings: ['frustrated', 'irritated', 'humiliated'],
    needs: ['respect', 'consideration', 'space'],
    examples: [
      'During (event) on (channel), (person-peer) cut me off while I described (object).',
      'At (location), (person-authority) muted (person-general) during (event).',
    ],
    cues: [
      {
        id: 'interruption-cut-off',
        lexiconKeys: ['interrupting_cutoff'],
        phrases: ['kept cutting me off'],
        example: 'During (event) on (channel), (person-peer) cut (person-general) off while we discussed (object).',
      },
      {
        id: 'interruption-talk-over',
        lexiconKeys: ['interrupting_talk_over'],
        phrases: ['talked over me'],
        example:
          'At (location) during (event), (person-authority) kept talking while (person-general) said "(statement)" about (object).',
      },
      {
        id: 'interruption-muted',
        lexiconKeys: ['interrupting_muted'],
        phrases: ['muted my mic'],
        example:
          'On (channel) during (event), (person-peer) muted (person-general)\'s mic while they began sharing "(statement)" about (object).',
      },
      {
        id: 'interruption-ignored-hand',
        lexiconKeys: ['interrupting_ignored_hand'],
        phrases: ['ignored my raised hand'],
        example:
          "During (event) in (location), (person-authority) skipped (person-general) even though their hand was raised to share an update about (object).",
      },
    ],
  },
  {
    id: 'blame-and-shame',
    label: 'Blaming and shaming responses',
    summary: 'Accusations that pin the problem on the reporter.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'blame_your_fault',
      'blame_should_have',
      'blame_cause_problem',
    ],
    feelings: ['hurt', 'angry', 'resentful'],
    needs: ['understanding', 'support', 'fairness'],
    examples: [
      'During (event) at (location), (person-authority) said "(statement)" telling (person-general) it was their fault.',
    ],
    cues: [
      {
        id: 'blame-your-fault',
        lexiconKeys: ['blame_your_fault'],
        phrases: ['said it was my fault'],
        example:
          'During (event) at (location), (person-authority) told (person-general) "(statement)" saying they caused the problem.',
      },
      {
        id: 'blame-should-have',
        lexiconKeys: ['blame_should_have'],
        phrases: ['said I should have done more'],
        example:
          'After (event) at (location), (person-peer) said "(statement)" telling (person-general) they had to handle (object) alone.',
      },
      {
        id: 'blame-causing-problem',
        lexiconKeys: ['blame_cause_problem'],
        phrases: ['accused me of causing problems'],
        example: 'While we were in (location), (person-authority) said "(statement)" claiming (person-general) was causing problems.',
      },
    ],
  },
  {
    id: 'credit-and-recognition',
    label: 'Recognition and credit taking',
    summary: 'Moments where contributions are minimized or taken.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'credit_took_credit',
      'credit_presented_as_their',
      'credit_erased_role',
    ],
    feelings: ['resentful', 'disappointment', 'hurt'],
    needs: ['acknowledgement', 'fairness', 'respect'],
    examples: [
      'During (event), (person-peer) presented (object) as their idea even though (person-general) created it.',
    ],
    cues: [
      {
        id: 'credit-took-credit',
        lexiconKeys: ['credit_took_credit'],
        phrases: ['took credit for my work'],
        example: 'During (event) at (location), (person-peer) took credit for (object) that (person-general) created.',
      },
      {
        id: 'credit-presented-as-their',
        lexiconKeys: ['credit_presented_as_their'],
        phrases: ['presented my work as theirs'],
        example: 'At (location) during (event), (person-authority) presented (object) as their own work.',
      },
      {
        id: 'credit-erased-role',
        lexiconKeys: ['credit_erased_role'],
        phrases: ['left my name off'],
        example: 'During (event), (person-peer) shared (object) but left (person-general) off the credits.',
      },
    ],
  },
  {
    id: 'lack-of-support',
    label: 'Lack of follow-through or support',
    summary: 'Moments where promised support did not arrive.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'support_no_followup',
      'support_left_on_read',
      'support_no_backup',
    ],
    feelings: ['hurt', 'lonely', 'powerless'],
    needs: ['support', 'reliability', 'trust'],
    examples: [
      'After (event), (person-peer) never followed up about (object).',
      'On (channel), (person-authority) left my message on read when I shared (statement).',
    ],
    cues: [
      {
        id: 'support-no-followup',
        lexiconKeys: ['support_no_followup'],
        phrases: ['never followed up'],
        example:
          'After (event), (person-peer) did not follow up about (object) even though we set a check-in at (location).',
      },
      {
        id: 'support-left-on-read',
        lexiconKeys: ['support_left_on_read'],
        phrases: ['left my message on read'],
        example: 'On (channel) after (event), (person-authority) left (person-general) on read when they shared (statement).',
      },
      {
        id: 'support-no-backup',
        lexiconKeys: ['support_no_backup'],
        phrases: ['did not back me up'],
        example: 'During (event) at (location), (person-peer) stayed silent instead of backing (person-general) up about (object).',
      },
    ],
  },
  {
    id: 'exclusion-moments',
    label: 'Exclusion or being left out',
    summary: 'Situations where someone is intentionally excluded.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'exclusion_not_invited',
      'exclusion_closed_door',
      'exclusion_left_out',
    ],
    feelings: ['lonely', 'sad', 'hurt'],
    needs: ['belonging', 'inclusion', 'connection'],
    examples: [
      'During (event) at (location), (person-peer) held a closed-door discussion without (person-general).',
    ],
    cues: [
      {
        id: 'exclusion-no-invite',
        lexiconKeys: ['exclusion_not_invited'],
        phrases: ['was not invited'],
        example: 'I learned that during (event) at (location), (group) did not invite (person-general) to join.',
      },
      {
        id: 'exclusion-closed-door',
        lexiconKeys: ['exclusion_closed_door'],
        phrases: ['held a closed-door meeting'],
        example: 'At (location), (person-authority) closed the door for (event) and left (person-general) outside.',
      },
      {
        id: 'exclusion-left-out',
        lexiconKeys: ['exclusion_left_out'],
        phrases: ['left me out of the discussion'],
        example:
          'During (event) in (location), (person-peer) left (person-general) out of the planning conversation about (object) despite their reminders.',
      },
    ],
  },
  {
    id: 'threats-and-coercion',
    label: 'Threats or coercive statements',
    summary: 'Warnings that leverage fear or consequences.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'threats_consequence',
      'threats_job_security',
      'threats_retaliate',
    ],
    feelings: ['afraid', 'anxious', 'pressured'],
    needs: ['safety', 'autonomy', 'respect'],
    examples: [
      'During (event), (person-authority) said "(statement)" threatening consequences.',
    ],
    cues: [
      {
        id: 'threat-consequence',
        lexiconKeys: ['threats_consequence'],
        phrases: ['said there would be consequences'],
        example:
          'During (event) at (location), (person-authority) said "(statement)" warning (person-general) there would be consequences if they kept reporting it.',
      },
      {
        id: 'threat-job-security',
        lexiconKeys: ['threats_job_security'],
        phrases: ['threatened my job'],
        example:
          'At (location) after (event), (person-authority) said "(statement)" that (person-general) could lose their job if they didn\'t drop (object).',
      },
      {
        id: 'threat-retaliation',
        lexiconKeys: ['threats_retaliate'],
        phrases: ['promised retaliation'],
        example:
          'During (event), (person-authority) said "(statement)" promising they would make (person-general) regret speaking up to HR.',
      },
    ],
  },
  {
    id: 'micromanagement',
    label: 'Micromanagement and overriding work',
    summary: 'Moments where someone takes over or constantly checks work.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'micromanage_hover',
      'micromanage_rewrite',
      'micromanage_override',
    ],
    feelings: ['frustrated', 'thwarted', 'powerless'],
    needs: ['trust', 'autonomy', 'respect'],
    examples: [
      'During (event), (person-authority) hovered over (person-general) while they worked on (object).',
    ],
    cues: [
      {
        id: 'micromanage-hover',
        lexiconKeys: ['micromanage_hover'],
        phrases: ['hovered over my work'],
        example: 'During (event) at (location), (person-authority) hovered over (person-general) while they worked on (object).',
      },
      {
        id: 'micromanage-rewrite',
        lexiconKeys: ['micromanage_rewrite'],
        phrases: ['rewrote my work'],
        example: 'At (location), (person-peer) rewrote (object) that (person-general) had already finished.',
      },
      {
        id: 'micromanage-override',
        lexiconKeys: ['micromanage_override'],
        phrases: ['overrode my decision'],
        example: 'During (event), (person-authority) overrode (person-general) and changed (object) without discussion.',
      },
    ],
  },
  {
    id: 'boundary-crossing',
    label: 'Boundary crossing actions',
    summary: 'Moments where requests for boundaries are ignored.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'boundary_ignored',
      'boundary_shared_private',
      'boundary_touch',
    ],
    feelings: ['humiliated', 'tense', 'angry'],
    needs: ['safety', 'respect', 'autonomy'],
    examples: [
      'At (location) during (event), (person-peer) ignored the boundary (person-general) had set.',
    ],
    cues: [
      {
        id: 'boundary-ignored',
        lexiconKeys: ['boundary_ignored'],
        phrases: ['ignored my boundary'],
        example:
          'After (event) at (location), (person-partner) did (object) even though (person-general) had set that boundary moments earlier.',
      },
      {
        id: 'boundary-shared-private',
        lexiconKeys: ['boundary_shared_private'],
        phrases: ['shared my private story'],
        example: 'At (location), (person-peer) shared (person-general)\'s private story during (event).',
      },
      {
        id: 'boundary-touch',
        lexiconKeys: ['boundary_touch'],
        phrases: ['touched me without permission'],
        example: 'During (event) at (location), (person-peer) touched (person-general) without permission.',
      },
    ],
  },
  {
    id: 'stonewalling-and-silence',
    label: 'Stonewalling or shutting down conversation',
    summary: 'Moments where dialogue is blocked or abruptly ended.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'stonewall_silent',
      'stonewall_cancelled',
      'stonewall_walked_away',
    ],
    feelings: ['lonely', 'confused', 'hurt'],
    needs: ['to-be-heard', 'consideration', 'respect'],
    examples: [
      'During (event), (person-partner) walked away while (person-general) was sharing (statement).',
    ],
    cues: [
      {
        id: 'stonewall-silent-treatment',
        lexiconKeys: ['stonewall_silent'],
        phrases: ['gave me the silent treatment'],
        example: 'After (event), (person-partner) gave (person-general) the silent treatment at (location).',
      },
      {
        id: 'stonewall-cancelled',
        lexiconKeys: ['stonewall_cancelled'],
        phrases: ['cancelled our check-in'],
        example: 'Before (event), (person-authority) cancelled our check-in at the last minute.',
      },
      {
        id: 'stonewall-walked-away',
        lexiconKeys: ['stonewall_walked_away'],
        phrases: ['walked away while I was talking'],
        example: 'During (event) at (location), (person-peer) walked away while (person-general) was sharing (statement).',
      },
    ],
  },
  {
    id: 'bias-and-microaggressions',
    label: 'Bias, stereotypes, and microaggressions',
    summary: 'Statements that rely on stereotypes or biased assumptions.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'bias_comment_stereotype',
      'bias_comment_token',
      'bias_comment_joke',
      'bias_comment_mispronounce',
      'bias_comment_microaggression',
    ],
    feelings: ['angry', 'humiliated', 'tired'],
    needs: ['respect', 'justice', 'belonging'],
    examples: [
      'During (event) at (location), (person-peer) said "(statement)" relying on a stereotype.',
    ],
    cues: [
      {
        id: 'bias-stereotype-comment',
        lexiconKeys: ['bias_comment_stereotype'],
        phrases: ['made a stereotype about me'],
        example: 'During (event), (person-peer) said "(statement)" stereotyping (person-general).',
      },
      {
        id: 'bias-tokenizing',
        lexiconKeys: ['bias_comment_token'],
        phrases: ['called me a diversity hire'],
        example: 'At (location), (person-authority) said "(statement)" implying (person-general) was a token hire.',
      },
      {
        id: 'bias-just-a-joke',
        lexiconKeys: ['bias_comment_joke'],
        phrases: ['dismissed it as a joke'],
        example: 'During (event), (person-peer) said "(statement)" and told (person-general) it was just a joke.',
      },
      {
        id: 'bias-mispronounce-name',
        lexiconKeys: ['bias_comment_mispronounce'],
        phrases: ['kept mispronouncing my name'],
        example: 'At (location) during (event), (person-authority) mispronounced (person-general)\'s name even after being corrected.',
      },
      {
        id: 'bias-microaggression',
        lexiconKeys: ['bias_comment_microaggression'],
        phrases: ['asked where I am really from'],
        example: 'During (event), (person-peer) said "(statement)" asking where (person-general) was really from.',
      },
    ],
  },
  {
    id: 'surveillance-and-monitoring',
    label: 'Surveillance and monitoring',
    summary: 'Moments where activity is closely watched or recorded without consent.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'surveillance_camera',
      'surveillance_logs',
      'surveillance_screenshare',
    ],
    feelings: ['anxious', 'humiliated', 'pressured'],
    needs: ['privacy', 'trust', 'autonomy'],
    examples: [
      'During (event), (person-authority) forced (person-general) to share their screen.',
    ],
    cues: [
      {
        id: 'surveillance-camera',
        lexiconKeys: ['surveillance_camera'],
        phrases: ['checked the cameras on me'],
        example:
          'After (event), (person-authority) checked the cameras to watch (person-general) at (location) instead of speaking with them directly.',
      },
      {
        id: 'surveillance-logs',
        lexiconKeys: ['surveillance_logs'],
        phrases: ['pulled my activity logs'],
        example:
          'During (event), (person-peer) pulled the logs to monitor how (person-general) worked on (object) minute by minute.',
      },
      {
        id: 'surveillance-screenshare',
        lexiconKeys: ['surveillance_screenshare'],
        phrases: ['forced me to share my screen'],
        example:
          'On (channel), (person-authority) forced (person-general) to share their screen during (event) so they could watch every click.',
      },
    ],
  },
  {
    id: 'gossip-and-rumors',
    label: 'Gossip or rumor spreading',
    summary: 'Sharing personal or harmful information without consent.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'gossip_rumor',
      'gossip_shared_private',
      'gossip_public_chat',
    ],
    feelings: ['humiliated', 'embarrassed', 'hurt'],
    needs: ['trust', 'privacy', 'respect'],
    examples: [
      'During (event), (person-peer) spread a rumor about (person-general) in (location).',
    ],
    cues: [
      {
        id: 'gossip-rumor',
        lexiconKeys: ['gossip_rumor'],
        phrases: ['spread a rumor about me'],
        example: 'During (event) at (location), (person-peer) spread a rumor about (person-general).',
      },
      {
        id: 'gossip-shared-private',
        lexiconKeys: ['gossip_shared_private'],
        phrases: ['shared my business'],
        example: 'At (location), (person-peer) told (group) about (person-general)\'s private situation during (event).',
      },
      {
        id: 'gossip-public-chat',
        lexiconKeys: ['gossip_public_chat'],
        phrases: ['posted about me in the chat'],
        example: 'On (channel) during (event), (person-peer) posted about (person-general) in the group chat.',
      },
    ],
  },
  {
    id: 'retaliation-patterns',
    label: 'Retaliation after feedback',
    summary: 'Actions that punish someone for speaking up.',
    slotIds: ['time', 'context', 'sensory'],
    lexiconKeys: [
      'retaliation_schedule',
      'retaliation_assignments',
      'retaliation_reviews',
    ],
    feelings: ['anxious', 'scared', 'powerless'],
    needs: ['safety', 'fairness', 'support'],
    examples: [
      'After (event), (person-authority) changed (person-general)\'s schedule as retaliation.',
    ],
    cues: [
      {
        id: 'retaliation-schedule',
        lexiconKeys: ['retaliation_schedule'],
        phrases: ['cut my hours'],
        example: 'After (event), (person-authority) cut (person-general)\'s hours on the schedule at (location).',
      },
      {
        id: 'retaliation-assignments',
        lexiconKeys: ['retaliation_assignments'],
        phrases: ['loaded me with busy work'],
        example: 'Following (event), (person-authority) loaded (person-general) with extra busy work at (location).',
      },
      {
        id: 'retaliation-reviews',
        lexiconKeys: ['retaliation_reviews'],
        phrases: ['threatened my review'],
        example:
          'After (event) at (location), (person-authority) said "(statement)" saying they would mark (person-general)\'s review as unsatisfactory.',
      },
    ],
  },
];

async function loadSupportedVocabulary() {
  let contents;
  try {
    contents = await fs.readFile(SITE_INDEX_PATH, 'utf8');
  } catch (error) {
    const relativePath = path.relative(ROOT_DIR, SITE_INDEX_PATH);
    throw new Error(`Unable to read ${relativePath}: ${error.message}`);
  }

  let data;
  try {
    data = JSON.parse(contents);
  } catch (error) {
    const relativePath = path.relative(ROOT_DIR, SITE_INDEX_PATH);
    throw new Error(`Unable to parse ${relativePath}: ${error.message}`);
  }

  const feelings = new Set();
  const needs = new Set();

  (Array.isArray(data?.feelings) ? data.feelings : []).forEach(entry => {
    if (entry && typeof entry.slug === 'string' && entry.slug.trim()) {
      feelings.add(entry.slug.trim());
    }
  });

  (Array.isArray(data?.needs) ? data.needs : []).forEach(entry => {
    if (entry && typeof entry.slug === 'string' && entry.slug.trim()) {
      needs.add(entry.slug.trim());
    }
  });

  return { feelings, needs };
}

function normalizeModuleBlueprint(module, vocabulary) {
  const moduleId = module?.id || module?.label || 'module';
  const normalized = { ...module };

  if (Array.isArray(module?.feelings)) {
    normalized.feelings = normalizeSlugList(module.feelings, vocabulary.feelings, {
      kind: 'feeling',
      context: `module "${moduleId}"`,
    });
  }

  if (Array.isArray(module?.needs)) {
    normalized.needs = normalizeSlugList(module.needs, vocabulary.needs, {
      kind: 'need',
      context: `module "${moduleId}"`,
    });
  }

  if (Array.isArray(module?.cues)) {
    normalized.cues = module.cues.map(cue => normalizeCueBlueprint(cue, vocabulary, moduleId));
  }

  return normalized;
}

function normalizeCueBlueprint(cue, vocabulary, moduleId) {
  const cueId = cue?.id || cue?.label || 'cue';
  const context = `cue "${cueId}" in module "${moduleId}"`;
  const normalized = { ...cue };

  if (Array.isArray(cue?.feelings)) {
    normalized.feelings = normalizeSlugList(cue.feelings, vocabulary.feelings, {
      kind: 'feeling',
      context,
    });
  } else if ('feelings' in normalized) {
    delete normalized.feelings;
  }

  if (Array.isArray(cue?.needs)) {
    normalized.needs = normalizeSlugList(cue.needs, vocabulary.needs, {
      kind: 'need',
      context,
    });
  } else if ('needs' in normalized) {
    delete normalized.needs;
  }

  return normalized;
}

function normalizeSlugList(list, allowedSet, { kind, context }) {
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  list.forEach(entry => {
    const slug = typeof entry === 'string' ? entry.trim() : '';
    if (!slug) {
      return;
    }

    if (!allowedSet.has(slug)) {
      throw new Error(
        `Observation ${context} references unknown ${kind} slug "${slug}". Add a supported ${kind} entry or update the blueprint.`,
      );
    }

    if (!seen.has(slug)) {
      seen.add(slug);
      normalized.push(slug);
    }
  });

  return normalized;
}

function sortLexicon(definitions) {
  const sortedKeys = Object.keys(definitions).sort();
  const result = {};
  sortedKeys.forEach(key => {
    const entries = Array.isArray(definitions[key]) ? definitions[key] : [];
    result[key] = entries
      .map(entry => ({ ...entry }))
      .sort((a, b) => {
        const patternA = a.pattern || a.phrase || '';
        const patternB = b.pattern || b.phrase || '';
        return patternA.localeCompare(patternB);
      });
  });
  return result;
}

function sortModule(module) {
  return {
    ...module,
    lexiconKeys: Array.isArray(module.lexiconKeys) ? [...module.lexiconKeys].sort() : [],
    slotIds: Array.isArray(module.slotIds) ? [...module.slotIds].sort() : [],
    feelings: Array.isArray(module.feelings) ? [...module.feelings].sort() : [],
    needs: Array.isArray(module.needs) ? [...module.needs].sort() : [],
    examples: Array.isArray(module.examples)
      ? module.examples.map(example => example.trim()).filter(Boolean)
      : [],
    cues: Array.isArray(module.cues)
      ? module.cues
          .map(cue => ({
            ...cue,
            lexiconKeys: Array.isArray(cue.lexiconKeys) ? [...cue.lexiconKeys].sort() : [],
            phrases: Array.isArray(cue.phrases)
              ? cue.phrases
                  .map(phrase => phrase.trim())
                  .filter(Boolean)
                  .sort()
              : [],
          }))
          .sort((a, b) => a.id.localeCompare(b.id))
      : [],
  };
}

async function writeJson(filePath, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, text, 'utf8');
  console.log(`Wrote ${path.relative(ROOT_DIR, filePath)}`);
}

async function main() {
  const lexicon = sortLexicon(LEXICON_DEFINITIONS);
  const vocabulary = await loadSupportedVocabulary();
  const modules = MODULE_BLUEPRINTS
    .map(module => normalizeModuleBlueprint(module, vocabulary))
    .map(sortModule)
    .sort((a, b) => a.id.localeCompare(b.id));

  await writeJson(LEXICON_OUTPUT_PATH, lexicon);
  await writeJson(MODULE_OUTPUT_PATH, { modules });
}

main().catch(error => {
  console.error('Failed to generate observation language data', error);
  process.exitCode = 1;
});
