(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CHARSET = "+xo10";
  const TICK_MS = 32;
  const STEP_TICKS = 18; // roughly how many ticks a full grow/shrink/cross-scramble takes, any length
  const PRESCRAMBLE_TICKS = 7; // ticks of pure randomization before a lock sweep starts resolving

  // Placeholder copy — swap for the real content when ready.
  const ABOUT_TEXT = `This is placeholder copy standing in for the real bio.

It exists to test how the reveal handles a couple of short
paragraphs, some punctuation, and line breaks before the
real content goes in.`;

  const WORK_TEXT = `This is placeholder copy standing in for real project write-ups.

It exists to test how the reveal handles a couple of short
paragraphs before real work samples go in.`;

  const identity = document.querySelector(".identity");
  const nameEl = document.querySelector(".name");
  const roleEl = document.querySelector(".role");

  const stage = document.getElementById("reveal-stage");
  const stageLabel = document.getElementById("reveal-label");
  const stageContent = document.getElementById("reveal-content");

  if (!identity || !nameEl || !roleEl || !stage || !stageLabel || !stageContent) {
    return;
  }

  const sections = {
    about: {
      link: document.getElementById("about-link"),
      labelText: "// About",
      text: ABOUT_TEXT,
    },
    work: {
      link: document.getElementById("work-link"),
      labelText: "// Work",
      text: WORK_TEXT,
    },
  };

  let current = null; // null | "about" | "work"
  let busy = false;
  let positionFrozen = false;

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
  // sweeps a lock across it to resolve the scramble into the real text. Used
  // only for the very first reveal, where el starts out empty.
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
        prescramble(PRESCRAMBLE_TICKS);
        return;
      }
      el.textContent = renderMasked(target, len, 0);
      len = Math.min(target.length, len + step);
      setTimeout(growStep, TICK_MS);
    }

    function prescramble(ticksLeft) {
      if (ticksLeft <= 0) {
        revealStep(0);
        return;
      }
      el.textContent = renderMasked(target, target.length, 0);
      setTimeout(() => prescramble(ticksLeft - 1), TICK_MS);
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
  // what's left keeps scrambling, until nothing remains. Used only for the
  // name/role, which have nowhere to resolve to once identity is gone.
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

  // Scrambles el's current text directly into `target` — no clearing to
  // empty first. Every position up to the longer of the two lengths cycles
  // through random glyphs, then a lock sweeps left to right resolving each
  // into target's character; any leftover tail (if the old text was longer)
  // keeps scrambling until the final tick, when it's simply dropped.
  function scrambleTo(el, target, done) {
    if (REDUCED) {
      el.textContent = target;
      done();
      return;
    }

    const current = el.textContent;
    const maxLen = Math.max(current.length, target.length);
    const step = stepSizeFor(maxLen);

    function charAt(i) {
      const ch = i < target.length ? target[i] : current[i];
      return ch === " " || ch === "\n" ? ch : randChar();
    }

    function prescramble(ticksLeft) {
      if (ticksLeft <= 0) {
        lockStep(0);
        return;
      }
      let text = "";
      for (let i = 0; i < maxLen; i++) text += charAt(i);
      el.textContent = text;
      setTimeout(() => prescramble(ticksLeft - 1), TICK_MS);
    }

    function lockStep(locked) {
      if (locked >= target.length) {
        el.textContent = target;
        done();
        return;
      }
      let text = "";
      for (let i = 0; i < maxLen; i++) {
        text += i < locked ? target[i] : charAt(i);
      }
      el.textContent = text;
      setTimeout(() => lockStep(locked + step), TICK_MS);
    }

    prescramble(PRESCRAMBLE_TICKS);
  }

  // Measures how tall the stage would render with the given text, without
  // ever showing it (visibility:hidden still lays out and can be measured).
  function measureStageHeight(labelText, contentText) {
    stageLabel.textContent = labelText;
    stageContent.textContent = contentText;
    const height = stage.offsetHeight;
    stageLabel.textContent = "";
    stageContent.textContent = "";
    return height;
  }

  // .identity is centered/anchored via a transform (translateX on desktop,
  // translateY on mobile), so as the name/role shrink and the block's size
  // changes, that transform would keep re-centering it — reading as a drift.
  // Freeze its current on-screen position (both axes, whichever transform was
  // in play) once. The reveal stage gets a fixed top too — computed from a
  // true vertical center rather than tied to identity — using the taller of
  // About/Work's rendered heights, so both land at the exact same spot
  // instead of each self-centering around its own (different) height.
  function freezePosition() {
    if (positionFrozen) return;
    positionFrozen = true;
    const rect = identity.getBoundingClientRect();
    identity.style.left = `${rect.left}px`;
    identity.style.top = `${rect.top}px`;
    identity.style.transform = "none";

    stage.style.left = `${rect.left}px`;
    const maxHeight = Math.max(
      ...Object.values(sections).map((s) => measureStageHeight(s.labelText, s.text)),
    );
    stage.style.top = `${Math.max(24, (window.innerHeight - maxHeight) / 2)}px`;
  }

  // First-ever reveal: shrink the name/role away while growing `section` in
  // at the same time.
  function enterFromIdentity(section) {
    freezePosition();

    const nameOriginal = Array.from(nameEl.childNodes);
    const roleOriginal = Array.from(roleEl.childNodes);
    const nameText = nameEl.textContent;
    const roleText = roleEl.textContent;

    let tasksRemaining = 4;
    function taskDone() {
      if (--tasksRemaining === 0) busy = false;
    }

    let shrinkRemaining = 2;
    function afterShrink() {
      if (--shrinkRemaining > 0) return;
      identity.classList.add("hidden");
      // Restore the real DOM (e.g. .role's hover-scramble spans), now hidden.
      nameEl.innerHTML = "";
      nameOriginal.forEach((n) => nameEl.appendChild(n));
      roleEl.innerHTML = "";
      roleOriginal.forEach((n) => roleEl.appendChild(n));
    }

    shrinkOut(nameEl, nameText, () => {
      afterShrink();
      taskDone();
    });
    shrinkOut(roleEl, roleText, () => {
      afterShrink();
      taskDone();
    });

    stage.classList.add("visible");
    stage.setAttribute("aria-hidden", "false");
    growIn(stageLabel, section.labelText, taskDone);
    growIn(stageContent, section.text, taskDone);
  }

  // Already showing a section: scramble its label/content directly into the
  // new one's, in place — no shrinking to empty and regrowing.
  function crossScrambleTo(section, done) {
    let remaining = 2;
    function next() {
      if (--remaining === 0) done();
    }
    scrambleTo(stageLabel, section.labelText, next);
    scrambleTo(stageContent, section.text, next);
  }

  function enterSection(key) {
    if (busy || current === key) return;
    busy = true;

    if (current === null) {
      enterFromIdentity(sections[key]);
    } else {
      crossScrambleTo(sections[key], () => {
        busy = false;
      });
    }

    current = key;
  }

  Object.entries(sections).forEach(([key, section]) => {
    if (!section.link) return;
    section.link.addEventListener("click", (e) => {
      e.preventDefault();
      enterSection(key);
    });
  });
})();
