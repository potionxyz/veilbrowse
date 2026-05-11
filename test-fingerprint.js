const http = require('http');
const { chromium } = require('playwright');
const launcher = require('./server/launcher');

const PORT = 9999; // use different port to avoid conflict
const BASE = `http://localhost:${PORT}`;

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('=== VeilBrowse Anti-Detect Verification ===\n');

  // Start server
  process.env.PORT = String(PORT);
  const app = require('./server/index.js');
  await sleep(500);

  // Create profile with Windows Chrome preset
  const profile = await api('POST', '/api/profiles', {
    name: 'Test-Profile-Win10',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport_width: 1920,
    viewport_height: 1080,
    timezone: 'America/New_York',
    language: 'en-US',
    geolocation_lat: 40.7128,
    geolocation_lng: -74.0060,
    canvas_seed: 42,
    webrtc_policy: 'block_local_ips',
    hardware_concurrency: 8,
    device_memory: 8,
    webgl_vendor: 'Google Inc. (NVIDIA)',
    webgl_renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
    audio_seed: 123,
    client_rects_noise: 0.3,
    startup_url: 'https://browserleaks.com/canvas',
  });
  console.log('Created profile:', profile.id, profile.name);

  // Launch profile
  const launchRes = await api('POST', `/api/profiles/${profile.id}/launch`);
  console.log('Launch result:', launchRes.status);
  await sleep(3000);

  // Get session page
  const session = launcher.activeSessions.get(profile.id);
  if (!session) {
    console.error('ERROR: Session not found after launch');
    process.exit(1);
  }

  // Wait for startup page to load
  const page = session.page;
  await page.waitForLoadState('networkidle');

  console.log('\n--- Test 1: BrowserLeaks Canvas ---');
  await page.goto('https://browserleaks.com/canvas', { waitUntil: 'networkidle' });
  await sleep(2000);

  // Extract canvas hash
  const canvasHash = await page.evaluate(() => {
    const el = document.querySelector('#fingerprint');
    return el ? el.textContent.trim() : null;
  });
  console.log('Canvas Hash:', canvasHash);

  // Extract toString results
  const toStringResults = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('.results li').forEach(li => {
      const text = li.textContent.trim();
      if (text.includes('toString')) results.push(text);
    });
    return results;
  });
  console.log('toString checks:', toStringResults.slice(0, 3));

  console.log('\n--- Test 2: BrowserLeaks WebRTC ---');
  await page.goto('https://browserleaks.com/webrtc', { waitUntil: 'networkidle' });
  await sleep(2000);

  const webrtcResults = await page.evaluate(() => {
    const ipEls = document.querySelectorAll('.table-responsive td');
    const ips = [];
    ipEls.forEach(el => {
      const text = el.textContent.trim();
      if (text.match(/\d+\.\d+\.\d+\.\d+/)) ips.push(text);
    });
    return ips;
  });
  console.log('WebRTC IPs found:', webrtcResults.length > 0 ? webrtcResults : 'NONE (blocked)');

  console.log('\n--- Test 3: BrowserLeaks Features (Webdriver flag) ---');
  await page.goto('https://browserleaks.com/javascript', { waitUntil: 'networkidle' });
  await sleep(2000);

  const jsFeatures = await page.evaluate(() => {
    return {
      webdriver: navigator.webdriver,
      chrome: !!window.chrome,
      chromeRuntime: typeof chrome !== 'undefined' && !!chrome.runtime,
      plugins: navigator.plugins.length,
      languages: navigator.languages,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      platform: navigator.platform,
    };
  });
  console.log('Navigator features:');
  console.log('  webdriver:', jsFeatures.webdriver);
  console.log('  chrome obj:', jsFeatures.chrome);
  console.log('  chrome.runtime:', jsFeatures.chromeRuntime);
  console.log('  plugins:', jsFeatures.plugins);
  console.log('  languages:', jsFeatures.languages);
  console.log('  hardwareConcurrency:', jsFeatures.hardwareConcurrency);
  console.log('  deviceMemory:', jsFeatures.deviceMemory);
  console.log('  platform:', jsFeatures.platform);

  console.log('\n--- Test 4: FingerprintJS / Cover Your Tracks ---');
  await page.goto('https://coveryourtracks.eff.org/', { waitUntil: 'networkidle' });
  await sleep(3000);

  // Click "Test your browser" if button exists
  const testBtn = await page.$('button:has-text("Test your browser")');
  if (testBtn) await testBtn.click();
  await sleep(5000);

  const trackerResults = await page.evaluate(() => {
    const txt = document.body.innerText;
    const fingerprinting = txt.includes('fingerprinting') ? txt.match(/fingerprinting[^.]+/i)?.[0] : 'N/A';
    return { fingerprinting: fingerprinting || 'N/A', text: txt.slice(0, 500) };
  });
  console.log('EFF results preview:', trackerResults.text.slice(0, 200));

  // Cleanup
  console.log('\n--- Cleanup ---');
  await api('POST', `/api/profiles/${profile.id}/stop`);
  await sleep(500);

  console.log('\n=== Summary ===');
  console.log('Profile ID:', profile.id);
  console.log('Canvas hash:', canvasHash ? 'EXISTS (check if different from real browser)' : 'MISSING');
  console.log('WebRTC IPs:', webrtcResults.length === 0 ? 'BLOCKED (good)' : 'LEAKING (bad): ' + webrtcResults);
  console.log('Navigator.webdriver:', jsFeatures.webdriver === false ? 'false (good)' : jsFeatures.webdriver + ' (bad)');
  console.log('Hardware spoofed:', jsFeatures.hardwareConcurrency === 8 && jsFeatures.deviceMemory === 8 ? 'YES (good)' : 'NO (bad)');

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
