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
      needs: ['reassurance', 'clarity', 'safety', 'support'],
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
      needs: ['safety', 'reassurance', 'protection'],
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
      needs: ['respect', 'fairness', 'boundaries', 'change'],
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
      needs: ['space', 'support', 'prioritization'],
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
      needs: ['play', 'celebration', 'expression'],
      regulation: ['Channel the spark—dance, share the news, or map out how to savor it.', 'Notice if you also need grounding to rest later.'],
      communication: 'I’m excited and want to celebrate or plan how to enjoy this moment.',
    },
    worry: {
      name: 'Worry',
      definition: 'A steady hum of concern that circles possibilities without resolution.',
      bodySignals: ['Tension behind eyes', 'Fidgeting', 'Tight shoulders'],
      thoughts: ['“Have I missed something?”', '“I should double-check.”'],
      contexts: ['Unfinished tasks', 'Ambiguous feedback', 'Caring deeply about an outcome'],
      needs: ['reassurance', 'information', 'contingency plans'],
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
      needs: ['comfort', 'acknowledgment', 'companionship'],
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
      needs: ['mourning space', 'witnessing', 'ritual'],
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
      needs: ['rest', 'recovery', 'nourishment'],
      regulation: ['Schedule real rest—even 10 minutes counts.', 'Check in with basic care: water, food, movement, sleep.'],
      communication: 'I’m tired and need rest or help sharing responsibilities.',
    },
    lonely: {
      name: 'Lonely',
      definition: 'A signal that you long for connection, understanding, or companionship.',
      bodySignals: ['Ache in the chest', 'Hollow stomach', 'Tears without clear reason'],
      thoughts: ['“No one gets me.”', '“I wish someone were here.”'],
      contexts: ['Being isolated', 'Feeling unseen in a crowd', 'Transitions away from familiar people'],
      needs: ['belonging', 'closeness', 'shared experience'],
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
      needs: ['repair', 'integrity', 'forgiveness'],
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
      needs: ['acceptance', 'empathy', 'self-compassion'],
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
      needs: ['support', 'structure', 'recovery'],
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
      needs: ['movement', 'problem-solving', 'understanding'],
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
      needs: ['gentle curiosity', 'safety', 'time'],
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
      needs: ['stimulation', 'meaning', 'variety'],
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
      needs: ['information', 'play', 'autonomy'],
      regulation: ['Follow the thread—research, ask questions, or experiment safely.', 'Protect time to wander without judging productivity.'],
      communication: 'I’m curious and would like time or resources to explore this further.',
    },
    thoughtful: {
      name: 'Thoughtful',
      definition: 'A reflective mood that turns inward to process meaning or possibilities.',
      bodySignals: ['Soft gaze', 'Slower pace', 'Focus on inner imagery'],
      thoughts: ['“Let me think this through.”', '“How does this fit?”'],
      contexts: ['Making decisions', 'Integrating new insight'],
      needs: ['reflection', 'quiet', 'clarity'],
      regulation: ['Give yourself unhurried space to journal or map ideas.', 'Balance reflection with small grounding breaks.'],
      communication: 'I’m feeling thoughtful and could use space to process before responding.',
    },
    uncertain: {
      name: 'Uncertain',
      definition: 'Not yet sure what to feel or choose because information is incomplete.',
      bodySignals: ['Mixed sensations', 'Alternating tension and release'],
      thoughts: ['“I need more data.”', '“I’m on the fence.”'],
      contexts: ['Facing ambiguous outcomes', 'Transition periods'],
      needs: ['information', 'time', 'guidance'],
      regulation: ['List what you know, what you guess, and what you need to find out.', 'Decide on the next small check-in point.'],
      communication: 'I’m uncertain and need more information or time before committing.',
    },
    determined: {
      name: 'Determined',
      definition: 'Focused drive to push toward a goal despite challenges.',
      bodySignals: ['Tight jaw', 'Forward posture', 'Strong grip'],
      thoughts: ['“I will make this happen.”', '“Keep going.”'],
      contexts: ['Working toward a meaningful goal', 'Protecting someone or something important'],
      needs: ['progress', 'agency', 'support'],
      regulation: ['Channel the drive into a clear action plan.', 'Balance effort with intentional pauses to avoid burnout.'],
      communication: 'I’m feeling determined and would appreciate support or acknowledgement as I work on this.',
    },
    focused: {
      name: 'Focused',
      definition: 'Sharpened attention directed at a task or outcome.',
      bodySignals: ['Steady gaze', 'Still body with poised energy'],
      thoughts: ['“Stay on target.”', '“One step at a time.”'],
      contexts: ['Working through complex tasks', 'Solving a problem'],
      needs: ['clarity', 'minimal distractions', 'completion'],
      regulation: ['Protect your focus window—silence notifications or set a timer.', 'Plan a closing ritual so you can release the task afterward.'],
      communication: 'I’m focused right now and need minimal interruptions until I finish.',
    },
    anticipation: {
      name: 'Anticipation',
      definition: 'Energized readiness for something coming soon—pleasant or uncertain.',
      bodySignals: ['Quickened breath', 'Forward-leaning posture', 'Tingling skin'],
      thoughts: ['“It’s almost time.”', '“I wonder how it will go.”'],
      contexts: ['Waiting for news', 'Preparing for an event'],
      needs: ['preparation', 'information', 'ritual'],
      regulation: ['Channel the build-up into preparation or a grounding routine.', 'Alternate between activity and calming breaths.'],
      communication: 'I’m feeling anticipation and would like support as I get ready.',
    },
    calm: {
      name: 'Calm',
      definition: 'Settled ease when your body senses safety and nothing demands urgent action.',
      bodySignals: ['Even breathing', 'Relaxed muscles', 'Warm, steady presence'],
      thoughts: ['“I can breathe.”', '“I have enough for this moment.”'],
      contexts: ['After soothing connection', 'When needs are met'],
      needs: ['rest', 'stability', 'presence'],
      regulation: ['Savor the calm by breathing slowly or practicing gratitude.', 'Note what supports this state for future reference.'],
      communication: 'I feel calm and grounded, which tells me my needs are met right now.',
    },
    relief: {
      name: 'Relief',
      definition: 'Release of tension after a feared outcome does not happen or support arrives.',
      bodySignals: ['Deep exhale', 'Softening shoulders', 'Warmth spreading'],
      thoughts: ['“It’s over.”', '“I can rest now.”'],
      contexts: ['Receiving good news', 'After a stressful event ends'],
      needs: ['rest', 'celebration', 'integration'],
      regulation: ['Let your body fully exhale and shake out leftover stress.', 'Mark the moment with a small reward or acknowledgement.'],
      communication: 'I’m relieved and want to honor the effort it took to get here.',
    },
    contentment: {
      name: 'Contentment',
      definition: 'Quiet satisfaction when needs feel sufficiently met.',
      bodySignals: ['Soft smile', 'Relaxed belly', 'Balanced posture'],
      thoughts: ['“This is enough for now.”', '“I can enjoy this.”'],
      contexts: ['Simple pleasures', 'Quality time with loved ones', 'Finishing meaningful work'],
      needs: ['appreciation', 'stability', 'belonging'],
      regulation: ['Pause to notice sensory details—savor taste, texture, or scenery.', 'Share gratitude or document what you appreciate.'],
      communication: 'I feel content and grateful for how things are landing right now.',
    },
    hope: {
      name: 'Hope',
      definition: 'A forward-looking belief that improvement or support is possible.',
      bodySignals: ['Light chest', 'Lifted gaze', 'Gentle energy'],
      thoughts: ['“Something good could happen.”', '“There are options.”'],
      contexts: ['Glimpsing new possibilities', 'Receiving encouragement'],
      needs: ['vision', 'support', 'agency'],
      regulation: ['Capture the ideas that spark hope so you can revisit them.', 'Pair hope with one practical next step.'],
      communication: 'I’m feeling hopeful and want to nurture this possibility together.',
    },
    gratitude: {
      name: 'Gratitude',
      definition: 'Warm appreciation for kindness, support, or meaningful experiences.',
      bodySignals: ['Warm chest', 'Soft smile', 'Moist eyes'],
      thoughts: ['“Thank you.”', '“This matters to me.”'],
      contexts: ['Receiving help', 'Noticing beauty', 'Moments of generosity'],
      needs: ['acknowledgment', 'connection', 'celebration'],
      regulation: ['Express thanks aloud, in writing, or through a small gesture.', 'Record the moment so you can revisit it later.'],
      communication: 'I feel grateful and want to express appreciation for what you did.',
    },
    joy: {
      name: 'Joy',
      definition: 'Expansive delight when something deeply meaningful or playful lands well.',
      bodySignals: ['Light, bouncy energy', 'Laughing', 'Sparkling eyes'],
      thoughts: ['“This is wonderful!”', '“I love this.”'],
      contexts: ['Celebrations', 'Shared laughter', 'Creative breakthroughs'],
      needs: ['play', 'connection', 'expression'],
      regulation: ['Amplify the joy—dance, sing, or share it.', 'Snapshot the moment mentally or physically to savor later.'],
      communication: 'I feel joyful and want to celebrate this together.',
    },
    pride: {
      name: 'Pride',
      definition: 'A warm sense of achievement or self-respect after meeting a challenge.',
      bodySignals: ['Expanded chest', 'Lifted chin', 'Steady stance'],
      thoughts: ['“I did it.”', '“I’m proud of myself.”'],
      contexts: ['Finishing a tough task', 'Living your values', 'Showing up bravely'],
      needs: ['recognition', 'self-respect', 'celebration'],
      regulation: ['Name the strengths you used.', 'Share the win with someone who will celebrate with you.'],
      communication: 'I feel proud of what I accomplished and want to mark this success.',
    },
  };

  const JOURNAL_KEY = 'nvcApp.journal';
  const LEGACY_JOURNAL_KEY = 'alexithymiaSupportJournal';
  const state = {
    selectedEmotion: null,
    quadrant: null,
    activeTag: null,
  };

  const startButton = steps.intro?.querySelector('[data-action="start"]');
  const breathingDisplay = document.querySelector('[data-breathing-display]');
  const breathingVisual = document.querySelector('[data-breathing-visual]');
  const bodySuggestions = document.querySelector('[data-body-suggestions]');
  const compassSuggestions = document.querySelector('[data-compass-suggestions]');
  const emotionLibrary = document.querySelector('[data-emotion-library]');
  const journalForm = document.querySelector('[data-journal-form]');
  const journalStatus = document.querySelector('[data-journal-status]');
  const journalHistory = document.querySelector('[data-journal-history]');
  const regulationCard = document.querySelector('[data-regulation-card]');
  const communicationCard = document.querySelector('[data-communication-card]');

  let breathingTimer = null;

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

  function handleStart() {
    revealStep('breathing');
    focusStep('breathing');
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
      revealStep('body');
      focusStep('body');
      return;
    }
    revealStep('body');
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
        focusStep('body');
      }
    }, 1000);
  }

  function skipBreathing() {
    resetBreathingVisual();
    revealStep('body');
    focusStep('body');
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

  function handleSensationSubmit() {
    const form = document.querySelector('[data-sensation-form]');
    if (!form) return;
    const selected = Array.from(form.querySelectorAll('input[name="sensation"]:checked')).map((input) => input.value);
    if (!selected.length) {
      renderSuggestionBlock(
        bodySuggestions,
        'Body-based matches',
        'Try choosing one or two sensations. If nothing stands out, move on to the emotion compass.',
        []
      );
      revealStep('compass');
      focusStep('compass');
      return;
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
    revealStep('compass');
    focusStep('compass');
  }

  function handleSensationClear() {
    const form = document.querySelector('[data-sensation-form]');
    if (!form) return;
    form.reset();
    renderSuggestionBlock(
      bodySuggestions,
      'Body-based matches',
      'Your body-based matches will appear here after you choose sensations.',
      []
    );
  }

  function handleSensationSkip() {
    revealStep('compass');
    focusStep('compass');
  }

  function computeQuadrant(energy, valence) {
    if (!energy || !valence) return null;
    return `${energy}-${valence}`;
  }

  function handleCompassChange(event) {
    const form = event.currentTarget;
    const energy = form.elements.energy?.value;
    const valence = form.elements.valence?.value;
    const quadrantKey = computeQuadrant(energy, valence);
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
    focusStep('library');
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

  function renderNeedLinks(needs) {
    if (!needs || !needs.length) {
      return '';
    }
    const items = needs
      .map((need) => {
        const href = `${basePath}needs/?focus=${encodeURIComponent(need.toLowerCase())}`;
        return `<li><a class="emotion-need-link" href="${href}">${need}</a></li>`;
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
    if (!needs || !needs.length) {
      return '';
    }
    const items = needs
      .map((need) => {
        const href = `${basePath}needs/?focus=${encodeURIComponent(need.toLowerCase())}`;
        return `<li><a class="regulation-needs__link" href="${href}">${need}</a></li>`;
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
  }

  function renderRegulationCard(emotion) {
    if (!regulationCard) return;
    const quadrantInfo = state.quadrant ? QUADRANT_SUGGESTIONS[state.quadrant] : null;
    const extraCare = quadrantInfo?.care ? renderListSection(`Support when you feel ${quadrantInfo.label.toLowerCase()}`, quadrantInfo.care) : '';
    const needsList = renderRegulationNeeds(emotion.needs);
    const primaryNeed = Array.isArray(emotion.needs) && emotion.needs.length ? emotion.needs[0] : '';
    const needsLink = primaryNeed
      ? `${basePath}needs/?focus=${encodeURIComponent(primaryNeed.toLowerCase())}`
      : `${basePath}needs/`;
    const needsButtonLabel = primaryNeed ? `See strategies for ${primaryNeed}` : 'Browse basic needs';
    const journalLink = `${basePath}inventory/#journal-dashboard`;
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
    const need = emotion.needs && emotion.needs.length ? emotion.needs[0] : 'support';
    const template = `I feel ${emotion.name.toLowerCase()} because I need ${need}.`;
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

  function readEntriesFromKey(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === 'object') : [];
    } catch (error) {
      console.warn('Could not read journal entries', error);
      return [];
    }
  }

  function migrateLegacyJournalEntries() {
    if (!LEGACY_JOURNAL_KEY) {
      return;
    }
    try {
      const legacyEntries = readEntriesFromKey(LEGACY_JOURNAL_KEY);
      if (!legacyEntries.length) {
        localStorage.removeItem(LEGACY_JOURNAL_KEY);
        return;
      }
      const currentEntries = readEntriesFromKey(JOURNAL_KEY);
      const signatures = new Set(
        currentEntries.map((entry) => `${entry.timestamp ?? ''}|${(entry.text ?? '').trim()}`)
      );
      let changed = false;
      legacyEntries.forEach((legacy) => {
        if (!legacy || typeof legacy !== 'object') {
          return;
        }
        const text = typeof legacy.text === 'string' ? legacy.text : '';
        const emotion = typeof legacy.emotion === 'string' ? legacy.emotion : legacy.emotion?.key || null;
        const timestamp = legacy.timestamp || legacy.date || legacy.savedAt || null;
        const signature = `${timestamp ?? ''}|${text.trim()}`;
        if (signature && signatures.has(signature)) {
          return;
        }
        const entry = {
          text,
          emotion,
          timestamp: timestamp || new Date().toISOString(),
        };
        currentEntries.push(entry);
        signatures.add(signature);
        changed = true;
      });
      if (changed) {
        currentEntries.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        saveJournalEntries(currentEntries);
      }
      localStorage.removeItem(LEGACY_JOURNAL_KEY);
    } catch (error) {
      console.warn('Unable to migrate legacy journal entries', error);
    }
  }

  function getJournalEntries() {
    return readEntriesFromKey(JOURNAL_KEY);
  }

  function saveJournalEntries(entries) {
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
    } catch (error) {
      console.warn('Could not save journal entries', error);
    }
  }

  function renderJournalHistory(entries) {
    if (!journalHistory) return;
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
      .slice(-5)
      .reverse()
      .forEach((entry) => {
        const item = document.createElement('li');
        item.className = 'journal-history__item';
        const date = new Date(entry.timestamp).toLocaleString();
        const emotion = entry.emotion ? `${EMOTION_LIBRARY[entry.emotion]?.name ?? entry.emotion} — ` : '';
        item.textContent = `${date}: ${emotion}${entry.text}`;
        list.appendChild(item);
      });
    journalHistory.appendChild(list);
    const link = document.createElement('a');
    link.className = 'support-button support-button--link support-button--ghost';
    link.href = `${basePath}inventory/#journal-dashboard`;
    link.textContent = 'Open full journal dashboard';
    journalHistory.appendChild(link);
  }

  function handleJournalSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const textarea = form.querySelector('textarea');
    if (!textarea) return;
    const value = textarea.value.trim();
    if (!value) {
      journalStatus.textContent = 'Add a few words before saving. Even a sentence counts.';
      return;
    }
    const entries = getJournalEntries();
    const entry = {
      text: value,
      emotion: state.selectedEmotion,
      timestamp: new Date().toISOString(),
    };
    entries.push(entry);
    saveJournalEntries(entries);
    renderJournalHistory(entries);
    textarea.value = '';
    journalStatus.textContent = 'Saved locally. Review it anytime in the inventory journal tab.';
  }

  function handleJournalClear() {
    const textarea = journalForm?.querySelector('textarea');
    if (textarea) {
      textarea.value = '';
      journalStatus.textContent = '';
    }
  }

  function handleSuggestionClick(event) {
    const target = event.target.closest('[data-emotion]');
    if (!target) return;
    const emotionKey = target.dataset.emotion;
    renderEmotionDetails(emotionKey, target);
    focusStep('library');
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

  function init() {
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
    sensationSubmit?.addEventListener('click', handleSensationSubmit);
    sensationClear?.addEventListener('click', handleSensationClear);
    sensationNext?.addEventListener('click', handleSensationSkip);

    const compassForm = document.querySelector('[data-compass-form]');
    compassForm?.addEventListener('change', handleCompassChange);

    bodySuggestions?.addEventListener('click', handleSuggestionClick);
    compassSuggestions?.addEventListener('click', handleSuggestionClick);

    if (journalForm) {
      journalForm.addEventListener('submit', handleJournalSubmit);
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
    migrateLegacyJournalEntries();
    renderJournalHistory(getJournalEntries());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
