const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  const logoPath = path.join(__dirname, '..', 'veilbrowse.png');
  const logoBase64 = fs.readFileSync(logoPath).toString('base64');
  const logoDataUri = `data:image/png;base64,${logoBase64}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #18191c;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Inter', sans-serif;
    color: #fff;
    position: relative;
    overflow: hidden;
  }
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  .glow {
    position: absolute; width: 600px; height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%);
    top: 50%; left: 50%; transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .logo-wrap {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 28px;
  }
  .logo-wrap img {
    width: 56px; height: 56px;
    border-radius: 12px;
    object-fit: contain;
  }
  .logo-text {
    font-family: 'Inter', sans-serif;
    font-size: 28px; font-weight: 800;
    color: #fff; letter-spacing: -0.02em;
  }
  .badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #06b6d4; border: 1px solid rgba(6,182,212,0.3);
    padding: 6px 16px; border-radius: 4px; margin-bottom: 32px;
    background: rgba(6,182,212,0.05);
  }
  h1 {
    font-size: 64px; font-weight: 900; line-height: 1.05;
    text-align: center; letter-spacing: -0.02em;
    max-width: 900px;
  }
  h1 span { color: #06b6d4; }
  p {
    font-size: 22px; color: #949ba4; margin-top: 20px;
    max-width: 700px; text-align: center; line-height: 1.4;
  }
  .footer {
    position: absolute; bottom: 40px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px; color: #5c5e66;
  }
</style>
</head>
<body>
  <div class="grid"></div>
  <div class="glow"></div>
  <div class="logo-wrap">
    <img src="${logoDataUri}" alt="VeilBrowse">
    <span class="logo-text">VeilBrowse</span>
  </div>
  <div class="badge">Open Source &middot; Linux Native &middot; MIT License</div>
  <h1>Unlimited isolated browsers.<br>Zero <span>linkability</span>.</h1>
  <p>Anti-detect browser manager for Linux</p>
  <div class="footer">veilbrowse.dev</div>
</body>
</html>
  `;

  await page.setContent(html);
  // Wait for fonts
  await page.waitForTimeout(2000);

  const screenshotPath = path.join(__dirname, 'site', 'og.png');
  await page.screenshot({ path: screenshotPath, type: 'png' });
  await browser.close();

  const stats = fs.statSync(screenshotPath);
  console.log(`OG image generated: ${screenshotPath} (${(stats.size / 1024).toFixed(1)} KB)`);
})();
