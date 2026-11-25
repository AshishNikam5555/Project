#!/usr/bin/env node
// Renders poster.html to print-ready A5 files: assets/poster-a5.pdf and assets/poster-a5.png (300 dpi).
// Usage: node tools/make-poster.js [public-url] [src]
//   public-url defaults to PUBLIC_URL in js/config.js — set it to your deployed site first.
//   src: poster (default) | whatsapp | maps | card | status — each variant is tracked separately.
const { chromium } = require('playwright');
const path = require('path');
const url = process.argv[2] || '';
const src = process.argv[3] || 'poster';
(async () => {
  const root = path.resolve(__dirname, '..');
  const page_url = `file://${root}/poster.html?src=${src}${url ? '&url=' + encodeURIComponent(url) : ''}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 560, height: 794 }, deviceScaleFactor: 3.125 });
  await page.goto(page_url);
  await page.waitForSelector('#qr svg');
  const suffix = src === 'poster' ? '' : '-' + src;
  await page.pdf({ path: `${root}/assets/poster-a5${suffix}.pdf`, format: 'A5', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.locator('.sheet').screenshot({ path: `${root}/assets/poster-a5${suffix}.png` });
  console.log(`QR → ${await page.textContent('#url')}\nWrote assets/poster-a5${suffix}.pdf and .png`);
  await browser.close();
})();
