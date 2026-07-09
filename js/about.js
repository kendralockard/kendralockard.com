(function () {
  "use strict";

  const identity = document.querySelector(".identity");

  const stage = document.getElementById("reveal-stage");
  const stageLabel = document.getElementById("reveal-label");
  const homeLink = document.getElementById("home-link");

  if (!identity || !stage || !stageLabel || !homeLink) {
    return;
  }

  const BASE_TITLE = "Kendra Lockard";

  const sections = {
    work: {
      link: document.getElementById("work-link"),
      panel: document.getElementById("panel-work"),
      path: "/work",
    },
    contact: {
      link: document.getElementById("contact-link"),
      panel: document.getElementById("panel-contact"),
      path: "/contact",
    },
  };

  let current = null; // null | "about" | "work" | "contact"
  let positionFrozen = false;

  // Measures how tall the stage would render with a given panel active,
  // without ever showing it (visibility:hidden still lays out and can be
  // measured).
  function measureStageHeight(section) {
    section.panel.classList.add("active");
    const height = stage.offsetHeight;
    section.panel.classList.remove("active");
    return height;
  }

  // .identity is centered/anchored via a transform (translateX on desktop,
  // translateY on mobile), so once it's hidden and the reveal stage takes its
  // place, that transform is no longer relevant. Freeze identity's current
  // on-screen position (both axes, whichever transform was in play) once. The
  // reveal stage gets a fixed top too — computed from a true vertical center
  // rather than tied to identity — using the taller of the sections' rendered
  // heights, so all of them land at the exact same spot instead of each
  // self-centering around its own (different) height.
  function freezePosition() {
    if (positionFrozen) return;
    positionFrozen = true;
    const rect = identity.getBoundingClientRect();
    identity.style.left = `${rect.left}px`;
    identity.style.top = `${rect.top}px`;
    identity.style.transform = "none";

    stage.style.left = `${rect.left}px`;
    const maxHeight = Math.max(
      ...Object.values(sections).map((s) => measureStageHeight(s)),
    );
    stage.style.top = `${Math.max(24, (window.innerHeight - maxHeight) / 2)}px`;
  }

  function showSection(key) {
    const section = sections[key];

    if (current === null) {
      freezePosition();
      identity.classList.add("hidden");
      stage.classList.add("visible");
      stage.setAttribute("aria-hidden", "false");
      homeLink.classList.remove("hidden");
    }

    Object.values(sections).forEach((s) => s.panel.classList.remove("active"));
    section.panel.classList.add("active");
    document.title = `${section.panel.dataset.label.replace("// ", "")} — ${BASE_TITLE}`;

    current = key;
  }

  function showHome() {
    if (current === null) return;
    identity.classList.remove("hidden");
    stage.classList.remove("visible");
    stage.setAttribute("aria-hidden", "true");
    homeLink.classList.add("hidden");
    Object.values(sections).forEach((s) => s.panel.classList.remove("active"));
    stageLabel.textContent = "";
    document.title = BASE_TITLE;
    current = null;
  }

  function pathToKey(pathname) {
    const path = pathname.replace(/\/$/, "") || "/";
    const found = Object.entries(sections).find(([, s]) => s.path === path);
    return found ? found[0] : null;
  }

  // Applies the section for `key` (or home when null). `push` controls
  // whether this is a user-initiated navigation (adds a history entry) or a
  // sync in response to one that already happened (initial load, popstate).
  function navigate(key, push) {
    if (key === current) return;
    if (key) {
      showSection(key);
    } else {
      showHome();
    }
    if (push) {
      history.pushState(null, "", key ? sections[key].path : "/");
    }
  }

  Object.entries(sections).forEach(([key, section]) => {
    if (!section.link) return;
    section.link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(key, true);
    });
  });

  homeLink.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(null, true);
  });

  window.addEventListener("popstate", () => {
    navigate(pathToKey(location.pathname), false);
  });

  // Loaded directly at /about, /work, or /contact — open that section
  // immediately instead of showing the identity view first.
  const initialKey = pathToKey(location.pathname);
  if (initialKey) {
    navigate(initialKey, false);
  }
})();
