/* ============================================================
   MindMate AI — UI Enhancements  v3.1
   Dark mode init · Cursor sparkles · Active nav · Card stagger
   ============================================================ */

(function () {

  /* ── Dark mode — applied immediately on every page load ─ */
  /* Runs before DOMContentLoaded to avoid flash of light mode */
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark-mode');
    document.body && document.body.classList.add('dark-mode');
  }

  /* Re-apply once body is available (covers edge cases) */
  function applyDarkMode() {
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-mode');
    }
    /* Sync the theme toggle button label if present */
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.textContent = localStorage.getItem('theme') === 'dark'
        ? '☀️ Light Mode'
        : '🌙 Dark Mode';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDarkMode);
  } else {
    applyDarkMode();
  }

  /* ── Cursor sparkles ─────────────────────────────────── */

  const SPARKS = ['✦','✧','·','⊹','∘','⋆'];
  let lastSpark = 0;

  document.addEventListener('mousemove', function (e) {
    if (localStorage.getItem('mm_sparkles') === 'off') return;
    const now = Date.now();
    if (now - lastSpark < 110) return;
    lastSpark = now;

    const el = document.createElement('span');
    el.className = 'sparkle';
    el.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)];
    el.style.cssText = `
      left: ${e.clientX + (Math.random() * 16 - 8)}px;
      top:  ${e.clientY + (Math.random() * 16 - 8)}px;
      color: hsl(${240 + Math.random() * 60}, 70%, 72%);
      pointer-events: none;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  });

  /* ── Active nav link highlight ───────────────────────── */

  function markActiveLink() {
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar a').forEach(a => {
      const href = a.getAttribute('href');
      if (href && (href === page || (page === '' && href === 'index.html'))) {
        a.classList.add('active');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markActiveLink);
  } else {
    markActiveLink();
  }

  /* ── Staggered card animations ───────────────────────── */

  function staggerCards() {
    const cards = document.querySelectorAll('.card-box, .support-card, .faq-item');
    cards.forEach((card, i) => {
      card.style.animationDelay = `${i * 0.06}s`;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', staggerCards);
  } else {
    staggerCards();
  }

})();
