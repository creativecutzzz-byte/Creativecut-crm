// Render book.html -> PDF (tagged, selectable text) + standalone cover PNG.
// Also prints an overflow report so no page silently clips content.
//   node layout/render.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const BOOK = 'file://' + path.join(ROOT, 'layout', 'book.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await page.goto(BOOK);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // Overflow check: content must end above the footer zone (inner padding-bottom).
  const report = await page.evaluate(() => {
    const out = [];
    for (const sec of document.querySelectorAll('section.page')) {
      if (sec.classList.contains('cover')) continue;
      const inner = sec.querySelector('.inner');
      const limit = sec.getBoundingClientRect().bottom - parseFloat(getComputedStyle(inner).paddingBottom);
      let maxBottom = 0;
      for (const el of inner.children) maxBottom = Math.max(maxBottom, el.getBoundingClientRect().bottom);
      const slack = limit - maxBottom;
      out.push({ page: sec.dataset.page, title: sec.dataset.title, slackPx: Math.round(slack) });
    }
    const fonts = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight);
    return { pages: out, fonts: [...new Set(fonts)] };
  });
  const bad = report.pages.filter(p => p.slackPx < 0);
  for (const p of report.pages) console.log(`p${p.page.padStart(2)} slack ${String(p.slackPx).padStart(5)}px  ${p.title}${p.slackPx < 0 ? '  <-- OVERFLOW' : ''}`);
  console.log('fonts loaded:', report.fonts.join(', '));
  fs.writeFileSync(path.join(ROOT, 'layout', 'overflow-report.json'), JSON.stringify(report, null, 2));

  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: path.join(ROOT, 'layout', 'raw.pdf'),
    width: '148mm', height: '210mm', printBackground: true, preferCSSPageSize: true,
    tagged: true, outline: false,
  });
  console.log('wrote layout/raw.pdf');

  // Standalone cover PNG = the supplied front cover artwork.
  fs.copyFileSync(path.join(ROOT, 'assets', 'images', 'cover-front.png'), path.join(ROOT, 'GTA_6_Creator_Toolkit_Cover.png'));
  console.log('wrote GTA_6_Creator_Toolkit_Cover.png (supplied artwork)');

  await browser.close();
  if (bad.length) { console.log(`OVERFLOW on ${bad.length} page(s)`); process.exitCode = 2; }
})();
