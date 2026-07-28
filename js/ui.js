(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      // Keep a stable text node so mousedown/mouseup always target the same
      // DOM node — replacing it via textContent loses the click mid-scramble.
      const textNode = el.firstChild || el.appendChild(document.createTextNode(original));
      // Split into words so multi-word text (e.g. "Kendra Lockard") locks
      // each word in lockstep by character depth, rather than the whole
      // string locking left-to-right (which would finish the first word
      // long before the second one even starts).
      const words = original.split(" ");
      const maxLen = Math.max(...words.map((w) => w.length));
      let timer = null;
      let locked = 0;
      let tick = 0;
      let dir = 1;

      function randChar() {
        return CHARSET[Math.floor(Math.random() * CHARSET.length)];
      }

      function renderAt(depth) {
        return words
          .map((w) => {
            let s = w.slice(0, depth);
            for (let i = depth; i < w.length; i++) s += randChar();
            return s;
          })
          .join(" ");
      }

      function step() {
        if (locked >= maxLen) {
          textNode.nodeValue = original;
          return;
        }
        if (locked < 0) {
          textNode.nodeValue = original;
          return;
        }
        textNode.nodeValue = renderAt(locked);
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
        if (locked >= maxLen) locked = maxLen - 1;
        step();
      });
    }

    document
      .querySelectorAll(".nav-links a")
      .forEach((el) => attachScramble(el));

    document
      .querySelectorAll(".contact-form button")
      .forEach((el) => attachScramble(el, TICK_MS, 3));
  }

  initScramble();
})();
