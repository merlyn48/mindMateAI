/* ============================================================
   MindMate AI — Global Audio Manager
   Injects a persistent floating audio button on every page
   and keeps play/pause state across navigation via localStorage.
   ============================================================ */

(function () {

  /* ── Frequencies for a binaural-like ambient tone (Web Audio API) ── */

  let audioCtx = null;
  let masterGain = null;
  let oscillators = [];
  let noiseNode = null;
  let isPlaying = false;

  /* Soft ambient chord: root + fifth + octave, slightly detuned */
  const NOTES = [
    { freq: 174.6, detune: -4 },   /* F3 — grounding */
    { freq: 261.6, detune: 3 },    /* C4 */
    { freq: 349.2, detune: -2 },   /* F4 */
    { freq: 392.0, detune: 5 },    /* G4 */
  ];

  function buildAudio() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    /* soft low-pass filter */
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.8;
    filter.connect(masterGain);

    /* tone oscillators */
    NOTES.forEach(n => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      osc.detune.value = n.detune;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      oscillators.push(osc);
    });

    /* gentle pink noise layer */
    const bufferSize = audioCtx.sampleRate * 4;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + white*0.0555179;
      b1 = 0.99332*b1 + white*0.0750759;
      b2 = 0.96900*b2 + white*0.1538520;
      b3 = 0.86650*b3 + white*0.3104856;
      b4 = 0.55000*b4 + white*0.5329522;
      b5 = -0.7616*b5 - white*0.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+white*0.5362)/7 * 0.08;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.015;
    noiseSource.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSource.start();
    noiseNode = noiseSource;
  }

  function fadeIn() {
    if (!audioCtx) buildAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.45, audioCtx.currentTime + 3.5);
    isPlaying = true;
    localStorage.setItem("mm_audio", "on");
    updateBtn();
  }

  function fadeOut() {
    if (!audioCtx) return;
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
    isPlaying = false;
    localStorage.setItem("mm_audio", "off");
    updateBtn();
  }

  /* ── Floating button ── */

  function updateBtn() {
    const btn = document.getElementById("mm-audio-fab");
    if (!btn) return;
    if (isPlaying) {
      btn.innerHTML = `<span class="mm-fab-icon">🔊</span><span class="mm-fab-label">Ambient On</span>`;
      btn.classList.add("mm-fab--active");
    } else {
      btn.innerHTML = `<span class="mm-fab-icon">🎵</span><span class="mm-fab-label">Calm Audio</span>`;
      btn.classList.remove("mm-fab--active");
    }
  }

  function injectFAB() {
    if (document.getElementById("mm-audio-fab")) return;

    const style = document.createElement("style");
    style.textContent = `
      #mm-audio-fab {
        position: fixed;
        bottom: 28px;
        right: 28px;
        z-index: 9998;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 10px 16px;
        border-radius: 50px;
        border: 1.5px solid rgba(139,124,246,0.35);
        background: rgba(255,255,255,0.12);
        backdrop-filter: blur(14px) saturate(1.6);
        -webkit-backdrop-filter: blur(14px) saturate(1.6);
        color: #7c6ee6;
        font-family: 'DM Sans', 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(.34,1.56,.64,1);
        box-shadow: 0 4px 20px rgba(124,110,230,0.18);
        letter-spacing: 0.01em;
      }
      body.dark-mode #mm-audio-fab {
        background: rgba(30,28,50,0.55);
        border-color: rgba(156,140,255,0.4);
        color: #c4baff;
      }
      #mm-audio-fab:hover {
        transform: translateY(-3px) scale(1.04);
        box-shadow: 0 8px 28px rgba(124,110,230,0.32);
        border-color: rgba(139,124,246,0.7);
      }
      #mm-audio-fab.mm-fab--active {
        background: linear-gradient(135deg, rgba(124,110,230,0.22), rgba(145,132,255,0.18));
        border-color: rgba(139,124,246,0.6);
        box-shadow: 0 0 0 4px rgba(124,110,230,0.12), 0 6px 20px rgba(124,110,230,0.28);
      }
      .mm-fab-icon {
        font-size: 15px;
        line-height: 1;
        display: flex;
        align-items: center;
      }
      .mm-fab--active .mm-fab-icon {
        animation: mm-pulse-icon 2s ease-in-out infinite;
      }
      @keyframes mm-pulse-icon {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.18); }
      }
      /* Also style the sidebar audio toggle button */
      #audioToggle {
        padding: 8px 12px;
        border-radius: 8px;
        background: rgba(139,124,246,0.1);
        border: 1px solid rgba(139,124,246,0.25);
        color: #7c6ee6;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.25s ease;
        margin-bottom: 16px;
        font-family: inherit;
      }
      #audioToggle:hover {
        background: rgba(139,124,246,0.2);
        transform: translateY(-1px);
      }
      #audioToggle.audio-on {
        background: linear-gradient(135deg, rgba(124,110,230,0.25), rgba(145,132,255,0.2));
        border-color: rgba(139,124,246,0.5);
        box-shadow: 0 2px 10px rgba(124,110,230,0.2);
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "mm-audio-fab";
    btn.setAttribute("aria-label", "Toggle calm ambient audio");
    document.body.appendChild(btn);

    btn.addEventListener("click", () => {
      if (isPlaying) fadeOut();
      else fadeIn();
    });

    updateBtn();
  }

  /* ── Sidebar toggle wiring ── */
  function wireSidebarToggle() {
    const sidebarBtn = document.getElementById("audioToggle");
    if (!sidebarBtn) return;
    sidebarBtn.addEventListener("click", () => {
      if (isPlaying) {
        fadeOut();
        sidebarBtn.classList.remove("audio-on");
        sidebarBtn.textContent = "🎧 Calm Audio";
      } else {
        fadeIn();
        sidebarBtn.classList.add("audio-on");
        sidebarBtn.textContent = "🔊 Audio Playing";
      }
    });
    if (isPlaying) {
      sidebarBtn.classList.add("audio-on");
      sidebarBtn.textContent = "🔊 Audio Playing";
    }
  }

  /* ── Init ── */
  function init() {
    injectFAB();
    wireSidebarToggle();

    /* Auto-resume if user had it on */
    const pref = localStorage.getItem("mm_audio");
    if (pref === "on") {
      /* need a user gesture first — listen once */
      const resume = () => {
        fadeIn();
        document.removeEventListener("click", resume);
        document.removeEventListener("keydown", resume);
      };
      document.addEventListener("click", resume, { once: true });
      document.addEventListener("keydown", resume, { once: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
