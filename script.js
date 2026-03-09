/* ================= ELEMENTS ================= */

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatContainer = document.getElementById("chatContainer");
const typingIndicator = document.getElementById("typingIndicator");
const newChatBtn = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");
const themeToggle = document.getElementById("themeToggle");
const suggestionButtons = document.querySelectorAll(".suggestion-btn");
const welcomeScreen = document.getElementById("welcomeScreen");

/* ================= USER STORAGE ================= */

const currentUser = localStorage.getItem("loggedInUser");
const storageKey = "mindmate_chats_" + currentUser;

let chats = JSON.parse(localStorage.getItem(storageKey)) || [];
let currentChatId = null;

/* ================= CONVERSATION STATE ================= */

let conversationState = {
    topic: null,
    stage: null,
    lastIntent: null
};

/* ================= LOAD ================= */

window.onload = () => {

    renderChatList();

    if (chats.length > 0) {
        loadChat(chats[0].id);
    }

    /* THEME LOAD */

    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
        if(themeToggle) themeToggle.textContent = "☀️ Light Mode";
    } else {
        if(themeToggle) themeToggle.textContent = "🌙 Dark Mode";
    }

};

/* ================= THEME ================= */

if(themeToggle){

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

/* ================= SAVE ================= */

function saveChats() {
    localStorage.setItem(storageKey, JSON.stringify(chats));
}

/* ================= NEW CHAT ================= */

if(newChatBtn){
newChatBtn.addEventListener("click", createNewChat);
}

function createNewChat() {

    const chat = {
        id: "chat_" + Date.now(),
        name: "New Chat",
        messages: []
    };

    chats.unshift(chat);
    currentChatId = chat.id;

    conversationState.topic = null;
    conversationState.stage = null;
    conversationState.lastIntent = null;

    saveChats();
    renderChatList();
    loadChat(chat.id);
}

/* ================= LOAD CHAT ================= */

function loadChat(chatId) {

    currentChatId = chatId;

    if(!chatContainer) return;

    chatContainer.innerHTML = "";

    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    if (chat.messages.length === 0) {
        if(welcomeScreen) welcomeScreen.style.display = "block";
    } else {
        if(welcomeScreen) welcomeScreen.style.display = "none";
    }

    chat.messages.forEach(msg => {
        createMessage(msg.text, msg.sender);
    });

    renderChatList();
}

/* ================= SIDEBAR ================= */

function renderChatList() {

    if(!historyList) return;

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

        const renameBtn = document.createElement("button");
        renameBtn.textContent = "✏";
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            renameChat(chat.id);
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        };

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        li.appendChild(title);
        li.appendChild(actions);

        historyList.appendChild(li);

    });
}

function renameChat(chatId) {

    const chat = chats.find(c => c.id === chatId);

    const newName = prompt("Rename chat", chat.name);
    if (!newName) return;

    chat.name = newName;

    saveChats();
    renderChatList();
}

function deleteChat(chatId) {

    if (!confirm("Delete this chat?")) return;

    chats = chats.filter(c => c.id !== chatId);

    if (chats.length > 0) {
        currentChatId = chats[0].id;
    } else {
        currentChatId = null;

        if(chatContainer) chatContainer.innerHTML = "";
        if(welcomeScreen) welcomeScreen.style.display = "block";
    }

    saveChats();
    renderChatList();

    if (currentChatId) loadChat(currentChatId);
}

/* ================= SEND MESSAGE ================= */

function sendMessage() {

    if(!messageInput) return;

    const text = messageInput.value.trim();
    if (!text) return;

    if(welcomeScreen) welcomeScreen.style.display = "none";

    addMessage(text, "user");

    messageInput.value = "";

    showTyping();

    setTimeout(() => {

        hideTyping();

        const reply = generateReply(text);

        addMessage(reply, "bot");

    }, 1000);
}

function addMessage(text, sender) {

    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    chat.messages.push({ text, sender });

    saveChats();
    /* update dashboard counter */

let count = localStorage.getItem("mindmate_chat_count") || 0;
count++;
localStorage.setItem("mindmate_chat_count", count);

    createMessage(text, sender);
}

