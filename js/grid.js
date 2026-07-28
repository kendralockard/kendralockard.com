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
  const BASE_A = 0.45; // base line opacity — higher than a dark theme would
  // need, since a dark, translucent line reads lower-contrast against a
  // light background than a light, translucent one does against a dark one
  const MAX_PAN = 0; // max grid pan offset in px

  // ── State ───────────────────────────────────────────────────────────────────
  const LAG = 0.04; // lerp factor — lower = more trail, higher = snappier

  let W, H;
  let rawMx = -9999,
    rawMy = -9999; // actual cursor position
  let mx = -9999,
    my = -9999; // lagged position used for distortion
  let panX = 0,
    panY = 0; // lagged pan offset
  let mouseIn = false;
  let mFade = 0;
  let lastTs = null;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // ── Snap the identity panel to the grid ──────────────────────────────────
  // Grid lines sit at multiples of CELL from the viewport origin. Size the
  // panel up to a whole multiple of CELL and nudge its position so all four
  // edges land on real grid lines, instead of floating between them.
  const IDENTITY_PAD_X = 32; // 2rem @ 16px root
  const IDENTITY_PAD_Y = 24; // 1.5rem @ 16px root

  function alignIdentityToGrid() {
    const el = document.querySelector(".identity");
    if (!el || !document.body.classList.contains("theme-light")) return;
    // Below this, .identity switches to an explicit CSS width (see the
    // mobile media query) that this padding-based sizing would fight with,
    // since box-sizing:border-box makes padding eat into that fixed width
    // instead of growing the box.
    if (window.innerWidth <= 720) {
      el.style.margin = "";
      el.style.padding = "";
      return;
    }

    el.style.margin = "0";
    el.style.padding = `${IDENTITY_PAD_Y}px ${IDENTITY_PAD_X}px`;

    const natural = el.getBoundingClientRect();
    const width = Math.ceil(natural.width / CELL) * CELL;
    const height = Math.ceil(natural.height / CELL) * CELL;
    const extraX = (width - natural.width) / 2;
    const extraY = (height - natural.height) / 2;
    el.style.paddingLeft = `${IDENTITY_PAD_X + extraX}px`;
    el.style.paddingRight = `${IDENTITY_PAD_X + extraX}px`;
    el.style.paddingTop = `${IDENTITY_PAD_Y + extraY}px`;
    el.style.paddingBottom = `${IDENTITY_PAD_Y + extraY}px`;

    const sized = el.getBoundingClientRect();
    el.style.marginLeft = `${Math.round(sized.left / CELL) * CELL - sized.left}px`;
    el.style.marginTop = `${Math.round(sized.top / CELL) * CELL - sized.top}px`;
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
    } else {
      panX += (0 - panX) * 0.012;
      panY += (0 - panY) * 0.012;
    }

    const target = mouseIn && !REDUCED ? 1 : 0;
    mFade += (target - mFade) * 0.07;

    const margin = CELL * 2; // draw beyond edges so distortion never shows a gap

    // — flat grid lines ————————————————————————————————————————————————————————
    function project(x, y) {
      return [x + panX, y + panY];
    }

    ctx.strokeStyle = `rgba(0,72,84,${BASE_A})`;
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
    vg.addColorStop(0, "rgba(244,241,236,0)");
    vg.addColorStop(1, "rgba(244,241,236,0.45)");
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
  document.addEventListener("mousemove", (e) => {
    rawMx = e.clientX;
    rawMy = e.clientY;
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
      e.preventDefault();
    },
    { passive: false },
  );

  function touchEnd() {
    mouseIn = false;
  }
  document.body.addEventListener("touchend", touchEnd);
  document.body.addEventListener("touchcancel", touchEnd);

  window.addEventListener("resize", () => {
    resize();
    alignIdentityToGrid();
  });
  resize();
  alignIdentityToGrid();
  // Custom fonts can change the text's natural size after first paint.
  if (document.fonts) document.fonts.ready.then(alignIdentityToGrid);
  requestAnimationFrame(frame);
})();
