/* ================================================================
   MindMate AI — Auth  v3.1
   Fix: Enter key listener now only activates on login/register pages,
        not on every page (was triggering "fill all fields" in chat)
   ================================================================ */

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "mindmate_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function safeGetJSON(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

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

  const existingUser = safeGetJSON("mindmate_user_" + email);
  if (existingUser) {
    showToast("An account with this email already exists", "error");
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = { name, email, passwordHash, createdAt: Date.now() };
  localStorage.setItem("mindmate_user_" + email, JSON.stringify(user));
  showToast("Account created! Redirecting…", "success");
  setTimeout(() => { window.location.href = "login.html"; }, 1200);
}

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

function logout() {
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("loggedInEmail");
  window.location.href = "login.html";
}

/* ── Enter key — ONLY on auth pages (login.html / register.html) ── */
document.addEventListener("DOMContentLoaded", () => {
  const page = location.pathname.split("/").pop();
  const isAuthPage = page === "login.html" || page === "register.html";
  if (!isAuthPage) return; // Do not attach on chat, dashboard, or any other page

  document.querySelectorAll("input").forEach(input => {
    input.addEventListener("keypress", e => {
      if (e.key === "Enter") {
        const isRegister = !!document.getElementById("name");
        isRegister ? register() : login();
      }
    });
  });
});
