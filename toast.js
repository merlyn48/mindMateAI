/* ================================================================
   MindMate AI — Toast Notifications  v3.0
   Improvements:
   - ARIA role="alert" for screen reader support
   - Icon added per toast type for visual clarity
   - Dismissable on click
   ================================================================ */

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    document.body.appendChild(container);
  }

  const icons = { success: "✓", error: "✕", info: "ℹ" };

  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.setAttribute("role", "alert");
  toast.style.cursor = "pointer";

  const icon = document.createElement("span");
  icon.textContent = icons[type] || icons.info;
  icon.style.cssText = "font-weight:700;flex-shrink:0;";

  const msg = document.createElement("span");
  msg.textContent = message; // textContent — safe from XSS

  toast.appendChild(icon);
  toast.appendChild(msg);
  container.appendChild(toast);

  const dismiss = () => {
    toast.style.animation = "toastOut 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  };

  toast.addEventListener("click", dismiss);
  setTimeout(dismiss, 3500);
}
