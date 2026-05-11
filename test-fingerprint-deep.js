const http = require('http');
const launcher = require('./server/launcher');

const PORT = 9998;
process.env.PORT = String(PORT);

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { hostname: 'localhost', port: PORT, path, method, headers: body ? { 'Content-Type': 'application/json' } : {} };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('=== VeilBrowse Anti-Detect Deep Verification ===\n');

  const app = require('./server/index.js');
  await sleep(800);

  // Create profile
  const profile = await api('POST', '/api/profiles', {
    name: 'Test-Deep-Win10',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport_width: 1920, viewport_height: 1080,
    timezone: 'America/New_York', language: 'en-US',
    geolocation_lat: 40.7128, geolocation_lng: -74.0060,
    canvas_seed: 42, webrtc_policy: 'block_local_ips',
    hardware_concurrency: 8, device_memory: 8,
    webgl_vendor: 'Google Inc. (NVIDIA)',
    webgl_renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
    audio_seed: 123, client_rects_noise: 0.3,
    startup_url: 'about:blank',
  });
  console.log('Profile:', profile.id);

  await api('POST', `/api/profiles/${profile.id}/launch`);
  await sleep(3000);

  const session = launcher.activeSessions.get(profile.id);
  if (!session) { console.error('No session'); process.exit(1); }
  const page = session.page;

  // Test 1: Canvas getImageData modification
  console.log('\n--- Canvas getImageData ---');
  await page.goto('about:blank');
  const canvasResult = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100; canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, 100, 100);
    const data = ctx.getImageData(0, 0, 100, 100).data;
    // Check if any noise was applied (red pixel at 0,0 should be slightly off pure 255,0,0)
    const r = data[0], g = data[1], b = data[2];
    return { r, g, b, modified: !(r === 255 && g === 0 && b === 0) };
  });
  console.log('Pixel (0,0):', canvasResult);
  console.log('Canvas spoofed:', canvasResult.modified ? 'YES (good)' : 'NO (bad - pure red, no noise)');

  // Test 2: WebGL vendor/renderer
  console.log('\n--- WebGL Vendor/Renderer ---');
  const webglResult = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return { error: 'No WebGL' };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return { error: 'No WEBGL_debug_renderer_info' };
    return {
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
    };
  });
  console.log('WebGL Vendor:', webglResult.vendor);
  console.log('WebGL Renderer:', webglResult.renderer);
  const webglSpoofed = webglResult.vendor === 'Google Inc. (NVIDIA)' && webglResult.renderer.includes('NVIDIA');
  console.log('WebGL spoofed:', webglSpoofed ? 'YES (good)' : 'NO (bad)');

  // Test 3: WebRTC leak
  console.log('\n--- WebRTC Leak Test ---');
  const webrtcResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      const ips = [];
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(o => pc.setLocalDescription(o));
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate) {
          resolve({ ips, done: true });
          return;
        }
        const candidate = ice.candidate.candidate;
        const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) ips.push(ipMatch[1]);
      };
      setTimeout(() => resolve({ ips, done: false }), 2000);
    });
  });
  console.log('WebRTC IPs found:', webrtcResult.ips.length > 0 ? webrtcResult.ips : 'NONE');
  console.log('WebRTC blocked:', webrtcResult.ips.length === 0 ? 'YES (good)' : 'NO (bad - leaking IPs)');

  // Test 4: Navigator deep check
  console.log('\n--- Navigator Properties ---');
  const navResult = await page.evaluate(() => {
    const descriptors = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
    return {
      webdriver: navigator.webdriver,
      webdriverDescriptor: descriptors ? { value: descriptors.value, get: !!descriptors.get } : 'no descriptor',
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      languages: navigator.languages,
      pluginsLength: navigator.plugins.length,
      chromeRuntimeExists: typeof chrome !== 'undefined' && !!chrome.runtime,
    };
  });
  console.log('navigator.webdriver:', navResult.webdriver, '(should be undefined)');
  console.log('hardwareConcurrency:', navResult.hardwareConcurrency, '(should be 8)');
  console.log('deviceMemory:', navResult.deviceMemory, '(should be 8)');
  console.log('platform:', navResult.platform, '(should be Win32)');
  console.log('maxTouchPoints:', navResult.maxTouchPoints, '(should be 0 for desktop)');
  console.log('languages:', navResult.languages);
  console.log('plugins.length:', navResult.pluginsLength);
  console.log('chrome.runtime exists:', navResult.chromeRuntimeExists);

  // Test 5: AudioContext fingerprint
  console.log('\n--- AudioContext Fingerprint ---');
  const audioResult = await page.evaluate(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const analyser = ctx.createAnalyser();
      const gain = ctx.createGain();
      const script = ctx.createScriptProcessor(4096, 1, 1);
      const dest = ctx.createMediaStreamDestination();
      osc.connect(analyser);
      analyser.connect(gain);
      gain.connect(dest);
      gain.connect(script);
      script.connect(ctx.destination);
      osc.start(0);
      return new Promise((resolve) => {
        script.onaudioprocess = (e) => {
          const data = e.inputBuffer.getChannelData(0);
          const sum = data.reduce((a, b) => a + Math.abs(b), 0);
          const avg = sum / data.length;
          osc.stop();
          resolve({ fingerprint: avg.toFixed(6) });
        };
        setTimeout(() => resolve({ error: 'timeout' }), 1000);
      });
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Audio fingerprint:', audioResult);

  // Test 6: Client rects noise
  console.log('\n--- Client Rects Noise ---');
  const rectsResult = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.width = '100px'; el.style.height = '100px';
    el.style.position = 'absolute'; el.style.left = '10.5px'; el.style.top = '20.3px';
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    document.body.removeChild(el);
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  console.log('Rect:', rectsResult);
  const hasNoise = rectsResult.left !== 10.5 || rectsResult.top !== 20.3;
  console.log('Rects noise applied:', hasNoise ? 'YES (good)' : 'NO (bad - exact match)');

  // Cleanup
  await api('POST', `/api/profiles/${profile.id}/stop`);

  console.log('\n=== FINAL VERDICT ===');
  const checks = [
    ['Canvas noise', canvasResult.modified],
    ['WebGL vendor spoofed', webglSpoofed],
    ['WebRTC blocked', webrtcResult.ips.length === 0],
    ['navigator.webdriver removed', navResult.webdriver === undefined],
    ['Hardware concurrency spoofed', navResult.hardwareConcurrency === 8],
    ['Device memory spoofed', navResult.deviceMemory === 8],
    ['Platform spoofed', navResult.platform === 'Win32'],
    ['Chrome runtime restored', navResult.chromeRuntimeExists],
    ['Client rects noise', hasNoise],
  ];
  let pass = 0, fail = 0;
  for (const [name, ok] of checks) {
    if (ok) { console.log('  PASS:', name); pass++; }
    else { console.log('  FAIL:', name); fail++; }
  }
  console.log(`\nScore: ${pass}/${pass + fail} checks passed`);

  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
