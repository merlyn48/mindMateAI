/* ================================================================
   MindMate AI — Chatbot Engine  v4.0
   Grounded in Eysenck & Wilson (1976) — A Textbook of Human Psychology

   Key principles applied:
   - Lazarus (1968) Appraisal Theory: stress is shaped by how the
     individual appraises a situation as threatening AND whether they
     feel able to cope. Never assume the source — always ask first.
   - Rogers (1957) Counselling Conditions: empathy, unconditional
     positive regard, and genuineness in every response.
   - Eysenck's neuroticism/arousal model: emotional instability is
     on a spectrum; responses acknowledge individual differences.
   - Martin (Emotions chapter): overt behaviour, physiological signals,
     and subjective experience are all valid — validate all three.
   - Shapiro (Counselling chapter): cognitive clarification of the
     client's problem before offering strategies.
   ================================================================ */

const messageInput     = document.getElementById("messageInput");
const sendBtn          = document.getElementById("sendBtn");
const chatContainer    = document.getElementById("chatContainer");
const typingIndicator  = document.getElementById("typingIndicator");
const newChatBtn       = document.getElementById("newChatBtn");
const historyList      = document.getElementById("historyList");
const themeToggle      = document.getElementById("themeToggle");
const suggestionButtons = document.querySelectorAll(".suggestion-btn");
const welcomeScreen    = document.getElementById("welcomeScreen");

const currentUser = localStorage.getItem("loggedInUser");
const storageKey  = "mindmate_chats_" + currentUser;

function safeParseJSON(val, fallback) {
  try { return val ? JSON.parse(val) : fallback; }
  catch { return fallback; }
}

let chats         = safeParseJSON(localStorage.getItem(storageKey), []);
let currentChatId = null;

/* ================================================================
   INTENT ENGINE — weighted keyword scoring
   Stress intentionally has NO exam bias — source is always explored.
   ================================================================ */
const INTENTS = {
  greeting: {
    threshold: 1,
    patterns: [{ words: ["hi","hello","hey","hiya","howdy","good morning","good evening","good afternoon","how are you","what's up","sup"], w: 2 }]
  },
  goodbye: {
    threshold: 1,
    patterns: [{ words: ["bye","goodbye","see you","take care","gotta go","talk later","cya"], w: 2 }]
  },
  gratitude: {
    threshold: 1,
    patterns: [{ words: ["thank","thanks","thank you","helpful","appreciate","grateful","that helped"], w: 2 }]
  },

  /* STRESS — broad, source-agnostic. Exam words deliberately removed.
     Per Lazarus (1968): stress = perceived threat + low coping appraisal.
     We must first understand WHAT is being appraised as threatening. */
  stress: {
    threshold: 2,
    patterns: [
      { words: ["stressed","stress","overwhelmed","overwhelm","pressure","tense","on edge","burnt out","burnout","too much","can't cope","breaking down"], w: 3 },
      { words: ["deadline","workload","behind","piling up","juggling","responsibility","expectations"], w: 2 },
      { words: ["family","relationship","work","job","money","health","future","change","loss"], w: 1 },
    ]
  },

  /* EXAM STRESS — only triggered when user explicitly mentions academic context */
  exam_stress: {
    threshold: 3,
    patterns: [
      { words: ["exam","exams","test","tests","assessment","quiz","finals","midterm","viva"], w: 3 },
      { words: ["study","studying","revise","revision","syllabus","notes","lecture","marks","grade","score","results","fail","failing"], w: 2 },
    ]
  },

  anxiety: {
    threshold: 2,
    patterns: [
      { words: ["anxious","anxiety","panic","panicking","nervous","nervousness","dread"], w: 3 },
      { words: ["overthink","overthinking","racing thoughts","mind won't stop","can't stop thinking"], w: 3 },
      { words: ["worried","worry","worrying","fear","scared","what if"], w: 2 },
      { words: ["heart racing","chest tight","can't breathe","shaking","trembling","sweating"], w: 3 },
      { words: ["restless","uneasy","tense","on edge"], w: 1 },
    ]
  },

  sadness: {
    threshold: 2,
    patterns: [
      { words: ["sad","sadness","unhappy","upset","down","low","blue","miserable"], w: 3 },
      { words: ["depressed","depression","hopeless","worthless","empty","numb","hollow"], w: 3 },
      { words: ["lonely","alone","isolated","no one","no friends","nobody cares"], w: 2 },
      { words: ["cry","crying","cried","tears","weeping"], w: 2 },
      { words: ["give up","what's the point","pointless","don't care anymore","nothing matters"], w: 3 },
    ]
  },

  sleep: {
    threshold: 2,
    patterns: [
      { words: ["sleep","sleeping","insomnia","can't sleep","sleepless","no sleep"], w: 3 },
      { words: ["tired","exhausted","fatigue","worn out","drained","no energy","groggy"], w: 2 },
      { words: ["bed","bedtime","awake","wake up","waking up","lying awake","3am","middle of the night"], w: 2 },
      { words: ["nightmare","bad dreams","dream","restless sleep","light sleeper"], w: 2 },
      { words: ["sleep schedule","routine","melatonin","nap","oversleeping"], w: 2 },
    ]
  },

  motivation: {
    threshold: 2,
    patterns: [
      { words: ["motivated","motivation","unmotivated","no motivation","lazy","procrastinat"], w: 3 },
      { words: ["can't start","stuck","lost","don't know where to start","paralysed"], w: 2 },
      { words: ["want to quit","feel like giving up","what's the point"], w: 2 },
      { words: ["productive","productivity","focus","concentrate","distracted","scattered"], w: 2 },
      { words: ["goal","purpose","direction","ambition","drive"], w: 2 },
    ]
  },

  career: {
    threshold: 2,
    patterns: [
      { words: ["career","job","work","profession","field","internship","placement"], w: 3 },
      { words: ["future","path","direction","what to do","confused about","don't know what"], w: 2 },
      { words: ["course","degree","major","subject","choose","switch"], w: 2 },
      { words: ["interview","resume","cv","apply","opportunity"], w: 2 },
      { words: ["passion","interest","talent","skill","strength","calling"], w: 1 },
    ]
  },
};

