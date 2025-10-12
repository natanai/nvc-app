(function () {
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

  const BODY_SENSATIONS = {
    'tight-chest': {
      label: 'Chest: tight, heavy, or pounding',
      message:
        'When the chest tightens or the heart races, your body may be preparing for a challenge. That activation can signal fear, anger, or high alert worry.',
      emotions: ['anxiety', 'fear', 'anger', 'overwhelm'],
    },
    'stomach-knots': {
      label: 'Stomach: knots, fluttery, or queasy',
      message:
        'Stomach flips often show up with anticipation. People notice them when anxious, worried, or energized by something uncertain.',
      emotions: ['anxiety', 'worry', 'fear', 'excitement'],
    },
    'throat-tight': {
      label: 'Throat: lump or tightness',
      message:
        'A lump in the throat frequently accompanies sadness, grief, or loneliness when words or tears feel stuck.',
      emotions: ['sadness', 'grief', 'shame', 'lonely'],
    },
    'jaw-clench': {
      label: 'Jaw or fists: clenched or hot',
      message:
        'Braced muscles and heat in the face can mean anger or frustration. Sometimes it also shows determination to push through.',
      emotions: ['anger', 'frustration', 'stress', 'determined'],
    },
    'head-fog': {
      label: 'Head: foggy, buzzing, or heavy',
      message:
        'Brain fog can indicate overwhelm, mental load, or exhaustion. It may also appear with worry spirals.',
      emotions: ['overwhelm', 'tired', 'numb', 'worry'],
    },
    'shoulders-weight': {
      label: 'Shoulders: weighted or lifted',
      message:
        'Weighted shoulders can reflect carrying responsibility, guilt, or sadness. Lifted shoulders can show you are bracing to respond.',
      emotions: ['sadness', 'stress', 'guilt', 'anxiety'],
    },
    'limbs-lead': {
      label: 'Arms or legs: heavy, numb, or restless',
      message:
        'Heavy limbs may point toward tiredness or low mood; restless limbs can show pent-up energy looking for movement.',
      emotions: ['tired', 'sadness', 'numb', 'anxiety'],
    },
    'temperature-shift': {
      label: 'Temperature shifts',
      message:
        'Sudden heat, chills, or prickly skin often accompany strong anger, fear, or excitement when adrenaline releases.',
      emotions: ['anger', 'fear', 'anxiety', 'excitement'],
    },
    'no-sensation': {
      label: 'Hard to notice anything',
      message:
        'Feeling blank or disconnected is common in alexithymia. Numbness can mask overwhelm or simply mean your system needs more time.',
      emotions: ['numb', 'bored', 'overwhelm', 'tired'],
    },
  };

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
      description: 'Revved-up distress often signals anxiety, anger, fear, or overwhelm.',
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
    activeTag: null,
    activeStep: STEP_SEQUENCE[0],
    compassTouched: false,
    energyValue: 0,
    valenceValue: 0,
    draftPath: typeof window !== 'undefined' ? window.location.pathname : '',
    draftTimer: null,
    savedFeedbackTimer: null,
    lastSavedEntryId: '',
    saveButtonDefaultLabel: '',
    journalController: null,
    needs: [],
    feelings: [],
  };

  const startButton = steps.intro?.querySelector('[data-action="start"]');
  const breathingDisplay = document.querySelector('[data-breathing-display]');
  const breathingVisual = document.querySelector('[data-breathing-visual]');
  const bodySuggestions = document.querySelector('[data-body-suggestions]');
  const compassSuggestions = document.querySelector('[data-compass-suggestions]');
  const supportFlow = document.querySelector('.support-flow');
  const sensationChips = document.querySelector('[data-sensation-chips]');
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

  const DRAFT_DEBOUNCE_MS = 1200;

  const baseJournalForm = document.querySelector('[data-journal-form]');
  const journalStep = baseJournalForm?.closest('[data-step="journal"]') || baseJournalForm;
  if (journalStep && typeof window.NVCJournal?.createForm === 'function') {
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
  journalStatus = state.journalController?.statusEl || document.querySelector('[data-journal-status]');
  journalHistory = document.querySelector('[data-journal-history]');
  regulationCard = document.querySelector('[data-regulation-card]');
  communicationCard = document.querySelector('[data-communication-card]');
  supportJournalEmotion = state.journalController?.emotionInput || document.querySelector('[data-support-journal-emotion]');
  supportJournalIntensity = state.journalController?.intensityInput || document.querySelector('[data-support-journal-intensity]');
  supportJournalIntensityDisplay =
    state.journalController?.intensityDisplay || document.querySelector('[data-support-journal-intensity-display]');
  supportJournalNeedsInput = state.journalController?.needsSelect || document.querySelector('[data-support-journal-needs]');
  supportJournalTagsInput = state.journalController?.tagsInput || document.querySelector('[data-support-journal-tags]');
  supportJournalNotes = state.journalController?.notesInput || document.querySelector('[data-support-journal-notes]');
  supportJournalSubmit = state.journalController?.saveButton || document.querySelector('[data-support-journal-submit]');
  supportJournalOpenLink = document.querySelector('[data-support-journal-open]');

  state.saveButtonDefaultLabel = supportJournalSubmit?.textContent || 'Save reflection';

  let breathingTimer = null;

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

  const BREATH_SEQUENCE = [
    { label: 'Inhale', seconds: 4 },
    { label: 'Hold softly', seconds: 4 },
    { label: 'Exhale slowly', seconds: 6 },
    { label: 'Rest', seconds: 2 },
  ];

  function resetBreathingVisual() {
    breathingVisual?.classList.remove('is-active');
    if (breathingDisplay) {
      breathingDisplay.textContent = 'Press start to try a 30-second guided breath.';
    }
    if (breathingTimer) {
      clearInterval(breathingTimer);
      breathingTimer = null;
    }
  }

  function startBreathing() {
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
    let elapsed = 0;
    let phaseIndex = 0;
    let remaining = BREATH_SEQUENCE[phaseIndex].seconds;
    breathingDisplay.textContent = `${BREATH_SEQUENCE[phaseIndex].label} • ${remaining}s`;

    breathingTimer = setInterval(() => {
      elapsed += 1;
      remaining -= 1;
      if (remaining <= 0) {
        phaseIndex = (phaseIndex + 1) % BREATH_SEQUENCE.length;
        remaining = BREATH_SEQUENCE[phaseIndex].seconds;
      }
      breathingDisplay.textContent = `${BREATH_SEQUENCE[phaseIndex].label} • ${remaining}s`;
      if (elapsed >= 30) {
        clearInterval(breathingTimer);
        breathingTimer = null;
        breathingVisual.classList.remove('is-active');
        breathingDisplay.textContent = 'Nice job noticing your breath. Ready for the body check-in when it feels right.';
        goToStep('body');
      }
    }, 1000);
  }

  function skipBreathing() {
    resetBreathingVisual();
    goToStep('body');
  }

  function buildEmotionTag(emotionKey) {
    const emotion = EMOTION_LIBRARY[emotionKey];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emotion-tag';
    button.dataset.emotion = emotionKey;
    button.textContent = emotion ? emotion.name : emotionKey;
    return button;
  }

  function renderSuggestionBlock(container, title, message, emotionKeys) {
    if (!container) return;
    container.innerHTML = '';
    const heading = document.createElement('h4');
    heading.className = 'emotion-suggestions__title';
    heading.textContent = title;
    container.appendChild(heading);

    if (message) {
      const para = document.createElement('p');
      para.className = 'support-note';
      para.textContent = message;
      container.appendChild(para);
    }

    if (!emotionKeys || !emotionKeys.length) {
      const none = document.createElement('p');
      none.className = 'support-note';
      none.textContent = 'No clear matches yet. That is okay—try the emotion compass or pick any word to explore.';
      container.appendChild(none);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'emotion-suggestions__list';
    emotionKeys.forEach((key) => {
      const item = document.createElement('li');
      const tag = buildEmotionTag(key);
      item.appendChild(tag);
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function setChipState(button, pressed) {
    if (!button) return;
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.classList.toggle('is-active', pressed);
  }

  function getSelectedSensations(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('[data-sensation][aria-pressed="true"]')).map((button) => button.dataset.sensation);
  }

  function handleSensationChipClick(event) {
    const button = event.target.closest('[data-sensation]');
    if (!button) return;
    event.preventDefault();
    const pressed = button.getAttribute('aria-pressed') === 'true';
    setChipState(button, !pressed);
  }

  function handleSensationSubmit(event) {
    event?.preventDefault?.();
    const selected = getSelectedSensations(sensationChips);
    if (!selected.length) {
      renderSuggestionBlock(
        bodySuggestions,
        'Body-based matches',
        'Try choosing one or two sensations. If nothing stands out, move on to the emotion compass.',
        []
      );
      goToStep('compass');
      return false;
    }

    const emotionCounts = new Map();
    const notes = [];

    selected.forEach((id) => {
      const sensation = BODY_SENSATIONS[id];
      if (!sensation) return;
      notes.push(`• ${sensation.message}`);
      sensation.emotions.forEach((emotionKey) => {
        const current = emotionCounts.get(emotionKey) ?? 0;
        emotionCounts.set(emotionKey, current + 1);
      });
    });

    const sortedEmotions = Array.from(emotionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);

    const message = notes.join(' ');
    renderSuggestionBlock(
      bodySuggestions,
      'Body-based matches',
      message || 'Notice how each sensation might point toward a feeling.',
      sortedEmotions
    );
    goToStep('compass');
    return true;
  }

  function handleSensationClear() {
    if (sensationChips) {
      sensationChips.querySelectorAll('[data-sensation]').forEach((button) => setChipState(button, false));
    }
    renderSuggestionBlock(
      bodySuggestions,
      'Body-based matches',
      'Your body-based matches will appear here after you choose sensations.',
      []
    );
  }

  function handleSensationSkip() {
    goToStep('compass');
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
    state.quadrant = quadrantKey;
    if (!quadrantKey || !QUADRANT_SUGGESTIONS[quadrantKey]) {
      renderSuggestionBlock(
        compassSuggestions,
        'Emotion compass matches',
        'Pick one energy and one pleasantness option to see suggestions.',
        []
      );
      return;
    }
    const info = QUADRANT_SUGGESTIONS[quadrantKey];
    renderSuggestionBlock(
      compassSuggestions,
      'Emotion compass matches',
      `${info.label}: ${info.description}`,
      info.emotions
    );
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
        <h4 class="emotion-suggestions__title">Needs this feeling may point to</h4>
        <ul class="emotion-detail__list emotion-detail__list--links">${items}</ul>
      </div>
    `;
  }

  function renderRegulationNeeds(needs) {
    const normalized = Array.isArray(needs) && needs.every(isNormalizedNeed) ? needs : normalizeNeeds(needs);
    if (!normalized.length) {
      return '';
    }
    const items = normalized
      .map((need) => {
        const href = need.slug ? `${basePath}needs/${need.slug}/` : `${basePath}needs/`;
        return `<li><a class="regulation-needs__link" href="${href}">${need.label}</a></li>`;
      })
      .join('');
    return `
      <div class="regulation-needs">
        <p class="regulation-needs__title">Need cues to explore</p>
        <ul class="regulation-needs__list">${items}</ul>
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
    updateStepControls();
  }

  function renderRegulationCard(emotion) {
    if (!regulationCard) return;
    const quadrantInfo = state.quadrant ? QUADRANT_SUGGESTIONS[state.quadrant] : null;
    const extraCare = quadrantInfo?.care ? renderListSection(`Support when you feel ${quadrantInfo.label.toLowerCase()}`, quadrantInfo.care) : '';
    const normalizedNeeds = normalizeNeeds(emotion.needs);
    const needsList = renderRegulationNeeds(normalizedNeeds);
    const primaryNeed = normalizedNeeds.length ? normalizedNeeds[0] : null;
    const needsLink = primaryNeed ? `${basePath}needs/${primaryNeed.slug}/` : `${basePath}needs/`;
    const needsButtonLabel = primaryNeed ? `See strategies for ${primaryNeed.label}` : 'Browse basic needs';
    const journalLink = `${basePath}inventory/journal/`;
    regulationCard.innerHTML = `
      <h4 class="emotion-suggestions__title">Support for ${emotion.name}</h4>
      ${renderListSection('Try one of these nurturing steps', emotion.regulation)}
      ${extraCare}
      ${needsList}
      <p class="support-note">Experiment kindly. If none of these help, it simply means your body wants something different today. When you're ready, explore the needs library or add a journal note to track what supports you.</p>
      <div class="regulation-actions">
        <a class="support-button support-button--link" href="${needsLink}">${needsButtonLabel}</a>
        <a class="support-button support-button--link support-button--ghost" href="${journalLink}">Open journal dashboard</a>
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
    const sensations = getSelectedSensations(sensationChips);
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

    const entry = createLaneEntry({
      emotion: emotionValue,
      intensity: data.intensity,
      tags: data.tags,
      notes: trimmedNotes,
      energy: Number.isFinite(state.energyValue) ? state.energyValue : undefined,
      valence: Number.isFinite(state.valenceValue) ? state.valenceValue : undefined,
      sensations: getSelectedSensations(sensationChips),
      needs: mergedNeeds,
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
    const target = event.target.closest('[data-emotion]');
    if (!target) return;
    const emotionKey = target.dataset.emotion;
    renderEmotionDetails(emotionKey, target);
    goToStep('library');
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
    breathingStart?.addEventListener('click', startBreathing);
    breathingSkip?.addEventListener('click', skipBreathing);

    const sensationSubmit = document.querySelector('[data-action="sensation-submit"]');
    const sensationClear = document.querySelector('[data-action="sensation-clear"]');
    const sensationNext = document.querySelector('[data-action="sensation-next"]');
    sensationChips?.addEventListener('click', handleSensationChipClick);
    sensationSubmit?.addEventListener('click', handleSensationSubmit);
    sensationClear?.addEventListener('click', handleSensationClear);
    sensationNext?.addEventListener('click', handleSensationSkip);

    compassRoot?.addEventListener('nvc-compass-change', handleCompassSelection);

    supportFlow?.addEventListener('click', handleStepCtaClick);

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
    const journalClear = document.querySelector('[data-action="journal-clear"]');
    journalClear?.addEventListener('click', handleJournalClear);

    communicationCard?.addEventListener('click', handleCommunicationClick);

    renderSuggestionBlock(
      bodySuggestions,
      'Body-based matches',
      'Your body-based matches will appear here after you choose sensations.',
      []
    );
    renderSuggestionBlock(
      compassSuggestions,
      'Emotion compass matches',
      'Pick one energy and one pleasantness option to see suggestions.',
      []
    );
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
