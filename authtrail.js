/* ================================================================
   MindMate AI — Mindful Cursor Trail
   Leaves behind soft breathing orbs + tiny wellness symbols
   that slowly expand and fade like a breath releasing.
   ================================================================ */

(function () {

  /* symbols that drift off the trail — calming / wellness themed */
  const SYMBOLS = ['✿', '❀', '✦', '◦', '∘', '⊹', '✧', '⋆', '❋', '✾'];

  /* hue range: lavender → mint → rose — cycles gently */
  let hue = 260;

  const trailPoints = [];
  let animFrame;
  let mx = -999, my = -999;
  let lastTrailTime = 0;

  /* ── Canvas setup ─────────────────────────────────────── */

  const canvas = document.createElement('canvas');
  canvas.id = 'trail-canvas';
  canvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9990;
  `;
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── Trail point class ────────────────────────────────── */

  class TrailOrb {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.hue = hue;
      this.radius = 3 + Math.random() * 4;
      this.maxRadius = 18 + Math.random() * 22;
      this.alpha = 0.55 + Math.random() * 0.25;
      this.life = 0;
      this.maxLife = 55 + Math.random() * 40;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = -0.3 - Math.random() * 0.5; /* drift upward gently */
    }

    update() {
      this.life++;
      const t = this.life / this.maxLife;
      /* expand then shrink */
      this.radius = this.maxRadius * Math.sin(t * Math.PI) * 0.6 + 3;
      this.alpha  = (1 - t) * 0.38;
      this.x += this.vx;
      this.y += this.vy;
      this.vy *= 0.98; /* decelerate */
    }

    draw(ctx) {
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0,   `hsla(${this.hue}, 72%, 78%, ${this.alpha})`);
      grad.addColorStop(0.5, `hsla(${this.hue + 20}, 65%, 72%, ${this.alpha * 0.6})`);
      grad.addColorStop(1,   `hsla(${this.hue + 40}, 60%, 80%, 0)`);

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    get dead() { return this.life >= this.maxLife; }
  }

  /* ── Symbol particles ─────────────────────────────────── */

  class SymbolParticle {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 30;
      this.y = y + (Math.random() - 0.5) * 30;
      this.symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      this.hue = hue + Math.random() * 50 - 25;
      this.alpha = 0.7;
      this.size = 10 + Math.random() * 10;
      this.vx = (Math.random() - 0.5) * 1.2;
      this.vy = -0.8 - Math.random() * 1.2;
      this.life = 0;
      this.maxLife = 70 + Math.random() * 50;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.04;
    }

    update() {
      this.life++;
      const t = this.life / this.maxLife;
      this.alpha = (1 - t) * 0.65;
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.012; /* gentle gravity */
      this.vx *= 0.98;
      this.rotation += this.rotSpeed;
      this.size *= 0.995;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.font = `${this.size}px serif`;
      ctx.fillStyle = `hsl(${this.hue}, 65%, 72%)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.symbol, 0, 0);
      ctx.restore();
    }

    get dead() { return this.life >= this.maxLife; }
  }

  const orbs     = [];
  const symbols  = [];
  let symbolTick = 0;

  /* ── Mouse tracking ───────────────────────────────────── */

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;

    /* hue slowly cycles as cursor moves */
    hue = (hue + 0.4) % 360;

    const now = Date.now();
    if (now - lastTrailTime > 28) {
      lastTrailTime = now;
      orbs.push(new TrailOrb(mx, my));

      /* sprinkle a symbol every ~6th orb */
      symbolTick++;
      if (symbolTick % 6 === 0) {
        symbols.push(new SymbolParticle(mx, my));
      }
    }
  });

  /* ── Render loop ──────────────────────────────────────── */

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* update + draw orbs */
    for (let i = orbs.length - 1; i >= 0; i--) {
      orbs[i].update();
      orbs[i].draw(ctx);
      if (orbs[i].dead) orbs.splice(i, 1);
    }

    /* update + draw symbols */
    for (let i = symbols.length - 1; i >= 0; i--) {
      symbols[i].update();
      symbols[i].draw(ctx);
      if (symbols[i].dead) symbols.splice(i, 1);
    }

    animFrame = requestAnimationFrame(loop);
  }

  loop();

})();
