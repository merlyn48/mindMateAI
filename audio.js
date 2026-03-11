/* ================================================================
   MindMate AI — Calm Audio Engine  v5.0

   COMPLETE REDESIGN — no oscillators, no tones, no chords.
   Previous versions caused headaches from constant harmonic
   frequencies. This version uses only shaped noise to simulate:

   SOUNDSCAPE: "Soft Rain on Leaves"
   - Layer 1: Gentle rainfall — pink noise band-passed to the
     sweet 800–3000 Hz "rain" frequency range
   - Layer 2: Distant soft rain — lower, fuller noise bed
   - Layer 3: Occasional random "droplet" micro-bursts — short
     filtered noise pops at random intervals (0.4–1.8s apart)
     that simulate individual drops on a surface
   - Layer 4: Very soft low-frequency "room air" — sub-200Hz
     noise almost inaudible, just fills the space

   No tones. No music. No beats. Purely textural — the kind of
   sound that disappears into the background and lets you breathe.

   Cross-page consistency: resumes in < 0.5s on any new page
   interaction. Button-only toggle — no random restart on clicks.
   ================================================================ */

(function () {

  let ctx       = null;
  let master    = null;
  let isPlaying = false;
  let btnEl     = null;
  let dropTimer = null;

  const STORAGE_KEY  = 'mm_audio';
  const TARGET_GAIN  = 0.62;

  /* ── Build the rain soundscape ──────────────────────────── */
  function buildGraph() {
    if (ctx) return;
    ctx    = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);

    /* Final soft limiter */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-12, ctx.currentTime);
    comp.knee.setValueAtTime(6,        ctx.currentTime);
    comp.ratio.setValueAtTime(4,       ctx.currentTime);
    comp.attack.setValueAtTime(0.003,  ctx.currentTime);
    comp.release.setValueAtTime(0.25,  ctx.currentTime);
    comp.connect(master);
    master.connect(ctx.destination);

    /* ── Helper: make a looping pink-noise buffer ────────── */
    function makePinkNoise(seconds, stereo) {
      const sr      = ctx.sampleRate;
      const length  = Math.floor(sr * seconds);
      const channels = stereo ? 2 : 1;
      const buf     = ctx.createBuffer(channels, length, sr);

      for (let ch = 0; ch < channels; ch++) {
        const d = buf.getChannelData(ch);
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < length; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886*b0 + w*0.0555179;
          b1 = 0.99332*b1 + w*0.0750759;
          b2 = 0.96900*b2 + w*0.1538520;
          b3 = 0.86650*b3 + w*0.3104856;
          b4 = 0.55000*b4 + w*0.5329522;
          b5 = -0.7616*b5 - w*0.0168980;
          b6 = w * 0.115926;
          d[i] = (b0+b1+b2+b3+b4+b5+b6) / 7;
          /* Slightly different phase per channel for stereo width */
          if (ch === 1 && i > 0) d[i] = d[i] * 0.98 + d[i-1] * 0.02;
        }
      }
      return buf;
    }

    /* ── Layer 1: Main rainfall (stereo, 8s loop) ────────── */
    /* Band-pass centred ~1.4kHz — the natural frequency of rain */
    const rainBuf = makePinkNoise(8, true);
    const rain    = ctx.createBufferSource();
    rain.buffer   = rainBuf;
    rain.loop     = true;

    const rainBP = ctx.createBiquadFilter();
    rainBP.type            = 'bandpass';
    rainBP.frequency.value = 1400;
    rainBP.Q.value         = 0.7; /* Wide band — natural rain spread */

    /* Slight high-shelf cut so it doesn't sibilate */
    const rainHS = ctx.createBiquadFilter();
    rainHS.type            = 'highshelf';
    rainHS.frequency.value = 4000;
    rainHS.gain.value      = -9;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.55;

    rain.connect(rainBP);
    rainBP.connect(rainHS);
    rainHS.connect(rainGain);
    rainGain.connect(comp);
    rain.start();

    /* ── Layer 2: Distant rain bed (mono, 5s loop) ───────── */
    /* Lower, fuller — fills in the body under the main rain */
    const bedBuf = makePinkNoise(5, false);
    const bed    = ctx.createBufferSource();
    bed.buffer   = bedBuf;
    bed.loop     = true;

    const bedLP = ctx.createBiquadFilter();
    bedLP.type            = 'lowpass';
    bedLP.frequency.value = 700;
    bedLP.Q.value         = 0.5;

    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.28;

    bed.connect(bedLP);
    bedLP.connect(bedGain);
    bedGain.connect(comp);
    bed.start();

    /* ── Layer 3: Room air / soft wind (mono, 11s loop) ──── */
    /* Very low sub-200Hz — barely there, just fills the room */
    const airBuf = makePinkNoise(11, false);
    const air    = ctx.createBufferSource();
    air.buffer   = airBuf;
    air.loop     = true;

    const airLP = ctx.createBiquadFilter();
    airLP.type            = 'lowpass';
    airLP.frequency.value = 180;
    airLP.Q.value         = 0.3;

    const airGain = ctx.createGain();
    airGain.gain.value = 0.18;

    air.connect(airLP);
    airLP.connect(airGain);
    airGain.connect(comp);
    air.start();

    /* ── Layer 4: Random droplets ────────────────────────── */
    /* Short filtered noise bursts at random intervals.
       Each "droplet" is a tiny noise buffer with a fast
       attack and exponential decay — just like a real raindrop. */
    const dropBuf = makePinkNoise(0.12, false);

    function scheduleDroplet() {
      if (!isPlaying) return;

      const drop = ctx.createBufferSource();
      drop.buffer = dropBuf;

      /* Band-pass each droplet slightly differently for variety */
      const bp = ctx.createBiquadFilter();
      bp.type            = 'bandpass';
      bp.frequency.value = 900 + Math.random() * 2200; /* 900–3100 Hz */
      bp.Q.value         = 2.5 + Math.random() * 3;

      const g = ctx.createGain();
      const vol = 0.015 + Math.random() * 0.04;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08 + Math.random() * 0.06);

      drop.connect(bp);
      bp.connect(g);
      g.connect(comp);
      drop.start();

      /* Next droplet in 0.25–1.4 seconds */
      const nextIn = 250 + Math.random() * 1150;
      dropTimer = setTimeout(scheduleDroplet, nextIn);
    }

    /* Start droplets after a short delay so they don't front-load */
    dropTimer = setTimeout(scheduleDroplet, 800);
  }

  /* ── Fade in / out ──────────────────────────────────────── */
  function fadeIn(dur) {
    dur = dur ?? 3.0;
    if (!ctx) buildGraph();
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(TARGET_GAIN, ctx.currentTime + dur);
    isPlaying = true;
    localStorage.setItem(STORAGE_KEY, 'on');
    /* Restart droplet scheduler if it stopped */
    if (!dropTimer) {
      const drop800 = setTimeout(() => {
        dropTimer = null;
        if (isPlaying) scheduleDrop();
      }, 800);
    }
    syncUI();
  }

  function fadeOut(dur) {
    dur = dur ?? 2.0;
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    isPlaying = false;
    if (dropTimer) { clearTimeout(dropTimer); dropTimer = null; }
    localStorage.setItem(STORAGE_KEY, 'off');
    syncUI();
  }

  /* ── UI ─────────────────────────────────────────────────── */
  function syncUI() {
    if (!btnEl) btnEl = document.getElementById('audioToggle');
    if (!btnEl) return;
    btnEl.textContent = isPlaying ? '🌧 Rain On' : '🌧 Calm Rain';
    btnEl.classList.toggle('audio-on', isPlaying);
  }

  /* ── Cross-page resume ──────────────────────────────────── */
  /* Audio context dies on navigation. This listener waits for
     the first trusted user interaction on the new page, then
     rebuilds the graph and fades back in quickly (0.5s).
     It fires ONCE and removes itself — cannot trigger again. */
  function resumeOnFirstInteraction(e) {
    if (!e.isTrusted) return;
    document.removeEventListener('click',      resumeOnFirstInteraction, true);
    document.removeEventListener('keydown',    resumeOnFirstInteraction, true);
    document.removeEventListener('touchstart', resumeOnFirstInteraction, true);
    setTimeout(() => {
      if (localStorage.getItem(STORAGE_KEY) === 'on') {
        ctx = null; /* force fresh graph */
        buildGraph();
        fadeIn(0.5);
      }
    }, 300);
  }

  /* ── Button handler ─────────────────────────────────────── */
  /* ONLY the button toggles audio — never any other element */
  function onButtonClick() {
    isPlaying ? fadeOut() : fadeIn();
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    btnEl     = document.getElementById('audioToggle');
    isPlaying = localStorage.getItem(STORAGE_KEY) === 'on';

    syncUI();

    if (btnEl) {
      /* Clone to wipe any old listeners from previous page loads */
      const fresh = btnEl.cloneNode(true);
      btnEl.parentNode.replaceChild(fresh, btnEl);
      btnEl = fresh;
      btnEl.addEventListener('click', onButtonClick);
    }

    /* Register cross-page resume — only if audio was already on */
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
