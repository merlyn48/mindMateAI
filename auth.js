/* ================================================================
   MindMate AI — Auth  v3.0
   Improvements:
   - Password hashing via SHA-256 (Web Crypto API) — no plaintext
   - Multi-user support: each user stored individually by email key
   - Input validation with clear error messages
   - XSS-safe: all DOM writes use textContent
   ================================================================ */

/* ── Simple SHA-256 via Web Crypto ─────────────────────────── */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "mindmate_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ── Safe localStorage helpers ─────────────────────────────── */
function safeGetJSON(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

/* ── Register ───────────────────────────────────────────────── */
async function register() {
  const name     = document.getElementById("name")?.value?.trim();
  const email    = document.getElementById("email")?.value?.trim().toLowerCase();
  const password = document.getElementById("password")?.value;

  if (!name || !email || !password) {
    showToast("Please fill in all fields", "error");
    return;
  }
  if (name.length < 2) {
    showToast("Name must be at least 2 characters", "error");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Please enter a valid email address", "error");
    return;
  }
  if (password.length < 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  // Check if email already registered
  const existingUser = safeGetJSON("mindmate_user_" + email);
  if (existingUser) {
    showToast("An account with this email already exists", "error");
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = { name, email, passwordHash, createdAt: Date.now() };

  localStorage.setItem("mindmate_user_" + email, JSON.stringify(user));
  showToast("Account created successfully! Redirecting…", "success");
  setTimeout(() => { window.location.href = "login.html"; }, 1200);
}

/* ── Login ──────────────────────────────────────────────────── */
async function login() {
  const email    = document.getElementById("email")?.value?.trim().toLowerCase();
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    showToast("Please fill in all fields", "error");
    return;
  }

  const storedUser = safeGetJSON("mindmate_user_" + email);
  if (!storedUser) {
    showToast("No account found with this email", "error");
    return;
  }

  const passwordHash = await hashPassword(password);
  if (storedUser.passwordHash !== passwordHash) {
    showToast("Incorrect password", "error");
    return;
  }

  localStorage.setItem("loggedInUser", storedUser.name);
  localStorage.setItem("loggedInEmail", email);
  showToast("Welcome back, " + storedUser.name + "!", "success");
  setTimeout(() => { window.location.href = "dashboard.html"; }, 800);
}

/* ── Logout ─────────────────────────────────────────────────── */
function logout() {
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("loggedInEmail");
  window.location.href = "login.html";
}

/* ── Enter key support ──────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("input").forEach(input => {
    input.addEventListener("keypress", e => {
      if (e.key === "Enter") {
        const isRegister = !!document.getElementById("name");
        isRegister ? register() : login();
      }
    });
  });
});
