(function () {
  "use strict";

  const carousel = document.getElementById("site-carousel");
  if (!carousel) return;

  const cards = Array.from(carousel.querySelectorAll(".site-card"));
  const dots = Array.from(carousel.querySelectorAll(".site-dot"));
  const prevBtn = document.getElementById("site-prev");
  const nextBtn = document.getElementById("site-next");

  let index = 0;

  function show(i) {
    index = (i + cards.length) % cards.length;
    cards.forEach((card, ci) => card.classList.toggle("active", ci === index));
    dots.forEach((dot, di) => dot.classList.toggle("active", di === index));
  }

  prevBtn.addEventListener("click", () => show(index - 1));
  nextBtn.addEventListener("click", () => show(index + 1));
  dots.forEach((dot) => {
    dot.addEventListener("click", () => show(Number(dot.dataset.index)));
  });
})();
