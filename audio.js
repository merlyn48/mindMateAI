/* ============================================================
   MindMate AI — Global Audio Manager  v2.1
   Fixes:
   - FAB moves to bottom-LEFT so it never overlaps the chat
     send button (which is bottom-right)
   - Audio state is truly uniform: the FAB reflects the stored
     preference immediately on every page load, no flicker
   ============================================================ */

(function () {

  let audioCtx   = null;
  let masterGain = null;
  let isPlaying  = false;

  const NOTES = [
    { freq: 174.6, detune: -4 },
    { freq: 261.6, detune:  3 },
    { freq: 349.2, detune: -2 },
    { freq: 392.0, detune:  5 },
  ];

  /* ── build Web Audio graph (once per page) ── */
  function buildAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    const filter = audioCtx.createBiquadFilter();
    filter.type           = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value         = 0.8;
    filter.connect(masterGain);

    NOTES.forEach(n => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type           = 'sine';
      osc.frequency.value = n.freq;
      osc.detune.value    = n.detune;
      gain.gain.value     = 0.06;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
    });

    /* pink noise */
    const sr  = audioCtx.sampleRate;
    const buf = audioCtx.createBuffer(1, sr * 4, sr);
    const d   = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+w*0.5362)/7 * 0.08;
    }
    const ns = audioCtx.createBufferSource();
    ns.buffer = buf; ns.loop = true;
    const ng  = audioCtx.createGain(); ng.gain.value = 0.015;
    ns.connect(ng); ng.connect(masterGain); ns.start();
  }

  /* ── fade helpers ── */
  function fadeIn() {
    if (!audioCtx) buildAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.45, audioCtx.currentTime + 3.5);
    isPlaying = true;
    localStorage.setItem('mm_audio', 'on');
    syncAllUI();
  }

  function fadeOut() {
    if (!audioCtx) return;
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
    isPlaying = false;
    localStorage.setItem('mm_audio', 'off');
    syncAllUI();
  }

  /* ── keep FAB + sidebar button in sync ── */
  function syncAllUI() {
    /* FAB */
    const fab = document.getElementById('mm-audio-fab');
    if (fab) {
      if (isPlaying) {
        fab.innerHTML = '<span class="mm-fab-icon">🔊</span><span class="mm-fab-label">Audio On</span>';
        fab.classList.add('mm-fab--active');
      } else {
        fab.innerHTML = '<span class="mm-fab-icon">🎵</span><span class="mm-fab-label">Calm Audio</span>';
        fab.classList.remove('mm-fab--active');
      }
    }

  }

  /* ── inject the FAB (bottom-LEFT, away from chat send btn) ── */
  function injectFAB() {
    if (document.getElementById('mm-audio-fab')) return;

    const style = document.createElement('style');
    style.textContent = `
      #mm-audio-fab {
        position: fixed;
        bottom: 108px;
        left: 24px;           /* LEFT side — never overlaps send button */
        z-index: 9998;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 10px 16px;
        border-radius: 50px;
        border: 1.5px solid rgba(139,124,246,0.35);
        background: rgba(255,255,255,0.75);
        backdrop-filter: blur(14px) saturate(1.6);
        -webkit-backdrop-filter: blur(14px) saturate(1.6);
        color: #7c6ee6;
        font-family: 'DM Sans','Inter',sans-serif;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(.34,1.56,.64,1);
        box-shadow: 0 4px 20px rgba(124,110,230,0.18);
        letter-spacing: 0.01em;
      }
      body.dark-mode #mm-audio-fab {
        background: rgba(30,28,50,0.72);
        border-color: rgba(156,140,255,0.4);
        color: #c4baff;
      }
      #mm-audio-fab:hover {
        transform: translateY(-3px) scale(1.04);
        box-shadow: 0 8px 28px rgba(124,110,230,0.32);
        border-color: rgba(139,124,246,0.7);
      }
      #mm-audio-fab.mm-fab--active {
        background: linear-gradient(135deg,rgba(124,110,230,0.18),rgba(145,132,255,0.14));
        border-color: rgba(139,124,246,0.6);
        box-shadow: 0 0 0 4px rgba(124,110,230,0.10), 0 6px 20px rgba(124,110,230,0.26);
      }
      .mm-fab-icon { font-size:15px; line-height:1; display:flex; align-items:center; }
      .mm-fab--active .mm-fab-icon { animation: mm-pulse 2s ease-in-out infinite; }
      @keyframes mm-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'mm-audio-fab';
    btn.setAttribute('aria-label', 'Toggle calm ambient audio');
    document.body.appendChild(btn);

    btn.addEventListener('click', () => isPlaying ? fadeOut() : fadeIn());
    syncAllUI(); /* render correct state immediately */
  }


  /* ── init ── */
  function init() {
    /* Reflect stored preference in UI right away (no gesture needed for UI) */
    isPlaying = localStorage.getItem('mm_audio') === 'on';

    injectFAB();

    /* If preference was ON, start audio on first user interaction */
    if (isPlaying) {
      const startOnGesture = () => {
        /* Only actually start if preference is still on
           (user might have clicked the FAB before this fires) */
        if (localStorage.getItem('mm_audio') === 'on') fadeIn();
        document.removeEventListener('click',   startOnGesture);
        document.removeEventListener('keydown', startOnGesture);
      };
      document.addEventListener('click',   startOnGesture, { once: true });
      document.addEventListener('keydown', startOnGesture, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
