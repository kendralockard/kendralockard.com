(function () {
  "use strict";

  const ABOUT_TEXT = `I'm a full-stack software engineer with a focus on backend systems and domain modeling. I specialize in designing software tools for the built environment and am motivated by work that advances social and environmental responsibility. On the side, I also enjoy building websites for artists and small business owners.`;

  const WORK_ENTRIES = [
    { name: "Thalo Labs", url: "https://thalolabs.com", role: "Senior Software Engineer" },
    { name: "TEECOM", url: "https://www.teecom.com", role: "Senior Software Engineer" },
    { name: "Oberlin College", url: "https://www.oberlin.edu", role: "Web Development Instructor" },
    { name: "Freelance", url: null, role: "Web Developer" },
  ];

  const WORK_HTML = WORK_ENTRIES.map(({ name, url, role }) => {
    const label = url
      ? `<a href="${url}" target="_blank" rel="noopener">${name}</a>`
      : name;
    return `${label} · ${role}`;
  }).join("\n");

  const identity = document.querySelector(".identity");

  const stage = document.getElementById("reveal-stage");
  const stageLabel = document.getElementById("reveal-label");
  const stageContent = document.getElementById("reveal-content");

  if (!identity || !stage || !stageLabel || !stageContent) {
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
      text: WORK_HTML,
      html: true,
    },
  };

  let current = null; // null | "about" | "work"
  let positionFrozen = false;

  // Measures how tall the stage would render with the given text, without
  // ever showing it (visibility:hidden still lays out and can be measured).
  function measureStageHeight(section) {
    stageLabel.textContent = section.labelText;
    setContent(section);
    const height = stage.offsetHeight;
    stageLabel.textContent = "";
    stageContent.textContent = "";
    return height;
  }

  function setContent(section) {
    if (section.html) {
      stageContent.innerHTML = section.text;
    } else {
      stageContent.textContent = section.text;
    }
  }

  // .identity is centered/anchored via a transform (translateX on desktop,
  // translateY on mobile), so once it's hidden and the reveal stage takes its
  // place, that transform is no longer relevant. Freeze identity's current
  // on-screen position (both axes, whichever transform was in play) once. The
  // reveal stage gets a fixed top too — computed from a true vertical center
  // rather than tied to identity — using the taller of About/Work's rendered
  // heights, so both land at the exact same spot instead of each
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

  function enterSection(key) {
    if (current === key) return;

    const section = sections[key];

    if (current === null) {
      freezePosition();
      identity.classList.add("hidden");
      stage.classList.add("visible");
      stage.setAttribute("aria-hidden", "false");
    }

    stageLabel.textContent = section.labelText;
    setContent(section);

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
