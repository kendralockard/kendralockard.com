(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CHARSET =
    "0123456789+-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const TICK_MS = 35;
  const STEP_TICKS = 26; // roughly how many ticks a full grow/shrink/reveal takes, any length

  // Placeholder copy — swap for the real bio when ready.
  const ABOUT_TEXT = `This is placeholder copy standing in for the real bio.

It exists to test how the reveal handles a couple of short
paragraphs, some punctuation, and line breaks before the
real content goes in.`;

  const link = document.getElementById("about-link");
  const identity = document.querySelector(".identity");
  const nameEl = document.querySelector(".name");
  const roleEl = document.querySelector(".role");
  const stage = document.getElementById("about-stage");
  const stageContent = document.getElementById("about-content");

  if (!link || !identity || !nameEl || !roleEl || !stage || !stageContent) {
    return;
  }

  let shown = false;
  let busy = false;

  function randChar() {
    return CHARSET[(Math.random() * CHARSET.length) | 0];
  }

  function stepSizeFor(length) {
    return Math.max(1, Math.round(length / STEP_TICKS));
  }

  // Renders the first `len` characters of `target`; characters before `locked`
  // show their real value, the rest scramble. Spaces/newlines always pass
  // through untouched.
  function renderMasked(target, len, locked) {
    let text = "";
    for (let i = 0; i < len; i++) {
      const ch = target[i];
      text += i < locked || ch === " " || ch === "\n" ? ch : randChar();
    }
    return text;
  }

  // Grows `target` onto el one chunk of characters at a time (each newly
  // appended character starts scrambled), then once full length is reached,
  // sweeps a lock across it to resolve the scramble into the real text.
  function growIn(el, target, done) {
    if (REDUCED) {
      el.textContent = target;
      done();
      return;
    }

    const step = stepSizeFor(target.length);
    let len = 0;

    function growStep() {
      if (len >= target.length) {
        revealStep(0);
        return;
      }
      el.textContent = renderMasked(target, len, 0);
      len = Math.min(target.length, len + step);
      setTimeout(growStep, TICK_MS);
    }

    function revealStep(locked) {
      if (locked >= target.length) {
        el.textContent = target;
        done();
        return;
      }
      el.textContent = renderMasked(target, target.length, locked);
      setTimeout(() => revealStep(locked + step), TICK_MS);
    }

    growStep();
  }

  // Shrinks el's current text away from the end, one chunk at a time, while
  // what's left keeps scrambling, until nothing remains.
  function shrinkOut(el, source, done) {
    if (REDUCED) {
      el.textContent = "";
      done();
      return;
    }

    const step = stepSizeFor(source.length);
    let len = source.length;

    function shrinkStep() {
      if (len <= 0) {
        el.textContent = "";
        done();
        return;
      }
      el.textContent = renderMasked(source, len, 0);
      len = Math.max(0, len - step);
      setTimeout(shrinkStep, TICK_MS);
    }

    shrinkStep();
  }

  function goToAbout() {
    busy = true;

    const nameOriginal = Array.from(nameEl.childNodes);
    const roleOriginal = Array.from(roleEl.childNodes);
    const nameText = nameEl.textContent;
    const roleText = roleEl.textContent;

    let remaining = 2;
    function afterShrink() {
      if (--remaining > 0) return;
      identity.classList.add("hidden");
      // Restore the real DOM (e.g. .role's hover-scramble spans) while hidden.
      nameEl.innerHTML = "";
      nameOriginal.forEach((n) => nameEl.appendChild(n));
      roleEl.innerHTML = "";
      roleOriginal.forEach((n) => roleEl.appendChild(n));

      stage.classList.add("visible");
      stage.setAttribute("aria-hidden", "false");
      growIn(stageContent, ABOUT_TEXT, () => {
        busy = false;
      });
    }

    shrinkOut(nameEl, nameText, afterShrink);
    shrinkOut(roleEl, roleText, afterShrink);
  }

  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (busy || shown) return;
    shown = true;
    goToAbout();
  });
})();
