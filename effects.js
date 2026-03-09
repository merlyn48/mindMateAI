/* ============================================================
   MindMate AI — UI Enhancements
   Cursor sparkles · Active nav link · Smooth scroll
   ============================================================ */

(function () {

  /* ── Cursor sparkles ─────────────────────────────────── */

  const SPARKS = ['✦','✧','·','⊹','∘','⋆'];

  let lastSpark = 0;

  document.addEventListener('mousemove', function (e) {

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
