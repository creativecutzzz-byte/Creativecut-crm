// Swaps any capture that fails to load for a clearly labelled slate, and marks the page as a draft.
// Real captures live in ../captures/ (see RECORDING-BRIEF.md). Nothing here draws imitation UI.
(function () {
  const imgs = [...document.querySelectorAll("img[data-capture]")];
  let pending = imgs.length;
  const done = () => { if (--pending <= 0) document.body.dataset.ready = "1"; };
  if (!pending) document.body.dataset.ready = "1";
  imgs.forEach((img) => {
    const fail = () => {
      document.body.classList.add("draft");
      const s = document.createElement("div");
      s.className = "slate";
      s.innerHTML = `<b>REAL AE CAPTURE NEEDED</b><code>captures/${img.dataset.capture}</code><span>${img.alt}</span>`;
      img.replaceWith(s);
      done();
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", fail, { once: true });
    img.src = "../captures/" + img.dataset.capture;
  });
})();
