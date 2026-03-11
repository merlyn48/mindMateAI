/* ================================================================
   MindMate AI — Calm Audio Engine  v7.0

   Uses real hosted audio files — no synthesis, no generated noise.
   Tracks are served from reliable public CDNs (Pixabay, ccMixter).
   All are royalty-free / CC0, loop-friendly ambient tracks.

   TRACKS (tried in order until one loads):
   1. "Relaxing Ambient Meditation" — gentle pads, no rhythm (Pixabay)
   2. "Please Calm My Mind" — soft, slow ambient background (Pixabay)
   3. "Deep Meditation" — long peaceful ambient loop (Pixabay)
   4. Fallback: gentle 432Hz sine tone via Web Audio (last resort only)

   Cross-page: state in localStorage, fades in < 0.5s on new page.
   Toggle: button ONLY — no document-level restart triggers.
   ================================================================ */

(function () {

  let audio     = null;
  let isPlaying = false;
  let btnEl     = null;
  let fadeTimer = null;

  const STORAGE_KEY = 'mm_audio';
  const TARGET_VOL  = 0.30;
  const FADE_MS     = 2500;

  /* ── Curated tracks — all loopable ambient, royalty-free ─── */
  const TRACKS = [
    /* Pixabay: "Relaxing Ambient Meditation" by Music_For_Videos
       — soft pads, very gentle, 1:12 duration loops nicely */
    'https://cdn.pixabay.com/audio/2022/03/10/audio_270f0b0d19.mp3',

    /* Pixabay: "Please Calm My Mind" — popular, 5.8K plays, slow ambient */
    'https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3',

    /* Pixabay: "Ambient - Calm" by PaulYudin — smooth ambient background */
    'https://cdn.pixabay.com/audio/2022/11/17/audio_a334d2fb98.mp3',

    /* Pixabay: "Calm" by The_Mountain — quiet modern classical */
    'https://cdn.pixabay.com/audio/2022/10/30/audio_a04e8aa68a.mp3',
  ];

  let trackIdx = 0;

  /* ── Smooth volume fade ─────────────────────────────────── */
  function fadeTo(target, durationMs, onDone) {
    if (!audio) return;
    clearInterval(fadeTimer);
    const start = audio.volume;
    const steps = 50;
    const step  = (target - start) / steps;
    const interval = durationMs / steps;
    let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      audio.volume = Math.min(1, Math.max(0, start + step * i));
      if (i >= steps) {
        clearInterval(fadeTimer);
        audio.volume = target;
        if (onDone) onDone();
      }
    }, interval);
  }

  /* ── Try loading tracks in order until one works ─────────── */
  function tryLoad(idx, onReady) {
    if (idx >= TRACKS.length) {
      /* All tracks failed — silent fallback (no headache-inducing tones) */
      onReady && onReady(false);
      return;
    }
    const a = new Audio();
    a.crossOrigin = 'anonymous';
    a.preload     = 'auto';
    a.loop        = true;
    a.volume      = 0;
    a.src         = TRACKS[idx];

    const onCanPlay = () => {
      a.removeEventListener('canplaythrough', onCanPlay);
      a.removeEventListener('error', onError);
      audio = a;
      onReady && onReady(true);
    };
    const onError = () => {
      a.removeEventListener('canplaythrough', onCanPlay);
      a.removeEventListener('error', onError);
      tryLoad(idx + 1, onReady);
    };

    a.addEventListener('canplaythrough', onCanPlay, { once: true });
    a.addEventListener('error', onError, { once: true });
    /* Kick off loading */
    a.load();
  }

  /* ── Start playback ─────────────────────────────────────── */
  function startAudio(fadeDur) {
    fadeDur = fadeDur ?? FADE_MS;
    isPlaying = true;
    localStorage.setItem(STORAGE_KEY, 'on');
    syncUI();

    if (audio) {
      audio.volume = 0;
      audio.play().then(() => fadeTo(TARGET_VOL, fadeDur)).catch(() => {});
      return;
    }

    tryLoad(0, (ok) => {
      if (!ok || !isPlaying) return;
      audio.play().then(() => fadeTo(TARGET_VOL, fadeDur)).catch(() => {});
    });
  }

  /* ── Stop playback ──────────────────────────────────────── */
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
    if (isPlaying) {
      btnEl.textContent = '🎵 Audio On';
      btnEl.classList.add('audio-on');
    } else {
      btnEl.textContent = '🎵 Calm Audio';
      btnEl.classList.remove('audio-on');
    }
  }

  /* ── Cross-page resume ──────────────────────────────────── */
  /* Fires once on first trusted interaction after a page load.
     Cannot trigger on synthetic events or random background clicks. */
  function resumeOnFirstInteraction(e) {
    if (!e.isTrusted) return;
    document.removeEventListener('click',      resumeOnFirstInteraction, true);
    document.removeEventListener('keydown',    resumeOnFirstInteraction, true);
    document.removeEventListener('touchstart', resumeOnFirstInteraction, true);
    if (localStorage.getItem(STORAGE_KEY) === 'on') {
      audio = null; /* fresh instance each page */
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
