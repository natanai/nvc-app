// Generated from alexithymia-support.js to share structured data.

async function loadBodyRegionsData() {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    try {
      const response = await fetch(new URL('../data/body-regions.json', import.meta.url));
      if (!response.ok) {
        throw new Error(`Failed to load body regions JSON (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      console.warn('[alexithymia-support-data] Unable to fetch body regions', error);
      return [];
    }
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    const [{ readFileSync }, { fileURLToPath }, { dirname, join }] = await Promise.all([
      import('node:fs'),
      import('node:url'),
      import('node:path'),
    ]);
    const filePath = join(dirname(fileURLToPath(import.meta.url)), '../data/body-regions.json');
    try {
      const raw = readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      console.warn('[alexithymia-support-data] Unable to read body regions from disk', filePath, error);
      return [];
    }
  }

  return [];
}

function cloneBodyRegions(regions) {
  if (!Array.isArray(regions)) {
    return [];
  }

  return regions.map((region) => {
    const options = Array.isArray(region?.options)
      ? region.options.map((option) => ({
          ...option,
          emotions: { ...(option?.emotions || {}) },
        }))
      : [];

    return {
      id: region?.id || '',
      label: region?.label || '',
      prompt: region?.prompt || '',
      options,
    };
  });
}

function deriveBodyOptionIds(regions) {
  const seen = new Set();
  const ids = [];
  regions.forEach((region) => {
    region.options.forEach((option) => {
      const id = option?.id;
      if (typeof id === 'string' && id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    });
  });
  return ids;
}

const bodyRegionsRaw = await loadBodyRegionsData();
const bodyRegions = cloneBodyRegions(bodyRegionsRaw);

export const BODY_OPTION_IDS = [
  ...deriveBodyOptionIds(bodyRegions),
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

export const BODY_REGIONS = bodyRegions;


const BODY_SENSATION_OPTIONS = new Map();

export const QUADRANT_SUGGESTIONS = {
  'low-unpleasant': {
    label: 'Low energy · Unpleasant',
    description: 'Low activation with unpleasant affect can be associated with sadness, grief, fatigue, or loneliness.',
    emotions: ['sadness', 'grief', 'tired', 'lonely'],
    care: [
      'Reduce stimulation and choose a physically comfortable setting if possible.',
      'Consider contacting someone you trust for company or practical support.',
      'Try slow breathing, stretching, or progressive muscle relaxation and notice whether tension changes.',
    ],
  },
  'medium-unpleasant': {
    label: 'Steady energy · Unpleasant',
    description: 'Moderate activation with unpleasant affect can be associated with anxiety, guilt, shame, or stress.',
    emotions: ['anxiety', 'guilt', 'shame', 'stress'],
    care: [
      'Identify the situation, thought, value, or need that seems most relevant.',
      'Try a grounding check: notice 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.',
      'Use a brief grounding or movement exercise and note whether activation changes.',
    ],
  },
  'high-unpleasant': {
    label: 'High energy · Unpleasant',
    description: 'High activation with unpleasant affect can be associated with anxiety, fear, anger, or overwhelm.',
    emotions: ['anxiety', 'fear', 'anger', 'overwhelm'],
    care: [
      'Lengthen the exhale or press your feet into the floor and notice whether arousal changes.',
      'Use brief movement if remaining still increases agitation.',
      'Delay non-urgent responses until activation has decreased when possible.',
    ],
  },
  'low-neutral': {
    label: 'Low energy · Neutral',
    description: 'Low activation with neutral affect can occur with numbness, boredom, or fatigue.',
    emotions: ['numb', 'bored', 'tired'],
    care: [
      'Check basic sensory information such as texture, temperature, pressure, or movement and note what is easiest to detect.',
      'Try one small change in movement, light, temperature, or activity and notice whether the state changes.',
      'Use slow movement or stretching if it helps make body sensations easier to notice.',
    ],
  },
  'medium-neutral': {
    label: 'Steady energy · Neutral',
    description: 'Moderate activation with neutral affect can occur with curiosity, reflection, or uncertainty.',
    emotions: ['curiosity', 'thoughtful', 'uncertain'],
    care: [
      'Write down what is known, what remains uncertain, and what information would help.',
      'Allow additional time before deciding if the situation remains unclear.',
      'Record the context if you want to compare it with future patterns.',
    ],
  },
  'high-neutral': {
    label: 'High energy · Neutral',
    description: 'High activation without clear distress can occur with determination, focus, or anticipation.',
    emotions: ['determined', 'focused', 'excited'],
    care: [
      'Direct the energy toward one specific next step or a brief period of movement.',
      'Check whether urgency is necessary before acting, and seek another perspective if useful.',
      'Plan a transition or break if sustained activation or focus is becoming tiring.',
    ],
  },
  'low-pleasant': {
    label: 'Low energy · Pleasant',
    description: 'Low activation with pleasant affect can occur with calm, relief, or contentment.',
    emotions: ['calm', 'relief', 'contented'],
    care: [
      'Notice what conditions are present while the state feels calm or relieved.',
      'Use the state as an opportunity for rest or recovery if needed.',
      'Record the context if it may be useful to recreate later.',
    ],
  },
  'medium-pleasant': {
    label: 'Steady energy · Pleasant',
    description: 'Moderate activation with pleasant affect can occur with contentment, hope, or gratitude.',
    emotions: ['contented', 'hopeful', 'gratitude'],
    care: [
      'Identify what is contributing to the state.',
      'Express appreciation if another person contributed and you want to.',
      'Record the context if tracking supportive conditions is useful.',
    ],
  },
  'high-pleasant': {
    label: 'High energy · Pleasant',
    description: 'High activation with pleasant affect can occur with joy, excitement, or pride.',
    emotions: ['joyful', 'excited', 'pride'],
    care: [
      'Enjoy or express the positive activation in a way that fits the situation.',
      'Notice what contributed to the experience.',
      'Record it if you want to compare positive patterns over time.',
    ],
  },
};

export const EMOTION_LIBRARY = {
  anxiety: {
    name: 'Anxiety',
    definition: 'A state of apprehension or heightened arousal associated with anticipated threat, uncertainty, or possible negative outcomes.',
    bodySignals: ['Tight or fluttery chest', 'Fast heartbeat', 'Butterflies in the stomach', 'Restless energy in hands or feet'],
    thoughts: ['“What if something goes wrong?”', 'Planning every possible outcome', 'Scanning for threats or mistakes'],
    contexts: [
      'Facing uncertainty or change',
      'Waiting for results',
      'Holding lots of responsibility',
      'Unfinished tasks or ambiguous feedback',
      'Caring deeply about an outcome',
    ],
    needs: ['Safety', 'Clarity', 'Support', 'Trust', 'Predictability'],
    regulation: [
      'Try 4-4-6 breathing: inhale 4, hold 4, exhale 6 to downshift activation.',
      'Orient to the present—name five things you can see or touch to remind your body it is here now.',
      'Write down the worry, then note what is in your control versus what is not.',
      'Schedule a specific time to revisit the concern so your brain can rest meanwhile.',
    ],
    communication: "I'm feeling anxious and could use some reassurance or clearer next steps.",
  },
  fear: {
    name: 'Fear',
    definition: 'An emotional response to a perceived immediate or specific threat.',
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
    definition: 'An activated emotional state that often occurs in response to perceived obstruction, unfairness, threat, or boundary violation.',
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
    definition: 'A state in which demands, sensory input, or emotional load feel greater than available processing capacity.',
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
  excited: {
    name: 'Excited',
    definition: 'A high-arousal positive state associated with anticipation, interest, or a desired event.',
    bodySignals: ['Bouncing legs', 'Quick speech', 'Warmth in the face'],
    thoughts: ['“This is going to be great!”', '“I can’t wait.”'],
    contexts: ['Anticipating a positive event', 'Working on an inspiring idea', 'Waiting for news'],
    needs: ['Appreciation', 'Self expression', 'Connection', 'Predictability'],
    regulation: ['Channel the spark—dance, share the news, or map out how to savor it.', 'Alternate excitement with grounding breaths or movement so you can rest later.'],
    communication: 'I’m excited and want to celebrate or plan how to enjoy this moment.',
  },
  sadness: {
    name: 'Sadness',
    definition: 'A low-arousal unpleasant state commonly associated with loss, disappointment, or unmet expectations.',
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
    definition: 'An emotional response to significant loss that may include sadness, yearning, anger, numbness, or changes in energy.',
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
    definition: 'A state of reduced physical or mental energy associated with a need for rest or recovery.',
    bodySignals: ['Heavy limbs', 'Yawning', 'Difficulty concentrating'],
    thoughts: ['“I can’t push much more.”', '“I need a break.”'],
    contexts: ['Long stretches of effort', 'Emotional caregiving', 'Lack of sleep or nutrition'],
    needs: ['Rest', 'Relaxation', 'Support'],
    regulation: ['Schedule real rest—even 10 minutes counts.', 'Check in with basic care: water, food, movement, sleep.'],
    communication: 'I’m tired and need rest or help sharing responsibilities.',
  },
  lonely: {
    name: 'Lonely',
    definition: 'Distress associated with a perceived gap between desired and available social connection.',
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
    definition: 'An unpleasant self-evaluative emotion associated with believing that a specific action or omission violated your standards or harmed someone.',
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
    definition: 'A painful self-evaluative emotion associated with a negative judgment of the self and concern about rejection or social exposure.',
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
    definition: 'A state of psychological or physiological strain that can occur when perceived demands exceed available resources.',
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
    definition: 'An unpleasant activated state that commonly occurs when progress toward a goal is blocked or delayed.',
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
    definition: 'A state of reduced emotional awareness, intensity, or access to feeling.',
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
    definition: 'An unpleasant low-engagement state associated with insufficient stimulation, interest, or meaning.',
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
    definition: 'An interest-driven state characterized by motivation to seek information, explore, or understand.',
    bodySignals: ['Leaning forward', 'Eyes widening', 'Gentle alertness'],
    thoughts: ['“What is this about?”', '“I want to understand.”'],
    contexts: ['Encountering new ideas', 'Having space to explore without pressure'],
    needs: ['Clarity', 'Autonomy', 'Freedom'],
    regulation: ['Follow the thread—research, ask questions, or experiment safely.', 'Protect time to wander without judging productivity.'],
    communication: 'I’m curious and would like time or resources to explore this further.',
  },
  thoughtful: {
    name: 'Thoughtful',
    definition: 'A reflective state characterized by sustained attention to meaning, decisions, or possibilities.',
    bodySignals: ['Soft gaze', 'Slower pace', 'Focus on inner imagery'],
    thoughts: ['“Let me think this through.”', '“How does this fit?”'],
    contexts: ['Making decisions', 'Integrating new insight'],
    needs: ['Understanding', 'Calm', 'Clarity'],
    regulation: ['Give yourself unhurried space to journal or map ideas.', 'Balance reflection with small grounding breaks.'],
    communication: 'I’m feeling thoughtful and could use space to process before responding.',
  },
  uncertain: {
    name: 'Uncertain',
    definition: 'A state of unresolved judgment or choice when available information does not support a clear conclusion.',
    bodySignals: ['Mixed sensations', 'Alternating tension and release'],
    thoughts: ['“I need more data.”', '“I’m on the fence.”'],
    contexts: ['Facing ambiguous outcomes', 'Transition periods'],
    needs: ['Clarity', 'Predictability', 'Support'],
    regulation: ['List what you know, what you guess, and what you need to find out.', 'Decide on the next small check-in point.'],
    communication: 'I’m uncertain and need more information or time before committing.',
  },
  determined: {
    name: 'Determined',
    definition: 'A goal-directed state marked by sustained motivation despite difficulty or delay.',
    bodySignals: ['Tight jaw', 'Forward posture', 'Strong grip'],
    thoughts: ['“I will make this happen.”', '“Keep going.”'],
    contexts: ['Working toward a meaningful goal', 'Protecting someone or something important'],
    needs: ['Accomplishment', 'Support', 'Commitment'],
    regulation: ['Channel the drive into a clear action plan.', 'Balance effort with intentional pauses to avoid burnout.'],
    communication: 'I’m feeling determined and would appreciate support or acknowledgement as I work on this.',
  },
  focused: {
    name: 'Focused',
    definition: 'A state of concentrated attention directed toward a task, problem, or goal.',
    bodySignals: ['Steady gaze', 'Still body with poised energy'],
    thoughts: ['“Stay on target.”', '“One step at a time.”'],
    contexts: ['Working through complex tasks', 'Solving a problem'],
    needs: ['Clarity', 'Order', 'Accomplishment'],
    regulation: ['Protect your focus window—silence notifications or set a timer.', 'Plan a closing ritual so you can release the task afterward.'],
    communication: 'I’m focused right now and need minimal interruptions until I finish.',
  },
  calm: {
    name: 'Calm',
    definition: 'A low-arousal state marked by relative physiological and emotional steadiness.',
    bodySignals: ['Even breathing', 'Relaxed muscles', 'Warm, steady presence'],
    thoughts: ['“I can breathe.”', '“I have enough for this moment.”'],
    contexts: ['After soothing connection', 'When needs are met'],
    needs: ['Rest', 'Serenity', 'Peace'],
    regulation: ['Savor the calm by breathing slowly or practicing gratitude.', 'Note what supports this state for future reference.'],
    communication: 'I feel calm and grounded, which tells me my needs are met right now.',
  },
  relief: {
    name: 'Relief',
    definition: 'A reduction in tension or distress after a threat, demand, or uncertainty decreases.',
    bodySignals: ['Deep exhale', 'Softening shoulders', 'Warmth spreading'],
    thoughts: ['“It’s over.”', '“I can rest now.”'],
    contexts: ['Receiving good news', 'After a stressful event ends'],
    needs: ['Rest', 'Relaxation', 'Appreciation'],
    regulation: ['Let your body fully exhale and shake out leftover stress.', 'Mark the moment with a small reward or acknowledgement.'],
    communication: 'I’m relieved and want to honor the effort it took to get here.',
  },
  contented: {
    name: 'Contented',
    definition: 'A low-to-moderate arousal positive state characterized by satisfaction with current conditions.',
    bodySignals: ['Soft smile', 'Relaxed belly', 'Balanced posture'],
    thoughts: ['“This is enough for now.”', '“I can enjoy this.”'],
    contexts: ['Simple pleasures', 'Quality time with loved ones', 'Finishing meaningful work'],
    needs: ['Appreciation', 'Belonging', 'Peace'],
    regulation: ['Pause to notice sensory details—savor taste, texture, or scenery.', 'Share gratitude or document what you appreciate.'],
    communication: 'I feel content and grateful for how things are landing right now.',
  },
  hopeful: {
    name: 'Hopeful',
    definition: 'A future-oriented positive state associated with perceiving that a desired outcome remains possible.',
    bodySignals: ['Light chest', 'Lifted gaze', 'Gentle energy'],
    thoughts: ['“Something good could happen.”', '“There are options.”'],
    contexts: ['Glimpsing new possibilities', 'Receiving encouragement'],
    needs: ['Growth', 'Support', 'Empowerment'],
    regulation: ['Capture the ideas that spark hope so you can revisit it.', 'Pair hope with one practical next step.'],
    communication: 'I’m feeling hopeful and want to nurture this possibility together.',
  },
  gratitude: {
    name: 'Gratitude',
    definition: 'Positive appreciation in response to a valued benefit, experience, or contribution.',
    bodySignals: ['Warm chest', 'Soft smile', 'Moist eyes'],
    thoughts: ['“Thank you.”', '“This matters to me.”'],
    contexts: ['Receiving help', 'Noticing beauty', 'Moments of generosity'],
    needs: ['Appreciation', 'Connection', 'Mutuality'],
    regulation: ['Express thanks aloud, in writing, or through a small gesture.', 'Record the moment so you can revisit it later.'],
    communication: 'I feel grateful and want to express appreciation for what you did.',
  },
  joyful: {
    name: 'Joyful',
    definition: 'A positive emotional state associated with pleasure, connection, accomplishment, or other valued experiences.',
    bodySignals: ['Light, bouncy energy', 'Laughing', 'Sparkling eyes'],
    thoughts: ['“This is wonderful!”', '“I love this.”'],
    contexts: ['Celebrations', 'Shared laughter', 'Creative breakthroughs'],
    needs: ['Connection', 'Self expression', 'Freedom'],
    regulation: ['Amplify the joy—dance, sing, or share it.', 'Snapshot the moment mentally or physically to savor later.'],
    communication: 'I feel joyful and want to celebrate this together.',
  },
  pride: {
    name: 'Pride',
    definition: 'A positive self-evaluative emotion associated with achievement, effort, competence, or acting in accordance with your values.',
    bodySignals: ['Expanded chest', 'Lifted chin', 'Steady stance'],
    thoughts: ['“I did it.”', '“I’m proud of myself.”'],
    contexts: ['Finishing a tough task', 'Living your values', 'Showing up bravely'],
    needs: ['Recognition', 'Integrity', 'Support'],
    regulation: ['Name the strengths you used.', 'Share the win with someone who will celebrate with you.'],
    communication: 'I feel proud of what I accomplished and want to mark this success.',
  },
};

export const FEELING_PAGE_SLUGS = [
  'afraid',
  'agitated',
  'alarmed',
  'angry',
  'antagonistic',
  'anxiety',
  'anxious',
  'bewildered',
  'calm',
  'confused',
  'contented',
  'defiant',
  'desperation',
  'disappointment',
  'distressed',
  'embarrassed',
  'energized',
  'enraged',
  'excited',
  'fear',
  'frightened',
  'frustrated',
  'helpless',
  'hopeful',
  'hostile',
  'hurt',
  'impotent',
  'in-pain',
  'inspired',
  'irritated',
  'jealous',
  'joyful',
  'lonely',
  'overwhelmed',
  'peaceful',
  'playful',
  'powerless',
  'proud',
  'relaxed',
  'relieved',
  'resentful',
  'sad',
  'scared',
  'tense',
  'terrified',
  'thwarted',
  'tired',
  'upset',
];

export const FEELING_SLUG_ALIASES = {
  "anxious": "anxiety",
  "anxiety": "anxiety",
  "sad": "sadness",
  "lonely": "lonely",
  "angry": "anger",
  "enraged": "anger",
  "antagonistic": "anger",
  "hostile": "anger",
  "resentful": "anger",
  "proud": "pride",
  "irritated": "frustration",
  "frustrated": "frustration",
  "thwarted": "frustration",
  "contentment": "contented",
  "pressured": "stress",
  "tense": "stress",
  "distressed": "stress",
  "upset": "stress",
  "agitated": "stress",
  "relieved": "relief",
  "joyful": "joyful",
  "joy": "joyful",
  "excited": "excited",
  "excitement": "excited",
  "hopeful": "hopeful",
  "hope": "hopeful",
  "overwhelmed": "overwhelm",
  "overwhelm": "overwhelm",
  "fear": "fear",
  "afraid": "fear",
  "frightened": "fear",
  "scared": "fear",
  "terrified": "fear",
  "alarmed": "fear",
  "bewildered": "uncertain",
  "confused": "uncertain",
  "defiant": "determined",
  "anxiousness": "anxiety",
  "humiliated": "shame",
  "embarrassed": "shame",
  "shame": "shame",
  "guilt": "guilt",
  "hurt": "sadness",
  "in-pain": "sadness",
  "powerless": "numb",
  "helpless": "numb",
  "impotent": "numb",
  "desperation": "overwhelm",
  "worry": "anxiety",
  "jealous": "anxiety",
  "love": "love-caring",
  "contented": "contented",
  "anticipation": "excited"
};
