"use strict";

/* Anthropic API configuration — uses the built-in proxy, no API key needed */
const _AI_HEADERS = {
  "Content-Type": "application/json",
};


/* MODULE 1 — MOOD ANALYSER */

const MoodAnalyser = (() => {

  const LEXICON = {
    happy: { v: 0.8, a: 0.5, d: 0.5, e: "joy" },
    excited: { v: 0.8, a: 0.9, d: 0.5, e: "joy" },
    great: { v: 0.7, a: 0.4, d: 0.4, e: "joy" },
    wonderful: { v: 0.9, a: 0.5, d: 0.5, e: "joy" },
    amazing: { v: 0.9, a: 0.7, d: 0.5, e: "joy" },
    fantastic: { v: 0.9, a: 0.7, d: 0.5, e: "joy" },
    good: { v: 0.5, a: 0.2, d: 0.3, e: "joy" },
    okay: { v: 0.1, a: 0.0, d: 0.1, e: "neutral" },
    fine: { v: 0.1, a: 0.0, d: 0.1, e: "neutral" },
    relieved: { v: 0.6, a: -0.2, d: 0.3, e: "joy" },
    content: { v: 0.5, a: -0.1, d: 0.3, e: "joy" },
    anxious: { v: -0.7, a: 0.8, d: -0.6, e: "anxiety" },
    anxiety: { v: -0.7, a: 0.8, d: -0.6, e: "anxiety" },
    panicking: { v: -0.9, a: 0.9, d: -0.8, e: "anxiety" },
    panic: { v: -0.8, a: 0.9, d: -0.7, e: "anxiety" },
    stressed: { v: -0.6, a: 0.7, d: -0.4, e: "stress" },
    stress: { v: -0.5, a: 0.6, d: -0.3, e: "stress" },
    overwhelmed: { v: -0.7, a: 0.6, d: -0.7, e: "stress" },
    worried: { v: -0.5, a: 0.6, d: -0.4, e: "anxiety" },
    scared: { v: -0.7, a: 0.7, d: -0.6, e: "fear" },
    afraid: { v: -0.7, a: 0.6, d: -0.6, e: "fear" },
    nervous: { v: -0.4, a: 0.6, d: -0.3, e: "anxiety" },
    tense: { v: -0.4, a: 0.5, d: -0.2, e: "stress" },
    pressure: { v: -0.4, a: 0.5, d: -0.3, e: "stress" },
    sad: { v: -0.7, a: -0.4, d: -0.5, e: "sadness" },
    sadness: { v: -0.7, a: -0.4, d: -0.5, e: "sadness" },
    depressed: { v: -0.9, a: -0.6, d: -0.8, e: "depression" },
    depression: { v: -0.9, a: -0.6, d: -0.8, e: "depression" },
    hopeless: { v: -0.9, a: -0.5, d: -0.9, e: "depression" },
    worthless: { v: -0.9, a: -0.3, d: -0.9, e: "depression" },
    empty: { v: -0.7, a: -0.7, d: -0.6, e: "depression" },
    lonely: { v: -0.6, a: -0.3, d: -0.5, e: "sadness" },
    alone: { v: -0.5, a: -0.2, d: -0.4, e: "sadness" },
    miserable: { v: -0.8, a: -0.3, d: -0.7, e: "sadness" },
    numb: { v: -0.5, a: -0.8, d: -0.6, e: "depression" },
    crying: { v: -0.6, a: 0.2, d: -0.5, e: "sadness" },
    tired: { v: -0.3, a: -0.7, d: -0.3, e: "fatigue" },
    exhausted: { v: -0.5, a: -0.8, d: -0.5, e: "fatigue" },
    drained: { v: -0.5, a: -0.7, d: -0.5, e: "fatigue" },
    frustrated: { v: -0.6, a: 0.4, d: -0.2, e: "anger" },
    angry: { v: -0.6, a: 0.7, d: 0.2, e: "anger" },
    irritated: { v: -0.4, a: 0.4, d: 0.1, e: "anger" },
    lost: { v: -0.5, a: -0.2, d: -0.6, e: "sadness" },
    confused: { v: -0.3, a: 0.3, d: -0.4, e: "stress" },
    unmotivated: { v: -0.4, a: -0.5, d: -0.4, e: "fatigue" },
    suicidal: { v: -1.0, a: -0.5, d: -1.0, e: "crisis", crisis: true },
    "self-harm": { v: -1.0, a: 0.2, d: -0.8, e: "crisis", crisis: true },
    "hurt myself": { v: -1.0, a: 0.3, d: -0.8, e: "crisis", crisis: true },
    "end it": { v: -0.9, a: -0.2, d: -0.9, e: "crisis", crisis: true },
    "want to die": { v: -1.0, a: -0.3, d: -1.0, e: "crisis", crisis: true },
    "don't want to live": { v: -1.0, a: -0.3, d: -1.0, e: "crisis", crisis: true },
  };

  const INTENSIFIERS = new Set(["very", "really", "extremely", "so", "absolutely", "incredibly", "terribly", "deeply"]);
  const DIMINISHERS = new Set(["a bit", "slightly", "somewhat", "kind of", "kinda", "a little", "not very", "not too"]);
  const NEGATORS = new Set(["not", "no", "never", "don't", "doesn't", "can't", "won't", "isn't", "aren't", "wasn't"]);

  function analyse(text) {
    const words = text.toLowerCase().replace(/[^\w\s'-]/g, " ").split(/\s+/);
    let totalV = 0, totalA = 0, totalD = 0, count = 0;
    const emotionCounts = {};
    let hasCrisis = false;

    /* Score multi-word phrases first */
    const joined = text.toLowerCase();
    for (const [phrase, data] of Object.entries(LEXICON)) {
      if (phrase.includes(" ") && joined.includes(phrase)) {
        if (data.crisis) hasCrisis = true;
        const mult = 1.2;
        totalV += data.v * mult; totalA += data.a * mult; totalD += data.d * mult;
        count += mult;
        emotionCounts[data.e] = (emotionCounts[data.e] || 0) + mult;
      }
    }

    /* Score individual words with modifier adjustments */
    for (let i = 0; i < words.length; i++) {
      const w = words[i], data = LEXICON[w];
      if (!data) continue;
      if (data.crisis) hasCrisis = true;
      let mult = 1.0;
      const prev = words[i - 1] || "", prev2 = (words[i - 2] || "") + " " + prev;
      if (INTENSIFIERS.has(prev)) mult = 1.4;
      if (DIMINISHERS.has(prev) || DIMINISHERS.has(prev2)) mult = 0.5;
      if (NEGATORS.has(prev)) mult = -0.6;
      totalV += data.v * mult; totalA += data.a * mult; totalD += data.d * mult;
      count += Math.abs(mult);
      emotionCounts[data.e] = (emotionCounts[data.e] || 0) + Math.abs(mult);
    }

    if (count === 0) return { valence: 0, arousal: 0, dominance: 0, emotions: {}, dominant: "neutral", hasCrisis: false, score: 55 };
    const v = Math.max(-1, Math.min(1, totalV / count));
    const a = Math.max(-1, Math.min(1, totalA / count));
    const d = Math.max(-1, Math.min(1, totalD / count));
    const dominant = Object.entries(emotionCounts).sort((x, y) => y[1] - x[1])[0]?.[0] || "neutral";
    const score = Math.round(((v + 1) / 2 * 0.6 + (d + 1) / 2 * 0.4) * 100);
    return { valence: v, arousal: a, dominance: d, emotions: emotionCounts, dominant, hasCrisis, score };
  }

  return { analyse };
})();


/* MODULE 2 — MOOD TRACKER */

const MoodTracker = (() => {
  const KEY = "mindmate_mood_history_v2";
  const MAX = 300;

  function _load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function _save(e) { try { localStorage.setItem(KEY, JSON.stringify(e.slice(-MAX))); } catch { } }

  function record(mv, snippet = "") {
    const entries = _load();
    entries.push({ ts: Date.now(), v: Math.round(mv.valence * 100) / 100, a: Math.round(mv.arousal * 100) / 100, d: Math.round(mv.dominance * 100) / 100, score: mv.score, dominant: mv.dominant, hasCrisis: mv.hasCrisis, snippet: snippet.substring(0, 80) });
    _save(entries);
    return entries;
  }

  function recent(n = 20) { return _load().slice(-n); }

  function weeklyScores() {
    const entries = _load(), now = Date.now(), DAY = 86400000;
    return Array.from({ length: 7 }, (_, i) => {
      const start = now - (6 - i) * DAY, end = start + DAY;
      const slice = entries.filter(e => e.ts >= start && e.ts < end);
      return slice.length ? Math.round(slice.reduce((s, e) => s + e.score, 0) / slice.length) : null;
    });
  }

  /* Returns 1 (improving), -1 (declining), or 0 (stable) based on linear regression */
  function trend() {
    const e = _load().slice(-7);
    if (e.length < 3) return 0;
    const n = e.length, mx = (n - 1) / 2, my = e.reduce((s, x) => s + x.score, 0) / n;
    let num = 0, den = 0;
    e.forEach((x, i) => { num += (i - mx) * (x.score - my); den += (i - mx) ** 2; });
    const s = den === 0 ? 0 : num / den;
    return s > 2 ? 1 : s < -2 ? -1 : 0;
  }

  /* Counts consecutive days in the past 14 where average score was below 40 */
  function lowStreak() {
    const entries = _load(), DAY = 86400000, now = Date.now();
    let streak = 0;
    for (let day = 0; day < 14; day++) {
      const slice = entries.filter(e => e.ts >= now - (day + 1) * DAY && e.ts < now - day * DAY);
      if (!slice.length) continue;
      const avg = slice.reduce((s, e) => s + e.score, 0) / slice.length;
      if (avg < 40) streak++; else break;
    }
    return streak;
  }

  function summary() {
    const entries = recent(20), scores = entries.map(e => e.score);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
    const ec = {};
    entries.forEach(e => { if (e.dominant && e.dominant !== "neutral") ec[e.dominant] = (ec[e.dominant] || 0) + 1; });
    const topEmotions = Object.entries(ec).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e]) => e);
    return { averageWellnessScore: avg, trend: ["declining", "stable", "improving"][trend() + 1], topEmotions, lowStreakDays: lowStreak(), totalSessions: entries.length };
  }

  return { record, recent, weeklyScores, trend, lowStreak, summary };
})();


