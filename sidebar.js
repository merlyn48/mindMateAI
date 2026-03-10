/* ================================================================
   MindMate AI — Sidebar  v3.0
   Improvements:
   - Uses loggedInEmail to look up the correct user record
   - Safe JSON parsing with fallback
   - Reads auth.js logout() — no duplicate definition needed
   ================================================================ */

(function () {
  function safeParseJSON(val, fallback) {
    try { return val ? JSON.parse(val) : fallback; }
    catch { return fallback; }
  }

  const sidebarAvatar = document.getElementById("sidebarAvatar");
  const sidebarName   = document.getElementById("sidebarName");

  const email = localStorage.getItem("loggedInEmail");
  const user  = email ? safeParseJSON(localStorage.getItem("mindmate_user_" + email), null) : null;
  const avatar = localStorage.getItem("mindmate_avatar_" + (email || ""));

  if (sidebarName) {
    sidebarName.textContent = user?.name || localStorage.getItem("loggedInUser") || "User";
  }

  if (sidebarAvatar) {
    if (avatar) {
      sidebarAvatar.src = avatar;
    } else {
      const displayName = user?.name || localStorage.getItem("loggedInUser") || "User";
      sidebarAvatar.src =
        "https://ui-avatars.com/api/?name=" +
        encodeURIComponent(displayName) +
        "&background=8b7cf6&color=fff";
    }
  }
})();
