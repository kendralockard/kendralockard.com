(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CHARSET = "+xo";
  const TICK_MS = 25;
  const STEP_TICKS = 18; // roughly how many ticks a full grow/shrink/reveal takes, any length

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

  if (!identity || !nameEl || !roleEl) return;

  const sections = {
    about: {
      link: document.getElementById("about-link"),
      stage: document.getElementById("about-stage"),
      label: document.getElementById("about-label"),
      content: document.getElementById("about-content"),
      text: ABOUT_TEXT,
    },
    work: {
      link: document.getElementById("work-link"),
      stage: document.getElementById("work-stage"),
      label: document.getElementById("work-label"),
      content: document.getElementById("work-content"),
      text: WORK_TEXT,
    },
  };

  // Capture each label's original text once, up front — it gets scrambled
  // away and regrown, so we can't rely on reading it back from the DOM later.
  Object.values(sections).forEach((s) => {
    if (s.label) s.labelText = s.label.textContent;
  });

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

  // .identity is centered/anchored via a transform (translateX on desktop,
  // translateY on mobile), so as the name/role shrink and the block's size
  // changes, that transform would keep re-centering it — reading as a drift.
  // Freeze its current on-screen position (both axes, whichever transform was
  // in play) once, and pin every section's stage to that same top/left so
  // switching between About and Work — which have different line counts —
  // never shifts position (previously each stage centered itself via its own
  // height, so a taller/shorter block landed at a different top edge).
  function freezePosition() {
    if (positionFrozen) return;
    positionFrozen = true;
    const rect = identity.getBoundingClientRect();
    identity.style.left = `${rect.left}px`;
    identity.style.top = `${rect.top}px`;
    identity.style.transform = "none";
    const stageTop = Math.max(24, rect.top - 40);
    Object.values(sections).forEach((s) => {
      s.stage.style.left = `${rect.left}px`;
      s.stage.style.top = `${stageTop}px`;
    });
  }

  function shrinkSection(section, done) {
    let remaining = 2;
    function next() {
      if (--remaining > 0) return;
      section.stage.classList.remove("visible");
      section.stage.setAttribute("aria-hidden", "true");
      done();
    }
    shrinkOut(section.label, section.labelText, next);
    shrinkOut(section.content, section.content.textContent, next);
  }

  function growSection(section, done) {
    section.stage.classList.add("visible");
    section.stage.setAttribute("aria-hidden", "false");
    let remaining = 2;
    function next() {
      if (--remaining === 0) done();
    }
    growIn(section.label, section.labelText, next);
    growIn(section.content, section.text, next);
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

    section.stage.classList.add("visible");
    section.stage.setAttribute("aria-hidden", "false");
    growIn(section.label, section.labelText, taskDone);
    growIn(section.content, section.text, taskDone);
  }

  function enterSection(key) {
    if (busy || current === key) return;
    busy = true;

    if (current === null) {
      enterFromIdentity(sections[key]);
    } else {
      const from = sections[current];
      shrinkSection(from, () => {
        growSection(sections[key], () => {
          busy = false;
        });
      });
    }

    current = key;
  }

  Object.entries(sections).forEach(([key, section]) => {
    if (!section.link || !section.stage || !section.label || !section.content) {
      return;
    }
    section.link.addEventListener("click", (e) => {
      e.preventDefault();
      enterSection(key);
    });
  });
})();
