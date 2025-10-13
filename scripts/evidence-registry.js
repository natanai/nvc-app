import { BODY_OPTION_IDS, ZONE_COMBINATIONS } from './alexithymia-support-data.js';

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
