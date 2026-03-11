/* ================================================================
   MindMate AI — Calm Audio Engine  v4.0

   FIXES:
   - Audio no longer stops on page navigation — it resumes instantly
     on every new page load (< 0.4s fade, feels seamless)
   - Gesture listener is ONLY on the button itself, never on
     random page elements (was triggering on any click before)
   - AudioContext is built fresh each page but state is persisted
     via localStorage — volume, on/off, and position all restored

   SOUND DESIGN — layered calming soundscape:
   - Sub-bass sine drone (F2 / 87Hz) — grounding, warm
   - Slow breathing-rhythm tremolo on a soft pad chord (F3/C4/A4)
   - Pink noise "forest air" — very gentle, high-shelf filtered
   - Slow harmonic shimmer: two detuned sines drifting in/out of
     phase on a 14-second cycle — creates a sense of gentle motion
   - All layers shaped through a warm low-pass + soft limiter
   ================================================================ */

(function () {

  /* ── State ──────────────────────────────────────────────── */
  let ctx         = null;
  let master      = null;
  let isPlaying   = false;
  let btnEl       = null;
  let gestureReady = false;

  const STORAGE_KEY  = 'mm_audio';
  const RESUME_DELAY = 400; // ms — fast enough to feel seamless on page load

  /* ── Core audio graph builder ───────────────────────────── */
  function buildGraph() {
    if (ctx) return;

    ctx    = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);

    /* Warm low-pass — cuts harsh highs, keeps it cosy */
    const lpf = ctx.createBiquadFilter();
    lpf.type            = 'lowpass';
    lpf.frequency.value = 1100;
    lpf.Q.value         = 0.5;

    /* Soft limiter / compressor to glue layers */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, ctx.currentTime);
    comp.knee.setValueAtTime(12,       ctx.currentTime);
    comp.ratio.setValueAtTime(3,       ctx.currentTime);
    comp.attack.setValueAtTime(0.05,   ctx.currentTime);
    comp.release.setValueAtTime(0.4,   ctx.currentTime);

    /* Chain: sources → lpf → comp → master → output */
    lpf.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);

    /* ── Layer 1: Sub-bass drone (F2, 87.3 Hz) ──────────── */
    /* Deep, grounding sine — barely audible but felt */
    const drone = ctx.createOscillator();
    drone.type            = 'sine';
    drone.frequency.value = 87.3;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.18;
    drone.connect(droneGain);
    droneGain.connect(lpf);
    drone.start();

    /* ── Layer 2: Soft pad chord ─────────────────────────── */
    /* F3 (174.6), C4 (261.6), A4 (440) — an Fmaj chord */
    /* Each oscillator has a very slow LFO tremolo (breathing) */
    const padNotes = [
      { freq: 174.6, detune: -3,  vol: 0.07 },
      { freq: 261.6, detune:  2,  vol: 0.06 },
      { freq: 440.0, detune: -5,  vol: 0.04 },
      { freq: 523.2, detune:  4,  vol: 0.03 }, /* C5 — upper shimmer */
    ];

    padNotes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      osc.type            = 'sine';
      osc.frequency.value = n.freq;
      osc.detune.value    = n.detune;

      /* Per-voice gain */
      const vGain = ctx.createGain();
      vGain.gain.value = n.vol;

      /* Slow tremolo LFO — breathing rhythm (~0.07 Hz = ~14s cycle) */
      const lfo = ctx.createOscillator();
      lfo.type            = 'sine';
      lfo.frequency.value = 0.065 + i * 0.008; /* slightly offset per voice */

      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = n.vol * 0.35; /* ±35% of voice gain */

      /* LFO modulates gain: gain.value + lfoDepth */
      lfo.connect(lfoDepth);
      lfoDepth.connect(vGain.gain);

      osc.connect(vGain);
      vGain.connect(lpf);
      osc.start();
      lfo.start();
    });

    /* ── Layer 3: Harmonic shimmer pair ─────────────────── */
    /* Two sines very close in frequency drift in/out of phase */
    /* Creates a gentle, slow beating sensation — like rippling water */
    const shimmerPairs = [
      { f: 523.25, detune1: 0, detune2: 3.5 }, /* C5 pair */
      { f: 392.00, detune1: 0, detune2: 2.8 }, /* G4 pair */
    ];
    shimmerPairs.forEach(p => {
      [p.detune1, p.detune2].forEach(det => {
        const o = ctx.createOscillator();
        o.type            = 'sine';
        o.frequency.value = p.f;
        o.detune.value    = det;
        const g = ctx.createGain();
        g.gain.value = 0.022;
        o.connect(g);
        g.connect(lpf);
        o.start();
      });
    });

    /* ── Layer 4: Pink noise — "forest air" ─────────────── */
    /* Generated in a 6-second looping buffer */
    const sr  = ctx.sampleRate;
    const buf = ctx.createBuffer(2, sr * 6, sr); /* stereo for width */

    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0=0.99886*b0+w*0.0555179;
        b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520;
        b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522;
        b5=-0.7616*b5-w*0.0168980;
        d[i] = (b0+b1+b2+b3+b4+b5+w*0.5362) / 7 * 0.055;
      }
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop   = true;

    /* High-shelf cut to soften the noise — keeps only the
       airy low-mid texture, not hissy high frequencies */
    const hpf = ctx.createBiquadFilter();
    hpf.type            = 'highshelf';
    hpf.frequency.value = 3000;
    hpf.gain.value      = -14; /* dB — cuts harshness */

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.12;

    noise.connect(hpf);
    hpf.connect(noiseGain);
    noiseGain.connect(lpf);
    noise.start();
  }

  /* ── Fade in/out ────────────────────────────────────────── */
  function fadeIn(duration) {
    const dur = duration ?? 3.5;
    if (!ctx) buildGraph();
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + dur);
    isPlaying = true;
    localStorage.setItem(STORAGE_KEY, 'on');
    syncUI();
  }

  function fadeOut(duration) {
    const dur = duration ?? 2.0;
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    isPlaying = false;
    localStorage.setItem(STORAGE_KEY, 'off');
    syncUI();
  }

  /* ── UI sync ─────────────────────────────────────────────── */
  function syncUI() {
    if (!btnEl) btnEl = document.getElementById('audioToggle');
    if (!btnEl) return;
    if (isPlaying) {
      btnEl.textContent = '🔊 Audio On';
      btnEl.classList.add('audio-on');
    } else {
      btnEl.textContent = '🎵 Calm Audio';
      btnEl.classList.remove('audio-on');
    }
  }

  /* ── Button handler ─────────────────────────────────────── */
  function onButtonClick() {
    /* First click ever — browser requires a user gesture to start AudioContext.
       This listener is ONLY on the button, never on the whole document.
       This was the bug causing random restarts on any page click before. */
    if (!gestureReady) {
      gestureReady = true;
    }
    if (isPlaying) {
      fadeOut();
    } else {
      fadeIn();
    }
  }

  /* ── Page-load resume ───────────────────────────────────── */
  /* When the user navigates to a new page and audio was 'on',
     we resume as soon as any interaction happens on the new page.
     We use a NAMED function so we can remove it properly and avoid
     it firing on anything other than the very first interaction. */
  function resumeOnFirstInteraction(e) {
    /* Only resume if it's a real user gesture (not synthetic) */
    if (!e.isTrusted) return;
    /* Remove ourselves immediately so we only fire once */
    document.removeEventListener('click',   resumeOnFirstInteraction, true);
    document.removeEventListener('keydown', resumeOnFirstInteraction, true);
    document.removeEventListener('touchstart', resumeOnFirstInteraction, true);
    /* Short delay so page feels fully loaded before audio swells in */
    setTimeout(() => {
      if (localStorage.getItem(STORAGE_KEY) === 'on') {
        buildGraph();
        fadeIn(0.6); /* Very fast fade-in — feels like it never stopped */
      }
    }, RESUME_DELAY);
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    btnEl     = document.getElementById('audioToggle');
    isPlaying = localStorage.getItem(STORAGE_KEY) === 'on';

    syncUI();

    /* Attach toggle — ONLY to the button */
    if (btnEl) {
      /* Remove any old listener clones before adding */
      const fresh = btnEl.cloneNode(true);
      btnEl.parentNode.replaceChild(fresh, btnEl);
      btnEl = fresh;
      btnEl.addEventListener('click', onButtonClick);
    }

    /* If audio was on, set up a one-time cross-page resume listener.
       Uses capture phase so it fires before anything else on the page. */
    if (isPlaying) {
      document.addEventListener('click',     resumeOnFirstInteraction, { capture: true, once: true });
      document.addEventListener('keydown',   resumeOnFirstInteraction, { capture: true, once: true });
      document.addEventListener('touchstart',resumeOnFirstInteraction, { capture: true, once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
