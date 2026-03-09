/* ============================================================
   MindMate AI — Global Audio Manager  v3.0
   Audio is now a full-width sidebar button (#audioToggle)
   on every page — consistent, no floating pill.
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

  function buildAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    const filter = audioCtx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value         = 0.8;
    filter.connect(masterGain);

    NOTES.forEach(n => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = n.freq;
      osc.detune.value    = n.detune;
      gain.gain.value     = 0.06;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
    });

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

  function fadeIn() {
    if (!audioCtx) buildAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.45, audioCtx.currentTime + 3.5);
    isPlaying = true;
    localStorage.setItem('mm_audio', 'on');
    syncUI();
  }

  function fadeOut() {
    if (!audioCtx) return;
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
    isPlaying = false;
    localStorage.setItem('mm_audio', 'off');
    syncUI();
  }

  function syncUI() {
    const btn = document.getElementById('audioToggle');
    if (!btn) return;
    if (isPlaying) {
      btn.textContent = '🔊 Audio On';
      btn.classList.add('audio-on');
    } else {
      btn.textContent = '🎵 Calm Audio';
      btn.classList.remove('audio-on');
    }
  }

  function init() {
    isPlaying = localStorage.getItem('mm_audio') === 'on';

    const btn = document.getElementById('audioToggle');
    if (btn) {
      syncUI();
      btn.addEventListener('click', () => isPlaying ? fadeOut() : fadeIn());
    }

    if (isPlaying) {
      const startOnGesture = () => {
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