function scoreIntent(text, key) {
  const lower = text.toLowerCase();
  let score = 0;
  INTENTS[key].patterns.forEach(p => {
    p.words.forEach(w => { if (lower.includes(w)) score += p.w; });
  });
  return score;
}

function detectIntent(text) {
  let best = { key: "unknown", score: 0 };
  Object.keys(INTENTS).forEach(key => {
    const score = scoreIntent(text, key);
    if (score >= INTENTS[key].threshold && score > best.score) best = { key, score };
  });
  return best.key;
}

function wantsTopicSwitch(text) {
  const lower = text.toLowerCase();
  return ["actually","change topic","something else","different topic",
    "never mind","forget it","move on","can we talk about","instead","switch"].some(p => lower.includes(p));
}

function isFollowUp(text) {
  const t = text.trim().toLowerCase();
  return t.length < 30 || /^(yes|no|ok|okay|sure|nope|yeah|yep|nah|maybe|not really|kind of|i think so|i don't know|idk|hmm|i guess|please|go on|tell me|how|what|why|both|all of it|everything)/.test(t);
}

/* ================================================================
   RESPONSE BANKS
   Stress responses use open appraisal questions (Lazarus 1968).
   All openers follow Rogers' empathy + unconditional positive regard.
   ================================================================ */
const R = {
  greeting:  [
    "Hi there 🌿 I'm really glad you're here. How are you feeling today?",
    "Hello! It's good to see you. What's been on your mind lately?",
    "Hey 😊 I'm here and I'm listening. How's your day going so far?"
  ],
  goodbye:   [
    "Take care of yourself 💜 I'm always here when you need to talk.",
    "Goodbye for now 🌿 Remember to be kind to yourself today.",
    "See you soon. You're doing better than you think 😊"
  ],
  gratitude: [
    "You're so welcome 🌱 I'm really glad I could help even a little.",
    "Anytime — that's what I'm here for. Take things one step at a time 💜",
    "It means a lot to hear that. I'm always here whenever you need me."
  ],

  /* STRESS — source-open responses based on Lazarus appraisal model.
     First response always asks WHAT is causing the stress before assuming. */
  stress: {
    opener: [
      "I hear you — feeling overwhelmed is really hard. Before anything else, can you tell me a bit about what's been weighing on you? Sometimes stress comes from so many different places, and I want to make sure I understand yours.",
      "That sounds really heavy, and I'm glad you're talking about it. Stress can come from so many directions — work, relationships, health, the future, or just life feeling like too much at once. What does it feel like it's mostly coming from for you right now?",
    ],
    /* Source-specific follow-ups — triggered by what the user says the cause is */
    relationships: [
      "Relationship stress can be some of the hardest to carry because it touches our sense of belonging and security. Is this something that's been building for a while, or did something specific happen recently?",
      "When people we care about are a source of stress, it can feel like there's nowhere safe to land. What's been happening — is this with someone close to you?",
    ],
    work_or_life: [
      "It sounds like life is piling a lot on you right now. When everything feels urgent at once, it becomes almost impossible to know where to start. What feels like the heaviest thing to carry today?",
      "That kind of pressure — where it just keeps building — is genuinely exhausting. Is there one specific thing that feels most unmanageable right now, or is it more the sheer weight of everything together?",
    ],
    physical: [
      "Stress that shows up in your body — tension, exhaustion, that restless feeling — is your nervous system signalling it's had enough. Have you noticed any physical signs like that? Tight shoulders, trouble sleeping, a racing heart?",
      "When stress becomes physical, it's a sign your mind and body really need some relief. Have you been able to rest at all, or does it feel relentless?",
    ],
    coping: [
      "One thing that really helps when everything feels like too much is narrowing your focus to just one thing — not the whole picture, just the very next step. Is there one small thing that would make today feel even slightly more manageable?",
      "It can help to ask yourself: is this something I can change, or something I need to accept for now? That distinction — from Lazarus's work on coping — often helps people figure out where to direct their energy. What does it feel like for you?",
    ],
    encouragement: [
      "The fact that you're here and talking about it already means you're not just absorbing it silently — that takes something. What's one thing that has helped you get through a difficult stretch before?",
      "You're dealing with a lot, and it makes sense that you're feeling it. You don't have to have it all figured out right now 💜 What would feel like a safe first step?",
    ],
  },

  exam_stress: {
    opener: [
      "Exam pressure is really tough, and it's okay to feel overwhelmed by it. What's weighing on you the most — the workload, a specific subject, not feeling prepared, or just the pressure of it all?",
      "I hear you. Exams can make everything feel urgent and heavy all at once. What's the biggest thing you're struggling with right now?"
    ],
    workload: [
      "When the syllabus feels endless, breaking it into tiny pieces helps. What if you focused on just one topic today — which subject feels most manageable to start?",
      "A huge workload can feel paralysing. Try listing just 3 things you want to cover today — nothing more. Small wins build momentum 📝"
    ],
    focus: [
      "Losing focus under stress is very common — it's your mind's arousal level getting in the way of concentration. The Pomodoro method really helps: 25 minutes focused, then a 5-minute break. Have you tried anything like that?",
      "When focus slips, your environment matters a lot. Is there something around you pulling your attention away — phone, noise, people?"
    ],
    distraction: [
      "Phones are incredibly hard to resist when studying feels difficult. Try putting yours in another room during study time — even 25 minutes. Does that feel doable?",
      "Even placing your phone face-down across the room makes a real difference. Want to try that during your next session?"
    ],
    encouragement: [
      "You're putting in the effort just by talking about this — that counts for something. What's one thing you've already understood well this week?",
      "Remember: you don't need to be perfect, you just need to keep going 💜 What subject are you tackling next?"
    ],
  },

  anxiety: {
    opener: [
      "Anxiety can feel so overwhelming, and I want you to know you're not alone in this. Can you tell me what's making you feel anxious right now — is it something specific, or more a general sense of dread?",
      "That sounds really hard. I'm here with you. Is there something particular on your mind, or is it more like a background hum of unease that won't go away?"
    ],
    grounding: [
      "Let's try something together right now. Look around and name 3 things you can see, 2 things you can touch, and 1 thing you can hear. Take your time — there's no rush 🌿",
      "Try this: breathe in slowly for 4 counts, hold for 4, breathe out for 6. It activates your parasympathetic nervous system and signals to your body that you're safe. Want to try it with me?"
    ],
    breathing: [
      "Slow breathing is one of the most powerful things you can do right now. Try: in for 4 seconds, hold for 4, out for 6. Repeat 3 times. How do you feel after?",
      "When anxiety spikes, breathing gets shallow — and that actually makes the anxiety worse. Take one long slow breath right now. Just one. Did that help even a little?"
    ],
    physical: [
      "Physical symptoms like a racing heart are your autonomic nervous system's stress response — uncomfortable, but not dangerous. Try placing one hand on your chest and breathing slowly into it.",
      "Cold water on your wrists or face can calm your nervous system quickly. It sounds odd but it genuinely works for a lot of people. Have you tried anything like that?"
    ],
    reassurance: [
      "What you're feeling is real. Anxiety is your mind trying to protect you, even when it overcorrects. You're not broken — you're human, and this is your nervous system doing its job 💜",
      "It's okay to feel this way. A lot of people experience exactly this. Just one moment at a time — you don't have to solve everything right now."
    ],
  },

  sadness: {
    opener: [
      "I'm really sorry you're feeling this way 💜 You don't have to carry it alone. Do you want to tell me a little about what's been going on?",
      "That sounds really painful. I'm here to listen — all of it, whatever you want to share. What's been happening?"
    ],
    loneliness: [
      "Feeling lonely is one of the hardest experiences there is — it can exist even in a crowd. Is there anyone in your life, even one person, you feel even slightly comfortable with?",
      "Loneliness can feel invisible from the outside, but it's very real and heavy. When did you start feeling this disconnected?"
    ],
    hopelessness: [
      "When things feel hopeless, even small steps feel impossible. But the fact that you're here and talking means part of you wants things to be different — and that part matters 💜",
      "Hopelessness often comes after trying really hard for a long time without enough support. You deserve more support than you've been getting."
    ],
    crisis: "I'm really grateful you told me that, and I want you to know I'm taking it seriously 💜 You don't have to face this alone. Please reach out to iCall (India): 9152987821, or Vandrevala Foundation: 1860-2662-345. They're caring, non-judgmental people who can help right now. Are you safe at this moment?",
    gentle_check: [
      "I want to gently check in — are you having any thoughts of hurting yourself? It's okay to tell me honestly. I won't judge you, and I'm not going anywhere.",
      "I hear how much pain you're in. Sometimes when we feel this low, dark thoughts can come up. Is that happening for you at all?"
    ],
    encouragement: [
      "Even on days when everything feels grey, you are still worth caring for. Is there anything — even something very small — that brought you a moment of comfort recently?",
      "You reached out today and that takes real courage. These feelings do lift with time and the right support 💜"
    ],
  },

  sleep: {
    opener: [
      "Sleep trouble affects everything — mood, focus, emotional regulation, energy. Is it more that you can't fall asleep, or that you wake up during the night and can't get back?",
      "Not sleeping well is exhausting in a way that's hard to describe to someone who hasn't been through it. What's been happening — do you lie awake thinking, or do you wake up too early?"
    ],
    cant_sleep: [
      "When you can't switch your mind off, try writing everything on your mind before bed — it tells your brain the thoughts have been 'noted' and can rest. Would you try that tonight?",
      "Racing thoughts at bedtime are really common but so frustrating. Keeping your phone out of the bedroom helps — blue light suppresses melatonin and keeps your brain in alert mode. Have you tried that?"
    ],
    routine: [
      "Going to bed and waking up at the same time — even on weekends — helps reset your circadian rhythm. What does your current bedtime look like?",
      "A wind-down routine signals to your brain that it's safe to rest: dim lights, no screens 30 minutes before bed, maybe calm music or reading. What feels realistic for you to try?"
    ],
    tired: [
      "Feeling exhausted even after sleeping often means sleep quality is the issue, not just quantity. Are you waking up feeling rested at all, or does it feel like you never really switched off?",
      "Daytime exhaustion can spiral — too tired to focus, stressed about that, then too anxious to sleep at night. Let's try to interrupt that cycle. What's the hardest part of your day energy-wise?"
    ],
    nightmares: [
      "Nightmares often show up when we're processing stress or something emotionally unresolved. Are the dreams connected to anything going on in your life right now?",
      "Bad dreams can make you start dreading sleep altogether. Grounding yourself before bed — slow breathing, journalling, a calm routine — can sometimes help reduce them."
    ],
    encouragement: [
      "Sleep struggles are genuinely hard on both mind and body. Even one small change tonight can start shifting things 🌙",
      "You deserve proper rest — it's not a luxury, it's essential for emotional regulation and wellbeing. What small step feels doable for tonight?"
    ],
  },

  motivation: {
    opener: [
      "Feeling unmotivated is so common — and it often means you're running on empty, not that you're lazy. There's an important difference. What does your day-to-day feel like right now?",
      "Motivation is interesting — it rarely comes before we start, it usually shows up after. What's the one thing you've been putting off the most lately?"
    ],
    procrastination: [
      "Procrastination is almost always about anxiety or emotional avoidance, not laziness. We put things off because they feel threatening in some way. What feels scary or heavy about starting?",
      "The hardest part is almost always the first two minutes. Try just 5 minutes on the task — set a timer. Often once you're in it, it flows. What have you been avoiding?"
    ],
    no_goal: [
      "Feeling lost without a clear direction is really disorienting. Try thinking smaller — not 'what's my life purpose' but 'what's one thing I want to feel proud of this week'?",
      "Purpose doesn't have to be one grand thing. What's something that used to make you feel alive, even something small or seemingly unimportant?"
    ],
    burnout: [
      "What you're describing sounds like genuine burnout. When did you last do something just for enjoyment, with absolutely no productivity attached?",
      "Burnout is your mind and body saying they need a real break — not a productive break, an actual one. Rest isn't wasted time. What would genuine rest look like for you?"
    ],
    encouragement: [
      "The fact that you want to feel motivated tells me there's still drive in you — it's just buried under pressure and exhaustion. What's something you've done recently that you're even slightly proud of?",
      "You don't need to feel motivated to take one small step. Action creates motivation, not the other way around 💜 What's the smallest possible thing you could do today?"
    ],
  },

  career: {
    opener: [
      "Career uncertainty is one of the most anxiety-inducing things — and you're definitely not alone in feeling this way. What's the part you're most confused or worried about right now?",
      "Figuring out your path can feel like everyone else has a map and you don't. What are you currently studying or doing, and how do you feel about it honestly?"
    ],
    confused: [
      "Not knowing what you want to do is very normal at this stage — most people change direction several times. What are the things that make time feel like it goes faster for you?",
      "Sometimes clarity comes from ruling things out first. What's something you already know you don't want to do — even if you can't articulate why?"
    ],
    pressure: [
      "Family or societal pressure around careers is real and heavy. Setting that aside completely for a moment — what do you actually want, in your own honest voice?",
      "The pressure to have everything figured out at your age is genuinely unfair. Most adults are still figuring it out too. What feels true to you, even if it's just a small thing?"
    ],
    skills: [
      "What do people tend to come to you for help with? What do you find yourself doing without being asked? Those are often real clues about where your strengths lie.",
      "Where your natural strengths and genuine interests overlap is often a useful starting point. What do you feel you're naturally decent at, even if it seems small or ordinary?"
    ],
    encouragement: [
      "Career paths rarely look like straight lines — and that's completely okay. Asking questions like you're doing now is exactly the right move 💜",
      "You're thinking about this seriously, which is more than a lot of people do. That thoughtfulness is itself a real strength."
    ],
  },

  unknown: [
    "I hear you. Can you tell me a little more about what's going on? I want to make sure I understand properly.",
    "That sounds like it matters to you. Can you share a bit more about what you mean?",
    "I'm listening 🌿 What's been on your mind the most lately?",
    "Tell me more — I want to understand what you're going through."
  ],
};

/* Non-repeating pick — exhausts all options before cycling,
   and never starts the next cycle with the same item it ended on */
const _queues = {};
function pick(arr, key) {
  if (!Array.isArray(arr)) return arr;
  if (arr.length === 1) return arr[0];
  if (!_queues[key] || _queues[key].length === 0) {
    /* Shuffle all indices */
    const indices = arr.map((_, i) => i).sort(() => Math.random() - 0.5);
    /* Avoid starting new cycle with last used item */
    const lastUsed = _queues[key + '_last'];
    if (lastUsed !== undefined && indices[0] === lastUsed && indices.length > 1) {
      [indices[0], indices[1]] = [indices[1], indices[0]];
    }
    _queues[key] = indices;
  }
  const idx = _queues[key].shift();
  _queues[key + '_last'] = idx;
  return arr[idx];
}

/* ================================================================
   CASUAL / FILLER DETECTOR
   Handles "lol", "haha", "ok", "hmm", emojis, etc. naturally
   without derailing the conversation topic.
   ================================================================ */
const CASUAL_PATTERNS = [
  { re: /^(lol|lmao|lmfao|haha|hehe|hihi|😂|🤣|😆|xd|xD)[\s!.]*$/i,
    replies: [
      "😄 Haha! A little laughter helps too, you know.",
      "Ha! Good to see you smiling 😄 How are you feeling though?",
      "😄 Well at least we can laugh a little! Seriously though — how are you doing?",
    ]
  },
  { re: /^(ok|okay|k|kk|sure|alright|aight|yep|yup|yeah|ya|yes|👍|✅)[\s!.]*$/i,
    replies: [
      "Great 🌿 Tell me more whenever you're ready.",
      "I'm here whenever you want to continue.",
      "No rush — take your time 💜",
    ]
  },
  { re: /^(no|nope|nah|na|not really|😐|🙁|😶)[\s!.]*$/i,
    replies: [
      "That's okay. What would feel right to talk about?",
      "No worries — I'm here either way 🌿",
      "Alright, no pressure. What's on your mind?",
    ]
  },
  { re: /^(hmm+|hm+|umm+|um+|erm+|uhh+|idk|i don'?t know|not sure|dunno)[\s!.?]*$/i,
    replies: [
      "Take your time — there's no rush here 🌿",
      "That's okay, we can figure it out together. What feels closest to what you're experiencing?",
      "It's fine not to have the words yet. Just say whatever comes naturally.",
    ]
  },
  { re: /^(wow|omg|oh my|oh no|oh|ah|whoa|woah|damn|seriously|really\??)[\s!.]*$/i,
    replies: [
      "Yeah, it can be a lot to take in. How are you feeling right now?",
      "I hear you. Want to talk through it?",
      "Tell me more — what's going through your mind?",
    ]
  },
  { re: /^(thanks?|thank you|thx|ty|tysm|appreciate it|👏|🙏)[\s!.]*$/i,
    replies: [
      "Always here for you 💜 Is there anything else on your mind?",
      "Of course 🌿 You deserve the support.",
      "Anytime. Take good care of yourself 💜",
    ]
  },
  { re: /^[😊🙂😀😁😃😄🥰😍🤗💜💙💚💛🧡❤️🌿✨⭐🌸🌺]+$/,
    replies: [
      "💜 Sending that warmth right back to you.",
      "🌿 Always here.",
      "😊 That made my day. How are you feeling?",
    ]
  },
  { re: /^(\.+|\?+|!+|…+)$/,
    replies: [
      "Take your time 🌿 I'm not going anywhere.",
      "No rush — whenever you're ready.",
      "I'm here. Just say whatever feels right.",
    ]
  },
];

function isCasual(text) {
  const t = text.trim();
  for (const p of CASUAL_PATTERNS) {
    if (p.re.test(t)) return p.replies;
  }
  return null;
}

/* ================================================================
   MAIN REPLY GENERATOR
   ================================================================ */
/* state is now per-chat only — stored in sessionStorage keyed by chatId */

function generateReply(text, state) {
  const lower    = text.toLowerCase().trim();
  const intent   = detectIntent(text);
  const followUp = isFollowUp(text);
  const switching = wantsTopicSwitch(text);

  /* Handle casual/filler messages first — keep conversation light */
  const casualReplies = isCasual(text);
  if (casualReplies) return pick(casualReplies, "casual_" + text.trim().toLowerCase().replace(/\W/g,""));

  if (intent === "goodbye")  { state.topic = null; state.turn = 0; return pick(R.goodbye, "bye"); }
  if (intent === "gratitude") return pick(R.gratitude, "grat");
  if (intent === "greeting" && !state.topic) return pick(R.greeting, "greet");

  if (intent !== "unknown" && intent !== "greeting" && intent !== "gratitude") {
    if (!state.topic || switching) {
      state.topic = intent; state.turn = 0;
    } else if (intent !== state.topic && !followUp) {
      const names = {
        stress: "what's been stressing you", exam_stress: "exams",
        anxiety: "anxiety", sadness: "how you're feeling",
        sleep: "sleep", motivation: "motivation", career: "career"
      };
      state.turn++;
      return `I want to make sure we finish talking about ${names[state.topic] || "this"} first — it sounds important. But I also hear that ${names[intent] || "that"} is on your mind. Shall we stay here, or would you like to switch?`;
    }
  }

  if (!state.topic) return pick(R.unknown, "unk");

  state.turn++;
  const r = R[state.topic];

  switch (state.topic) {

    case "stress":
      if (state.turn === 1) return pick(r.opener, "st_op");
      // After the opener, try to identify the source from what they say
      if (lower.match(/relationship|partner|friend|family|parents|siblings|colleague|someone|people/))
        return pick(r.relationships, "st_rel");
      if (lower.match(/work|job|uni|college|school|deadline|project|assignment|money|finances|health|body/))
        return pick(r.work_or_life, "st_wol");
      if (lower.match(/tense|tight|headache|stomach|chest|heart|physical|body|tired|exhausted|can't breathe/))
        return pick(r.physical, "st_phy");
      if (lower.match(/help|what do i do|how do i|tips|advice|cope|manage|deal/))
        return pick(r.coping, "st_cop");
      return pick(r.encouragement, "st_enc");

    case "exam_stress":
      if (state.turn === 1) return pick(r.opener, "ex_op");
      if (lower.match(/phone|social media|instagram|tiktok|youtube|scroll/)) return pick(r.distraction, "ex_dis");
      if (lower.match(/focus|concentrat|keep losing|attention|can't focus/)) return pick(r.focus, "ex_foc");
      if (lower.match(/syllabus|so much|too much|a lot|chapters|heavy|overwhelm|don't know where/)) return pick(r.workload, "ex_wk");
      if (lower.match(/pomodoro|technique|tip|strategy|method|how do i|what should/))
        return "The Pomodoro Technique is great — 25 minutes focused, then a 5-minute break. After 4 rounds, take a longer break. It works because it matches your brain's natural attention cycle. Want more study tips?";
      return pick(r.encouragement, "ex_enc");

    case "anxiety":
      if (state.turn === 1) return pick(r.opener, "anx_op");
      if (lower.match(/breath|breathing|can't breathe|chest|heart racing/)) return pick(r.breathing, "anx_br");
      if (lower.match(/ground|technique|something to do|help me now|right now|calm down/)) return pick(r.grounding, "anx_gr");
      if (lower.match(/shak|tremble|sweat|physical|body|dizzy/)) return pick(r.physical, "anx_ph");
      return pick(r.reassurance, "anx_re");

    case "sadness":
      if (state.turn === 1) return pick(r.opener, "sad_op");
      if (lower.match(/hurt myself|end it|disappear|don't want to be here|suicid|self.harm|self harm|not worth it/))
        return r.crisis;
      if (lower.match(/alone|lonely|no one|nobody|isolated|no friends|left out/)) return pick(r.loneliness, "sad_lo");
      if (lower.match(/hopeless|pointless|what's the point|nothing matters|give up|no point/)) return pick(r.hopelessness, "sad_ho");
      if (state.turn >= 3 && state.turn % 3 === 0) return pick(r.gentle_check, "sad_gc");
      return pick(r.encouragement, "sad_en");

    case "sleep":
      if (state.turn === 1) return pick(r.opener, "sl_op");
      if (lower.match(/can't sleep|won't sleep|lie awake|fall asleep|taking ages|hours awake|3am|4am/)) return pick(r.cant_sleep, "sl_cs");
      if (lower.match(/routine|schedule|same time|habit|wind down/)) return pick(r.routine, "sl_ro");
      if (lower.match(/tired|exhausted|no energy|drained|still tired|waking up tired|groggy/)) return pick(r.tired, "sl_ti");
      if (lower.match(/nightmare|bad dream|dream|wake up scared|night terror/)) return pick(r.nightmares, "sl_nm");
      return pick(r.encouragement, "sl_en");

    case "motivation":
      if (state.turn === 1) return pick(r.opener, "mo_op");
      if (lower.match(/procrastinat|putting off|keep delaying|avoiding|can't start|can't begin|keep scrolling/)) return pick(r.procrastination, "mo_pr");
      if (lower.match(/don't know what|no direction|lost|no goal|no purpose|what's the point/)) return pick(r.no_goal, "mo_ng");
      if (lower.match(/burnt out|burnout|exhausted|can't anymore|too much|done|finished|depleted/)) return pick(r.burnout, "mo_bu");
      return pick(r.encouragement, "mo_en");

    case "career":
      if (state.turn === 1) return pick(r.opener, "ca_op");
      if (lower.match(/confused|don't know|no idea|lost|unsure|uncertain|clueless/)) return pick(r.confused, "ca_co");
      if (lower.match(/pressure|parents|family|expect|supposed to|society|they want/)) return pick(r.pressure, "ca_pr");
      if (lower.match(/skill|good at|strength|talent|what am i|what can i|naturally/)) return pick(r.skills, "ca_sk");
      return pick(r.encouragement, "ca_en");

    default:
      return pick(R.unknown, "unk");
  }
}

/* ================================================================
   AI WRAPPER — restores state, adds 3-second typing delay
   ================================================================ */
async function getAIReply(userMessage, chatId) {
  /* Load this chat's own state — completely isolated from other chats */
  const state = safeParseJSON(sessionStorage.getItem("mm_state_" + chatId), { topic: null, turn: 0 });

  const reply = generateReply(userMessage, state);

  /* Save updated state back under this chat's key only */
  sessionStorage.setItem("mm_state_" + chatId, JSON.stringify({ topic: state.topic, turn: state.turn }));

  await new Promise(resolve => setTimeout(resolve, 3000));
  return reply;
}

/* ================================================================
   SMART CHAT TITLE (2–3 words)
   ================================================================ */
function generateChatTitle(userMessage) {
  const lower = userMessage.toLowerCase();
  if (lower.match(/exam|test|study|revision|finals|midterm/))   return "Exam Stress";
  if (lower.match(/anxious|anxiety|panic|overthink|worry/))     return "Feeling Anxious";
  if (lower.match(/sad|depress|hopeless|lonely|crying|empty/))  return "Low Mood";
  if (lower.match(/sleep|insomnia|tired|nightmare|exhausted/))  return "Sleep Issues";
  if (lower.match(/motivat|procrastin|lazy|stuck|focus/))       return "Motivation Help";
  if (lower.match(/career|job|degree|future|internship/))       return "Career Guidance";
  if (lower.match(/stress|overwhelm|pressure|burnout/))         return "Feeling Stressed";

  const stopwords = new Set(["i","am","im","i'm","a","an","the","is","are","was","were",
    "be","been","being","have","has","had","do","does","did","will","would","could","should",
    "can","may","might","shall","to","of","in","on","at","by","for","with","about","so","and",
    "but","or","not","just","really","very","too","also","how","what","why","when","help","please"]);

  const words = userMessage.replace(/[^\w\s]/g, "").split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w.toLowerCase()));

  if (words.length >= 2) return words.slice(0, 3).join(" ");
  if (words.length === 1) return words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return "New Chat";
}

/* ================================================================
   CHAT ENGINE
   ================================================================ */

/* Topic openers triggered by dashboard cards */
const TOPIC_OPENERS = {
  stress:     "I've been feeling really stressed and overwhelmed lately. Can you help me with some grounding techniques?",
  motivation: "I've been struggling with motivation and can't seem to get things done. I really need some help.",
  sleep:      "I've been having a lot of trouble sleeping lately. My mind just won't switch off at night.",
};

window.onload = () => {
  renderChatList();

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    if (themeToggle) themeToggle.textContent = "☀️ Light Mode";
  } else {
    if (themeToggle) themeToggle.textContent = "🌙 Dark Mode";
  }

  const params = new URLSearchParams(window.location.search);
  const topic  = params.get("topic");

  if (topic === "new") {
    createNewChat();
    history.replaceState(null, "", "index.html");
  } else if (topic && TOPIC_OPENERS[topic]) {
    createNewChat();
    setTimeout(() => {
      if (messageInput) {
        messageInput.value = TOPIC_OPENERS[topic];
        sendMessage();
        history.replaceState(null, "", "index.html");
      }
    }, 150);
  } else {
    if (chats.length > 0) loadChat(chats[0].id);
  }
};

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    document.documentElement.classList.toggle("dark-mode", isDark);
    themeToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

function saveChats() {
  try { localStorage.setItem(storageKey, JSON.stringify(chats)); }
  catch { showToast("Storage full — older chats may not save", "error"); }
}

if (newChatBtn) newChatBtn.addEventListener("click", createNewChat);

function createNewChat() {
  const chat = { id: "chat_" + Date.now(), name: "New Chat", messages: [] };
  chats.unshift(chat);
  currentChatId = chat.id;
  saveChats();
  renderChatList();
  loadChat(chat.id);
}

function loadChat(chatId) {
  currentChatId = chatId;
  if (!chatContainer) return;
  chatContainer.innerHTML = "";
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  if (welcomeScreen) welcomeScreen.style.display = chat.messages.length === 0 ? "block" : "none";
  chat.messages.forEach(msg => createMessage(msg.text, msg.sender, msg.timestamp, false));
  renderChatList();
}

function renderChatList() {
  if (!historyList) return;
  historyList.innerHTML = "";
  chats.forEach(chat => {
    const li = document.createElement("li");
    li.classList.add("chat-item");
    if (chat.id === currentChatId) li.classList.add("active-chat");

    const title = document.createElement("span");
    title.className = "chat-title";
    title.textContent = chat.name;
    title.onclick = () => loadChat(chat.id);

    const actions = document.createElement("div");
    actions.className = "chat-actions";

    const rb = document.createElement("button");
    rb.textContent = "✏"; rb.title = "Rename";
    rb.setAttribute("aria-label", "Rename chat");
    rb.onclick = e => { e.stopPropagation(); showRenameModal(chat.id); };

    const db = document.createElement("button");
    db.textContent = "🗑"; db.title = "Delete";
    db.setAttribute("aria-label", "Delete chat");
    db.onclick = e => { e.stopPropagation(); showDeleteModal(chat.id); };

    actions.appendChild(rb);
    actions.appendChild(db);
    li.appendChild(title);
    li.appendChild(actions);
    historyList.appendChild(li);
  });
}

function showRenameModal(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  showModal({
    title: "Rename Chat", input: true, inputValue: chat.name, confirmLabel: "Rename",
    onConfirm: (val) => {
      if (!val.trim()) return;
      chat.name = val.trim().substring(0, 60);
      saveChats(); renderChatList();
    }
  });
}

function showDeleteModal(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  showModal({
    title: "Delete Chat",
    message: `Delete "${chat.name}"? This cannot be undone.`,
    confirmLabel: "Delete", danger: true,
    onConfirm: () => {
      chats = chats.filter(c => c.id !== chatId);
      sessionStorage.removeItem("mm_state_" + chatId);
      currentChatId = chats.length > 0 ? chats[0].id : null;
      if (!currentChatId) {
        if (chatContainer) chatContainer.innerHTML = "";
        if (welcomeScreen) welcomeScreen.style.display = "block";
      }
      saveChats(); renderChatList();
      if (currentChatId) loadChat(currentChatId);
    }
  });
}

function showModal({ title, message, input, inputValue = "", confirmLabel = "OK", danger = false, onConfirm }) {
  document.getElementById("mm-modal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "mm-modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;display:flex;align-items:center;justify-content:center;animation:fadeIn .15s ease;";

  const box = document.createElement("div");
  box.style.cssText = "background:var(--c-surface);border:1px solid var(--c-border);border-radius:16px;padding:28px 30px;width:320px;max-width:90vw;box-shadow:var(--shadow-lg);animation:slideUp .2s var(--ease-spring);";

  const h = document.createElement("h3");
  h.textContent = title;
  h.style.cssText = "margin-bottom:12px;font-size:16px;font-weight:600;";
  box.appendChild(h);

  if (message) {
    const p = document.createElement("p");
    p.textContent = message;
    p.style.cssText = "font-size:14px;color:var(--c-muted);margin-bottom:18px;";
    box.appendChild(p);
  }

  let inputEl = null;
  if (input) {
    inputEl = document.createElement("input");
    inputEl.value = inputValue;
    inputEl.style.cssText = "width:100%;padding:10px 14px;border-radius:8px;border:1.5px solid var(--c-border);background:var(--c-bg);color:var(--c-text);font-size:14px;font-family:inherit;outline:none;margin-bottom:18px;";
    inputEl.addEventListener("focus", () => { inputEl.style.borderColor = "var(--c-accent)"; });
    inputEl.addEventListener("blur",  () => { inputEl.style.borderColor = "var(--c-border)"; });
    box.appendChild(inputEl);
  }

  const btns = document.createElement("div");
  btns.style.cssText = "display:flex;gap:10px;justify-content:flex-end;";

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.style.cssText = "padding:9px 18px;border-radius:8px;border:1px solid var(--c-border);background:transparent;color:var(--c-muted);font-size:13px;font-family:inherit;cursor:pointer;";
  cancel.onclick = () => overlay.remove();

  const confirm = document.createElement("button");
  confirm.textContent = confirmLabel;
  confirm.style.cssText = `padding:9px 18px;border-radius:8px;border:none;font-size:13px;font-family:inherit;cursor:pointer;font-weight:500;color:white;background:${danger ? "#ef4444" : "linear-gradient(135deg,var(--c-accent),var(--c-accent2))"};`;
  confirm.onclick = () => { const val = inputEl ? inputEl.value : ""; overlay.remove(); onConfirm(val); };

  if (inputEl) inputEl.addEventListener("keypress", e => { if (e.key === "Enter") confirm.click(); });

  btns.appendChild(cancel);
  btns.appendChild(confirm);
  box.appendChild(btns);
  overlay.appendChild(box);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  if (inputEl) { inputEl.focus(); inputEl.select(); }
}

async function sendMessage() {
  if (!messageInput) return;
  const text = messageInput.value.trim();
  if (!text) return;
  if (welcomeScreen) welcomeScreen.style.display = "none";
  if (!currentChatId) createNewChat();

  addMessage(text, "user");
  messageInput.value = "";
  messageInput.setAttribute("disabled", "true");
  if (sendBtn) sendBtn.setAttribute("disabled", "true");

  showTyping();
  const reply = await getAIReply(text, currentChatId);
  hideTyping();

  addMessage(reply, "bot");
  messageInput.removeAttribute("disabled");
  if (sendBtn) sendBtn.removeAttribute("disabled");
  messageInput.focus();

  const chat = chats.find(c => c.id === currentChatId);
  if (chat && chat.name === "New Chat" && chat.messages.filter(m => m.sender === "user").length === 1) {
    chat.name = generateChatTitle(text);
    saveChats();
    renderChatList();
  }
}

function addMessage(text, sender) {
  const chat = chats.find(c => c.id === currentChatId);
  if (!chat) return;
  const timestamp = new Date().toISOString();
  chat.messages.push({ text, sender, timestamp });
  saveChats();
  try {
    localStorage.setItem("mindmate_chat_count",
      (parseInt(localStorage.getItem("mindmate_chat_count") || "0") + 1));
  } catch { /* ignore */ }
  createMessage(text, sender, timestamp, true);
}

function createMessage(text, sender, timestamp, animate = true) {
  if (!chatContainer) return;
  const div = document.createElement("div");
  div.classList.add("message", sender === "user" ? "user-message" : "bot-message");
  if (!animate) div.style.animation = "none";

  const textNode = document.createTextNode(text);
  div.appendChild(textNode);

  const ts = document.createElement("div");
  ts.className = "timestamp";
  const dateObj = timestamp ? new Date(timestamp) : new Date();
  ts.textContent = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  div.appendChild(ts);

  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTyping() {
  if (typingIndicator) typingIndicator.classList.remove("hidden");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}
function hideTyping() {
  if (typingIndicator) typingIndicator.classList.add("hidden");
}

if (sendBtn) sendBtn.addEventListener("click", sendMessage);
if (messageInput) {
  messageInput.addEventListener("keypress", e => {
    if (e.key === "Enter" && !e.shiftKey) sendMessage();
  });
}

const SUGGESTION_OPENERS = {
  "Exam Stress":     "I'm really stressed about my exams and feel overwhelmed. Can you help?",
  "Career Guidance": "I'm confused about my career path and don't know what direction to take.",
  "Motivation":      "I've been feeling really unmotivated lately and can't seem to get anything done.",
  "Anxiety Help":    "I've been feeling very anxious and my mind won't stop racing. I need some help.",
};

suggestionButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!messageInput) return;
    const label = btn.textContent.trim();
    messageInput.value = SUGGESTION_OPENERS[label] || label;
    sendMessage();
  });
});
