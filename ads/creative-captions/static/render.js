// Renders the static ads (and the video thumbnail) to PNG.
// Usage (from ads/creative-captions): node static/render.js
// A page with any missing capture is saved with a -PLACEHOLDER suffix and a red "not for publishing" banner.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const jobs = [
  { html: "static/creative-1-client-revision.html", out: "creative-1-client-revision", w: 1080, h: 1350 },
  { html: "static/creative-2-style-variety.html", out: "creative-2-style-variety", w: 1080, h: 1350 },
  { html: "video/thumbnail.html", out: "creative-3-thumbnail", w: 1080, h: 1920 },
];

(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(path.join(root, "out"), { recursive: true });
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1 });
    await page.goto("file://" + path.join(root, j.html));
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    const draft = await page.evaluate(() => document.body.classList.contains("draft"));
    const file = path.join(root, "out", j.out + (draft ? "-PLACEHOLDER" : "") + ".png");
    // remove a stale counterpart so out/ never holds both versions
    for (const s of ["", "-PLACEHOLDER"]) {
      const f = path.join(root, "out", j.out + s + ".png");
      if (f !== file && fs.existsSync(f)) fs.unlinkSync(f);
    }
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: j.w, height: j.h } });
    console.log((draft ? "PLACEHOLDER " : "FINAL       ") + path.relative(root, file));
    await page.close();
  }
  await browser.close();
})();
