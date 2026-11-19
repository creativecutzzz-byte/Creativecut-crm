// Screenshot the preview + ads to PNG, and check the tap-to-reveal page at phone width.
//   node preview/shoot.js
const { chromium } = require('playwright');
const path = require('path');
const D = __dirname;
const u = f => 'file://' + path.join(D, f);

(async () => {
  const b = await chromium.launch();
  const shot = async (file, out, vw, vh, full) => {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    await p.goto(u(file)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(D, out), fullPage: !!full });
    await p.close();
  };
  await shot('spot-the-rejection-static.html', 'spot-the-rejection-preview.png', 1080, 1350, true);
  await shot('ad-a-beginner.html', 'ad-a-beginner-1080x1350.png', 1080, 1350);
  await shot('ad-b-creator.html', 'ad-b-creator-1080x1350.png', 1080, 1350);

  // Phone review of the interactive version (before and after tapping).
  const p = await b.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  await p.goto(u('spot-the-rejection.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(D, 'review-375-before.png'), fullPage: true });
  const overflowX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await p.click('[data-pick="A"]'); await p.waitForTimeout(400);
  const h = await p.textContent('.answer h2');
  await p.screenshot({ path: path.join(D, 'review-375-after.png'), fullPage: true });
  console.log('horizontal overflow at 375px:', overflowX, '| answer after tapping A:', h);
  await b.close();
})();
