/* ================================================================
   MindMate AI — Toast Notifications  v3.1
   - No icons (cleaner look)
   - ARIA role="alert" for screen readers
   - Click to dismiss
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

  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.setAttribute("role", "alert");
  toast.style.cursor = "pointer";

  const msg = document.createElement("span");
  msg.textContent = message;
  toast.appendChild(msg);
  container.appendChild(toast);

  const dismiss = () => {
    toast.style.animation = "toastOut 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  };

  toast.addEventListener("click", dismiss);
  setTimeout(dismiss, 3500);
}