function createMessage(text, sender) {

    if(!chatContainer) return;

    const div = document.createElement("div");

    div.classList.add("message", sender === "user" ? "user-message" : "bot-message");

    div.innerHTML = `${text}<div class="timestamp">${getTime()}</div>`;

    chatContainer.appendChild(div);

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* ================= INTENT DETECTION ================= */

function detectIntent(text) {

    text = text.toLowerCase();

    if (text.match(/hi|hello|hey/)) return "greeting";
    if (text.match(/exam|test|study|fail|syllabus|marks/)) return "exam_stress";
    if (text.match(/anxiety|panic|nervous|overthink/)) return "anxiety";
    if (text.match(/sad|depressed|lonely|low/)) return "sadness";

    return "unknown";
}

/* ================= RESPONSE LOGIC ================= */

function generateReply(text) {

    const intent = detectIntent(text);
    const lowerText = text.toLowerCase();

    /* Gratitude */

    if (lowerText.match(/thank|thanks|helpful|appreciate/)) {

        conversationState.topic = "gratitude";

        return random([
            "You're very welcome. I'm glad I could help a little.",
            "Happy to help. Remember to take things one step at a time.",
            "Anytime. I'm here whenever you need to talk."
        ]);
    }

    /* Topic switching */

    if (intent !== "unknown" && intent !== "greeting" && intent !== conversationState.topic) {

        return startNewTopic(intent);
    }

    /* Continue topic */

    if (conversationState.topic === "exam_stress") return handleExamStress(lowerText);
    if (conversationState.topic === "anxiety") return handleAnxiety(lowerText);
    if (conversationState.topic === "sadness") return handleSadness(lowerText);

    /* Greeting */

    if (intent === "greeting") {

        conversationState.topic = null;

        return random([
            "Hi there. I'm here to listen. How are you feeling today?",
            "Hello. What's been on your mind lately?"
        ]);
    }

    /* Fallback */

    return random([
        "I see. Could you tell me a bit more about that?",
        "That sounds important. How does that make you feel?",
        "I'm listening. Go on."
    ]);
}

/* ================= TOPIC HANDLERS ================= */

function startNewTopic(intent) {

    conversationState.topic = intent;

    if (intent === "exam_stress") {

        return random([
            "Exams can be overwhelming. What's the biggest challenge you're facing right now?",
            "I hear you. What part of the exams is worrying you the most?"
        ]);
    }

    if (intent === "anxiety") {

        return "Anxiety can feel heavy. Do you notice it more at certain times of the day?";
    }

    if (intent === "sadness") {

        return "I'm sorry you're feeling this way. Would it help to talk about what's been happening?";
    }
}

function handleExamStress(text) {

    if (text.match(/technique|strategy|tip|method/)) {

        return "You could try the Pomodoro Technique: study for 25 minutes and take a 5-minute break. It helps your brain stay focused.";
    }

    if (text.match(/phone|scroll|social media/)) {

        return "Phones can easily distract us. Try keeping it in another room while studying.";
    }

    if (text.match(/syllabus|time|heavy/)) {

        return "When the syllabus feels huge, try focusing on one chapter at a time.";
    }

    return random([
        "Exams can feel overwhelming, but you're not alone in that feeling.",
        "Thanks for sharing that with me. What subject feels hardest right now?",
        "It sounds like you're carrying a lot of pressure."
    ]);
}

function handleAnxiety(text) {

    if (text.match(/yes|ok|sure|how/)) {

        return "Try this: name 3 things you can see and 2 things you can hear. It helps ground your mind.";
    }

    return "Taking slow breaths for a minute can sometimes calm anxiety. Would you like to try that?";
}

function handleSadness() {

    return "Thank you for sharing that with me. Is there something recently that made you feel a little better?";
}

/* ================= UTILS ================= */

function random(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function getTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function showTyping(){
if(typingIndicator) typingIndicator.classList.remove("hidden");
}

function hideTyping(){
if(typingIndicator) typingIndicator.classList.add("hidden");
}

/* ================= EVENTS ================= */

if(sendBtn){
sendBtn.addEventListener("click", sendMessage);
}

if(messageInput){
messageInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});
}

suggestionButtons.forEach(btn => {

    btn.addEventListener("click", () => {

        if(messageInput){
        messageInput.value = btn.textContent;
        sendMessage();
        }

    });

});

function showToast(message){

const toast = document.createElement("div");
toast.className = "toast";
toast.innerText = message;

document.body.appendChild(toast);

setTimeout(()=>{
toast.classList.add("show");
},100);

setTimeout(()=>{
toast.classList.remove("show");
setTimeout(()=>toast.remove(),300);
},3000);

}
