import {
  EMOTION_CIRCUMPLEX,
  inferZoneFromSensations,
  mergeCompassAndInferredZone,
  calculateRejectionPenalty,
  normalizeScoresWithPenalty,
} from './alexithymia-support-logic.js';

export const REVIEW_DATE = '2025-10-13';

const SOMATIC_SUPPORTS = [
  { label: 'Circumplex (valence × arousal)', ref: 'Posner & Russell 2005' },
  { label: 'Bodily maps arise from self-report topographies', ref: 'Nummenmaa et al. 2014' },
];
const SOMATIC_LIMITATIONS = ['Somatic cues guide hypotheses but do not diagnose emotions.'];

const ZONE_SUPPORTS = [
  { label: 'Core affect mapped by valence and arousal', ref: 'Barrett 2017' },
  { label: 'Circumplex reliably clusters feeling families', ref: 'Russell 1980' },
];
const ZONE_LIMITATIONS = ['Zones capture averages—personal context still matters.'];

const LABELING_SUPPORTS = [
  { label: 'Affect labeling dampens limbic activity', ref: 'Lieberman et al. 2007' },
  { label: 'Naming feelings supports regulation in practice', ref: 'Kircanski et al. 2012' },
];
const LABELING_LIMITATIONS = ['Language access varies by culture and learning history.'];

const PHYSIOLOGICAL_SIGH_SUPPORTS = [
  { label: 'Double-inhale sigh lowers autonomic arousal', ref: 'Balban et al. 2023' },
  { label: 'Slow exhalation improves state anxiety', ref: 'Naveen et al. 2016' },
];
const BREATH_LIMITATIONS = ['Breathing practices may need adaptation for respiratory conditions.'];

const RESONANCE_SUPPORTS = [
  { label: 'Resonance breathing stabilises HRV', ref: 'Zaccaro et al. 2018' },
  { label: '6 bpm breathing aids emotion regulation', ref: 'Lehrer & Gevirtz 2014' },
];

const SLOW_446_SUPPORTS = [
  { label: 'Slow paced breathing steadies autonomic tone', ref: 'Brown & Gerbarg 2005' },
  { label: 'Extended exhale promotes parasympathetic shift', ref: 'Strauss-Blasche et al. 2000' },
];

function cloneEvidenceSupports(list) {
  return list.map((entry) => ({ ...entry }));
}

function makeEvidenceEntry({ supports, limitations, level = 'B' }) {
  return {
    supports: cloneEvidenceSupports(supports),
    limitations: [...limitations],
    lastReviewed: REVIEW_DATE,
    level,
  };
}

function somaticEvidence(level = 'B') {
  return makeEvidenceEntry({ supports: SOMATIC_SUPPORTS, limitations: SOMATIC_LIMITATIONS, level });
}

export const BODY_OPTION_IDS = [
  'chest-tight',
  'chest-pressure',
  'chest-pounding',
  'chest-open',
  'gut-rolling',
  'gut-nausea',
  'gut-emptiness',
  'gut-warm',
  'throat-tight',
  'throat-lump',
  'throat-dry',
  'jaw-clench',
  'jaw-heat',
  'jaw-tremble',
  'head-pressure',
  'head-buzzing',
  'head-fog',
  'shoulders-weighted',
  'shoulders-braced',
  'shoulders-droop',
  'limbs-heavy',
  'limbs-restless',
  'limbs-tingly',
  'temp-flush',
  'temp-chill',
  'temp-prickly',
  'overall-numb',
  'overall-floating',
  'overall-calm',
];

export const ZONE_COMBINATIONS = [
  ['unpleasant', 'low'],
  ['unpleasant', 'medium'],
  ['unpleasant', 'high'],
  ['neutral', 'low'],
  ['neutral', 'medium'],
  ['neutral', 'high'],
  ['pleasant', 'low'],
  ['pleasant', 'medium'],
  ['pleasant', 'high'],
];

const EMOTION_EVIDENCE_GROUPS = {
  threat: makeEvidenceEntry({
    supports: [
      { label: 'Anxiety involves exaggerated threat appraisal', ref: 'Barlow 2002' },
      { label: 'Uncertainty amplifies vigilance and worry', ref: 'Grupe & Nitschke 2013' },
    ],
    limitations: ['Threat responses are shaped by experience and context.'],
    level: 'B',
  }),
  anger: makeEvidenceEntry({
    supports: [
      { label: 'Approach-related anger activates sympathetic arousal', ref: 'Harmon-Jones et al. 2011' },
      { label: 'Anger often defends threatened goals or boundaries', ref: 'Kassinove & Tafrate 2002' },
    ],
    limitations: ['Anger can mask secondary emotions like hurt or fear.'],
    level: 'B',
  }),
  loss: makeEvidenceEntry({
    supports: [
      { label: 'Sadness and grief follow attachment disruption', ref: 'Bonanno & Keltner 1997' },
      { label: 'Grief processing varies across mourning phases', ref: 'Stroebe et al. 2007' },
    ],
    limitations: ['Timelines for loss responses differ widely among individuals.'],
    level: 'B',
  }),
  shame: makeEvidenceEntry({
    supports: [
      { label: 'Shame and guilt regulate social belonging', ref: 'Tangney & Dearing 2002' },
      { label: 'Self-conscious emotions rely on internal standards', ref: 'Leach & Cidam 2015' },
    ],
    limitations: ['Cultural norms shape how shame and guilt appear.'],
    level: 'B',
  }),
  depletion: makeEvidenceEntry({
    supports: [
      { label: 'Boredom signals unmet engagement needs', ref: 'Eastwood et al. 2012' },
      { label: 'Low arousal states can blend with negative affect', ref: 'Kuppens et al. 2010' },
    ],
    limitations: ['Physical health factors can mimic low-energy emotions.'],
    level: 'B',
  }),
  curiosity: makeEvidenceEntry({
    supports: [
      { label: 'Curiosity rises with manageable uncertainty', ref: 'Kashdan et al. 2018' },
      { label: 'Information gaps motivate exploration', ref: 'Loewenstein 1994' },
    ],
    limitations: ['Tolerance for ambiguity differs by person and culture.'],
    level: 'B',
  }),
  approach: makeEvidenceEntry({
    supports: [
      { label: 'Approach motivation energises goal pursuit', ref: 'Gable & Harmon-Jones 2010' },
      { label: 'Positive challenge can heighten focus', ref: 'Seo et al. 2010' },
    ],
    limitations: ['Approach states can co-occur with anxiety or doubt.'],
    level: 'B',
  }),
  positive: makeEvidenceEntry({
    supports: [
      { label: 'Positive emotions broaden attention and build resources', ref: 'Fredrickson 2001' },
      { label: 'Gratitude strengthens relational bonds', ref: 'Algoe 2012' },
    ],
    limitations: ['Not everyone resonates with the same positive emotion cues.'],
    level: 'B',
  }),
};

export const EMOTION_EVIDENCE_MAP = {
  anxiety: 'threat',
  fear: 'threat',
  overwhelm: 'threat',
  worry: 'threat',
  stress: 'threat',
  anger: 'anger',
  frustration: 'anger',
  sadness: 'loss',
  grief: 'loss',
  lonely: 'loss',
  guilt: 'shame',
  shame: 'shame',
  tired: 'depletion',
  numb: 'depletion',
  bored: 'depletion',
  curiosity: 'curiosity',
  thoughtful: 'curiosity',
  uncertain: 'curiosity',
  determined: 'approach',
  focused: 'approach',
  anticipation: 'approach',
  calm: 'positive',
  relief: 'positive',
  contentment: 'positive',
  hope: 'positive',
  gratitude: 'positive',
  joy: 'positive',
  pride: 'positive',
  excitement: 'positive',
};

export const EVIDENCE_REGISTRY = BODY_OPTION_IDS.reduce((acc, id) => {
  acc[id] = somaticEvidence('B');
  return acc;
}, {});

ZONE_COMBINATIONS.forEach(([valence, arousal]) => {
  const key = `zone-${valence}-${arousal}`;
  EVIDENCE_REGISTRY[key] = makeEvidenceEntry({ supports: ZONE_SUPPORTS, limitations: ZONE_LIMITATIONS, level: 'A' });
});

EVIDENCE_REGISTRY['skill-labeling'] = makeEvidenceEntry({
  supports: LABELING_SUPPORTS,
  limitations: LABELING_LIMITATIONS,
  level: 'A',
});
EVIDENCE_REGISTRY['skill-physiological_sigh'] = makeEvidenceEntry({
  supports: PHYSIOLOGICAL_SIGH_SUPPORTS,
  limitations: BREATH_LIMITATIONS,
  level: 'A',
});
EVIDENCE_REGISTRY['skill-resonance_6bpm'] = makeEvidenceEntry({
  supports: RESONANCE_SUPPORTS,
  limitations: BREATH_LIMITATIONS,
  level: 'A',
});
EVIDENCE_REGISTRY['skill-slow_446'] = makeEvidenceEntry({
  supports: SLOW_446_SUPPORTS,
  limitations: BREATH_LIMITATIONS,
  level: 'B',
});

Object.entries(EMOTION_EVIDENCE_MAP).forEach(([emotionKey, groupKey]) => {
  const group = EMOTION_EVIDENCE_GROUPS[groupKey];
  if (group) {
    EVIDENCE_REGISTRY[`emotion-${emotionKey}`] = makeEvidenceEntry(group);
  }
});

