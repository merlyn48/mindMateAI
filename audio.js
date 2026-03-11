/* ================================================================
   MindMate AI — Calm Audio Engine  v8.0
   Plays a single local file: calm-guitar.mp3
   Smooth fade in/out. Button-only toggle. Cross-page persistence.
   ================================================================ */

(function () {

  let audio     = null;
  let isPlaying = false;
  let btnEl     = null;
  let fadeTimer = null;

  const STORAGE_KEY = 'mm_audio';
  const TARGET_VOL  = 0.35;

  /* ── Smooth fade ────────────────────────────────────────── */
  function fadeTo(target, durationMs, onDone) {
    if (!audio) return;
    clearInterval(fadeTimer);
    const start    = audio.volume;
    const steps    = 40;
    const stepSize = (target - start) / steps;
    const interval = durationMs / steps;
    let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      audio.volume = Math.min(1, Math.max(0, start + stepSize * i));
      if (i >= steps) {
        clearInterval(fadeTimer);
        audio.volume = target;
        if (onDone) onDone();
      }
    }, interval);
  }

  /* ── Start ──────────────────────────────────────────────── */
  function startAudio(fadeDur) {
    fadeDur   = fadeDur ?? 2500;
    isPlaying = true;
    localStorage.setItem(STORAGE_KEY, 'on');
    syncUI();

    if (!audio) {
      audio          = new Audio('calm-guitar.mp3');
      audio.loop     = true;
      audio.volume   = 0;
      audio.preload  = 'auto';
    }

    audio.volume = 0;
    audio.play().then(() => fadeTo(TARGET_VOL, fadeDur)).catch(() => {});
  }

  /* ── Stop ───────────────────────────────────────────────── */
  function stopAudio() {
    isPlaying = false;
    localStorage.setItem(STORAGE_KEY, 'off');
    syncUI();
    if (!audio) return;
    fadeTo(0, 1500, () => audio.pause());
  }

  /* ── UI ─────────────────────────────────────────────────── */
  function syncUI() {
    if (!btnEl) btnEl = document.getElementById('audioToggle');
    if (!btnEl) return;
    btnEl.textContent = isPlaying ? '🎵 Audio On' : '🎵 Calm Audio';
    btnEl.classList.toggle('audio-on', isPlaying);
  }

  /* ── Cross-page resume ──────────────────────────────────── */
  function resumeOnFirstInteraction(e) {
    if (!e.isTrusted) return;
    document.removeEventListener('click',      resumeOnFirstInteraction, true);
    document.removeEventListener('keydown',    resumeOnFirstInteraction, true);
    document.removeEventListener('touchstart', resumeOnFirstInteraction, true);
    if (localStorage.getItem(STORAGE_KEY) === 'on') {
      audio = null;
      setTimeout(() => startAudio(500), 200);
    }
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    btnEl     = document.getElementById('audioToggle');
    isPlaying = localStorage.getItem(STORAGE_KEY) === 'on';
    syncUI();

    if (btnEl) {
      const fresh = btnEl.cloneNode(true);
      btnEl.parentNode.replaceChild(fresh, btnEl);
      btnEl = fresh;
      btnEl.addEventListener('click', () => isPlaying ? stopAudio() : startAudio());
    }

    if (isPlaying) {
      document.addEventListener('click',      resumeOnFirstInteraction, { capture: true, once: true });
      document.addEventListener('keydown',    resumeOnFirstInteraction, { capture: true, once: true });
      document.addEventListener('touchstart', resumeOnFirstInteraction, { capture: true, once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
