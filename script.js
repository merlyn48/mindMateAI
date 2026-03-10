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

/* ── Conversation context for AI (persists across page loads via sessionStorage) ── */
function getConversationHistory(chatId) {
  return safeParseJSON(sessionStorage.getItem("mm_ctx_" + chatId), []);
}
function saveConversationHistory(chatId, history) {
  // Keep last 20 turns to stay within context window
  const trimmed = history.slice(-20);
  try { sessionStorage.setItem("mm_ctx_" + chatId, JSON.stringify(trimmed)); }
  catch { /* sessionStorage full — clear old entries */ sessionStorage.clear(); }
}

/* ── Anthropic AI call ────────────────────────────────────── */
async function getAIReply(userMessage, chatId) {
  const history = getConversationHistory(chatId);

  const systemPrompt = `You are MindMate AI, a warm and compassionate mental health support chatbot for students. 
Your role is to provide emotional support, practical coping strategies, and a safe space to talk.
You specialise in: exam stress, anxiety, sadness and low mood, sleep problems, motivation, and career guidance.
Guidelines:
- Be warm, empathetic, and non-judgmental at all times
- Ask follow-up questions to better understand the user's situation
- Offer practical, evidence-based coping strategies (CBT, mindfulness, sleep hygiene etc.)
- For crisis situations (self-harm mentions), immediately provide crisis resources: iCall India: 9152987821, Vandrevala Foundation: 1860-2662-345
- Keep responses concise (2-4 sentences usually) unless the situation calls for more depth
- Use gentle, supportive language — avoid clinical jargon
- Do not diagnose or prescribe — recommend professional help when appropriate
- Respond only in plain text, no markdown formatting`;

  const messages = [
    ...history,
    { role: "user", content: userMessage }
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) throw new Error("API error: " + response.status);
    const data = await response.json();
    const reply = data.content?.map(b => b.text || "").join("").trim();
    if (!reply) throw new Error("Empty response");

    // Save updated history
    saveConversationHistory(chatId, [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: reply }
    ]);

    return reply;
  } catch (err) {
    console.error("AI error:", err);
    return "I'm having a little trouble connecting right now. Please try again in a moment 💜";
  }
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