(function () {
  if (typeof document === 'undefined') {
    return;
  }
  const steps = {
    intro: document.querySelector('[data-step="intro"]'),
    breathing: document.querySelector('[data-step="breathing"]'),
    body: document.querySelector('[data-step="body"]'),
    compass: document.querySelector('[data-step="compass"]'),
    library: document.querySelector('[data-step="library"]'),
    journal: document.querySelector('[data-step="journal"]'),
    regulation: document.querySelector('[data-step="regulation"]'),
    communication: document.querySelector('[data-step="communication"]'),
    closing: document.querySelector('[data-step="closing"]'),
  };

  const STEP_SEQUENCE = ['intro', 'breathing', 'body', 'compass', 'library', 'journal', 'regulation', 'communication', 'closing'];

  const basePath = document.body?.dataset?.basePath || '';

  const SENSATION_DEFAULT_INTENSITY = 5;
  const EVIDENCE_MODE_ENABLED = window.NVC_FLAGS?.evidenceMode !== false;
  const EVIDENCE_NOTE_KEY = 'nvc_evidence_note_dismissed';
  const REJECTION_KEY = 'nvc_rejected_emotions';

  const BODY_REGIONS = [
    {
      id: 'chest',
      label: 'Chest or heart space',
      prompt: 'Rest your attention on your chest or heart space. Notice breath depth, expansion, or pulsing.',
      options: [
        {
          id: 'chest-tight',
          title: 'Tight or constricted',
          note: 'Band squeezing, armor, or breath held high',
          insight: 'Tightness across the chest can accompany your system bracing for threat or overwhelm.',
          emotions: { anxiety: 1.4, fear: 1.1, anger: 0.9, overwhelm: 1.1 },
        },
        {
          id: 'chest-pressure',
          title: 'Weighted or pressured',
          note: 'Heavy stone, shoulders collapsing inward',
          insight: 'Weight or pressure here can reflect grief, sadness, or responsibility carried for others.',
          emotions: { sadness: 1.1, grief: 1.2, stress: 1, guilt: 0.9 },
        },
        {
          id: 'chest-pounding',
          title: 'Pounding or racing heartbeat',
          note: 'Heart racing, flutter, sudden surges of beats',
          insight: 'A pounding heart can point to activation—anxiety, fear, anger, or eager anticipation.',
          emotions: { anxiety: 1.2, fear: 1.1, excitement: 1, anticipation: 1, anger: 0.6 },
        },
        {
          id: 'chest-open',
          title: 'Open, warm, or expansive',
          note: 'Soft chest, easy breathing, gentle warmth',
          insight: 'An open chest can accompany calm, relief, or joyful connection.',
          emotions: { calm: 1.2, relief: 1.1, joy: 0.8, gratitude: 0.9 },
        },
      ],
    },
    {
      id: 'gut',
      label: 'Stomach or gut',
      prompt: 'Soften awareness into your belly. Notice flips, hollowness, or steadiness.',
      options: [
        {
          id: 'gut-rolling',
          title: 'Rolling or fluttering',
          note: 'Butterflies, swirls, churning movement',
          insight: 'Rolling sensations can blend anxious worry with hopeful excitement about what is next.',
          emotions: { anxiety: 1.1, worry: 1, excitement: 0.9, anticipation: 1 },
        },
        {
          id: 'gut-nausea',
          title: 'Nausea or queasy',
          note: 'Churned up, unsettled, urge to vomit',
          insight: 'Nausea can show up when something feels unsafe, overwhelming, or not right.',
          emotions: { anxiety: 1, fear: 1.1, stress: 0.9, overwhelm: 0.9 },
        },
        {
          id: 'gut-emptiness',
          title: 'Hollow or empty',
          note: 'Sinking, dropping, missing center',
          insight: 'Emptiness in the gut can flag sadness, loneliness, or grief.',
          emotions: { sadness: 1.2, grief: 1.2, lonely: 1, numb: 0.8 },
        },
        {
          id: 'gut-warm',
          title: 'Settled or warm',
          note: 'Grounded fullness, gentle ease',
          insight: 'Warmth in the belly can match calm confidence or gentle hope.',
          emotions: { hope: 1, contentment: 1, calm: 1, gratitude: 0.9 },
        },
      ],
    },
    {
      id: 'throat',
      label: 'Throat and voice',
      prompt: 'Bring attention to your throat and voice box. Notice tightness, urge to speak, or dryness.',
      options: [
        {
          id: 'throat-tight',
          title: 'Tight or gripped',
          note: 'Squeezing band, hard to swallow',
          insight: 'A tight throat can appear when sadness, anxiety, or shame holds words back.',
          emotions: { sadness: 1, grief: 1, shame: 0.9, anxiety: 0.8 },
        },
        {
          id: 'throat-lump',
          title: 'Lump or swelling',
          note: 'Tears hovering, voice shaking, lump rising',
          insight: 'A lump in the throat can pair with grief, loneliness, or tenderness seeking expression.',
          emotions: { grief: 1.2, lonely: 1, sadness: 1.1, overwhelm: 0.8 },
        },
        {
          id: 'throat-dry',
          title: 'Dry or closed off',
          note: 'Scratchy, hard to speak, voice fades',
          insight: 'Dryness can indicate fear or anticipation about speaking up.',
          emotions: { fear: 1, anxiety: 1, anticipation: 0.8, shame: 0.7 },
        },
      ],
    },
    {
      id: 'jaw',
      label: 'Jaw, mouth, or fists',
      prompt: 'Notice your jaw, tongue, and hands. Are they loose, braced, or buzzing?',
      options: [
        {
          id: 'jaw-clench',
          title: 'Clenched or grinding',
          note: 'Teeth locked, fists tight, rigid tongue',
          insight: 'Clenched muscles can reflect anger, frustration, or determined resolve.',
          emotions: { anger: 1.3, frustration: 1.2, determined: 1, stress: 0.9 },
        },
        {
          id: 'jaw-heat',
          title: 'Heat or flush',
          note: 'Warm cheeks, heat pooling in jaw',
          insight: 'Heat in the jaw can mark anger, shame, or a boundary flare.',
          emotions: { anger: 1.1, shame: 1, frustration: 0.8, guilt: 0.7 },
        },
        {
          id: 'jaw-tremble',
          title: 'Tremble or quiver',
          note: 'Jaw shaking, lips or hands quivering',
          insight: 'Trembling around the mouth can accompany fear, overwhelm, or sadness releasing.',
          emotions: { fear: 1.1, anxiety: 1, sadness: 0.9, overwhelm: 1 },
        },
      ],
    },
    {
      id: 'head',
      label: 'Head and mind space',
      prompt: 'Check your forehead, temples, and behind the eyes. Notice pressure, buzzing, or fog.',
      options: [
        {
          id: 'head-pressure',
          title: 'Pressure or band',
          note: 'Helmet feeling, squeezing temples',
          insight: 'Head pressure can signal mental load, stress, or overwhelm asking for relief.',
          emotions: { overwhelm: 1.3, stress: 1.1, worry: 1 },
        },
        {
          id: 'head-buzzing',
          title: 'Buzzing or static',
          note: 'Quick thoughts, humming energy',
          insight: 'Buzzing in the head can come with anxious energy or excited anticipation.',
          emotions: { anxiety: 1.1, excitement: 0.9, anticipation: 0.9, overwhelm: 0.8 },
        },
        {
          id: 'head-fog',
          title: 'Foggy or heavy',
          note: 'Hard to focus, thick clouded feeling',
          insight: 'Fog can appear with exhaustion, low mood, or protective numbness.',
          emotions: { tired: 1.1, numb: 1, sadness: 0.8, overwhelm: 0.9 },
        },
      ],
    },
    {
      id: 'shoulders',
      label: 'Shoulders and upper back',
      prompt: 'Sense the slope of your shoulders and upper back. Notice if they lift, droop, or carry weight.',
      options: [
        {
          id: 'shoulders-weighted',
          title: 'Weighted or burdened',
          note: 'Heavy load, sagging posture, tight knots',
          insight: 'Weighted shoulders can align with stress, guilt, or sadness about responsibility.',
          emotions: { stress: 1.2, guilt: 1.1, sadness: 1, overwhelm: 1 },
        },
        {
          id: 'shoulders-braced',
          title: 'Lifted or braced',
          note: 'Raised, ready to act, armor-like',
          insight: 'Braced shoulders can show your body gearing up—anxiety, determination, or anger.',
          emotions: { anxiety: 1.1, determined: 1, anger: 0.8, fear: 0.9 },
        },
        {
          id: 'shoulders-droop',
          title: 'Drooping or collapsed',
          note: 'Slumped, no lift, giving way',
          insight: 'Drooping shoulders can reflect fatigue, discouragement, or grief.',
          emotions: { tired: 1.1, sadness: 1, grief: 0.9, numb: 0.9 },
        },
      ],
    },
    {
      id: 'limbs',
      label: 'Arms, hands, or legs',
      prompt: 'Let awareness move through arms and legs. Notice heaviness, restlessness, or tingles.',
      options: [
        {
          id: 'limbs-heavy',
          title: 'Heavy or lead-like',
          note: 'Hard to move, sluggish, weighted',
          insight: 'Heavy limbs can show tiredness, sadness, or numb shutdown.',
          emotions: { tired: 1.3, sadness: 1, numb: 1.1, overwhelm: 0.8 },
        },
        {
          id: 'limbs-restless',
          title: 'Restless or fidgety',
          note: 'Urge to pace, bounce, or shake',
          insight: 'Restless limbs can signal pent-up energy linked to anxiety, anticipation, or frustration.',
          emotions: { anxiety: 1.2, anticipation: 1.1, excitement: 1, frustration: 0.9 },
        },
        {
          id: 'limbs-tingly',
          title: 'Tingly or sparkly',
          note: 'Buzzing skin, energetic tingles',
          insight: 'Tingles can mean excited anticipation or anxious vigilance.',
          emotions: { anticipation: 1.2, excitement: 1.1, fear: 0.9, joy: 0.8 },
        },
      ],
    },
    {
      id: 'temperature',
      label: 'Temperature shifts',
      prompt: 'Notice any sudden changes in temperature or skin sensation.',
      options: [
        {
          id: 'temp-flush',
          title: 'Flush of heat',
          note: 'Cheeks glowing, warmth rushing outward',
          insight: 'Heat waves can pair with anger, excitement, or shame.',
          emotions: { anger: 1.2, excitement: 1, shame: 1, pride: 0.6 },
        },
        {
          id: 'temp-chill',
          title: 'Chill or cold rush',
          note: 'Goosebumps, cold core, shivers',
          insight: 'Chills may signal fear, anxiety, or grief moving through.',
          emotions: { fear: 1.2, anxiety: 1.1, sadness: 0.8, overwhelm: 0.9 },
        },
        {
          id: 'temp-prickly',
          title: 'Prickly or sweaty skin',
          note: 'Prickles, sudden sweat, tingling heat',
          insight: 'Prickly sensations can show adrenaline—anxiety, anticipation, or overwhelm.',
          emotions: { anxiety: 1.1, anticipation: 1, excitement: 0.9, stress: 0.8 },
        },
      ],
    },
    {
      id: 'overall',
      label: 'Whole-body sense',
      prompt: 'Step back and notice the overall tone of your body right now.',
      options: [
        {
          id: 'overall-numb',
          title: 'Muted or numb',
          note: 'Blank, disconnected, hard to feel',
          insight: 'Numbness can be protective when overwhelm maxes out.',
          emotions: { numb: 1.4, bored: 1.1, overwhelm: 0.9, tired: 0.9 },
        },
        {
          id: 'overall-floating',
          title: 'Floating or unreal',
          note: 'Drifting, spaced out, not quite here',
          insight: 'Floating sensations can hint at overwhelm or anxiety pulling you away from the moment.',
          emotions: { overwhelm: 1.1, anxiety: 1, numb: 0.9, sadness: 0.7 },
        },
        {
          id: 'overall-calm',
          title: 'Grounded or calm',
          note: 'Steady, anchored, peacefully present',
          insight: 'Steady calm can mean needs feel met—contentment, gratitude, or relief.',
          emotions: { calm: 1.3, relief: 1.1, contentment: 1.1, gratitude: 1 },
        },
      ],
    },
  ];

  const BODY_SENSATION_OPTIONS = new Map();
  const REGION_OPTION_IDS = new Map();
  const BODY_SCAN_SEQUENCE = [];
  const sensationOptionElements = new Map();
  const regionElements = new Map();

  BODY_REGIONS.forEach((region) => {
    BODY_SCAN_SEQUENCE.push(region.id);
    const ids = [];
    region.options.forEach((option) => {
      BODY_SENSATION_OPTIONS.set(option.id, {
        ...option,
        regionId: region.id,
        regionLabel: region.label,
      });
      ids.push(option.id);
    });
    REGION_OPTION_IDS.set(region.id, ids);
  });

  const QUADRANT_SUGGESTIONS = {
    'low-unpleasant': {
      label: 'Low energy · Unpleasant',
      description: 'Feeling heavy, foggy, or slowed down often pairs with sadness, grief, or depletion.',
      emotions: ['sadness', 'grief', 'tired', 'lonely'],
      care: [
        'Offer gentle comfort: wrap in a blanket, hold a warm mug, or play soothing sounds.',
        'If it feels right, reach out to someone who can sit with you or send a caring message.',
        'Try a slow body scan or progressive muscle relaxation to reassure weighted muscles.',
      ],
    },
    'medium-unpleasant': {
      label: 'Steady energy · Unpleasant',
      description: 'Uneasy steadiness can align with worry, guilt, or shame when something important feels off.',
      emotions: ['worry', 'guilt', 'shame', 'stress'],
      care: [
        'Name what feels out of alignment and what value or need wants attention.',
        'Try a grounding check: notice 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.',
        'Follow a short guided body scan or mindful stretch to ease tension as you journal patterns.',
      ],
    },
    'high-unpleasant': {
      label: 'High energy · Unpleasant',
      description: 'Revved-up distress can accompany anxiety, anger, fear, or overwhelm.',
      emotions: ['anxiety', 'fear', 'anger', 'overwhelm'],
      care: [
        'Lengthen your exhale or press your feet into the floor to remind your body it is supported.',
        'Shake out your hands or shoulders to release excess adrenaline before responding.',
        'Move through progressive muscle relaxation or mindful stretching to discharge the surge.',
      ],
    },
    'low-neutral': {
      label: 'Low energy · Neutral',
      description: 'Feeling flat or disconnected might relate to numbness, boredom, or simple fatigue.',
      emotions: ['numb', 'bored', 'tired'],
      care: [
        'Take a sensory inventory: notice texture, temperature, or gentle movement to wake up interoception.',
        'Try a small action such as stretching, stepping outside, or sipping water.',
        'Experiment with mindful stretching or tai chi to invite subtle sensations back online.',
      ],
    },
    'medium-neutral': {
      label: 'Steady energy · Neutral',
      description: 'Balanced energy can signal curiosity or being deep in thought while you evaluate what comes next.',
      emotions: ['curiosity', 'thoughtful', 'uncertain'],
      care: [
        'Jot down what you know and what questions you still have—naming them can clarify direction.',
        'Check whether you need more information, reassurance, or time before acting.',
        'Tag the situation in your journal so you can track what helps clarity return.',
      ],
    },
    'high-neutral': {
      label: 'High energy · Neutral',
      description: 'Buzzing but not distressed may indicate determination or anticipation before taking action.',
      emotions: ['determined', 'focused', 'anticipation'],
      care: [
        'Channel the energy into a clear next step or into movement like a brisk walk.',
        'Double-check your plan with a supportive person if you want validation before moving forward.',
        'Try mindful stretching, dance, or shaking to partner with the momentum without burning out.',
      ],
    },
    'low-pleasant': {
      label: 'Low energy · Pleasant',
      description: 'Easeful and grounded sensations often pair with calm or relief after effort.',
      emotions: ['calm', 'relief', 'contentment'],
      care: [
        'Savor the ease—lengthen the exhale, stretch gently, or notice what feels safe.',
        'Thank your body for the steadiness.',
        'Try a guided body scan to anchor the memory so you can revisit it later.',
      ],
    },
    'medium-pleasant': {
      label: 'Steady energy · Pleasant',
      description: 'Balanced warmth can signal contentment, hope, or gratitude.',
      emotions: ['contentment', 'hope', 'gratitude'],
      care: [
        'Write down what is working right now so you can return to it later.',
        'Share appreciation with someone involved if that feels good.',
        'Log a gratitude entry with tags so future-you can spot what supports you.',
      ],
    },
    'high-pleasant': {
      label: 'High energy · Pleasant',
      description: 'Sparkly energy often aligns with joy, excitement, or pride.',
      emotions: ['joy', 'excitement', 'pride'],
      care: [
        'Let yourself celebrate—move, dance, or tell someone the good news.',
        'Anchor the moment by noting what contributed to the joy.',
        'Capture quick journal tags so you remember what sparked the delight.',
      ],
    },
  };


  const EMOTION_LIBRARY = {
    anxiety: {
      name: 'Anxiety',
      definition: 'An activated, future-focused alert that wants to keep you prepared for possible danger.',
      bodySignals: ['Tight or fluttery chest', 'Fast heartbeat', 'Butterflies in the stomach', 'Restless energy in hands or feet'],
      thoughts: ['“What if something goes wrong?”', 'Planning every possible outcome', 'Scanning for threats or mistakes'],
      contexts: ['Facing uncertainty or change', 'Waiting for results', 'Holding lots of responsibility'],
      needs: ['Safety', 'Clarity', 'Support', 'Trust'],
      regulation: [
        'Try 4-4-6 breathing: inhale 4, hold 4, exhale 6 to downshift activation.',
        'Orient to the present—name five things you can see or touch to remind your body it is here now.',
      ],
      communication: "I'm feeling anxious and could use some reassurance or clearer next steps.",
    },
    fear: {
      name: 'Fear',
      definition: 'A protective alarm that signals you may be in danger or facing something threatening.',
      bodySignals: ['Cold hands', 'Wide eyes', 'Tense muscles ready to flee or freeze'],
      thoughts: ['“I might get hurt.”', '“This is risky.”'],
      contexts: ['Perceiving physical or emotional threat', 'Entering unfamiliar spaces without support'],
      needs: ['Safety', 'Security', 'Support'],
      regulation: [
        'Let someone you trust know you feel scared; co-regulation calms fear.',
        'Create a small safety ritual—lock doors, check facts, or hold a grounding object.',
      ],
      communication: "I feel afraid and would appreciate protection or someone nearby while I figure out my next step.",
    },
    anger: {
      name: 'Anger',
      definition: 'A fiery surge that appears when a boundary, value, or need for respect is threatened.',
      bodySignals: ['Heat in face or hands', 'Clenched jaw or fists', 'Quick breathing'],
      thoughts: ['“This isn’t fair.”', '“Stop this now.”'],
      contexts: ['Experiencing injustice or disrespect', 'Sensing a boundary violation'],
      needs: ['Respect', 'Fairness', 'Justice', 'Integrity'],
      regulation: [
        'Move the energy safely—shake your arms, stomp gently, or press into a pillow.',
        'Write down what boundary was crossed before deciding how to respond.',
      ],
      communication: "I’m feeling angry because something I value feels crossed. I need us to pause and address that boundary.",
    },
    overwhelm: {
      name: 'Overwhelm',
      definition: 'A sense that there is more input or responsibility than you can process at once.',
      bodySignals: ['Pressure in the head', 'Difficulty focusing', 'Sighing or shallow breath'],
      thoughts: ['“It’s too much.”', '“I can’t keep up.”'],
      contexts: ['Juggling competing demands', 'Taking in intense sensory or emotional input'],
      needs: ['Space', 'Support', 'Rest'],
      regulation: [
        'List the tasks and circle the single next step; let the rest wait.',
        'Take a sensory break—step outside, dim lights, or use noise reduction.',
      ],
      communication: 'I feel overwhelmed and need to slow down or get help choosing the next priority.',
    },
    excitement: {
      name: 'Excitement',
      definition: 'High, sparkling energy that appears when something desired is about to happen.',
      bodySignals: ['Bouncing legs', 'Quick speech', 'Warmth in the face'],
      thoughts: ['“This is going to be great!”', '“I can’t wait.”'],
      contexts: ['Anticipating a positive event', 'Working on an inspiring idea'],
      needs: ['Appreciation', 'Self expression', 'Connection'],
      regulation: ['Channel the spark—dance, share the news, or map out how to savor it.', 'Notice if you also need grounding to rest later.'],
      communication: 'I’m excited and want to celebrate or plan how to enjoy this moment.',
    },
    worry: {
      name: 'Worry',
      definition: 'A steady hum of concern that circles possibilities without resolution.',
      bodySignals: ['Tension behind eyes', 'Fidgeting', 'Tight shoulders'],
      thoughts: ['“Have I missed something?”', '“I should double-check.”'],
      contexts: ['Unfinished tasks', 'Ambiguous feedback', 'Caring deeply about an outcome'],
      needs: ['Clarity', 'Predictability', 'Support'],
      regulation: [
        'Write down the worry, then note what is in your control versus what is not.',
        'Schedule a specific time to revisit the concern so your brain can rest meanwhile.',
      ],
      communication: 'I’m feeling worried and could use information or reassurance about what happens next.',
    },
    sadness: {
      name: 'Sadness',
      definition: 'A low, heavy feeling that accompanies loss or unmet needs for connection or meaning.',
      bodySignals: ['Heavy chest or throat', 'Tears or eye pressure', 'Slower movements'],
      thoughts: ['“This hurts.”', '“I miss what was possible.”'],
      contexts: ['After disappointments', 'Missing someone or something important'],
      needs: ['Connection', 'Support', 'Empathy'],
      regulation: [
        'Allow tears or sighs—they help the wave move through.',
        'Offer warmth: wrap in a blanket, hold a pillow, or listen to gentle music.',
      ],
      communication: 'I feel sad and would appreciate some comfort or quiet company.',
    },
    grief: {
      name: 'Grief',
      definition: 'A deep ache that honors the loss of someone, something, or a future you hoped for.',
      bodySignals: ['Hollowness in the chest or stomach', 'Wave-like surges of emotion', 'Exhaustion after crying'],
      thoughts: ['“This shouldn’t be gone.”', '“I don’t know who I am without it.”'],
      contexts: ['Bereavement', 'Major life transitions', 'Letting go of a dream'],
      needs: ['Community', 'Support', 'Honor'],
      regulation: [
        'Create a small ritual—light a candle, write a letter, or look at photos.',
        'Ask someone to simply listen while you share memories or feelings.',
      ],
      communication: 'I’m grieving and need space and compassionate witness as I honor what I lost.',
    },
    tired: {
      name: 'Tired',
      definition: 'Low physical or emotional fuel signalling the need for rest or recovery.',
      bodySignals: ['Heavy limbs', 'Yawning', 'Difficulty concentrating'],
      thoughts: ['“I can’t push much more.”', '“I need a break.”'],
      contexts: ['Long stretches of effort', 'Emotional caregiving', 'Lack of sleep or nutrition'],
      needs: ['Rest', 'Relaxation', 'Support'],
      regulation: ['Schedule real rest—even 10 minutes counts.', 'Check in with basic care: water, food, movement, sleep.'],
      communication: 'I’m tired and need rest or help sharing responsibilities.',
    },
    lonely: {
      name: 'Lonely',
      definition: 'A signal that you long for connection, understanding, or companionship.',
      bodySignals: ['Ache in the chest', 'Hollow stomach', 'Tears without clear reason'],
      thoughts: ['“No one gets me.”', '“I wish someone were here.”'],
      contexts: ['Being isolated', 'Feeling unseen in a crowd', 'Transitions away from familiar people'],
      needs: ['Belonging', 'Closeness', 'Connection'],
      regulation: [
        'Reach out with a simple message—even a text counts.',
        'Engage in a community space that feels low-pressure, such as an online group or forum.',
      ],
      communication: 'I’m feeling lonely and would appreciate a check-in or shared activity.',
    },
    guilt: {
      name: 'Guilt',
      definition: 'An uneasy feeling that signals you may have stepped away from your values or impacted someone.',
      bodySignals: ['Weighted shoulders', 'Knotted stomach', 'Downcast gaze'],
      thoughts: ['“I should make this right.”', '“I let them down.”'],
      contexts: ['Hurting someone unintentionally', 'Not living up to your own standards'],
      needs: ['Accountability', 'Integrity', 'Honesty'],
      regulation: [
        'Acknowledge what happened and what you value.',
        'Plan a repair action, even if it is a small apology or change.',
      ],
      communication: 'I feel guilty because this matters to me. I want to repair what happened.',
    },
    shame: {
      name: 'Shame',
      definition: 'A painful belief that who you are is unworthy of belonging.',
      bodySignals: ['Heat in the face', 'Desire to hide', 'Collapsed posture'],
      thoughts: ['“I am the problem.”', '“People will reject me.”'],
      contexts: ['Receiving harsh criticism', 'Reliving past hurts', 'Comparing yourself to others'],
      needs: ['Acceptance', 'Empathy', 'To be seen'],
      regulation: [
        'Reach out to someone who can meet you with kindness.',
        'Place a hand on your heart and say a supportive phrase such as “I deserve care even when I err.”',
      ],
      communication: 'I’m feeling shame and need reassurance that I’m still worthy of connection.',
    },
    stress: {
      name: 'Stress',
      definition: 'The tension of carrying more demands than the current resources make comfortable.',
      bodySignals: ['Tight shoulders', 'Headaches', 'Shallow breathing'],
      thoughts: ['“There’s so much to do.”', '“I can’t drop any balls.”'],
      contexts: ['High workloads', 'Caregiving with few breaks', 'Competing deadlines'],
      needs: ['Support', 'Rest', 'Reliability'],
      regulation: [
        'Chunk tasks into small steps and set a realistic window for each.',
        'Ask for support or renegotiate expectations where possible.',
      ],
      communication: 'I’m stressed and would benefit from adjusting plans or getting backup.',
    },
    frustration: {
      name: 'Frustration',
      definition: 'Irritated energy that shows up when progress feels blocked.',
      bodySignals: ['Tense jaw', 'Sighing', 'Fidgeting'],
      thoughts: ['“Why isn’t this working?”', '“I’m stuck.”'],
      contexts: ['Technical issues', 'Miscommunication', 'Delays outside your control'],
      needs: ['Autonomy', 'Support', 'Understanding'],
      regulation: [
        'Step back for a short break to reset your focus.',
        'Name what is in your control and brainstorm one new approach.',
      ],
      communication: 'I feel frustrated and need help troubleshooting or adjusting expectations.',
    },
    numb: {
      name: 'Numb',
      definition: 'A muted state where feelings feel distant or inaccessible.',
      bodySignals: ['Flat or absent sensation', 'Difficulty naming emotions', 'Detached awareness'],
      thoughts: ['“I don’t know what I feel.”', '“It’s just blank.”'],
      contexts: ['Overload after intense emotions', 'Protective shutdown when overwhelmed'],
      needs: ['Calm', 'Empathy', 'Safety'],
      regulation: [
        'Check in with basic senses—hold something textured, taste something minty, or move slowly.',
        'Remind yourself that numbness is a protective signal, not a failure.',
      ],
      communication: 'Right now I feel numb. I may need time and gentle support before feelings return.',
    },
    bored: {
      name: 'Bored',
      definition: 'Low stimulation that longs for novelty, purpose, or engagement.',
      bodySignals: ['Restless legs', 'Sighing', 'Difficulty focusing'],
      thoughts: ['“This is pointless.”', '“I want something different.”'],
      contexts: ['Repeating tasks', 'Lack of creative outlet'],
      needs: ['Growth', 'Participation', 'Freedom'],
      regulation: [
        'Introduce a small change—switch locations, add music, or gamify a task.',
        'Reconnect with a longer-term goal or why the task matters to you.',
      ],
      communication: 'I’m bored and would enjoy something engaging or meaningful to shift my energy.',
    },
    curiosity: {
      name: 'Curiosity',
      definition: 'Open, exploratory interest in learning more about something.',
      bodySignals: ['Leaning forward', 'Eyes widening', 'Gentle alertness'],
      thoughts: ['“What is this about?”', '“I want to understand.”'],
      contexts: ['Encountering new ideas', 'Having space to explore without pressure'],
      needs: ['Clarity', 'Autonomy', 'Freedom'],
      regulation: ['Follow the thread—research, ask questions, or experiment safely.', 'Protect time to wander without judging productivity.'],
      communication: 'I’m curious and would like time or resources to explore this further.',
    },
    thoughtful: {
      name: 'Thoughtful',
      definition: 'A reflective mood that turns inward to process meaning or possibilities.',
      bodySignals: ['Soft gaze', 'Slower pace', 'Focus on inner imagery'],
      thoughts: ['“Let me think this through.”', '“How does this fit?”'],
      contexts: ['Making decisions', 'Integrating new insight'],
      needs: ['Understanding', 'Calm', 'Clarity'],
      regulation: ['Give yourself unhurried space to journal or map ideas.', 'Balance reflection with small grounding breaks.'],
      communication: 'I’m feeling thoughtful and could use space to process before responding.',
    },
    uncertain: {
      name: 'Uncertain',
      definition: 'Not yet sure what to feel or choose because information is incomplete.',
      bodySignals: ['Mixed sensations', 'Alternating tension and release'],
      thoughts: ['“I need more data.”', '“I’m on the fence.”'],
      contexts: ['Facing ambiguous outcomes', 'Transition periods'],
      needs: ['Clarity', 'Predictability', 'Support'],
      regulation: ['List what you know, what you guess, and what you need to find out.', 'Decide on the next small check-in point.'],
      communication: 'I’m uncertain and need more information or time before committing.',
    },
    determined: {
      name: 'Determined',
      definition: 'Focused drive to push toward a goal despite challenges.',
      bodySignals: ['Tight jaw', 'Forward posture', 'Strong grip'],
      thoughts: ['“I will make this happen.”', '“Keep going.”'],
      contexts: ['Working toward a meaningful goal', 'Protecting someone or something important'],
      needs: ['Accomplishment', 'Support', 'Commitment'],
      regulation: ['Channel the drive into a clear action plan.', 'Balance effort with intentional pauses to avoid burnout.'],
      communication: 'I’m feeling determined and would appreciate support or acknowledgement as I work on this.',
    },
    focused: {
      name: 'Focused',
      definition: 'Sharpened attention directed at a task or outcome.',
      bodySignals: ['Steady gaze', 'Still body with poised energy'],
      thoughts: ['“Stay on target.”', '“One step at a time.”'],
      contexts: ['Working through complex tasks', 'Solving a problem'],
      needs: ['Clarity', 'Order', 'Accomplishment'],
      regulation: ['Protect your focus window—silence notifications or set a timer.', 'Plan a closing ritual so you can release the task afterward.'],
      communication: 'I’m focused right now and need minimal interruptions until I finish.',
    },
    anticipation: {
      name: 'Anticipation',
      definition: 'Energized readiness for something coming soon—pleasant or uncertain.',
      bodySignals: ['Quickened breath', 'Forward-leaning posture', 'Tingling skin'],
      thoughts: ['“It’s almost time.”', '“I wonder how it will go.”'],
      contexts: ['Waiting for news', 'Preparing for an event'],
      needs: ['Predictability', 'Support', 'Trust'],
      regulation: ['Channel the build-up into preparation or a grounding routine.', 'Alternate between activity and calming breaths.'],
      communication: 'I’m feeling anticipation and would like support as I get ready.',
    },
    calm: {
      name: 'Calm',
      definition: 'Settled ease when your body senses safety and nothing demands urgent action.',
      bodySignals: ['Even breathing', 'Relaxed muscles', 'Warm, steady presence'],
      thoughts: ['“I can breathe.”', '“I have enough for this moment.”'],
      contexts: ['After soothing connection', 'When needs are met'],
      needs: ['Rest', 'Serenity', 'Peace'],
      regulation: ['Savor the calm by breathing slowly or practicing gratitude.', 'Note what supports this state for future reference.'],
      communication: 'I feel calm and grounded, which tells me my needs are met right now.',
    },
    relief: {
      name: 'Relief',
      definition: 'Release of tension after a feared outcome does not happen or support arrives.',
      bodySignals: ['Deep exhale', 'Softening shoulders', 'Warmth spreading'],
      thoughts: ['“It’s over.”', '“I can rest now.”'],
      contexts: ['Receiving good news', 'After a stressful event ends'],
      needs: ['Rest', 'Relaxation', 'Appreciation'],
      regulation: ['Let your body fully exhale and shake out leftover stress.', 'Mark the moment with a small reward or acknowledgement.'],
      communication: 'I’m relieved and want to honor the effort it took to get here.',
    },
    contentment: {
      name: 'Contentment',
      definition: 'Quiet satisfaction when needs feel sufficiently met.',
      bodySignals: ['Soft smile', 'Relaxed belly', 'Balanced posture'],
      thoughts: ['“This is enough for now.”', '“I can enjoy this.”'],
      contexts: ['Simple pleasures', 'Quality time with loved ones', 'Finishing meaningful work'],
      needs: ['Appreciation', 'Belonging', 'Peace'],
      regulation: ['Pause to notice sensory details—savor taste, texture, or scenery.', 'Share gratitude or document what you appreciate.'],
      communication: 'I feel content and grateful for how things are landing right now.',
    },
    hope: {
      name: 'Hope',
      definition: 'A forward-looking belief that improvement or support is possible.',
      bodySignals: ['Light chest', 'Lifted gaze', 'Gentle energy'],
      thoughts: ['“Something good could happen.”', '“There are options.”'],
      contexts: ['Glimpsing new possibilities', 'Receiving encouragement'],
      needs: ['Growth', 'Support', 'Empowerment'],
      regulation: ['Capture the ideas that spark hope so you can revisit them.', 'Pair hope with one practical next step.'],
      communication: 'I’m feeling hopeful and want to nurture this possibility together.',
    },
    gratitude: {
      name: 'Gratitude',
      definition: 'Warm appreciation for kindness, support, or meaningful experiences.',
      bodySignals: ['Warm chest', 'Soft smile', 'Moist eyes'],
      thoughts: ['“Thank you.”', '“This matters to me.”'],
      contexts: ['Receiving help', 'Noticing beauty', 'Moments of generosity'],
      needs: ['Appreciation', 'Connection', 'Mutuality'],
      regulation: ['Express thanks aloud, in writing, or through a small gesture.', 'Record the moment so you can revisit it later.'],
      communication: 'I feel grateful and want to express appreciation for what you did.',
    },
    joy: {
      name: 'Joy',
      definition: 'Expansive delight when something deeply meaningful or playful lands well.',
      bodySignals: ['Light, bouncy energy', 'Laughing', 'Sparkling eyes'],
      thoughts: ['“This is wonderful!”', '“I love this.”'],
      contexts: ['Celebrations', 'Shared laughter', 'Creative breakthroughs'],
      needs: ['Connection', 'Self expression', 'Freedom'],
      regulation: ['Amplify the joy—dance, sing, or share it.', 'Snapshot the moment mentally or physically to savor later.'],
      communication: 'I feel joyful and want to celebrate this together.',
    },
    pride: {
      name: 'Pride',
      definition: 'A warm sense of achievement or self-respect after meeting a challenge.',
      bodySignals: ['Expanded chest', 'Lifted chin', 'Steady stance'],
      thoughts: ['“I did it.”', '“I’m proud of myself.”'],
      contexts: ['Finishing a tough task', 'Living your values', 'Showing up bravely'],
      needs: ['Recognition', 'Integrity', 'Support'],
      regulation: ['Name the strengths you used.', 'Share the win with someone who will celebrate with you.'],
      communication: 'I feel proud of what I accomplished and want to mark this success.',
    },
  };

  const state = {
    selectedEmotion: null,
    quadrant: null,
    inferredQuadrant: null,
    compassQuadrant: null,
    activeTag: null,
    activeStep: STEP_SEQUENCE[0],
    compassTouched: false,
    energyValue: 0,
    valenceValue: 0,
    guidedScanActive: false,
    guidedScanIndex: -1,
    guidedScanStarted: false,
    draftPath: typeof window !== 'undefined' ? window.location.pathname : '',
    draftTimer: null,
    savedFeedbackTimer: null,
    lastSavedEntryId: '',
    saveButtonDefaultLabel: '',
    journalController: null,
    needs: [],
    feelings: [],
    bodyCandidates: [],
    compassCandidates: [],
    candidateEmotions: [],
    selectedEmotionConfidence: null,
    regulationLog: new Set(),
    preferredBreathPattern: 'slow_446',
    bodySuggestionMeta: null,
    compassSuggestionMeta: null,
    lastRejectedEmotion: null,
  };

  const startButton = steps.intro?.querySelector('[data-action="start"]');
  const breathingDisplay = document.querySelector('[data-breathing-display]');
  const breathingVisual = document.querySelector('[data-breathing-visual]');
  const bodySuggestions = document.querySelector('[data-body-suggestions]');
  const compassSuggestions = document.querySelector('[data-compass-suggestions]');
  const supportFlow = document.querySelector('.support-flow');
  const sensationRegionList = document.querySelector('[data-sensation-region-list]');
  const bodyScanPanel = document.querySelector('[data-sensation-scan]');
  const scanControls = bodyScanPanel?.querySelector('[data-scan-controls]');
  const scanStatus = bodyScanPanel?.querySelector('[data-scan-status]');
  const scanPrompt = bodyScanPanel?.querySelector('[data-scan-prompt]');
  const scanStartButton = bodyScanPanel?.querySelector('[data-action="scan-start"]');
  const scanBackButton = bodyScanPanel?.querySelector('[data-action="scan-back"]');
  const scanNextButton = bodyScanPanel?.querySelector('[data-action="scan-next"]');
  const scanFinishButton = bodyScanPanel?.querySelector('[data-action="scan-finish"]');
  const compassRoot = document.querySelector('[data-compass]');
  const emotionLibrary = document.querySelector('[data-emotion-library]');

  let journalForm = null;
  let journalStatus = null;
  let journalHistory = null;
  let regulationCard = null;
  let communicationCard = null;
  let supportJournalEmotion = null;
  let supportJournalIntensity = null;
  let supportJournalIntensityDisplay = null;
  let supportJournalNeedsInput = null;
  let supportJournalTagsInput = null;
  let supportJournalNotes = null;
  let supportJournalSubmit = null;
  let supportJournalOpenLink = null;
  let supportJournalContainer = null;
  let supportJournalLayer = null;
  let supportJournalDialog = null;
  let supportJournalOpenButton = null;
  let supportJournalCloseButton = null;
  let supportJournalTitle = null;
  let supportJournalHeading = null;
  let supportJournalOverlayOpen = false;
  let evidencePopover = null;
  let evidencePopoverContent = null;
  let evidencePopoverClose = null;
  let evidencePopoverOverlay = null;
  let evidencePopoverFocusReturn = null;

  const DRAFT_DEBOUNCE_MS = 1200;

  const journalStep = document.querySelector('[data-step="journal"]');
  const journalMount = journalStep?.querySelector('[data-journal-module]') || journalStep;
  const renderJournalForm = window.NVCJournal?.renderForm;
  if (journalMount && typeof renderJournalForm === 'function') {
    try {
      renderJournalForm(journalMount, {
        variant: journalMount.dataset.journalVariant || 'support',
        idPrefix: journalMount.dataset.journalIdPrefix || 'support-journal',
      });
    } catch (error) {
      console.warn('Unable to render lane journal form', error);
    }
  }
  const baseJournalForm = journalMount?.querySelector('[data-journal-form]') || journalStep?.querySelector('[data-journal-form]');
  if (journalStep && baseJournalForm && typeof window.NVCJournal?.createForm === 'function') {
    try {
      state.journalController = window.NVCJournal.createForm(journalStep, {
        draftPath: state.draftPath,
        autoDraft: false,
      });
    } catch (error) {
      console.warn('Unable to initialise lane journal module', error);
      state.journalController = null;
    }
  }

  journalForm = state.journalController?.form || baseJournalForm || null;
  journalStatus = state.journalController?.statusEl || journalStep?.querySelector('[data-journal-status]');
  journalHistory = document.querySelector('[data-journal-history]');
  regulationCard = document.querySelector('[data-regulation-card]');
  communicationCard = document.querySelector('[data-communication-card]');
  supportJournalEmotion = state.journalController?.emotionInput || journalStep?.querySelector('[data-journal-emotion]');
  supportJournalIntensity = state.journalController?.intensityInput || journalStep?.querySelector('[data-journal-intensity]');
  supportJournalIntensityDisplay =
    state.journalController?.intensityDisplay || journalStep?.querySelector('[data-journal-intensity-display]');
  supportJournalNeedsInput = state.journalController?.needsSelect || journalStep?.querySelector('[data-journal-needs]');
  supportJournalTagsInput = state.journalController?.tagsInput || journalStep?.querySelector('[data-journal-tags]');
  supportJournalNotes = state.journalController?.notesInput || journalStep?.querySelector('[data-journal-notes]');
  supportJournalSubmit = state.journalController?.saveButton || journalStep?.querySelector('[data-journal-submit]');
  supportJournalOpenLink = journalStep?.querySelector('[data-journal-open-link]');
  supportJournalContainer = journalStep?.querySelector('[data-support-journal]') || null;
  supportJournalLayer = supportJournalContainer?.querySelector('[data-support-journal-layer]') || null;
  supportJournalDialog = supportJournalContainer?.querySelector('[data-support-journal-dialog]') || null;
  supportJournalOpenButton = supportJournalContainer?.querySelector('[data-support-journal-open]') || null;
  supportJournalCloseButton = supportJournalContainer?.querySelector('[data-support-journal-close]') || null;
  supportJournalTitle = journalStep?.querySelector('#support-journal-title') || null;
  supportJournalHeading = supportJournalContainer?.querySelector('[data-support-journal-heading]') || null;
  if (supportJournalHeading && supportJournalTitle?.textContent) {
    supportJournalHeading.textContent = supportJournalTitle.textContent.trim();
  }

  setupSupportJournalOverlay();

  state.saveButtonDefaultLabel = supportJournalSubmit?.textContent || 'Save reflection';

  let breathingTimer = null;

  function enableSupportJournalDialogAttributes() {
    if (!supportJournalDialog) {
      return;
    }
    supportJournalDialog.setAttribute('role', 'dialog');
    supportJournalDialog.setAttribute('aria-modal', 'true');
    if (supportJournalTitle?.id) {
      supportJournalDialog.setAttribute('aria-labelledby', supportJournalTitle.id);
    }
  }

  function disableSupportJournalDialogAttributes() {
    if (!supportJournalDialog) {
      return;
    }
    supportJournalDialog.removeAttribute('role');
    supportJournalDialog.removeAttribute('aria-modal');
    supportJournalDialog.removeAttribute('aria-labelledby');
  }

  function setSupportJournalBodyScroll(enabled) {
    if (!document.body || !document.body.classList) {
      return;
    }
    if (enabled) {
      document.body.classList.remove('has-support-journal-open');
    } else {
      document.body.classList.add('has-support-journal-open');
    }
  }

  function openSupportJournalOverlay() {
    if (!supportJournalLayer || supportJournalOverlayOpen) {
      return;
    }
    supportJournalOverlayOpen = true;
    supportJournalLayer.dataset.state = 'open';
    supportJournalLayer.setAttribute('aria-hidden', 'false');
    if (supportJournalOpenButton) {
      supportJournalOpenButton.setAttribute('aria-expanded', 'true');
    }
    enableSupportJournalDialogAttributes();
    setSupportJournalBodyScroll(false);
    if (supportJournalDialog) {
      const focusDialog = () => {
        try {
          supportJournalDialog.focus({ preventScroll: true });
        } catch (error) {
          supportJournalDialog.focus();
        }
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(focusDialog);
      } else {
        focusDialog();
      }
    }
    document.addEventListener('keydown', handleSupportJournalEscape);
  }

  function closeSupportJournalOverlay(options = {}) {
    const { returnFocus = true } = options;
    if (!supportJournalLayer || !supportJournalOverlayOpen) {
      return;
    }
    supportJournalOverlayOpen = false;
    supportJournalLayer.dataset.state = 'closed';
    supportJournalLayer.setAttribute('aria-hidden', 'true');
    if (supportJournalOpenButton) {
      supportJournalOpenButton.setAttribute('aria-expanded', 'false');
      if (returnFocus) {
        supportJournalOpenButton.focus();
      }
    }
    disableSupportJournalDialogAttributes();
    setSupportJournalBodyScroll(true);
    document.removeEventListener('keydown', handleSupportJournalEscape);
  }

  function handleSupportJournalLayerClick(event) {
    if (!supportJournalLayer) {
      return;
    }
    if (event.target === supportJournalLayer) {
      closeSupportJournalOverlay();
    }
  }

  function handleSupportJournalEscape(event) {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'Escape' || event.key === 'Esc') {
      closeSupportJournalOverlay();
    }
  }

  function setupSupportJournalOverlay() {
    if (!supportJournalLayer) {
      return;
    }
    supportJournalLayer.dataset.state = 'closed';
    supportJournalLayer.setAttribute('aria-hidden', 'true');
    disableSupportJournalDialogAttributes();
    if (supportJournalOpenButton) {
      supportJournalOpenButton.setAttribute('aria-expanded', 'false');
    }
    supportJournalOpenButton?.addEventListener('click', openSupportJournalOverlay);
    supportJournalCloseButton?.addEventListener('click', () => closeSupportJournalOverlay());
    supportJournalLayer.addEventListener('click', handleSupportJournalLayerClick);
  }

  function getJournalStore() {
    return window.NVCJournalStore || window.NVCJournal?.store || null;
  }

  function revealStep(key) {
    const step = steps[key];
    if (!step || !step.classList.contains('is-hidden')) return;
    step.classList.remove('is-hidden');
  }

  function focusStep(key) {
    const step = steps[key];
    if (step) {
      step.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function getStepIndex(key) {
    return STEP_SEQUENCE.indexOf(key);
  }

  function setControlButtonState(button, disabled) {
    if (!button) return;
    if (disabled) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }
  }

  function updateStepControls() {
    const index = getStepIndex(state.activeStep);
    const currentStep = steps[state.activeStep];
    if (!currentStep) return;
    const cta = currentStep.querySelector('[data-step-cta]');
    if (!cta) return;
    const backButton = cta.querySelector('[data-step-back]');
    const nextButton = cta.querySelector('[data-step-next]');
    const skipButton = cta.querySelector('[data-step-skip]');
    if (backButton) {
      const hideBack = index <= 0;
      backButton.hidden = hideBack;
      setControlButtonState(backButton, hideBack);
    }
    if (nextButton) {
      const hideNext = index >= STEP_SEQUENCE.length - 1;
      nextButton.hidden = hideNext;
      setControlButtonState(nextButton, hideNext);
    }
    if (skipButton) {
      const disableSkip = index >= STEP_SEQUENCE.length - 1;
      setControlButtonState(skipButton, disableSkip);
    }
  }

  function goToStep(key, options = {}) {
    const step = steps[key];
    if (!step) return;
    revealStep(key);
    state.activeStep = key;
    document.querySelectorAll('.support-step.step-current').forEach((node) => {
      node.classList.remove('step-current');
    });
    step.classList.add('step-current');
    updateStepControls();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lane:stepchange', {
          detail: { step: key },
        })
      );
    }
    if (options.focus !== false) {
      focusStep(key);
    }
  }

  function advanceFromStep(current, { skip = false } = {}) {
    switch (current) {
      case 'intro':
        goToStep('breathing');
        break;
      case 'breathing':
        goToStep('body');
        break;
      case 'body':
        if (skip) {
          goToStep('compass');
        } else {
          handleSensationSubmit();
        }
        break;
      case 'compass':
        if (skip || state.compassTouched) {
          goToStep('library');
        } else {
          const board = compassRoot?.querySelector('.emotion-compass__board');
          board?.focus();
        }
        break;
      case 'library':
        goToStep('journal');
        break;
      case 'journal':
        goToStep('regulation');
        break;
      case 'regulation':
        goToStep('communication');
        break;
      case 'communication':
        goToStep('closing');
        break;
      default:
        break;
    }
  }

  function retreatFromStep(current) {
    switch (current) {
      case 'breathing':
        goToStep('intro');
        break;
      case 'body':
        goToStep('breathing');
        break;
      case 'compass':
        goToStep('body');
        break;
      case 'library':
        goToStep('compass');
        break;
      case 'journal':
        goToStep('library');
        break;
      case 'regulation':
        goToStep('journal');
        break;
      case 'communication':
        goToStep('regulation');
        break;
      case 'closing':
        goToStep('communication');
        break;
      default:
        break;
    }
  }

  function handleStart() {
    goToStep('breathing');
  }

  function handleStepCtaClick(event) {
    const button = event.target.closest('[data-step-back],[data-step-next],[data-step-skip]');
    if (!button || button.disabled) return;
    const stepArticle = button.closest('[data-step]');
    const stepKey = stepArticle?.dataset?.step;
    if (!stepKey || stepKey !== state.activeStep) return;
    event.preventDefault();
    if (button.hasAttribute('data-step-back')) {
      retreatFromStep(stepKey);
    } else if (button.hasAttribute('data-step-skip')) {
      advanceFromStep(stepKey, { skip: true });
    } else if (button.hasAttribute('data-step-next')) {
      advanceFromStep(stepKey);
    }
  }

  const BREATH_PATTERNS = {
    slow_446: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold softly', seconds: 4 },
      { label: 'Exhale slowly', seconds: 6 },
      { label: 'Rest', seconds: 2 },
    ],
    physiological_sigh: [
      { label: 'Inhale', seconds: 2 },
      { label: 'Top-off inhale', seconds: 1 },
      { label: 'Long exhale', seconds: 6 },
      { label: 'Rest', seconds: 1 },
    ],
    resonance_6bpm: [
      { label: 'Inhale', seconds: 5 },
      { label: 'Exhale', seconds: 5 },
    ],
  };

  const BREATH_PATTERN_LABELS = {
    slow_446: '4-4-6 breath',
    physiological_sigh: 'Physiological sigh',
    resonance_6bpm: 'Resonance breath (6 bpm)',
  };

  function resetBreathingVisual() {
    breathingVisual?.classList.remove('is-active');
    if (breathingDisplay) {
      const label = BREATH_PATTERN_LABELS[state.preferredBreathPattern] || 'guided breath';
      breathingDisplay.textContent = `Press start to try a ${label.toLowerCase()} (~30 seconds).`;
    }
    if (breathingTimer) {
      clearInterval(breathingTimer);
      breathingTimer = null;
    }
  }

  function startBreathing(patternKey = 'slow_446') {
    if (!breathingDisplay || !breathingVisual) {
      goToStep('body');
      return;
    }
    revealStep('body');
    updateStepControls();
    if (breathingTimer) {
      clearInterval(breathingTimer);
      breathingTimer = null;
    }
    breathingVisual.classList.add('is-active');
    const sequence = BREATH_PATTERNS[patternKey] || BREATH_PATTERNS.slow_446;
    const label = BREATH_PATTERN_LABELS[patternKey] || 'Guided breath';
    state.preferredBreathPattern = patternKey;
    state.regulationLog.add(patternKey);
    let elapsed = 0;
    let phaseIndex = 0;
    let remaining = sequence[phaseIndex].seconds;
    breathingDisplay.textContent = `${label}: ${sequence[phaseIndex].label} • ${remaining}s`;

    breathingTimer = setInterval(() => {
      elapsed += 1;
      remaining -= 1;
      if (remaining <= 0) {
        phaseIndex = (phaseIndex + 1) % sequence.length;
        remaining = sequence[phaseIndex].seconds;
      }
      breathingDisplay.textContent = `${label}: ${sequence[phaseIndex].label} • ${remaining}s`;
      if (elapsed >= 30) {
        clearInterval(breathingTimer);
        breathingTimer = null;
        breathingVisual.classList.remove('is-active');
        breathingDisplay.textContent = `${label} complete. Ready for the body check-in when it feels right.`;
        goToStep('body');
      }
    }, 1000);
  }

  function handleBreathingStart(event) {
    const pattern = event?.currentTarget?.dataset?.breathPattern || state.preferredBreathPattern || 'slow_446';
    startBreathing(pattern);
  }

  function skipBreathing() {
    resetBreathingVisual();
    goToStep('body');
  }

  function getRejections() {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    try {
      const raw = localStorage.getItem(REJECTION_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('Support lane: unable to read rejection history', error);
      return {};
    }
  }

  function setRejections(map) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(REJECTION_KEY, JSON.stringify(map));
    } catch (error) {
      console.warn('Support lane: unable to persist rejection history', error);
    }
  }

  function recordRejection(emotionKey) {
    if (!emotionKey) {
      return;
    }
    const map = getRejections();
    map[emotionKey] = (map[emotionKey] || 0) + 1;
    setRejections(map);
    state.lastRejectedEmotion = emotionKey;
  }

  function rejectionPenalty(emotionKey) {
    const map = getRejections();
    const count = map[emotionKey] || 0;
    return calculateRejectionPenalty(count);
  }

  function buildEmotionTag(emotionKey, { confidence = 0 } = {}) {
    const emotion = EMOTION_LIBRARY[emotionKey];
    const wrapper = document.createElement('div');
    wrapper.className = 'emotion-tag__wrapper';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emotion-tag';
    button.dataset.emotion = emotionKey;
    button.setAttribute('aria-pressed', state.selectedEmotion === emotionKey ? 'true' : 'false');
    if (Number.isFinite(confidence)) {
      button.dataset.confidence = confidence.toFixed(2);
      button.title = `Confidence: ${confidence.toFixed(2)}`;
    }
    button.textContent = emotion ? emotion.name : emotionKey;
    wrapper.appendChild(button);

    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'emotion-tag__reject';
    reject.dataset.emotionReject = emotionKey;
    reject.setAttribute('aria-label', `Reject ${emotion ? emotion.name : emotionKey}`);
    reject.textContent = 'Not it';
    wrapper.appendChild(reject);

    return wrapper;
  }

  function renderSuggestionBlock(container, title, message, emotionEntries, contextKeys = []) {
    if (!container) return;
    container.innerHTML = '';
    const headingWrap = document.createElement('div');
    headingWrap.className = 'emotion-suggestions__heading';

    const heading = document.createElement('h4');
    heading.className = 'emotion-suggestions__title';
    heading.textContent = title;
    headingWrap.appendChild(heading);

    if (EVIDENCE_MODE_ENABLED && contextKeys.length) {
      const whyButton = document.createElement('button');
      whyButton.type = 'button';
      whyButton.className = 'evidence-link';
      whyButton.textContent = 'Why these?';
      whyButton.dataset.evidenceTrigger = 'true';
      whyButton.dataset.evidenceKeys = contextKeys.join(',');
      headingWrap.appendChild(whyButton);
    }

    container.appendChild(headingWrap);

    if (message) {
      const para = document.createElement('p');
      para.className = 'support-note';
      para.textContent = message;
      container.appendChild(para);
    }

    if (!emotionEntries || !emotionEntries.length) {
      const none = document.createElement('p');
      none.className = 'support-note';
      none.textContent = 'No clear matches yet. That is okay—try the emotion compass or pick any word to explore.';
      container.appendChild(none);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'emotion-suggestions__list';
    emotionEntries.forEach(({ key, confidence = 0 }) => {
      const item = document.createElement('li');
      const tagWrapper = buildEmotionTag(key, { confidence });
      item.appendChild(tagWrapper);
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function evidenceKeyForQuadrant(quadrantKey) {
    if (!quadrantKey || typeof quadrantKey !== 'string') {
      return null;
    }
    const [arousal, valence] = quadrantKey.split('-');
    if (!arousal || !valence) {
      return null;
    }
    return `zone-${valence}-${arousal}`;
  }

  function quadrantKeyFromEvidenceKey(key) {
    if (!key || !key.startsWith('zone-')) {
      return null;
    }
    const [, valence, arousal] = key.split('-');
    if (!valence || !arousal) {
      return null;
    }
    return `${arousal}-${valence}`;
  }

  function updateCandidateSnapshot() {
    const combined = [...state.bodyCandidates, ...state.compassCandidates];
    const seen = new Map();
    combined.forEach(({ key, confidence }) => {
      if (!seen.has(key) || confidence > (seen.get(key)?.confidence ?? 0)) {
        seen.set(key, { key, confidence });
      }
    });
    state.candidateEmotions = Array.from(seen.values()).slice(0, 5);
  }

  function updateBreathingPatternFromZone() {
    const quadrantKey = state.quadrant;
    if (!quadrantKey) {
      state.preferredBreathPattern = 'slow_446';
      return;
    }
    const [arousal, valence] = quadrantKey.split('-');
    if ((valence === 'unpleasant' && (arousal === 'high' || arousal === 'medium'))) {
      state.preferredBreathPattern = 'physiological_sigh';
    } else if (arousal === 'high' && (valence === 'pleasant' || valence === 'neutral')) {
      state.preferredBreathPattern = 'resonance_6bpm';
    } else {
      state.preferredBreathPattern = 'slow_446';
    }
  }

  function getBreathingRecommendation() {
    const pattern = state.preferredBreathPattern || 'slow_446';
    const label = BREATH_PATTERN_LABELS[pattern] || 'guided breath';
    let summary = 'Try a steady 4-4-6 breath to invite calm and soften the edges.';
    if (pattern === 'physiological_sigh') {
      summary = 'Use a physiological sigh (double inhale, long exhale) to release high unpleasant activation.';
    } else if (pattern === 'resonance_6bpm') {
      summary = 'Resonance breathing (5s in, 5s out) steadies high energy while staying grounded.';
    }
    return { pattern, label, summary };
  }

  function refreshSuggestions() {
    if (state.bodySuggestionMeta) {
      const bodyEntries = state.bodySuggestionMeta.entries
        .map(({ key, baseScore }) => ({ key, score: baseScore * rejectionPenalty(key), baseScore }))
        .filter(({ score }) => score > 0);
      const normalizedBody = normalizeScoresWithPenalty(bodyEntries.map(({ key, score }) => ({ key, score })));
      const baseMap = new Map(state.bodySuggestionMeta.entries.map(({ key, baseScore }) => [key, baseScore]));
      const displayEntries = normalizedBody.map((entry) => ({
        ...entry,
        baseScore: baseMap.get(entry.key) ?? entry.score,
      }));
      renderSuggestionBlock(
        bodySuggestions,
        state.bodySuggestionMeta.title,
        state.bodySuggestionMeta.message,
        displayEntries,
        state.bodySuggestionMeta.contextKeys
      );
      state.bodyCandidates = displayEntries.slice(0, 5).map(({ key, confidence }) => ({ key, confidence }));
    }

    if (state.compassSuggestionMeta) {
      const compassEntries = state.compassSuggestionMeta.entries
        .map(({ key, baseScore }) => ({ key, score: baseScore * rejectionPenalty(key), baseScore }))
        .filter(({ score }) => score > 0);
      const normalizedCompass = normalizeScoresWithPenalty(compassEntries.map(({ key, score }) => ({ key, score })));
      const baseMap = new Map(state.compassSuggestionMeta.entries.map(({ key, baseScore }) => [key, baseScore]));
      const displayEntries = normalizedCompass.map((entry) => ({
        ...entry,
        baseScore: baseMap.get(entry.key) ?? entry.score,
      }));
      renderSuggestionBlock(
        compassSuggestions,
        state.compassSuggestionMeta.title,
        state.compassSuggestionMeta.message,
        displayEntries,
        state.compassSuggestionMeta.contextKeys
      );
      state.compassCandidates = displayEntries.slice(0, 5).map(({ key, confidence }) => ({ key, confidence }));
    }

    updateCandidateSnapshot();
  }

  if (typeof process !== 'undefined' && process.env?.NVC_TEST === '1') {
    globalThis.__NVC_SUPPORT_TESTS__ = {
      renderSuggestionBlock,
    };
  }

  function setChipState(button, pressed) {
    if (!button) return;
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.classList.toggle('is-active', pressed);
  }

  function clampIntensityValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return SENSATION_DEFAULT_INTENSITY;
    }
    return Math.max(0, Math.min(10, Math.round(numeric)));
  }

  function getSensationIntensity(optionId) {
    const elements = sensationOptionElements.get(optionId);
    if (!elements) {
      return SENSATION_DEFAULT_INTENSITY;
    }
    const rawValue = Number(elements.slider?.value ?? elements.defaultValue ?? SENSATION_DEFAULT_INTENSITY);
    return clampIntensityValue(rawValue);
  }

  function syncSensationIntensity(optionId, rawValue) {
    const elements = sensationOptionElements.get(optionId);
    if (!elements) {
      return SENSATION_DEFAULT_INTENSITY;
    }
    const clamped = clampIntensityValue(rawValue);
    if (elements.slider && Number(elements.slider.value) !== clamped) {
      elements.slider.value = String(clamped);
    }
    if (elements.output) {
      elements.output.textContent = String(clamped);
    }
    return clamped;
  }

  function updateRegionSummary(regionId) {
    const region = regionElements.get(regionId);
    if (!region) return;
    const optionIds = REGION_OPTION_IDS.get(regionId) || [];
    const selections = [];
    optionIds.forEach((optionId) => {
      const elements = sensationOptionElements.get(optionId);
      if (!elements) return;
      if (elements.button?.getAttribute('aria-pressed') !== 'true') {
        return;
      }
      const option = BODY_SENSATION_OPTIONS.get(optionId);
      if (!option) return;
      const intensity = getSensationIntensity(optionId);
      selections.push(`${option.title} (${intensity}/10)`);
    });
    if (!selections.length) {
      const fallback =
        region.defaultSummary || region.summary.dataset.defaultSummary || 'We can check in here whenever you\'re ready.';
      region.summary.textContent = fallback;
      region.summary.dataset.hasSelection = 'false';
      return;
    }
    const display = selections.slice(0, 3).join(', ');
    region.summary.textContent = selections.length === 1 ? `Noticing: ${display}.` : `Noticing: ${display}${
      selections.length > 3 ? '…' : ''
    }.`;
    region.summary.dataset.hasSelection = 'true';
  }

  function setSensationState(optionId, active, { focusSlider = false, skipDraft = false } = {}) {
    const elements = sensationOptionElements.get(optionId);
    if (!elements) return;
    setChipState(elements.button, active);
    if (elements.wrapper) {
      elements.wrapper.classList.toggle('is-selected', active);
    }
    if (elements.intensity) {
      elements.intensity.hidden = !active;
    }
    if (elements.slider) {
      if (active) {
        elements.slider.disabled = false;
        syncSensationIntensity(optionId, elements.slider.value);
        if (focusSlider) {
          try {
            elements.slider.focus({ preventScroll: true });
          } catch (error) {
            // ignore focus errors
          }
        }
      } else {
        elements.slider.disabled = true;
        syncSensationIntensity(optionId, elements.defaultValue);
      }
    }
    const option = BODY_SENSATION_OPTIONS.get(optionId);
    if (option) {
      updateRegionSummary(option.regionId);
    }
    if (!skipDraft) {
      resetLaneSaveButton();
      scheduleLaneDraftSave();
    }
  }

  function getSelectedSensations() {
    const selections = [];
    sensationOptionElements.forEach((elements, optionId) => {
      if (!elements?.button) return;
      if (elements.button.getAttribute('aria-pressed') !== 'true') {
        return;
      }
      const option = BODY_SENSATION_OPTIONS.get(optionId);
      if (!option) return;
      const intensity = getSensationIntensity(optionId);
      selections.push({ id: optionId, intensity, option });
    });
    return selections;
  }

  function serializeSensationSelections(selections) {
    if (!Array.isArray(selections) || !selections.length) {
      return [];
    }
    return selections.map(({ id, intensity }) => `${id}:${clampIntensityValue(intensity)}`);
  }

  function handleSensationChoiceClick(event) {
    const toggle = event.target.closest('[data-region-toggle]');
    if (toggle) {
      event.preventDefault();
      const regionId = toggle.dataset.regionToggle;
      if (!regionId) {
        return;
      }
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        collapseRegion(regionId);
      } else {
        expandRegion(regionId, { focus: true });
      }
      return;
    }

    const closeButton = event.target.closest('[data-region-close]');
    if (closeButton) {
      event.preventDefault();
      const regionId = closeButton.dataset.regionClose;
      if (!regionId) {
        return;
      }
      collapseRegion(regionId, { returnFocus: true });
      return;
    }

    const button = event.target.closest('[data-sensation]');
    if (!button) return;
    event.preventDefault();
    const optionId = button.dataset.sensation;
    if (!optionId) return;
    const pressed = button.getAttribute('aria-pressed') === 'true';
    setSensationState(optionId, !pressed, { focusSlider: !pressed });
  }

  function handleSensationIntensityInput(event) {
    const input = event.target;
    if (!input || !input.dataset || !input.dataset.sensationIntensity) {
      return;
    }
    const optionId = input.dataset.sensationIntensity;
    const option = BODY_SENSATION_OPTIONS.get(optionId);
    syncSensationIntensity(optionId, input.value);
    if (option) {
      updateRegionSummary(option.regionId);
    }
    resetLaneSaveButton();
    scheduleLaneDraftSave();
  }

  function handleSensationSubmit(event) {
    event?.preventDefault?.();
    const selections = getSelectedSensations();
    if (!selections.length) {
      state.bodySuggestionMeta = null;
      state.bodyCandidates = [];
      state.inferredQuadrant = null;
      state.quadrant = mergeCompassAndInferredZone(state.compassQuadrant, null);
      updateBreathingPatternFromZone();
      updateCandidateSnapshot();
      renderSuggestionBlock(
        bodySuggestions,
        'Body-based matches',
        'Try choosing a region and setting how strong the sensation feels. If nothing stands out, move on to the emotion compass.',
        []
      );
      goToStep('compass');
      return false;
    }

    const emotionScores = new Map();
    const notes = [];
    const contextKeys = new Set();

    selections.forEach(({ option, intensity }) => {
      if (!option) return;
      const safeIntensity = clampIntensityValue(intensity);
      notes.push(`• ${option.regionLabel}: ${option.title} (${safeIntensity}/10). ${option.insight}`);
      const intensityFactor = safeIntensity / 10;
      contextKeys.add(option.id);
      if (intensityFactor > 0) {
        Object.entries(option.emotions || {}).forEach(([emotionKey, weight]) => {
          const numericWeight = Number(weight);
          if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
            return;
          }
          const score = numericWeight * intensityFactor;
          emotionScores.set(emotionKey, (emotionScores.get(emotionKey) ?? 0) + score);
        });
      }
    });

    const inferredQuadrant = inferZoneFromSensations(selections);
    state.inferredQuadrant = inferredQuadrant;
    state.quadrant = mergeCompassAndInferredZone(state.compassQuadrant, inferredQuadrant);
    updateBreathingPatternFromZone();

    const scored = Array.from(emotionScores.entries())
      .filter(([, score]) => Number.isFinite(score) && score > 0)
      .map(([key, baseScore]) => {
        const penalizedScore = baseScore * rejectionPenalty(key);
        return { key, baseScore, score: penalizedScore };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    const normalized = normalizeScoresWithPenalty(scored.map(({ key, score }) => ({ key, score })));
    const baseMap = new Map(scored.map(({ key, baseScore }) => [key, baseScore]));
    const entries = normalized.map((entry) => ({
      ...entry,
      baseScore: baseMap.get(entry.key) ?? entry.score,
    }));

    entries.forEach(({ key }) => {
      contextKeys.add(`emotion-${key}`);
    });

    const zoneEvidenceKey = evidenceKeyForQuadrant(state.quadrant);
    if (zoneEvidenceKey) {
      contextKeys.add(zoneEvidenceKey);
    }

    const zoneLine = zoneEvidenceKey && QUADRANT_SUGGESTIONS[state.quadrant]
      ? `• Affective zone estimate: ${QUADRANT_SUGGESTIONS[state.quadrant].label}.`
      : '• Affective zone estimate: not clear yet (that’s okay).';

    const messageParts = [...notes, zoneLine, 'Use these as invitations, not rules.'];
    const message = messageParts.join(' ');

    state.bodyCandidates = entries.slice(0, 5).map(({ key, confidence }) => ({ key, confidence }));
    state.bodySuggestionMeta = {
      title: 'Body-based matches',
      message,
      contextKeys: Array.from(contextKeys),
      entries: scored.map(({ key, baseScore }) => ({ key, baseScore })),
    };

    renderSuggestionBlock(bodySuggestions, 'Body-based matches', message, entries, state.bodySuggestionMeta.contextKeys);
    updateCandidateSnapshot();
    goToStep('compass');
    return true;
  }

  function handleSensationClear() {
    sensationOptionElements.forEach((_, optionId) => {
      setSensationState(optionId, false, { skipDraft: true });
    });
    renderSuggestionBlock(
      bodySuggestions,
      'Body-based matches',
      'Body-based matches will appear here after you choose sensations and set their intensity.',
      []
    );
    state.bodySuggestionMeta = null;
    state.bodyCandidates = [];
    state.inferredQuadrant = null;
    state.quadrant = mergeCompassAndInferredZone(state.compassQuadrant, null);
    updateBreathingPatternFromZone();
    updateCandidateSnapshot();
    resetLaneSaveButton();
    scheduleLaneDraftSave();
    regionElements.forEach((_, regionId) => {
      collapseRegion(regionId);
    });
  }

  function handleSensationSkip() {
    finishGuidedScan();
    goToStep('compass');
  }

  function renderBodyRegions(container) {
    if (!container) return;
    container.innerHTML = '';
    sensationOptionElements.clear();
    regionElements.clear();

    BODY_REGIONS.forEach((region) => {
      const section = document.createElement('section');
      section.className = 'sensation-region';
      section.dataset.region = region.id;

      const header = document.createElement('div');
      header.className = 'sensation-region__header';

      const meta = document.createElement('div');
      meta.className = 'sensation-region__meta';

      const detailsId = `sensation-region-${region.id}-details`;

      const title = document.createElement('h4');
      title.className = 'sensation-region__title';
      title.textContent = region.label;
      meta.appendChild(title);

      const summary = document.createElement('p');
      summary.className = 'sensation-region__summary';
      summary.dataset.hasSelection = 'false';
      const defaultSummary = 'We can check in here whenever you\'re ready.';
      summary.dataset.defaultSummary = defaultSummary;
      summary.textContent = defaultSummary;
      meta.appendChild(summary);

      header.appendChild(meta);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'support-button support-button--ghost sensation-region__toggle';
      toggle.dataset.regionToggle = region.id;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', detailsId);
      toggle.textContent = 'Check in';
      header.appendChild(toggle);

      section.appendChild(header);

      const details = document.createElement('div');
      details.className = 'sensation-region__details';
      details.dataset.regionDetails = region.id;
      details.hidden = true;
      details.id = detailsId;
      details.setAttribute('aria-hidden', 'true');

      if (region.prompt) {
        const prompt = document.createElement('p');
        prompt.className = 'sensation-region__prompt support-note support-note--subtle';
        prompt.textContent = region.prompt;
        details.appendChild(prompt);
      }

      const instructions = document.createElement('p');
      instructions.className = 'sensation-region__instructions support-note support-note--subtle';
      instructions.textContent = 'Tap the sensation that fits. A 0–10 slider will appear after you choose.';
      details.appendChild(instructions);

      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'sensation-region__options';
      details.appendChild(optionsContainer);

      region.options.forEach((option) => {
        const optionWrapper = document.createElement('div');
        optionWrapper.className = 'sensation-option';
        optionWrapper.dataset.sensationOption = option.id;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip chip--stacked';
        button.dataset.sensation = option.id;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', `${region.label}: ${option.title}`);

        const buttonTitle = document.createElement('span');
        buttonTitle.className = 'chip__title';
        buttonTitle.textContent = option.title;
        button.appendChild(buttonTitle);

        if (option.note) {
          const note = document.createElement('span');
          note.className = 'chip__note';
          note.textContent = option.note;
          button.appendChild(note);
        }

        optionWrapper.appendChild(button);

        const intensity = document.createElement('div');
        intensity.className = 'sensation-intensity';
        intensity.dataset.sensationIntensityContainer = option.id;
        intensity.hidden = true;
        const sliderId = `sensation-${option.id}-intensity`;
        const defaultValue = clampIntensityValue(option.defaultIntensity ?? SENSATION_DEFAULT_INTENSITY);

        const label = document.createElement('label');
        label.className = 'sensation-intensity__label';
        label.setAttribute('for', sliderId);
        label.textContent = 'Intensity (0–10)';
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'sensation-intensity__value';
        valueDisplay.dataset.intensityOutput = option.id;
        valueDisplay.textContent = String(defaultValue);
        label.appendChild(valueDisplay);
        intensity.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'sensation-intensity__slider';
        slider.id = sliderId;
        slider.name = sliderId;
        slider.min = '0';
        slider.max = '10';
        slider.step = '1';
        slider.value = String(defaultValue);
        slider.dataset.sensationIntensity = option.id;
        slider.disabled = true;
        slider.setAttribute('aria-label', `${option.title} intensity (0 to 10)`);
        intensity.appendChild(slider);

        const scale = document.createElement('div');
        scale.className = 'sensation-intensity__scale';
        const minLabel = document.createElement('span');
        minLabel.textContent = '0';
        const maxLabel = document.createElement('span');
        maxLabel.textContent = '10';
        scale.appendChild(minLabel);
        scale.appendChild(maxLabel);
        intensity.appendChild(scale);

        optionWrapper.appendChild(intensity);
        optionsContainer.appendChild(optionWrapper);

        sensationOptionElements.set(option.id, {
          wrapper: optionWrapper,
          button,
          slider,
          output: valueDisplay,
          defaultValue,
          regionId: region.id,
          intensity,
        });
      });

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'support-button support-button--ghost sensation-region__close';
      closeButton.dataset.regionClose = region.id;
      closeButton.textContent = 'Done with this area';
      details.appendChild(closeButton);

      section.appendChild(details);
      container.appendChild(section);

      regionElements.set(region.id, {
        element: section,
        summary,
        label: region.label,
        toggle,
        details,
        defaultSummary,
      });
    });
  }

  function collapseRegion(regionId, { returnFocus = false } = {}) {
    const region = regionElements.get(regionId);
    if (!region) return;
    region.element?.classList.remove('sensation-region--open');
    region.element?.classList.remove('sensation-region--scan-active');
    if (region.details) {
      region.details.hidden = true;
      region.details.setAttribute('aria-hidden', 'true');
    }
    if (region.toggle) {
      region.toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) {
        try {
          region.toggle.focus({ preventScroll: true });
        } catch (error) {
          // ignore focus errors
        }
      }
    }
  }

  function expandRegion(regionId, { focus = false, collapseOthers = true } = {}) {
    const region = regionElements.get(regionId);
    if (!region) return;
    if (collapseOthers) {
      regionElements.forEach((_, otherId) => {
        if (otherId !== regionId) {
          collapseRegion(otherId);
        }
      });
    }
    if (region.details) {
      region.details.hidden = false;
      region.details.setAttribute('aria-hidden', 'false');
    }
    region.element?.classList.add('sensation-region--open');
    if (region.toggle) {
      region.toggle.setAttribute('aria-expanded', 'true');
    }
    if (focus && region.details) {
      const selected = region.details.querySelector('[data-sensation][aria-pressed="true"]');
      const firstButton = selected || region.details.querySelector('[data-sensation]');
      if (firstButton) {
        try {
          firstButton.focus({ preventScroll: true });
        } catch (error) {
          // ignore focus errors
        }
      }
    }
  }

  function clearScanHighlights() {
    regionElements.forEach((region) => {
      region.element.classList.remove('sensation-region--scan-active');
    });
  }

  function highlightScanRegion(regionId) {
    expandRegion(regionId, { focus: false, collapseOthers: true });
    let target = null;
    regionElements.forEach((region, id) => {
      const isActive = id === regionId;
      region.element.classList.toggle('sensation-region--scan-active', isActive);
      if (isActive) {
        target = region.element;
      }
    });
    if (target) {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        // ignore scroll errors
      }
    }
  }

  function updateScanUi() {
    if (!scanControls) return;
    if (!state.guidedScanActive) {
      scanControls.classList.add('is-hidden');
      clearScanHighlights();
      return;
    }

    const total = BODY_SCAN_SEQUENCE.length;
    if (!total) {
      return;
    }

    if (state.guidedScanIndex < 0) {
      state.guidedScanIndex = 0;
    } else if (state.guidedScanIndex >= total) {
      state.guidedScanIndex = total - 1;
    }

    scanControls.classList.remove('is-hidden');
    const regionId = BODY_SCAN_SEQUENCE[state.guidedScanIndex];
    highlightScanRegion(regionId);

    const regionMeta = regionElements.get(regionId);
    if (scanStatus) {
      const label = regionMeta?.label || 'this area';
      scanStatus.textContent = `Focusing on ${label} (${state.guidedScanIndex + 1} of ${total}).`;
    }
    if (scanPrompt) {
      const prompt = BODY_REGIONS.find((item) => item.id === regionId)?.prompt || '';
      scanPrompt.textContent = prompt;
    }
    if (scanBackButton) {
      scanBackButton.disabled = state.guidedScanIndex <= 0;
    }
    if (scanNextButton) {
      scanNextButton.textContent = state.guidedScanIndex >= total - 1 ? 'Finish scan' : 'Next area';
    }
  }

  function startGuidedScan() {
    if (!BODY_SCAN_SEQUENCE.length) {
      return;
    }
    state.guidedScanActive = true;
    state.guidedScanStarted = true;
    state.guidedScanIndex = 0;
    if (scanStartButton) {
      scanStartButton.textContent = 'Restart scan';
    }
    updateScanUi();
  }

  function finishGuidedScan({ completed = false } = {}) {
    if (scanStatus) {
      scanStatus.textContent = completed
        ? 'Scan complete. Choose any areas that still want attention.'
        : 'Scan paused. Restart whenever you want more guidance.';
    }
    state.guidedScanActive = false;
    state.guidedScanIndex = -1;
    clearScanHighlights();
    if (scanControls) {
      scanControls.classList.add('is-hidden');
    }
    if (scanPrompt) {
      scanPrompt.textContent = '';
    }
  }

  function moveGuidedScan(step) {
    if (!state.guidedScanActive) {
      return;
    }
    state.guidedScanIndex += step;
    updateScanUi();
  }

  function handleScanStart() {
    if (state.guidedScanActive) {
      state.guidedScanIndex = 0;
      updateScanUi();
      return;
    }
    startGuidedScan();
  }

  function handleScanBack() {
    moveGuidedScan(-1);
  }

  function handleScanNext() {
    if (!state.guidedScanActive) {
      startGuidedScan();
      return;
    }
    if (state.guidedScanIndex >= BODY_SCAN_SEQUENCE.length - 1) {
      finishGuidedScan({ completed: true });
    } else {
      moveGuidedScan(1);
    }
  }

  function handleScanFinish() {
    finishGuidedScan({ completed: true });
  }

  function restoreSensationSelections(serialized) {
    if (!Array.isArray(serialized) || !serialized.length) {
      sensationOptionElements.forEach((_, optionId) => {
        setSensationState(optionId, false, { skipDraft: true });
      });
      return;
    }
    const intensityMap = new Map();
    serialized.forEach((entry) => {
      if (typeof entry !== 'string') return;
      const [id, raw] = entry.split(':');
      if (!id || !BODY_SENSATION_OPTIONS.has(id)) return;
      intensityMap.set(id, clampIntensityValue(Number(raw)));
    });
    sensationOptionElements.forEach((_, optionId) => {
      if (!intensityMap.has(optionId)) {
        setSensationState(optionId, false, { skipDraft: true });
        return;
      }
      const value = intensityMap.get(optionId);
      setSensationState(optionId, true, { skipDraft: true });
      syncSensationIntensity(optionId, value);
      const option = BODY_SENSATION_OPTIONS.get(optionId);
      if (option) {
        updateRegionSummary(option.regionId);
      }
    });
  }

  function computeQuadrant(energy, valence) {
    if (!energy || !valence) return null;
    return `${energy}-${valence}`;
  }

  function handleCompassSelection(event) {
    const detail = event?.detail;
    if (!detail) return;
    if (typeof detail.energy === 'number') {
      state.energyValue = detail.energy;
    }
    if (typeof detail.valence === 'number') {
      state.valenceValue = detail.valence;
    }
    if (detail.userTriggered) {
      state.compassTouched = true;
    }
    const quadrantKey = computeQuadrant(detail.energyKey, detail.valenceKey);
    state.compassQuadrant = quadrantKey;
    state.quadrant = mergeCompassAndInferredZone(quadrantKey, state.inferredQuadrant);
    updateBreathingPatternFromZone();
    if (!quadrantKey || !QUADRANT_SUGGESTIONS[quadrantKey]) {
      renderSuggestionBlock(
        compassSuggestions,
        'Emotion compass matches',
        'Pick one energy and one pleasantness option to see compass matches.',
        []
      );
      state.compassCandidates = [];
      state.compassSuggestionMeta = null;
      updateCandidateSnapshot();
      return;
    }
    const info = QUADRANT_SUGGESTIONS[quadrantKey];
    const baseEntries = info.emotions.map((key, index) => ({ key, baseScore: 1 / (index + 1) }));
    const scored = baseEntries
      .map(({ key, baseScore }) => ({ key, baseScore, score: baseScore * rejectionPenalty(key) }))
      .filter(({ score }) => score > 0);
    const normalized = normalizeScoresWithPenalty(scored.map(({ key, score }) => ({ key, score })));
    const baseMap = new Map(baseEntries.map(({ key, baseScore }) => [key, baseScore]));
    const entries = normalized.map((entry) => ({
      ...entry,
      baseScore: baseMap.get(entry.key) ?? entry.score,
    }));

    const contextKeys = new Set();
    const zoneEvidenceKey = evidenceKeyForQuadrant(state.quadrant || quadrantKey);
    if (zoneEvidenceKey) {
      contextKeys.add(zoneEvidenceKey);
    }
    entries.forEach(({ key }) => contextKeys.add(`emotion-${key}`));

    const message = `${info.label}: ${info.description}`;
    renderSuggestionBlock(
      compassSuggestions,
      'Emotion compass matches',
      message,
      entries,
      Array.from(contextKeys)
    );
    state.compassCandidates = entries.slice(0, 5).map(({ key, confidence }) => ({ key, confidence }));
    state.compassSuggestionMeta = {
      title: 'Emotion compass matches',
      message,
      contextKeys: Array.from(contextKeys),
      entries: baseEntries,
    };
    updateCandidateSnapshot();
    revealStep('library');
    updateStepControls();
  }

  function renderListSection(title, items) {
    if (!items || !items.length) return '';
    const listItems = items.map((item) => `<li>${item}</li>`).join('');
    return `
      <div>
        <h4 class="emotion-suggestions__title">${title}</h4>
        <ul class="emotion-detail__list">${listItems}</ul>
      </div>
    `;
  }

  function slugifyNeed(label) {
    if (typeof label !== 'string') {
      return '';
    }
    return label
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function isNormalizedNeed(value) {
    return !!value && typeof value === 'object' && typeof value.label === 'string';
  }

  function normalizeNeed(need) {
    if (!need) {
      return null;
    }
    if (isNormalizedNeed(need)) {
      const slug = typeof need.slug === 'string' && need.slug ? need.slug : slugifyNeed(need.label);
      return { label: need.label, slug };
    }
    if (typeof need === 'string') {
      const label = need.trim();
      if (!label) {
        return null;
      }
      return { label, slug: slugifyNeed(label) };
    }
    return null;
  }

  function normalizeNeeds(needs) {
    if (!Array.isArray(needs)) {
      return [];
    }
    return needs.map((need) => normalizeNeed(need)).filter(Boolean);
  }

  function renderNeedLinks(needs) {
    const normalized = Array.isArray(needs) && needs.every(isNormalizedNeed) ? needs : normalizeNeeds(needs);
    if (!normalized.length) {
      return '';
    }
    const items = normalized
      .map((need) => {
        const href = need.slug ? `${basePath}needs/${need.slug}/` : `${basePath}needs/`;
        return `<li><a class="emotion-need-link" href="${href}">${need.label}</a></li>`;
      })
      .join('');
    return `
      <div>
        <h4 class="emotion-suggestions__title">Possible needs this feeling can point to (hypotheses)</h4>
        <ul class="emotion-detail__list emotion-detail__list--links">${items}</ul>
      </div>
    `;
  }

  function setActiveTag(tag) {
    if (state.activeTag) {
      state.activeTag.classList.remove('is-active');
    }
    if (tag) {
      tag.classList.add('is-active');
      state.activeTag = tag;
    }
  }

  function renderEmotionDetails(emotionKey, sourceTag) {
    const emotion = EMOTION_LIBRARY[emotionKey];
    if (!emotion || !emotionLibrary) return;
    setActiveTag(sourceTag);
    state.selectedEmotion = emotionKey;
    const candidate = state.candidateEmotions.find((item) => item.key === emotionKey);
    state.selectedEmotionConfidence = candidate ? candidate.confidence ?? null : null;
    state.regulationLog.add('labeling');
    prefillSupportEmotion(emotionKey, { force: true });

    const html = `
      <div class="emotion-detail">
        <h3 class="emotion-detail__name">${emotion.name}</h3>
        <p class="emotion-detail__definition">${emotion.definition}</p>
        ${renderListSection('Common body cues', emotion.bodySignals)}
        ${renderListSection('Typical thoughts', emotion.thoughts)}
        ${renderListSection('When it often appears', emotion.contexts)}
        ${renderNeedLinks(emotion.needs)}
        ${renderListSection('Care ideas to experiment with', emotion.regulation)}
        <p class="support-note">Everyone feels emotions uniquely. Use these clues as invitations, not rules.</p>
      </div>
    `;
    emotionLibrary.innerHTML = html;

    revealStep('journal');
    revealStep('regulation');
    revealStep('communication');
    revealStep('closing');
    renderRegulationCard(emotion);
    renderCommunicationCard(emotion);
    refreshSuggestions();
    updateStepControls();
  }

  function renderRegulationCard(emotion) {
    if (!regulationCard) return;
    const quadrantInfo = state.quadrant ? QUADRANT_SUGGESTIONS[state.quadrant] : null;
    const extraCare = quadrantInfo?.care ? renderListSection(`Support when you feel ${quadrantInfo.label.toLowerCase()}`, quadrantInfo.care) : '';
    const journalLink = `${basePath}inventory/journal/`;
    const breathingRecommendation = getBreathingRecommendation();
    const breathingSection = `
      <div class="regulation-breathing">
        <h4 class="emotion-suggestions__title">Matched breathing option</h4>
        <p>${breathingRecommendation.summary}</p>
        <button type="button" class="support-button support-button--ghost" data-action="breathing-start" data-breath-pattern="${breathingRecommendation.pattern}">Start ${breathingRecommendation.label}</button>
      </div>
    `;
    const evidenceNote =
      '<p class="support-note support-note--mini">Affect labeling and exhale-biased breathing can reduce distress (see “Why these?”).</p>';
    regulationCard.innerHTML = `
      <h4 class="emotion-suggestions__title">Support for ${emotion.name}</h4>
      ${renderListSection('Try one of these nurturing steps', emotion.regulation)}
      ${extraCare}
      ${breathingSection}
      <p class="support-note">Experiment kindly. If none of these help, it simply means your body wants something different today. Track what works or needs tweaking so future-you can adjust with care.</p>
      ${evidenceNote}
      <div class="regulation-actions">
        <a class="support-button support-button--link" href="${journalLink}">Open journal dashboard</a>
      </div>
    `;
  }

  function renderCommunicationCard(emotion) {
    if (!communicationCard) return;
    const normalizedNeeds = normalizeNeeds(emotion.needs);
    const needLabel = normalizedNeeds.length ? normalizedNeeds[0].label.toLowerCase() : 'support';
    const template = `I feel ${emotion.name.toLowerCase()} because I need ${needLabel}.`;
    communicationCard.innerHTML = `
      <p class="communication-template" data-communication-template>${template}</p>
      <div class="communication-actions">
        <button class="support-button" type="button" data-action="copy-template">Copy sentence</button>
        <button class="support-button support-button--ghost" type="button" data-action="speak-template">Read it aloud</button>
      </div>
      <p class="support-note" data-communication-status role="status"></p>
      <p class="support-note">It is okay to say, “I’m still figuring out my feelings.” The goal is practice, not perfection.</p>
    `;
  }

  function getEvidenceTitle(key) {
    if (!key) {
      return 'Evidence';
    }
    if (BODY_SENSATION_OPTIONS.has(key)) {
      const option = BODY_SENSATION_OPTIONS.get(key);
      return option?.title || 'Body sensation';
    }
    if (key.startsWith('zone-')) {
      const quadrantKey = quadrantKeyFromEvidenceKey(key);
      const info = quadrantKey ? QUADRANT_SUGGESTIONS[quadrantKey] : null;
      return info?.label || 'Affect zone';
    }
    if (key.startsWith('emotion-')) {
      const emotionKey = key.slice('emotion-'.length);
      const emotion = EMOTION_LIBRARY[emotionKey];
      return emotion?.name || emotionKey;
    }
    if (key === 'skill-labeling') {
      return 'Affect labeling';
    }
    if (key.startsWith('skill-')) {
      const pattern = key.slice('skill-'.length);
      return BREATH_PATTERN_LABELS[pattern] || pattern;
    }
    return key;
  }

  function ensureEvidencePopover() {
    if (!EVIDENCE_MODE_ENABLED || evidencePopover) {
      return;
    }
    evidencePopover = document.createElement('div');
    evidencePopover.className = 'evidence-popover';
    evidencePopover.hidden = true;
    evidencePopover.setAttribute('aria-hidden', 'true');

    evidencePopoverOverlay = document.createElement('div');
    evidencePopoverOverlay.className = 'evidence-popover__overlay';
    evidencePopoverOverlay.setAttribute('aria-hidden', 'true');
    evidencePopoverOverlay.addEventListener('click', () => closeEvidencePopover());

    const dialog = document.createElement('div');
    dialog.className = 'evidence-popover__dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const heading = document.createElement('h4');
    heading.className = 'evidence-popover__title';
    heading.textContent = 'Why these suggestions';
    dialog.appendChild(heading);

    evidencePopoverClose = document.createElement('button');
    evidencePopoverClose.type = 'button';
    evidencePopoverClose.className = 'evidence-popover__close';
    evidencePopoverClose.textContent = 'Close';
    evidencePopoverClose.addEventListener('click', () => closeEvidencePopover());
    dialog.appendChild(evidencePopoverClose);

    evidencePopoverContent = document.createElement('div');
    evidencePopoverContent.className = 'evidence-popover__body';
    dialog.appendChild(evidencePopoverContent);

    evidencePopover.appendChild(evidencePopoverOverlay);
    evidencePopover.appendChild(dialog);
    document.body.appendChild(evidencePopover);
  }

  function buildEvidenceSection(key, entry) {
    const section = document.createElement('section');
    section.className = 'evidence-popover__section';

    const title = document.createElement('h5');
    title.className = 'evidence-popover__heading';
    title.textContent = getEvidenceTitle(key);
    section.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'evidence-popover__meta';
    meta.textContent = `Level ${entry.level || 'B'} • Reviewed ${entry.lastReviewed || REVIEW_DATE}`;
    section.appendChild(meta);

    if (Array.isArray(entry.supports) && entry.supports.length) {
      const supportList = document.createElement('ul');
      supportList.className = 'evidence-popover__list';
      entry.supports.forEach(({ label, ref }) => {
        const li = document.createElement('li');
        li.textContent = ref ? `${label} — ${ref}` : label;
        supportList.appendChild(li);
      });
      section.appendChild(supportList);
    }

    if (Array.isArray(entry.limitations) && entry.limitations.length) {
      const limitsHeading = document.createElement('p');
      limitsHeading.className = 'evidence-popover__subheading';
      limitsHeading.textContent = 'Limitations';
      section.appendChild(limitsHeading);
      const limitsList = document.createElement('ul');
      limitsList.className = 'evidence-popover__list evidence-popover__list--limits';
      entry.limitations.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        limitsList.appendChild(li);
      });
      section.appendChild(limitsList);
    }

    return section;
  }

  function openEvidencePopover(trigger, keys) {
    if (!EVIDENCE_MODE_ENABLED) {
      return;
    }
    ensureEvidencePopover();
    if (!evidencePopover || !evidencePopoverContent) {
      return;
    }
    const parsedKeys = Array.from(
      new Set(
        (Array.isArray(keys) ? keys : [])
          .map((key) => (key || '').trim())
          .filter(Boolean)
      )
    );
    evidencePopoverContent.innerHTML = '';
    const sections = parsedKeys
      .map((key) => ({ key, entry: EVIDENCE_REGISTRY[key] }))
      .filter(({ entry }) => !!entry);

    if (!sections.length) {
      const note = document.createElement('p');
      note.className = 'support-note';
      note.textContent = 'Sources will appear here once the mapping is documented.';
      evidencePopoverContent.appendChild(note);
    } else {
      sections.forEach(({ key, entry }) => {
        evidencePopoverContent.appendChild(buildEvidenceSection(key, entry));
      });
    }

    evidencePopover.hidden = false;
    evidencePopover.setAttribute('aria-hidden', 'false');
    document.body?.classList?.add('has-evidence-popover-open');
    evidencePopoverFocusReturn = trigger;
    document.addEventListener('keydown', handleEvidenceEscape);
    try {
      evidencePopoverClose?.focus({ preventScroll: true });
    } catch (error) {
      evidencePopoverClose?.focus();
    }
  }

  function closeEvidencePopover() {
    if (!evidencePopover) {
      return;
    }
    evidencePopover.hidden = true;
    evidencePopover.setAttribute('aria-hidden', 'true');
    document.body?.classList?.remove('has-evidence-popover-open');
    document.removeEventListener('keydown', handleEvidenceEscape);
    if (evidencePopoverFocusReturn && typeof evidencePopoverFocusReturn.focus === 'function') {
      try {
        evidencePopoverFocusReturn.focus();
      } catch (error) {
        // ignore focus errors
      }
    }
    evidencePopoverFocusReturn = null;
  }

  function handleEvidenceEscape(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      closeEvidencePopover();
    }
  }

  function handleEvidenceClick(event) {
    const trigger = event.target.closest('[data-evidence-trigger]');
    if (!trigger) {
      return;
    }
    event.preventDefault();
    const keys = (trigger.dataset.evidenceKeys || '').split(',');
    openEvidencePopover(trigger, keys);
  }

  function maybeShowEvidenceNote() {
    if (!EVIDENCE_MODE_ENABLED || !supportFlow) {
      return;
    }
    let dismissed = false;
    if (typeof localStorage !== 'undefined') {
      try {
        dismissed = localStorage.getItem(EVIDENCE_NOTE_KEY) === '1';
      } catch (error) {
        dismissed = false;
      }
    }
    if (dismissed) {
      return;
    }
    const notice = document.createElement('div');
    notice.className = 'evidence-note';
    const message = document.createElement('p');
    message.textContent = 'Suggestions are hypotheses based on affect science; tap “Why these?” for sources.';
    notice.appendChild(message);
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'evidence-note__dismiss';
    dismiss.textContent = 'Got it';
    dismiss.addEventListener('click', () => {
      notice.remove();
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(EVIDENCE_NOTE_KEY, '1');
        } catch (error) {
          // ignore storage errors
        }
      }
    });
    notice.appendChild(dismiss);
    supportFlow.prepend(notice);
  }

  function copyTemplate(text, statusNode) {
    if (!navigator.clipboard) {
      statusNode.textContent = 'Copy is unavailable in this browser. You can highlight the sentence manually.';
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        statusNode.textContent = 'Copied! Share it or keep it where it helps.';
      })
      .catch(() => {
        statusNode.textContent = 'Copy did not work. Try copying manually.';
      });
  }

  function speakTemplate(text, statusNode) {
    if (!('speechSynthesis' in window)) {
      statusNode.textContent = 'Speech is unavailable here. Try reading the sentence aloud yourself.';
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
    statusNode.textContent = 'Playing the sentence out loud—pause or stop if you prefer to speak it yourself.';
  }

  function renderJournalHistory() {
    if (!journalHistory) return;
    const store = getJournalStore();
    const entries = store ? store.list() : [];
    journalHistory.innerHTML = '';
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'support-note';
      empty.textContent = 'Your saved reflections will appear here and in the Inventory journal tab.';
      journalHistory.appendChild(empty);
      return;
    }
    const title = document.createElement('p');
    title.className = 'journal-history__title';
    title.textContent = 'Recent reflections on this device';
    journalHistory.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'journal-history';
    entries
      .slice(0, 5)
      .forEach((entry) => {
        const item = document.createElement('li');
        item.className = 'journal-history__item';
        const date = entry.dateISO ? new Date(entry.dateISO).toLocaleString() : '';
        const emotion = entry.emotion ? `${EMOTION_LIBRARY[entry.emotion]?.name ?? entry.emotion} — ` : '';
        item.textContent = `${date}: ${emotion}${entry.notes || ''}`;
        list.appendChild(item);
      });
    journalHistory.appendChild(list);
    const link = document.createElement('a');
    link.className = 'support-button support-button--link support-button--ghost';
    link.href = `${basePath}inventory/journal/`;
    link.textContent = 'Open full journal dashboard';
    journalHistory.appendChild(link);
  }

  function normalizeJournalTagsValue(value) {
    if (window.NVCJournal?.normalizeJournalTags) {
      return window.NVCJournal.normalizeJournalTags(value);
    }
    if (!value) {
      return [];
    }
    const segments = value.split(',');
    const seen = new Set();
    const tags = [];
    segments.forEach((segment) => {
      const trimmed = segment.replace(/^#/, '').trim();
      if (!trimmed) {
        return;
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      tags.push(trimmed);
    });
    return tags;
  }

  function joinJournalTagsValue(tags, { trailing = false } = {}) {
    if (window.NVCJournal?.joinJournalTags) {
      return window.NVCJournal.joinJournalTags(tags, { trailing });
    }
    const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
    if (!list.length) {
      return '';
    }
    const joined = list.join(', ');
    return trailing ? `${joined}, ` : joined;
  }

  function updateLaneIntensityDisplay(value) {
    if (state.journalController && typeof state.journalController.updateIntensityDisplay === 'function') {
      state.journalController.updateIntensityDisplay(value);
      return;
    }
    if (!supportJournalIntensityDisplay) {
      return;
    }
    const displayValue = Number.isFinite(value) ? Math.max(0, Math.min(10, Math.round(value))) : 0;
    supportJournalIntensityDisplay.textContent = `${displayValue}/10`;
  }

  function handleLaneIntensityInput(event) {
    const value = Number(event.target?.value);
    updateLaneIntensityDisplay(value);
    resetLaneSaveButton();
    scheduleLaneDraftSave();
  }

  function gatherSupportJournalData() {
    if (state.journalController && typeof state.journalController.collectData === 'function') {
      return state.journalController.collectData();
    }
    const notes = supportJournalNotes?.value || '';
    const emotionValue = supportJournalEmotion?.value || '';
    const intensityValue = supportJournalIntensity ? Number(supportJournalIntensity.value) : undefined;
    const intensity =
      Number.isFinite(intensityValue) && intensityValue >= 0
        ? Math.min(10, Math.round(intensityValue))
        : undefined;
    const tags = normalizeJournalTagsValue(supportJournalTagsInput?.value || '');
    const needs = supportJournalNeedsInput
      ? (supportJournalNeedsInput.value || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    return {
      notes,
      emotion: emotionValue.trim(),
      intensity,
      needs,
      tags,
    };
  }

  function createLaneEntry(overrides = {}) {
    const factory = window.NVCJournal?.makeEntry || window.NVCJournal?.emptyEntry;
    if (typeof factory === 'function') {
      return factory({ ...overrides });
    }
    const fallback = {
      id: `lane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      dateISO: new Date().toISOString(),
      emotion: '',
      intensity: undefined,
      confidence: undefined,
      sensations: [],
      needs: [],
      strategies: [],
      tags: [],
      notes: '',
      energy: undefined,
      valence: undefined,
      zone: null,
      emotionCandidates: [],
      chosenEmotionConfidence: undefined,
      regulationUsed: [],
      source: 'lane',
    };
    return { ...fallback, ...overrides };
  }

  function setSupportOpenLink(id) {
    if (!supportJournalOpenLink) {
      return;
    }
    if (!id) {
      clearSupportOpenLink();
      return;
    }
    state.lastSavedEntryId = id;
    supportJournalOpenLink.href = `${basePath}inventory/journal/?e=${encodeURIComponent(id)}#edit`;
    supportJournalOpenLink.hidden = false;
  }

  function clearSupportOpenLink() {
    if (!supportJournalOpenLink) {
      return;
    }
    state.lastSavedEntryId = '';
    supportJournalOpenLink.hidden = true;
    supportJournalOpenLink.removeAttribute('href');
  }

  function resetLaneSaveButton() {
    if (!supportJournalSubmit) {
      return;
    }
    if (state.savedFeedbackTimer) {
      clearTimeout(state.savedFeedbackTimer);
      state.savedFeedbackTimer = null;
    }
    supportJournalSubmit.textContent = state.saveButtonDefaultLabel;
    supportJournalSubmit.disabled = false;
    supportJournalSubmit.removeAttribute('aria-disabled');
  }

  function showLaneSavedFeedback() {
    if (!supportJournalSubmit) {
      return;
    }
    resetLaneSaveButton();
    supportJournalSubmit.textContent = 'Saved ✓';
    supportJournalSubmit.disabled = true;
    supportJournalSubmit.setAttribute('aria-disabled', 'true');
    state.savedFeedbackTimer = setTimeout(() => {
      supportJournalSubmit.textContent = state.saveButtonDefaultLabel;
      supportJournalSubmit.disabled = false;
      supportJournalSubmit.removeAttribute('aria-disabled');
      state.savedFeedbackTimer = null;
    }, 1500);
  }

  function scheduleLaneDraftSave() {
    const store = getJournalStore();
    if (!store) {
      return;
    }
    if (state.draftTimer) {
      clearTimeout(state.draftTimer);
    }
    state.draftTimer = setTimeout(() => {
      state.draftTimer = null;
      saveLaneDraft();
    }, DRAFT_DEBOUNCE_MS);
  }

  function saveLaneDraft() {
    const store = getJournalStore();
    if (!store || !journalForm) {
      return;
    }
    const data = gatherSupportJournalData();
    const selections = getSelectedSensations();
    const sensations = serializeSensationSelections(selections);
    const hasContent =
      data.notes.trim().length > 0 ||
      data.emotion ||
      (Array.isArray(data.tags) && data.tags.length > 0) ||
      (Array.isArray(data.needs) && data.needs.length > 0);
    if (!hasContent) {
      store.clearDraft(state.draftPath);
      return;
    }
    const draft = {
      notes: data.notes,
      emotion: data.emotion,
      intensity: data.intensity,
      tags: data.tags,
      needs: data.needs,
      energy: state.energyValue,
      valence: state.valenceValue,
      sensations,
    };
    store.saveDraft(state.draftPath, draft);
  }

  function applyLaneDraft() {
    const store = getJournalStore();
    if (!store || !journalForm) {
      return;
    }
    const draft = store.loadDraft(state.draftPath);
    if (!draft) {
      return;
    }
    const draftTags = Array.isArray(draft.tags)
      ? draft.tags
      : typeof draft.tags === 'string'
      ? normalizeJournalTagsValue(draft.tags)
      : [];
    const draftData = {
      notes: typeof draft.notes === 'string' ? draft.notes : '',
      emotion: typeof draft.emotion === 'string' ? draft.emotion : '',
      intensity: Number.isFinite(draft.intensity) ? Number(draft.intensity) : undefined,
      tags: draftTags,
      needs: Array.isArray(draft.needs) ? draft.needs : [],
    };
    if (state.journalController && typeof state.journalController.setValues === 'function') {
      state.journalController.setValues(draftData, { trailingTags: draftTags.length > 0 });
    } else {
      if (supportJournalNotes) {
        supportJournalNotes.value = draftData.notes;
      }
      if (supportJournalEmotion) {
        supportJournalEmotion.value = draftData.emotion;
      }
      if (supportJournalIntensity && Number.isFinite(draftData.intensity)) {
        supportJournalIntensity.value = Math.max(0, Math.min(10, Math.round(draftData.intensity)));
        updateLaneIntensityDisplay(Number(supportJournalIntensity.value));
      }
      if (supportJournalNeedsInput) {
        supportJournalNeedsInput.value = draftData.needs.length ? `${draftData.needs.join(', ')}` : '';
      }
      if (supportJournalTagsInput) {
        supportJournalTagsInput.value = joinJournalTagsValue(draftTags, { trailing: draftTags.length > 0 });
      }
    }
    if (!state.journalController && supportJournalIntensity) {
      const current = Number(supportJournalIntensity.value);
      updateLaneIntensityDisplay(Number.isFinite(current) ? current : 5);
    }
    if (supportJournalEmotion && draftData.emotion) {
      supportJournalEmotion.dataset.autofill = 'false';
    }
    if (typeof draft.energy === 'number') {
      state.energyValue = draft.energy;
    }
    if (typeof draft.valence === 'number') {
      state.valenceValue = draft.valence;
    }
    if (Array.isArray(draft.sensations)) {
      restoreSensationSelections(draft.sensations);
    } else {
      restoreSensationSelections([]);
    }
    if (draft.notes) {
      journalStatus.textContent = 'Draft restored. Save when you are ready.';
    }
  }

  function handleJournalSubmit(event) {
    event.preventDefault();
    const store = getJournalStore();
    if (!store || !journalForm) {
      journalStatus.textContent = 'Saving is unavailable right now. Try reloading and saving again.';
      return;
    }
    const data = gatherSupportJournalData();
    const trimmedNotes = data.notes.trim();
    const emotionName = state.selectedEmotion
      ? EMOTION_LIBRARY[state.selectedEmotion]?.name ?? state.selectedEmotion
      : '';
    const emotionValue = data.emotion || emotionName;
    const hasContent =
      trimmedNotes ||
      emotionValue ||
      (Array.isArray(data.tags) && data.tags.length) ||
      (Array.isArray(data.needs) && data.needs.length);
    if (!hasContent) {
      journalStatus.textContent = 'Add a few notes, an emotion, or a tag before saving.';
      return;
    }
    const typedNeeds = Array.isArray(data.needs) ? data.needs : [];
    const suggestedNeeds = state.selectedEmotion ? EMOTION_LIBRARY[state.selectedEmotion]?.needs ?? [] : [];
    const mergedNeedsRaw = normalizeNeeds([...typedNeeds, ...suggestedNeeds]);
    const mergedNeeds = [];
    const seenNeeds = new Set();
    mergedNeedsRaw.forEach((need) => {
      const label = need?.label || '';
      if (!label) {
        return;
      }
      const key = label.toLowerCase();
      if (seenNeeds.has(key)) {
        return;
      }
      seenNeeds.add(key);
      mergedNeeds.push(label);
    });

    const selections = getSelectedSensations();
    const serializedSensations = serializeSensationSelections(selections);

    const entry = createLaneEntry({
      emotion: emotionValue,
      intensity: data.intensity,
      tags: data.tags,
      notes: trimmedNotes,
      energy: Number.isFinite(state.energyValue) ? state.energyValue : undefined,
      valence: Number.isFinite(state.valenceValue) ? state.valenceValue : undefined,
      sensations: serializedSensations,
      needs: mergedNeeds,
      zone: state.quadrant || null,
      emotionCandidates: state.candidateEmotions.slice(0, 5).map(({ key, confidence }) => ({
        emotion: key,
        confidence: Number.isFinite(confidence) ? Number(confidence) : null,
      })),
      chosenEmotionConfidence: Number.isFinite(state.selectedEmotionConfidence)
        ? Number(state.selectedEmotionConfidence)
        : undefined,
      regulationUsed: Array.from(state.regulationLog || []).filter(Boolean),
      source: 'lane',
    });
    const saved = store.create(entry);
    resetLaneSaveButton();
    showLaneSavedFeedback();
    setSupportOpenLink(saved?.id);
    store.clearDraft(state.draftPath);
    if (state.journalController && typeof state.journalController.resetForm === 'function') {
      state.journalController.resetForm();
    } else {
      if (supportJournalNotes) {
        supportJournalNotes.value = '';
      }
      if (supportJournalTagsInput) {
        supportJournalTagsInput.value = '';
      }
      if (supportJournalIntensity) {
        supportJournalIntensity.value = 5;
        updateLaneIntensityDisplay(5);
      } else {
        updateLaneIntensityDisplay(5);
      }
      if (supportJournalEmotion) {
        supportJournalEmotion.value = '';
      }
    }
    if (supportJournalEmotion) {
      delete supportJournalEmotion.dataset.autofill;
    }
    if (supportJournalNotes) {
      supportJournalNotes.focus();
    }
    prefillSupportEmotion(state.selectedEmotion, { force: false });
    state.journalController?.hideTagSuggestions?.();
    renderJournalHistory();
    journalStatus.textContent = 'Saved locally. Open in Journal to continue or edit.';
    state.regulationLog = new Set();
    state.selectedEmotionConfidence = null;
  }

  function handleJournalClear() {
    if (state.journalController && typeof state.journalController.resetForm === 'function') {
      state.journalController.resetForm();
    } else {
      if (supportJournalEmotion) {
        supportJournalEmotion.value = '';
      }
      if (supportJournalIntensity) {
        supportJournalIntensity.value = 5;
        updateLaneIntensityDisplay(5);
      } else {
        updateLaneIntensityDisplay(5);
      }
      if (supportJournalNeedsInput) {
        supportJournalNeedsInput.value = '';
      }
      if (supportJournalTagsInput) {
        supportJournalTagsInput.value = '';
      }
      if (supportJournalNotes) {
        supportJournalNotes.value = '';
      }
    }
    state.journalController?.hideTagSuggestions?.();
    if (supportJournalEmotion) {
      delete supportJournalEmotion.dataset.autofill;
    }
    journalStatus.textContent = '';
    resetLaneSaveButton();
    clearSupportOpenLink();
    const store = getJournalStore();
    store?.clearDraft?.(state.draftPath);
    prefillSupportEmotion(state.selectedEmotion, { force: false });
    state.regulationLog = new Set();
  }

  function prefillSupportEmotion(emotionKey, { force = false } = {}) {
    if (!supportJournalEmotion || !emotionKey) {
      return;
    }
    const emotion = EMOTION_LIBRARY[emotionKey];
    const label = emotion?.name || emotionKey;
    if (force || !supportJournalEmotion.value || supportJournalEmotion.dataset.autofill === 'true') {
      supportJournalEmotion.value = label;
      supportJournalEmotion.dataset.autofill = 'true';
    }
  }

  function handleSuggestionClick(event) {
    const rejectButton = event.target.closest('[data-emotion-reject]');
    if (rejectButton) {
      event.preventDefault();
      const emotionKey = rejectButton.dataset.emotionReject;
      recordRejection(emotionKey);
      refreshSuggestions();
      return;
    }

    const target = event.target.closest('[data-emotion]');
    if (!target) return;
    const emotionKey = target.dataset.emotion;
    renderEmotionDetails(emotionKey, target);
    if (state.activeStep !== 'library') {
      goToStep('library', { focus: false });
    }
  }

  function handleCommunicationClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const templateNode = communicationCard?.querySelector('[data-communication-template]');
    const statusNode = communicationCard?.querySelector('[data-communication-status]');
    if (!templateNode || !statusNode) return;
    const text = templateNode.textContent ?? '';
    const action = actionButton.dataset.action;
    if (action === 'copy-template') {
      copyTemplate(text, statusNode);
    } else if (action === 'speak-template') {
      speakTemplate(text, statusNode);
    }
  }

  function loadLaneReferenceData() {
    const loadNeeds = window.NVCJournal?.loadNeedsList;
    const loadFeelings = window.NVCJournal?.loadFeelingsList;
    if (typeof loadNeeds !== 'function' && typeof loadFeelings !== 'function') {
      return;
    }
    const needsPromise = typeof loadNeeds === 'function' ? loadNeeds({ basePath }) : Promise.resolve([]);
    const feelingsPromise = typeof loadFeelings === 'function' ? loadFeelings({ basePath }) : Promise.resolve([]);
    Promise.all([
      needsPromise.catch((error) => {
        console.warn('Support lane: unable to load needs list', error);
        return [];
      }),
      feelingsPromise.catch((error) => {
        console.warn('Support lane: unable to load feelings list', error);
        return [];
      }),
    ]).then(([needs, feelings]) => {
      if (Array.isArray(needs) && needs.length) {
        state.needs = needs;
        if (state.journalController && typeof state.journalController.setNeedsOptions === 'function') {
          state.journalController.setNeedsOptions(needs);
          supportJournalNeedsInput = state.journalController.needsSelect || supportJournalNeedsInput;
        }
      }
      if (Array.isArray(feelings) && feelings.length) {
        state.feelings = feelings;
        if (state.journalController && typeof state.journalController.setEmotionOptions === 'function') {
          state.journalController.setEmotionOptions(feelings);
        }
      }
    });
  }

  function init() {
    const initialStepElement = steps[state.activeStep];
    initialStepElement?.classList.add('step-current');

    if (startButton) {
      startButton.addEventListener('click', handleStart);
    }
    const breathingStart = document.querySelector('[data-action="breathing-start"]');
    const breathingSkip = document.querySelector('[data-action="breathing-skip"]');
    breathingStart?.addEventListener('click', handleBreathingStart);
    breathingSkip?.addEventListener('click', skipBreathing);

    if (sensationRegionList) {
      renderBodyRegions(sensationRegionList);
      sensationRegionList.addEventListener('click', handleSensationChoiceClick);
      sensationRegionList.addEventListener('input', handleSensationIntensityInput);
    }

    const sensationSubmit = document.querySelector('[data-action="sensation-submit"]');
    const sensationClear = document.querySelector('[data-action="sensation-clear"]');
    const sensationNext = document.querySelector('[data-action="sensation-next"]');
    sensationSubmit?.addEventListener('click', handleSensationSubmit);
    sensationClear?.addEventListener('click', handleSensationClear);
    sensationNext?.addEventListener('click', handleSensationSkip);

    scanStartButton?.addEventListener('click', handleScanStart);
    scanBackButton?.addEventListener('click', handleScanBack);
    scanNextButton?.addEventListener('click', handleScanNext);
    scanFinishButton?.addEventListener('click', handleScanFinish);

    compassRoot?.addEventListener('nvc-compass-change', handleCompassSelection);

    supportFlow?.addEventListener('click', handleStepCtaClick);
    supportFlow?.addEventListener('click', handleEvidenceClick);

    bodySuggestions?.addEventListener('click', handleSuggestionClick);
    compassSuggestions?.addEventListener('click', handleSuggestionClick);

    if (journalForm) {
      journalForm.addEventListener('submit', handleJournalSubmit);
    }
    if (supportJournalNotes) {
      supportJournalNotes.addEventListener('input', () => {
        resetLaneSaveButton();
        scheduleLaneDraftSave();
      });
    }
    if (supportJournalEmotion) {
      supportJournalEmotion.setAttribute('aria-autocomplete', 'list');
      supportJournalEmotion.addEventListener('input', () => {
        supportJournalEmotion.dataset.autofill = 'false';
        resetLaneSaveButton();
        scheduleLaneDraftSave();
      });
    }
    if (supportJournalIntensity) {
      supportJournalIntensity.addEventListener('input', handleLaneIntensityInput);
      const initialIntensity = Number(supportJournalIntensity.value);
      updateLaneIntensityDisplay(Number.isFinite(initialIntensity) ? initialIntensity : 5);
    } else {
      updateLaneIntensityDisplay(5);
    }
    if (supportJournalTagsInput) {
      supportJournalTagsInput.addEventListener('input', () => {
        resetLaneSaveButton();
        scheduleLaneDraftSave();
      });
    }
    if (!state.journalController && supportJournalNeedsInput) {
      supportJournalNeedsInput.setAttribute('aria-autocomplete', 'list');
      supportJournalNeedsInput.addEventListener('input', () => {
        resetLaneSaveButton();
        scheduleLaneDraftSave();
      });
    }
    const journalClear = journalStep?.querySelector('[data-journal-clear]');
    journalClear?.addEventListener('click', handleJournalClear);

    communicationCard?.addEventListener('click', handleCommunicationClick);

    renderSuggestionBlock(
      bodySuggestions,
      'Body-based matches',
      'Body-based matches will appear here after you choose sensations and set their intensity.',
      []
    );
    renderSuggestionBlock(
      compassSuggestions,
      'Emotion compass matches',
      'Pick one energy and one pleasantness option to see suggestions.',
      []
    );
    if (EVIDENCE_MODE_ENABLED) {
      ensureEvidencePopover();
      maybeShowEvidenceNote();
    }
    applyLaneDraft();
    loadLaneReferenceData();
    renderJournalHistory();
    updateStepControls();
    if (!getJournalStore() && typeof window !== 'undefined') {
      window.addEventListener(
        'nvc-journal-store-ready',
        () => {
          applyLaneDraft();
          renderJournalHistory();
        },
        { once: true }
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