/* MODULE 3 — RAG MEMORY */

const RAGMemory = (() => {
  const PREFIX = "mindmate_rag_";

  function _key() { return PREFIX + (localStorage.getItem("loggedInUser") || "default"); }
  function _load() { try { return JSON.parse(localStorage.getItem(_key())) || { facts: [], lastUpdated: null }; } catch { return { facts: [], lastUpdated: null }; } }
  function _save(d) { try { localStorage.setItem(_key(), JSON.stringify(d)); } catch { } }

  /* Adds or updates a single fact, capping storage at 30 entries */
  function upsert(category, value, confidence = "medium") {
    const mem = _load();
    const idx = mem.facts.findIndex(f => f.category === category);
    const fact = { category, value, confidence, ts: Date.now() };
    if (idx >= 0) mem.facts[idx] = fact; else mem.facts.push(fact);
    mem.lastUpdated = Date.now();
    if (mem.facts.length > 30) {
      const c = { high: 3, medium: 2, low: 1 };
      mem.facts.sort((a, b) => c[a.confidence] - c[b.confidence] || a.ts - b.ts);
      mem.facts = mem.facts.slice(-30);
    }
    _save(mem);
  }

  /* Returns stored facts as a formatted string */
  function recall() {
    const mem = _load();
    if (!mem.facts.length) return null;
    return mem.facts.filter(f => f.value && f.value.trim()).map(f => `• ${f.category}: ${f.value}`).join("\n");
  }

  /* Returns short summaries of the user's last 5 chat sessions */
  function sessionHistory() {
    const key = "mindmate_chats_" + (localStorage.getItem("loggedInUser") || "default");
    try {
      const chats = JSON.parse(localStorage.getItem(key)) || [];
      return chats
        .filter(c => c.messages?.some(m => m.sender === "user"))
        .slice(-5)
        .map(c => {
          const first = c.messages.find(m => m.sender === "user");
          return `"${c.name}": ${first?.text?.substring(0, 80) || ""}`;
        }).join("\n");
    } catch { return ""; }
  }

  /* Calls the LLM to extract new facts from the latest exchange and stores them */
  async function extractAndStore(userMessage, botReply, existingMemory) {
    const prompt = `You are a memory extraction system for a mental wellness chatbot.

Given the exchange below, extract any NEW factual information about the USER worth remembering in future sessions.

Categories to look for: name, age, occupation or studies (e.g. "preparing for JEE", "final year B.Tech"), specific stressors, relationships mentioned, coping strategies that helped them, recurring emotional themes, location context.

EXISTING MEMORY:
${existingMemory || "None yet."}

USER MESSAGE: "${userMessage}"
BOT REPLY: "${botReply}"

Reply ONLY with a JSON array. Empty array [] if nothing new. Example format:
[{"category":"studies","value":"Final year engineering student at a private university","confidence":"high"}]

Only extract facts explicitly stated. Never infer. Keep values under 15 words.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: _AI_HEADERS,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 250,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) { console.warn("[MindMate RAG] Memory extraction skipped:", res.status); return; }
      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";
      const facts = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(facts)) facts.forEach(f => { if (f.category && f.value) upsert(f.category, f.value, f.confidence || "medium"); });
    } catch (e) { console.warn("[MindMate RAG] Memory extraction error (non-blocking):", e.message); }
  }

  return { upsert, recall, extractAndStore, sessionHistory };
})();


/* MODULE 4 — RECOMMENDATION ENGINE */

const RecommendEngine = (() => {
  const ACTIONS = {
    breathing: {
      label: "🫁 4-7-8 Breathing", urgency: "high", tags: ["anxiety", "stress", "panic", "fear"],
      desc: "Breathe in for 4 counts, hold for 7, exhale slowly for 8. Directly activates your body's calm response.",
    },
    grounding: {
      label: "🌿 5-4-3-2-1 Grounding", urgency: "high", tags: ["anxiety", "panic", "fear"],
      desc: "Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. Pulls you back to the present moment.",
    },
    journaling: {
      label: "📓 Reflective Journaling", urgency: "medium", tags: ["stress", "sadness", "depression", "anger"],
      desc: "Write freely for 5–10 minutes without editing. Getting thoughts out of your head and onto paper genuinely reduces their weight.",
    },
    pmr: {
      label: "💪 Progressive Muscle Relaxation", urgency: "medium", tags: ["stress", "tension", "sleep", "anxiety"],
      desc: "Tense each muscle group for 5 seconds then release — start from your feet and work upward. Breaks the physical stress-tension cycle.",
    },
    sleep_hygiene: {
      label: "🌙 Sleep Wind-Down Routine", urgency: "medium", tags: ["fatigue", "sleep", "depression"],
      desc: "Dim lights 1 hour before bed, no screens, write tomorrow's 3 priorities to clear your mind, keep the same wake time daily.",
    },
    exercise: {
      label: "🏃 10-Minute Movement", urgency: "medium", tags: ["sadness", "depression", "fatigue", "stress"],
      desc: "A short walk, stretching, or dancing to one song raises serotonin more effectively than ruminating on the problem.",
    },
    pomodoro: {
      label: "⏱ Pomodoro Focus Session", urgency: "low", tags: ["fatigue", "procrastination", "stress"],
      desc: "Set a timer for 25 minutes, work on just one thing, then take a 5-minute break. Removes the paralysis of doing everything at once.",
    },
    social: {
      label: "💬 Reach Out to Someone", urgency: "medium", tags: ["sadness", "depression"],
      desc: "Text or call one person you trust — not to fix anything, just to connect for 5 minutes.",
    },
    mindfulness: {
      label: "🧘 5-Minute Body Scan", urgency: "low", tags: ["anxiety", "stress", "sadness", "anger"],
      desc: "Close your eyes and slowly move attention from head to toes, noticing sensations without judgment.",
    },
    nutrition: {
      label: "🍌 Check Your Basics", urgency: "low", tags: ["fatigue", "anger", "stress"],
      desc: "Have you eaten and had water today? Low blood sugar quietly amplifies every negative emotion.",
    },
    /* Professional help — shown only as a last resort */
    professional: {
      label: "🩺 Consider Talking to Someone Real",
      urgency: "critical",
      tags: ["crisis", "depression", "persistent"],
      desc: "I'm an AI and I do make mistakes — sometimes what you're going through really benefits from a real human professional. That's not a weakness, it's just good self-care. No shame at all.",
    },
    indian_resources: {
      label: "📞 Indian Mental Health Helplines",
      urgency: "critical",
      tags: ["crisis"],
      desc: "iCall (TISS): 9152987821 | Vandrevala Foundation: 1860-2662-345 (24/7 free) | AASRA: 9820466627 (24/7) | Snehi: 044-24640050 | iHCall (students): 8944880079",
    },
  };

  function recommend(moodVector, trackerSummary, turnCount = 0) {
    const { dominant, score, hasCrisis } = moodVector;
    const { lowStreakDays = 0 } = trackerSummary;
    const result = [];

    /* Crisis signals — surface helplines immediately */
    if (hasCrisis) { result.push(ACTIONS.indian_resources); result.push(ACTIONS.professional); }

    /* Escalate to professional support after persistent low mood */
    const escalate = !hasCrisis && (score < 20 || lowStreakDays >= 4 || (score < 30 && turnCount >= 5));
    if (escalate) { result.push(ACTIONS.professional); result.push(ACTIONS.indian_resources); }

    /* Add emotion-matched coping actions */
    const tags = [dominant, ...(score < 45 ? ["stress"] : [])];
    for (const a of Object.values(ACTIONS)) {
      if (result.includes(a) || a === ACTIONS.professional || a === ACTIONS.indian_resources) continue;
      if (a.tags.some(t => tags.includes(t))) result.push(a);
    }

    /* Ensure at least 3 actions are returned */
    if (!result.find(a => a.urgency === "high" && a !== ACTIONS.professional)) result.push(ACTIONS.breathing);
    if (result.length < 2) result.push(ACTIONS.mindfulness);
    if (result.length < 3) result.push(ACTIONS.nutrition);

    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    const unique = [...new Map(result.map(a => [a.label, a])).values()];
    unique.sort((a, b) => order[a.urgency] - order[b.urgency]);
    return unique.slice(0, 4);
  }

  return { recommend, ACTIONS };
})();


/* MODULE 5 — CRISIS DETECTOR */

const CrisisDetector = (() => {
  const PATTERNS = [
    /\b(suicid|commit suicide|want to die|wanna die|i want to die|end my life|end it all|kill myself|don't want to live|not worth living)\b/i,
    /\b(hurt myself|self.?harm|cutting myself|harming myself)\b/i,
    /\b(disappear forever|better off without me|can't go on|no reason to live)\b/i,
    /\b(i('ll| will) (commit suicide|kill myself|end it|harm myself))\b/i,
  ];

  const RESPONSE =
    `I want to stop for a moment because what you just shared really matters 💜

You don't have to carry this alone. There are real people in India you can talk to right now:

📞 **iCall (TISS Mumbai):** 9152987821 *(Mon–Sat, 8am–10pm)*
📞 **Vandrevala Foundation:** 1860-2662-345 *(24/7, completely free)*
📞 **AASRA:** 9820466627 *(24/7)*
📞 **Snehi:** 044-24640050

I'm still here with you. Can you tell me a little about what's been happening?`;

  return {
    check: (t) => PATTERNS.some(p => p.test(t)),
    response: () => RESPONSE,
  };
})();


/* MODULE 6 — ANTHROPIC AI INTEGRATION */

const groqAI = (() => {
  const MODEL = "claude-sonnet-4-20250514";
  const ENDPOINT = "https://api.anthropic.com/v1/messages";

  function buildSystemPrompt(mv, tracker, recs, memory, sessions, turns) {
    const label = mv.score > 65 ? "positive/stable" : mv.score > 45 ? "mildly distressed" : mv.score > 28 ? "moderately distressed" : "severely distressed";

    const history = tracker.totalSessions > 2
      ? `Trend: ${tracker.trend} | Avg score: ${tracker.averageWellnessScore}/100 | Low-mood streak: ${tracker.lowStreakDays} days | Top emotions: ${tracker.topEmotions.join(", ") || "none yet"}`
      : "Not enough history yet.";

    const memBlock = memory
      ? `WHAT YOU ALREADY KNOW ABOUT THIS USER (from past conversations):\n${memory}\n`
      : "No prior memory of this user.\n";

    const sessBlock = sessions ? `THEIR RECENT CHAT SESSIONS:\n${sessions}\n` : "";

    const recBlock = recs.length
      ? recs.map(r => `  • ${r.label}: ${r.desc}`).join("\n")
      : "  • No specific actions flagged";

    const escalation = turns >= 5 && mv.score < 35
      ? "ESCALATION NOTE: This user has been struggling across several turns. You may now gently mention professional support — but only AFTER giving concrete help, and frame it warmly as an option, not a directive. Use the Indian helplines."
      : "ESCALATION NOTE: Do NOT mention professional help this turn. Focus entirely on being genuinely useful first.";

    return `You are MindMate, a warm and knowledgeable mental wellness companion for students and young adults in India. You are NOT a therapist — but you ARE a caring, smart friend who genuinely understands psychology, stress management, and wellbeing.

${memBlock}${sessBlock}CURRENT MOOD (this message):
- Wellness score: ${mv.score}/100 (${label})
- Dominant emotion: ${mv.dominant}
- Crisis flag: ${mv.hasCrisis ? "⚠️ YES" : "No"}

MOOD HISTORY: ${history}

COPING STRATEGIES TO DRAW FROM (weave in naturally, never dump as a list):
${recBlock}

${escalation}

YOUR CORE INSTRUCTIONS:

1. READ THE FULL CONVERSATION HISTORY ABOVE FIRST. You are given the entire chat history. Never ask for information the user already provided. Never repeat a question you already asked. Never give a response that could apply to ANY user — your response must be specific to THIS person and THIS message.

2. RESPOND TO WHAT THEY LITERALLY JUST SAID. The user's last message is the most important thing. If they told you their stressor, do NOT ask what their stressor is. If they answered your question, move forward — don't loop back. If it's a short message, read what came before it for context.

3. MAINTAIN CONTINUITY. Track what has been established. If the user said they're stressed about maths exams, every subsequent reply should treat that as known context. Reference earlier details naturally ("since you mentioned the maths workload earlier...").

4. BE SPECIFIC AND ACTIONABLE. Vague comfort ("you'll get through this") is unhelpful. Give something concrete to DO or THINK about. If they mention exam stress → suggest a specific revision technique. If they mention sleep → give one specific sleep hygiene change. Match your advice to exactly what they described.

5. USE CROSS-SESSION MEMORY. If you have memory of this user from past sessions, reference it naturally: "Last time you mentioned X — has that shifted at all?" This makes them feel genuinely heard.

6. ASK ONE GOOD QUESTION. End your response with ONE focused, open question that moves the conversation FORWARD — not backward over ground already covered. Make it specific to what they just shared.

7. PROFESSIONAL HELP IS A LAST RESORT. Only mention it if: (a) you've tried multiple strategies and they're still struggling badly, OR (b) the situation is clearly severe or crisis-level. When you do, say: "I want to be honest — I'm an AI and I do have real limits. What you're describing might genuinely benefit from talking to a counsellor." Then mention Indian options (iCall: 9152987821, Vandrevala: 1860-2662-345, AASRA: 9820466627).

8. CONVERSATIONAL TONE. 3–5 sentences for most turns. Simple, warm language. Max 2 emojis. No bullet points unless they ask for a list.

9. NEVER DIAGNOSE. Name emotions, reflect patterns, suggest strategies — but never say "you have depression" or "this is an anxiety disorder."

10. INDIA-SPECIFIC AWARENESS. Be sensitive to: board exam and JEE/NEET pressure, family expectations, societal pressure about career choices, competitive college admissions, stigma around mental health. These are real and specific — acknowledge them as such, not as generic "academic stress."`;
  }

  async function chat(userMessage, history, mv, tracker, recs, memory, sessions, turns) {
    const sys = buildSystemPrompt(mv, tracker, recs, memory, sessions, turns);

    /* Build messages array: last 20 history entries + current message */
    const msgs = [
      ...history.slice(-20),
      { role: "user", content: userMessage },
    ];

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: _AI_HEADERS,
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system: sys, messages: msgs }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[MindMate AI] Anthropic API error:", res.status, errText);
      throw new Error(`API ${res.status}: ${errText}`);
    }
    const data = await res.json();
    return (data.content?.[0]?.text || "").trim();
  }

  return { chat };
})();


/* MAIN PIPELINE — orchestrates all modules */

async function getAIReplyAI(userMessage, chatId) {

  /* Step 1 — Crisis check */
  if (CrisisDetector.check(userMessage)) {
    MoodTracker.record({ valence: -1, arousal: 0, dominance: -1, score: 0, dominant: "crisis", hasCrisis: true }, userMessage);
    return CrisisDetector.response();
  }

  /* Step 2 — Mood analysis */
  const mv = MoodAnalyser.analyse(userMessage);

  /* Step 3 — Record to tracker */
  MoodTracker.record(mv, userMessage);
  const tracker = MoodTracker.summary();

  /* Step 4 — Load RAG memory */
  const memory = RAGMemory.recall();
  const sessions = RAGMemory.sessionHistory();

  /* Step 5 — Build current-session history and count turns */
  const user = localStorage.getItem("loggedInUser") || "user";
  const storageKey = "mindmate_chats_" + user;
  let history = [];
  let turns = 0;

  try {
    const allChats = JSON.parse(localStorage.getItem(storageKey)) || [];
    const chat = allChats.find(c => c.id === chatId);
    if (chat?.messages) {
      turns = chat.messages.filter(m => m.sender === "user").length;
      history = chat.messages
        .filter(m => m.text && m.sender)
        .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }))
        .reduce((acc, msg) => {
          if (acc.length && acc[acc.length - 1].role === msg.role) acc[acc.length - 1].content += "\n" + msg.content;
          else acc.push(msg);
          return acc;
        }, []);

      /* Remove the last user message — it is already in the store and will be appended by groqAI.chat() */
      if (history.length > 0 && history[history.length - 1].role === "user") {
        history = history.slice(0, -1);
      }
    }
  } catch { }

  /* Step 6 — Recommendations */
  const recs = RecommendEngine.recommend(mv, tracker, turns);

  /* Step 7 — API call */
  let reply;
  try {
    reply = await groqAI.chat(userMessage, history, mv, tracker, recs, memory, sessions, turns);
  } catch (err) {
    console.error("[MindMate AI] API error:", err);
    if (typeof generateReply === "function") {
      const state = (() => { try { return JSON.parse(sessionStorage.getItem("mm_state_" + chatId)) || {}; } catch { return {}; } })();
      reply = generateReply(userMessage, state);
    } else {
      reply = "I'm here with you 💜 I had a small technical hiccup — could you tell me more about what's going on?";
    }
  }

  /* Step 8 — Async memory extraction (fires after reply, never delays user) */
  setTimeout(() => RAGMemory.extractAndStore(userMessage, reply, memory), 0);

  return reply;
}


/* DASHBOARD API */

window.MindMateBackend = {
  MoodAnalyser, MoodTracker, RAGMemory, RecommendEngine, CrisisDetector,
  getWeeklyData() { return { scores: MoodTracker.weeklyScores(), summary: MoodTracker.summary() }; },
  analyseMessage(text) { return MoodAnalyser.analyse(text); },
  getRecommendations(t, n = 0) { return RecommendEngine.recommend(MoodAnalyser.analyse(t), MoodTracker.summary(), n); },
  getUserMemory() { return RAGMemory.recall(); },
};


/* Override getAIReply() from script.js — this script must load after script.js */

function _override() {
  window.getAIReply = getAIReplyAI;
  console.info("[MindMate AI v2.0] ✅ Active — Anthropic Claude + RAG Memory + Mood Tracking.");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _override);
else _override();
