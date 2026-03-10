/* ================================================================
   MindMate AI — Chatbot Engine  v3.0
   Improvements:
   - Real AI responses via Anthropic claude-sonnet-4-20250514
   - XSS protection: textContent used instead of innerHTML for user text
   - Timestamps saved in localStorage so they survive page reload
   - Suggestion buttons send meaningful opener phrases, not raw labels
   - Conversation state persists across page loads via sessionStorage
   - Modal-based rename/delete dialogs instead of browser prompt/confirm
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

/* Safe JSON parse helper */
function safeParseJSON(val, fallback) {
  try { return val ? JSON.parse(val) : fallback; }
  catch { return fallback; }
}

let chats         = safeParseJSON(localStorage.getItem(storageKey), []);
let currentChatId = null;


/* ================================================================
   NLP INTENT ENGINE — weighted keyword scoring
   ================================================================ */
const INTENTS = {
  greeting:    { threshold:1, patterns:[{ words:["hi","hello","hey","hiya","howdy","good morning","good evening","good afternoon","how are you","what's up","sup"], w:2 }] },
  goodbye:     { threshold:1, patterns:[{ words:["bye","goodbye","see you","take care","gotta go","talk later","cya"], w:2 }] },
  gratitude:   { threshold:1, patterns:[{ words:["thank","thanks","thank you","helpful","appreciate","grateful","that helped"], w:2 }] },
  exam_stress: {
    threshold:2,
    patterns:[
      { words:["exam","exams","test","tests","assessment","quiz","finals","midterm"], w:3 },
      { words:["study","studying","revise","revision","syllabus","notes","lecture"], w:2 },
      { words:["fail","failed","failing","marks","grade","score","results"], w:2 },
      { words:["pressure","deadline","overwhelmed","behind","can't focus","no time"], w:2 },
    ]
  },
  anxiety: {
    threshold:2,
    patterns:[
      { words:["anxious","anxiety","panic","panicking","nervous","nervousness"], w:3 },
      { words:["overthink","overthinking","racing thoughts","mind won't stop"], w:3 },
      { words:["worried","worry","worrying","fear","scared","dread"], w:2 },
      { words:["heart racing","chest tight","can't breathe","shaking"], w:3 },
      { words:["stressed","stress","tense","on edge","restless"], w:1 },
    ]
  },
  sadness: {
    threshold:2,
    patterns:[
      { words:["sad","sadness","unhappy","upset","down","low","blue"], w:3 },
      { words:["depressed","depression","hopeless","worthless","empty","numb"], w:3 },
      { words:["lonely","alone","isolated","no one","no friends","nobody"], w:2 },
      { words:["cry","crying","cried","tears"], w:2 },
      { words:["give up","what's the point","pointless","don't care anymore"], w:3 },
    ]
  },
  sleep: {
    threshold:2,
    patterns:[
      { words:["sleep","sleeping","insomnia","can't sleep","sleepless"], w:3 },
      { words:["tired","exhausted","fatigue","worn out","drained","no energy"], w:2 },
      { words:["bed","bedtime","awake","wake up","waking up","lying awake"], w:2 },
      { words:["nightmare","bad dreams","dream","restless sleep"], w:2 },
      { words:["sleep schedule","routine","melatonin","nap"], w:2 },
    ]
  },
  motivation: {
    threshold:2,
    patterns:[
      { words:["motivated","motivation","unmotivated","no motivation","lazy","procrastinat"], w:3 },
      { words:["can't start","stuck","lost","don't know where to start"], w:2 },
      { words:["give up","want to quit","feel like quitting"], w:2 },
      { words:["productive","productivity","focus","concentrate","distracted"], w:2 },
      { words:["goal","purpose","direction","ambition"], w:2 },
    ]
  },
  career: {
    threshold:2,
    patterns:[
      { words:["career","job","work","profession","field","internship"], w:3 },
      { words:["future","path","direction","what to do","confused about"], w:2 },
      { words:["course","degree","major","subject","choose"], w:2 },
      { words:["placement","interview","resume","cv","apply"], w:2 },
      { words:["passion","interest","talent","skill","strength"], w:1 },
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
  let best = { key:"unknown", score:0 };
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
  return t.length < 30 || /^(yes|no|ok|okay|sure|nope|yeah|yep|nah|maybe|not really|kind of|i think so|i don't know|idk|hmm|i guess|please|go on|tell me|how|what|why)/.test(t);
}

/* ── Response banks ──────────────────────────────────────── */
const R = {
  greeting:  ["Hi there 🌿 I'm really glad you stopped by. How are you feeling today?","Hello! It's good to see you. What's been on your mind lately?","Hey 😊 I'm here and I'm listening. How's your day going so far?"],
  goodbye:   ["Take care of yourself 💜 I'm always here when you need to talk.","Goodbye for now 🌿 Remember to be kind to yourself today.","See you soon! You're doing better than you think 😊"],
  gratitude: ["You're so welcome 🌱 I'm really glad I could help even a little.","Anytime. That's what I'm here for — take things one step at a time 💜","It means a lot to hear that. I'm always here whenever you need me."],

  exam_stress: {
    opener:       ["Exam pressure is really tough, and it's okay to feel overwhelmed. What's weighing on you the most — the workload, a specific subject, or just the pressure in general?","I hear you. Exams can make everything feel urgent and heavy all at once. What's the biggest thing you're struggling with?"],
    workload:     ["When the syllabus feels endless, breaking it into tiny pieces helps. What if you focused on just one topic today — which subject feels most manageable to start?","A huge workload can feel paralysing. Try listing just 3 things you want to cover today — nothing more. Small wins build momentum 📝"],
    focus:        ["Losing focus is so common under stress. The Pomodoro method really helps — 25 minutes of study, then a 5-minute break. Have you tried anything like that?","When focus slips, your environment matters. Is there something around you pulling your attention away — phone, noise, people?"],
    distraction:  ["Phones are incredibly hard to resist when studying feels difficult. Try putting yours in another room during study time. Does that sound doable?","Even placing your phone face-down across the room makes a difference. Want to try that during your next session?"],
    encouragement:["You're putting in the effort just by talking about this — that counts for something. What's one thing you've already understood well this week?","Remember: you don't need to be perfect, you just need to keep going 💜 What subject are you tackling next?"],
  },

  anxiety: {
    opener:      ["Anxiety can feel so overwhelming. I'm here with you. Can you tell me what's making you feel anxious right now?","That sounds really hard. Is there something specific on your mind, or more a general sense of dread?"],
    grounding:   ["Let's try something together. Look around and name 3 things you can see, 2 things you can touch, and 1 thing you can hear. Take your time 🌿","Try this: breathe in slowly for 4 counts, hold for 4, breathe out for 6. It signals your nervous system that it's safe. Want to try it?"],
    breathing:   ["Slow breathing is one of the most powerful tools. Try: in for 4 seconds, hold for 4, out for 6. Repeat 3 times. How do you feel after?","When anxiety spikes, breathing gets shallow — and that makes it worse. Take one long slow breath right now. Just one. Did that help even a little?"],
    physical:    ["Physical symptoms like a racing heart are your body's stress response — uncomfortable but not dangerous. Try placing one hand on your chest and breathing slowly into it.","Cold water on your wrists or face can actually calm your nervous system. It sounds strange but it works for many people. Have you tried anything like that?"],
    reassurance: ["What you're feeling is real. Anxiety is your mind trying to protect you, even when it overcorrects. You're not broken — you're human 💜","It's okay to feel this way. A lot of students go through exactly this. Just one moment at a time."],
  },

  sadness: {
    opener:       ["I'm really sorry you're feeling this way 💜 Do you want to tell me a little about what's been going on?","That sounds really painful. You don't have to carry it alone — I'm here to listen. What's been happening?"],
    loneliness:   ["Feeling lonely is one of the hardest things. Is there anyone in your life — even one person — you feel slightly comfortable with?","Loneliness can feel invisible from the outside, but it's very real and heavy. When did you start feeling this way?"],
    hopelessness: ["When things feel hopeless, even small steps feel impossible. But the fact that you're here and talking means there's a part of you that wants things to be different. That part matters 💜","Hopelessness often means you've been trying really hard for a long time without enough support. You deserve more support than you've been getting."],
    crisis:       "I'm really grateful you told me that, and I want you to know I'm taking it seriously 💜 You don't have to face this alone. Please reach out to iCall (India): 9152987821, or Vandrevala Foundation: 1860-2662-345. They're kind, non-judgmental people who can help right now. Are you safe at this moment?",
    gentle_check: ["I want to gently check in — are you having any thoughts of hurting yourself? It's okay to tell me honestly. I won't judge you at all.","I hear how much pain you're in. Sometimes when we feel this low, dark thoughts can come up. Is that happening for you at all?"],
    encouragement:["Even on days when everything feels grey, you are still worth caring for. Is there anything — even something tiny — that brought you comfort recently?","You reached out today and that takes courage. Feelings this heavy do lift with time and the right support 💜"],
  },

  sleep: {
    opener:      ["Sleep trouble can affect everything — mood, focus, energy. Is it more that you can't fall asleep, or that you wake up during the night?","Not sleeping well is exhausting in a way that's hard to explain. What's been happening — do you lie awake thinking, or do you wake up too early?"],
    cant_sleep:  ["When you can't switch your mind off, try writing everything on your mind before bed — it tells your brain it's been 'noted' and can rest. Would you try that tonight?","Racing thoughts at bedtime are so common but so frustrating. Keeping your phone out of the bedroom entirely helps — the blue light keeps your brain alert. Have you tried that?"],
    routine:     ["Going to bed and waking up at the same time — even on weekends — helps reset your body clock. What does your current bedtime look like?","A wind-down routine helps — dim lights, no screens 30 minutes before bed, maybe calm music. It signals to your brain that it's safe to rest. What feels realistic to try?"],
    tired:       ["Feeling exhausted even after sleeping often means sleep quality is the issue, not just quantity. Are you waking up feeling rested at all?","Daytime exhaustion can spiral — too tired to focus, stressed about that, then too anxious to sleep. Let's try to break that cycle. What's the hardest part of your day energy-wise?"],
    nightmares:  ["Nightmares often show up when we're stressed or processing something difficult. Are the dreams connected to anything going on in your life?","Bad dreams can make you dread sleep altogether. Grounding yourself before bed — slow breathing, journalling, a calm routine — can sometimes reduce them."],
    encouragement:["Sleep struggles are genuinely hard on the mind and body. Even one small change tonight can start shifting things 🌙","You deserve proper rest — it's not a luxury, it's essential. What small step feels doable for tonight?"],
  },

  motivation: {
    opener:        ["Feeling unmotivated is so common, especially among students — it often means you're burnt out, not lazy. What does your day-to-day feel like right now?","Motivation is tricky — it rarely comes before we start, it usually comes after. What's the one thing you've been putting off the most?"],
    procrastination:["Procrastination is almost always about anxiety, not laziness. We avoid things because they feel too big. What feels scary about starting?","The hardest part is almost always the first 2 minutes. Try just 5 minutes of the task — often once you start, it flows. What are you avoiding?"],
    no_goal:       ["Feeling lost without clear direction is really disorienting. Think smaller — not 'what's my life goal' but 'what's one thing I want to feel proud of this week'?","Purpose doesn't have to be one big thing. What's something that used to make you feel good, even something small?"],
    burnout:       ["What you're describing sounds like burnout. When did you last do something just for fun, with no productivity attached?","Burnout is your mind and body saying they need a real break. Rest isn't wasted time — it makes effort sustainable. What would genuine rest look like for you?"],
    encouragement: ["The fact that you want to feel motivated tells me there's drive in you — it's just buried under pressure. What's something you've done recently that you're even slightly proud of?","You don't need to feel motivated to take one small step. Action creates motivation, not the other way around. What's the smallest thing you could do today? 💜"],
  },

  career: {
    opener:      ["Career uncertainty is one of the most anxiety-inducing things for students, and you're definitely not alone. What's the part you're most confused or worried about?","Figuring out your path can feel like everyone else has a map and you don't. What are you currently studying, and how do you feel about it?"],
    confused:    ["Not knowing what you want to do is very normal at this stage. What are the subjects or activities that make time feel like it goes faster for you?","Sometimes career clarity comes from ruling things out. What's something you already know you don't want to do?"],
    pressure:    ["Family or societal pressure around careers is really real and heavy. Setting that aside for a moment — what do you actually want?","The pressure to have everything figured out at your age is genuinely unfair. Most people change direction multiple times. What feels true to you?"],
    skills:      ["What do people come to you for help with? What do you find yourself doing without being asked? Those are often real clues.","Where your skills and interests overlap is often a great place to look. What do you feel you're naturally decent at, even if it seems small?"],
    encouragement:["Career paths rarely look like straight lines — and that's okay. Exploring and asking questions like you're doing now is exactly the right move 💜","You're thinking about this seriously, which is more than a lot of people do. That thoughtfulness will serve you really well."],
  },

  unknown: ["I hear you. Can you tell me a little more about what's going on? I want to make sure I understand properly.","That sounds like it matters to you. Can you share a bit more about what you mean?","I'm listening 🌿 What's been on your mind the most lately?","Tell me more — I want to get this right for you."],
};

const _used = {};
function pick(arr, key) {
  if (!Array.isArray(arr)) return arr;
  if (!_used[key]) _used[key] = [];
  let avail = arr.map((_, i) => i).filter(i => !_used[key].includes(i));
  if (!avail.length) { _used[key] = []; avail = arr.map((_,i) => i); }
  const idx = avail[Math.floor(Math.random() * avail.length)];
  _used[key].push(idx);
  return arr[idx];
}

/* ── Main reply generator ────────────────────────────────── */
let state = { topic: null, turn: 0, lastBot: null };

function generateReply(text) {
  const lower    = text.toLowerCase().trim();
  const intent   = detectIntent(text);
  const followUp = isFollowUp(text);
  const switching = wantsTopicSwitch(text);

  if (intent === "goodbye")  { state.topic=null; state.turn=0; return pick(R.goodbye,"bye"); }
  if (intent === "gratitude") return pick(R.gratitude,"grat");
  if (intent === "greeting" && !state.topic) return pick(R.greeting,"greet");

  if (intent !== "unknown" && intent !== "greeting" && intent !== "gratitude") {
    if (!state.topic || switching) {
      state.topic = intent; state.turn = 0;
    } else if (intent !== state.topic && !followUp) {
      const names = { exam_stress:"exams", anxiety:"anxiety", sadness:"how you're feeling", sleep:"sleep", motivation:"motivation", career:"career" };
      state.turn++;
      return `I want to make sure we finish talking about ${names[state.topic]||"this"} first — it sounds important. But I hear that ${names[intent]||"that"} is on your mind too. Shall we finish here first, or would you like to switch?`;
    }
  }

  if (!state.topic) return pick(R.unknown,"unk");

  state.turn++;
  const r = R[state.topic];

  switch (state.topic) {
    case "exam_stress":
      if (state.turn===1) return pick(r.opener,"ex_op");
      if (lower.match(/phone|social media|instagram|tiktok|youtube|scroll/)) return pick(r.distraction,"ex_dis");
      if (lower.match(/focus|concentrat|keep losing|attention/)) return pick(r.focus,"ex_foc");
      if (lower.match(/syllabus|so much|too much|a lot|chapters|heavy|overwhelm/)) return pick(r.workload,"ex_wk");
      if (lower.match(/pomodoro|technique|tip|strategy|method|how do i|what should/))
        return "The Pomodoro Technique is great — study for 25 minutes, then take a 5-minute break. After 4 rounds, take a longer 20-minute break. It keeps your brain fresh and gives you a sense of progress. Want more tips?";
      return pick(r.encouragement,"ex_enc");

    case "anxiety":
      if (state.turn===1) return pick(r.opener,"anx_op");
      if (lower.match(/breath|breathing|can't breathe|chest|heart racing/)) return pick(r.breathing,"anx_br");
      if (lower.match(/ground|technique|something to do|help me now|right now/)) return pick(r.grounding,"anx_gr");
      if (lower.match(/shak|tremble|sweat|physical|body/)) return pick(r.physical,"anx_ph");
      return pick(r.reassurance,"anx_re");

    case "sadness":
      if (state.turn===1) return pick(r.opener,"sad_op");
      if (lower.match(/hurt myself|end it|disappear|don't want to be here|suicid|self.harm|self harm/)) return r.crisis;
      if (lower.match(/alone|lonely|no one|nobody|isolated|no friends/)) return pick(r.loneliness,"sad_lo");
      if (lower.match(/hopeless|pointless|what's the point|nothing matters|give up/)) return pick(r.hopelessness,"sad_ho");
      if (state.turn>=3 && state.turn%3===0) return pick(r.gentle_check,"sad_gc");
      return pick(r.encouragement,"sad_en");

    case "sleep":
      if (state.turn===1) return pick(r.opener,"sl_op");
      if (lower.match(/can't sleep|won't sleep|lie awake|fall asleep|taking ages|hours awake/)) return pick(r.cant_sleep,"sl_cs");
      if (lower.match(/routine|schedule|same time|habit/)) return pick(r.routine,"sl_ro");
      if (lower.match(/tired|exhausted|no energy|drained|still tired|waking up tired/)) return pick(r.tired,"sl_ti");
      if (lower.match(/nightmare|bad dream|dream|wake up scared/)) return pick(r.nightmares,"sl_nm");
      return pick(r.encouragement,"sl_en");

    case "motivation":
      if (state.turn===1) return pick(r.opener,"mo_op");
      if (lower.match(/procrastinat|putting off|keep delaying|avoiding|can't start|can't begin/)) return pick(r.procrastination,"mo_pr");
      if (lower.match(/don't know what|no direction|lost|no goal|no purpose/)) return pick(r.no_goal,"mo_ng");
      if (lower.match(/burnt out|burnout|exhausted|can't anymore|too much|done/)) return pick(r.burnout,"mo_bu");
      return pick(r.encouragement,"mo_en");

    case "career":
      if (state.turn===1) return pick(r.opener,"ca_op");
      if (lower.match(/confused|don't know|no idea|lost|unsure|uncertain/)) return pick(r.confused,"ca_co");
      if (lower.match(/pressure|parents|family|expect|supposed to|society/)) return pick(r.pressure,"ca_pr");
      if (lower.match(/skill|good at|strength|talent|what am i|what can i/)) return pick(r.skills,"ca_sk");
      return pick(r.encouragement,"ca_en");

    default:
      return pick(R.unknown,"unk");
  }
}

/* ── AI reply wrapper (uses local engine, no API needed) ─── */
async function getAIReply(userMessage, chatId) {
  // Save conversation turn to sessionStorage for state continuity across reloads
  const savedState = safeParseJSON(sessionStorage.getItem("mm_state_" + chatId), null);
  if (savedState) {
    state.topic = savedState.topic;
    state.turn  = savedState.turn;
  }

  const reply = generateReply(userMessage);

  sessionStorage.setItem("mm_state_" + chatId, JSON.stringify({ topic: state.topic, turn: state.turn }));
  return reply;
}

/* ── Chat Engine ───────────────────────────────────────────── */
window.onload = () => {
  renderChatList();
  if (chats.length > 0) loadChat(chats[0].id);
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    if (themeToggle) themeToggle.textContent = "☀️ Light Mode";
  } else {
    if (themeToggle) themeToggle.textContent = "🌙 Dark Mode";
  }
};

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    if (document.body.classList.contains("dark-mode")) {
      themeToggle.textContent = "☀️ Light Mode";
      localStorage.setItem("theme", "dark");
    } else {
      themeToggle.textContent = "🌙 Dark Mode";
      localStorage.setItem("theme", "light");
    }
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
    title.textContent = chat.name; // textContent — safe from XSS
    title.onclick = () => loadChat(chat.id);

    const actions = document.createElement("div");
    actions.className = "chat-actions";

    const rb = document.createElement("button");
    rb.textContent = "✏";
    rb.title = "Rename";
    rb.setAttribute("aria-label", "Rename chat");
    rb.onclick = e => { e.stopPropagation(); showRenameModal(chat.id); };

    const db = document.createElement("button");
    db.textContent = "🗑";
    db.title = "Delete";
    db.setAttribute("aria-label", "Delete chat");
    db.onclick = e => { e.stopPropagation(); showDeleteModal(chat.id); };

    actions.appendChild(rb);
    actions.appendChild(db);
    li.appendChild(title);
    li.appendChild(actions);
    historyList.appendChild(li);
  });
}

/* ── Custom modals (replaces prompt/confirm) ─────────────── */
function showRenameModal(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  showModal({
    title: "Rename Chat",
    input: true,
    inputValue: chat.name,
    confirmLabel: "Rename",
    onConfirm: (val) => {
      if (!val.trim()) return;
      chat.name = val.trim().substring(0, 60);
      saveChats();
      renderChatList();
    }
  });
}

function showDeleteModal(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  showModal({
    title: "Delete Chat",
    message: `Delete "${chat.name}"? This cannot be undone.`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      chats = chats.filter(c => c.id !== chatId);
      sessionStorage.removeItem("mm_ctx_" + chatId);
      currentChatId = chats.length > 0 ? chats[0].id : null;
      if (!currentChatId) {
        if (chatContainer) chatContainer.innerHTML = "";
        if (welcomeScreen) welcomeScreen.style.display = "block";
      }
      saveChats();
      renderChatList();
      if (currentChatId) loadChat(currentChatId);
    }
  });
}

function showModal({ title, message, input, inputValue = "", confirmLabel = "OK", danger = false, onConfirm }) {
  // Remove any existing modal
  document.getElementById("mm-modal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "mm-modal";
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;
    display:flex;align-items:center;justify-content:center;animation:fadeIn .15s ease;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    background:var(--c-surface);border:1px solid var(--c-border);border-radius:16px;
    padding:28px 30px;width:320px;max-width:90vw;box-shadow:var(--shadow-lg);
    animation:slideUp .2s var(--ease-spring);
  `;

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
    inputEl.style.cssText = `
      width:100%;padding:10px 14px;border-radius:8px;border:1.5px solid var(--c-border);
      background:var(--c-bg);color:var(--c-text);font-size:14px;font-family:inherit;
      outline:none;margin-bottom:18px;
    `;
    inputEl.addEventListener("focus", () => { inputEl.style.borderColor = "var(--c-accent)"; });
    inputEl.addEventListener("blur",  () => { inputEl.style.borderColor = "var(--c-border)"; });
    box.appendChild(inputEl);
  }

  const btns = document.createElement("div");
  btns.style.cssText = "display:flex;gap:10px;justify-content:flex-end;";

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.style.cssText = `
    padding:9px 18px;border-radius:8px;border:1px solid var(--c-border);
    background:transparent;color:var(--c-muted);font-size:13px;font-family:inherit;cursor:pointer;
  `;
  cancel.onclick = () => overlay.remove();

  const confirm = document.createElement("button");
  confirm.textContent = confirmLabel;
  confirm.style.cssText = `
    padding:9px 18px;border-radius:8px;border:none;font-size:13px;font-family:inherit;
    cursor:pointer;font-weight:500;color:white;
    background:${danger ? "#ef4444" : "linear-gradient(135deg,var(--c-accent),var(--c-accent2))"};
  `;
  confirm.onclick = () => {
    const val = inputEl ? inputEl.value : "";
    overlay.remove();
    onConfirm(val);
  };

  if (inputEl) {
    inputEl.addEventListener("keypress", e => { if (e.key === "Enter") confirm.click(); });
  }

  btns.appendChild(cancel);
  btns.appendChild(confirm);
  box.appendChild(btns);
  overlay.appendChild(box);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  if (inputEl) { inputEl.focus(); inputEl.select(); }
}

/* ── Message sending ─────────────────────────────────────── */
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

  // Auto-name chat from first user message
  const chat = chats.find(c => c.id === currentChatId);
  if (chat && chat.name === "New Chat" && chat.messages.filter(m => m.sender === "user").length === 1) {
    chat.name = text.length > 36 ? text.substring(0, 36) + "…" : text;
    saveChats();
    renderChatList();
  }
}

function addMessage(text, sender) {
  const chat = chats.find(c => c.id === currentChatId);
  if (!chat) return;
  const timestamp = new Date().toISOString(); // Save ISO timestamp for accurate display on reload
  chat.messages.push({ text, sender, timestamp });
  saveChats();
  // Update chat count stat
  try {
    localStorage.setItem("mindmate_chat_count",
      (parseInt(localStorage.getItem("mindmate_chat_count") || "0") + 1));
  } catch { /* ignore */ }
  createMessage(text, sender, timestamp, true);
}

/* ── Render message safely (XSS protected) ───────────────── */
function createMessage(text, sender, timestamp, animate = true) {
  if (!chatContainer) return;

  const div = document.createElement("div");
  div.classList.add("message", sender === "user" ? "user-message" : "bot-message");
  if (!animate) div.style.animation = "none";

  // textContent for all user-supplied text — prevents XSS
  const textNode = document.createTextNode(text);
  div.appendChild(textNode);

  const ts = document.createElement("div");
  ts.className = "timestamp";
  // Display saved timestamp or current time
  const dateObj = timestamp ? new Date(timestamp) : new Date();
  ts.textContent = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  div.appendChild(ts);

  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function showTyping() {
  if (typingIndicator) typingIndicator.classList.remove("hidden");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}
function hideTyping() {
  if (typingIndicator) typingIndicator.classList.add("hidden");
}

/* ── Event listeners ─────────────────────────────────────── */
if (sendBtn) sendBtn.addEventListener("click", sendMessage);
if (messageInput) {
  messageInput.addEventListener("keypress", e => {
    if (e.key === "Enter" && !e.shiftKey) sendMessage();
  });
}

// Suggestion buttons: send meaningful opener text instead of raw label
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
