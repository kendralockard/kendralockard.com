(function () {
  "use strict";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Config ──────────────────────────────────────────────────────────────────
  const CELL = 88; // grid spacing in px
  const RADIUS = 200; // radius of mouse influence
  const MAX_DISP = 70; // max push distance
  const SEG = 10; // px between curve sample points — every pixel sampled
  const BASE_A = 0.28; // base line opacity
  const MAX_PAN = 0; // max grid pan offset in px
  const MAX_TILT = 0.22; // max tilt angle in radians (~12.5°)
  const PERSP_D = 900; // perspective distance — larger = flatter

  // ── State ───────────────────────────────────────────────────────────────────
  const LAG = 0.04; // lerp factor — lower = more trail, higher = snappier

  let W, H;
  let rawMx = -9999,
    rawMy = -9999; // actual cursor position
  let mx = -9999,
    my = -9999; // lagged position used for distortion
  let panX = 0,
    panY = 0; // lagged pan offset
  let tilt = 0; // lagged tilt angle for perspective y-rotation
  let mouseIn = false;
  let mFade = 0;
  let lastTs = null;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // ── Radial push displacement ─────────────────────────────────────────────────
  // Returns [dx, dy] to add to a grid vertex at (px, py).
  // Direction: outward from mouse. Magnitude: smoothstep falloff to zero at RADIUS.
  function displace(px, py) {
    const dx = px - mx,
      dy = py - my;
    const d2 = dx * dx + dy * dy;
    if (d2 < 4 || d2 >= RADIUS * RADIUS) return [0, 0];
    const d = Math.sqrt(d2);
    const t = 1 - d / RADIUS; // 1 at cursor, 0 at edge
    const sm = t * t * (3 - 2 * t); // smoothstep — no kink at edge
    const mag = sm * mFade * MAX_DISP;
    return [(mag * dx) / d, (mag * dy) / d];
  }

  // ── Smooth curve through displaced sample points ─────────────────────────────
  // Each sample point becomes a quadratic Bézier control; the curve passes through
  // the midpoints between adjacent controls — G1-continuous, no visible kinks.
  function strokeSmooth(pts) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const ex = (pts[i][0] + pts[i + 1][0]) * 0.5;
      const ey = (pts[i][1] + pts[i + 1][1]) * 0.5;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], ex, ey);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function render(dt) {
    ctx.clearRect(0, 0, W, H);

    // Lag the effective cursor position behind the real one
    if (mouseIn && !REDUCED) {
      mx += (rawMx - mx) * LAG;
      my += (rawMy - my) * LAG;
      panX += ((rawMx / W - 0.5) * MAX_PAN * 2 - panX) * 0.012;
      panY += ((rawMy / H - 0.5) * MAX_PAN * 2 - panY) * 0.012;
      tilt += ((rawMy / H - 0.5) * MAX_TILT * 2 - tilt) * 0.012;
    } else {
      panX += (0 - panX) * 0.012;
      panY += (0 - panY) * 0.012;
      tilt += (0 - tilt) * 0.012;
    }

    const target = mouseIn && !REDUCED ? 1 : 0;
    mFade += (target - mFade) * 0.07;

    const margin = CELL * 2; // draw beyond edges so distortion never shows a gap

    // — flat grid lines ————————————————————————————————————————————————————————
    const sinT = Math.sin(tilt);
    const cosT = Math.cos(tilt);
    const cx = W / 2 + panX;
    const cy = H / 2 + panY;

    function project(x, y) {
      const relY = y - H / 2;
      const sc = PERSP_D / (PERSP_D + relY * sinT);
      return [cx + (x - W / 2) * sc, cy + relY * cosT * sc];
    }

    ctx.strokeStyle = `rgba(0,229,255,${BASE_A})`;
    ctx.lineWidth = 0.9;

    // horizontal lines
    for (let gy = -margin; gy <= H + margin; gy += CELL) {
      const pts = [];
      for (let x = -margin; x <= W + margin; x += SEG) {
        const [ddx, ddy] = displace(x, gy);
        pts.push(project(x + ddx, gy + ddy));
      }
      strokeSmooth(pts);
    }

    // vertical lines
    for (let gx = -margin; gx <= W + margin; gx += CELL) {
      const pts = [];
      for (let y = -margin; y <= H + margin; y += SEG) {
        const [ddx, ddy] = displace(gx, y);
        pts.push(project(gx + ddx, y + ddy));
      }
      strokeSmooth(pts);
    }

    // — soft edge vignette — keeps the void from feeling too bounded —————————————
    const vg = ctx.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.65,
      W / 2,
      H / 2,
      H * 0.95,
    );
    vg.addColorStop(0, "rgba(3,7,17,0)");
    vg.addColorStop(1, "rgba(3,7,17,0.45)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Loop ─────────────────────────────────────────────────────────────────────
  function frame(ts) {
    const dt = lastTs != null ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
    lastTs = ts;
    render(dt);
    requestAnimationFrame(frame);
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  function updateCoords(clientX, clientY) {
    const xv = (clientX / W - 0.5) * 10;
    const yv = (clientY / H - 0.5) * 10;
    const fmt = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
    const el = document.getElementById("coords");
    if (el) el.textContent = `X:${fmt(xv)} · Y:${fmt(yv)}`;
  }

  document.addEventListener("mousemove", (e) => {
    rawMx = e.clientX;
    rawMy = e.clientY;
    updateCoords(e.clientX, e.clientY);
  });

  document.body.addEventListener("mouseenter", (e) => {
    mouseIn = true;
    rawMx = e.clientX;
    rawMy = e.clientY;
    mx = rawMx;
    my = rawMy;
  });

  document.body.addEventListener("mouseleave", () => {
    // Keep rawMx/rawMy at last position — mFade handles the fade-out
    mouseIn = false;
  });

  // Touch drag mirrors mouse hover — position, enter, and leave.
  document.body.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      mouseIn = true;
      rawMx = t.clientX;
      rawMy = t.clientY;
      mx = rawMx;
      my = rawMy;
      updateCoords(t.clientX, t.clientY);
    },
    { passive: true },
  );

  document.body.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      rawMx = t.clientX;
      rawMy = t.clientY;
      updateCoords(t.clientX, t.clientY);
      e.preventDefault();
    },
    { passive: false },
  );

  function touchEnd() {
    mouseIn = false;
  }
  document.body.addEventListener("touchend", touchEnd);
  document.body.addEventListener("touchcancel", touchEnd);

  // ── Nav link scramble ────────────────────────────────────────────────────
  function initScramble() {
    if (REDUCED) return;
    const CHARSET = "+xo";
    const TICK_MS = 45;
    const TICKS_PER_LOCK = 2;

    function attachScramble(
      el,
      tickMs = TICK_MS,
      ticksPerLock = TICKS_PER_LOCK,
    ) {
      const original = el.textContent;
      let timer = null;
      let locked = 0;
      let tick = 0;
      let dir = 1;

      function randChar() {
        return CHARSET[Math.floor(Math.random() * CHARSET.length)];
      }

      function step() {
        if (locked >= original.length) {
          el.textContent = original;
          return;
        }
        if (locked < 0) {
          el.textContent = original;
          return;
        }
        let text = original.slice(0, locked);
        for (let i = locked; i < original.length; i++) text += randChar();
        el.textContent = text;
        tick++;
        if (tick % ticksPerLock === 0) locked += dir;
        timer = setTimeout(step, tickMs);
      }

      el.addEventListener("mouseenter", () => {
        clearTimeout(timer);
        dir = 1;
        locked = 0;
        tick = 0;
        step();
      });

      el.addEventListener("mouseleave", () => {
        clearTimeout(timer);
        dir = -1;
        tick = 0;
        if (locked >= original.length) locked = original.length - 1;
        step();
      });
    }

    document
      .querySelectorAll(".nav-links a")
      .forEach((el) => attachScramble(el));
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
  initScramble();
})();
