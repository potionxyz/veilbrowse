const express = require('express');
const path = require('path');
const events = require('./events');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Landing page
app.get('/landing', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'landing.html'));
});

app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/proxies', require('./routes/proxies'));

app.get('/api/sessions', (req, res) => {
  const launcher = require('./launcher');
  res.json(launcher.listSessions());
});

// Dedicated profile start page — aligns with AdsPower-style start.adspower.net
app.get('/start/:id', (req, res) => {
  const db = require('./db');
  db.get(
    `SELECT p.*, px.name as pool_proxy_name, px.host as pool_proxy_host, px.port as pool_proxy_port
     FROM profiles p
     LEFT JOIN proxies px ON p.proxy_id = px.id
     WHERE p.id = ?`,
    [req.params.id],
    (err, p) => {
      if (err || !p) {
        res.status(404).send('<!DOCTYPE html><html><body style="background:#090b10;color:#f0f1f5;font-family:sans-serif;text-align:center;padding-top:40vh;"><h1>Profile not found</h1></body></html>');
        return;
      }

      const proxyDisplay = p.pool_proxy_name
        ? `${p.pool_proxy_name} (${p.pool_proxy_host}:${p.pool_proxy_port})`
        : (p.proxy_host ? `${p.proxy_host}:${p.proxy_port || ''}` : 'None');

      const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <title>VeilBrowse — ${p.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='18' fill='%2306b6d4'/%3E%3Ctext x='50' y='68' font-size='58' font-weight='700' text-anchor='middle' fill='%23fff' font-family='system-ui'%3EV%3C/text%3E%3C/svg%3E">
  <style>
    :root {
      --bg-root: #18191c;
      --bg-surface: #232428;
      --bg-elevated: #2b2d31;
      --bg-input: #1e1f22;
      --border: #2f3035;
      --border-hover: #3a3c42;
      --border-active: #4a4d55;
      --text-primary: #dbdee1;
      --text-secondary: #949ba4;
      --text-muted: #6d6f78;
      --accent: #06b6d4;
      --accent-hover: #0891b2;
      --accent-glow: rgba(6, 182, 212, 0.12);
      --accent-dim: rgba(6, 182, 212, 0.06);
      --danger: #ef4444;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.08);
      --info: #60a5fa;
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
      --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
      --dot-color: rgba(255,255,255,0.03);
    }
    [data-theme="light"] {
      --bg-root: #f2f3f5;
      --bg-surface: #ffffff;
      --bg-elevated: #ebedef;
      --bg-input: #ffffff;
      --border: #e3e5e8;
      --border-hover: #d5d8dc;
      --border-active: #c8ccd0;
      --text-primary: #313338;
      --text-secondary: #4f5660;
      --text-muted: #959ba3;
      --accent: #06b6d4;
      --accent-hover: #0891b2;
      --accent-glow: rgba(6, 182, 212, 0.10);
      --accent-dim: rgba(6, 182, 212, 0.04);
      --danger: #dc2626;
      --success: #059669;
      --success-bg: rgba(5, 150, 105, 0.06);
      --info: #2563eb;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
      --dot-color: rgba(0,0,0,0.035);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-root);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background-image: radial-gradient(var(--dot-color) 1px, transparent 1px);
      background-size: 24px 24px;
      transition: background 0.3s ease, color 0.3s ease;
    }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      max-width: 520px;
      width: 100%;
      transition: background 0.3s ease, border-color 0.3s ease;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
      transition: border-color 0.3s ease;
    }
    .brand-icon {
      width: 24px;
      height: 24px;
      background: var(--accent);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
    }
    .brand-text {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.3px;
      flex: 1;
    }
    .theme-toggle {
      width: 28px; height: 28px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.15s ease;
    }
    .theme-toggle:hover {
      background: var(--bg-input);
      color: var(--text-primary);
      border-color: var(--border-hover);
    }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary); letter-spacing: -0.2px; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; font-weight: 400; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .item {
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      transition: background 0.3s ease, border-color 0.3s ease;
    }
    .item-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .item-value {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
      word-break: break-word;
    }
    .item-full { grid-column: 1 / -1; }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      margin-right: 6px;
      margin-top: 4px;
    }
    .tag-cyan { background: rgba(96,165,250,0.08); color: #60a5fa; border: 1px solid rgba(96,165,250,0.15); }
    [data-theme="light"] .tag-cyan { background: rgba(37,99,235,0.06); color: #2563eb; border-color: rgba(37,99,235,0.12); }
    .tag-green { background: var(--success-bg); color: var(--success); border: 1px solid rgba(16,185,129,0.15); }
    [data-theme="light"] .tag-green { border-color: rgba(5,150,105,0.12); }
    .tag-gray { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--border); }
    .startup-url {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: border-color 0.3s ease;
    }
    .startup-url-text { font-size: 13px; color: var(--text-muted); }
    .startup-url-text strong { color: var(--accent); font-weight: 600; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 6px;
      border: 1px solid var(--accent);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      background: var(--accent);
      color: #fff;
      font-family: 'Inter', sans-serif;
      transition: background 0.15s ease, border-color 0.15s ease;
      flex-shrink: 0;
    }
    .btn:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
    .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-icon">V</div>
      <div class="brand-text">VEILBROWSE</div>
      <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="Toggle theme">
        <span id="themeIcon">&#127769;</span>
      </button>
    </div>
    <h1>${p.name}</h1>
    <div class="subtitle">Profile #${p.id} &mdash; Launched ${new Date().toLocaleString()}</div>
    <div class="grid">
      <div class="item">
        <div class="item-label">Viewport</div>
        <div class="item-value">${p.viewport_width || 1920}&times;${p.viewport_height || 1080}</div>
      </div>
      <div class="item">
        <div class="item-label">Timezone</div>
        <div class="item-value">${p.timezone || '&mdash;'}</div>
      </div>
      <div class="item">
        <div class="item-label">Language</div>
        <div class="item-value">${p.language || '&mdash;'}</div>
      </div>
      <div class="item">
        <div class="item-label">Location</div>
        <div class="item-value">${p.geolocation_lat ? p.geolocation_lat + ', ' + p.geolocation_lng : '&mdash;'}</div>
      </div>
      <div class="item item-full">
        <div class="item-label">Proxy</div>
        <div class="item-value">${proxyDisplay}</div>
      </div>
      <div class="item">
        <div class="item-label">WebRTC</div>
        <div class="item-value"><span class="tag tag-cyan">${p.webrtc_policy || 'block_local_ips'}</span></div>
      </div>
      <div class="item">
        <div class="item-label">Canvas</div>
        <div class="item-value">${p.canvas_seed !== null && p.canvas_seed !== undefined ? '<span class="tag tag-green">seed ' + p.canvas_seed + '</span>' : '<span class="tag tag-gray">default</span>'}</div>
      </div>
      <div class="item">
        <div class="item-label">CPU</div>
        <div class="item-value">${p.hardware_concurrency || '&mdash;'} cores</div>
      </div>
      <div class="item">
        <div class="item-label">RAM</div>
        <div class="item-value">${p.device_memory || '&mdash;'} GB</div>
      </div>
      <div class="item item-full">
        <div class="item-label">GPU</div>
        <div class="item-value mono" style="font-size:11px;color:var(--text-muted);">${p.webgl_vendor || 'default'} / ${p.webgl_renderer || 'default'}</div>
      </div>
      <div class="item">
        <div class="item-label">Audio</div>
        <div class="item-value">${p.audio_seed !== null && p.audio_seed !== undefined ? '<span class="tag tag-green">seed ' + p.audio_seed + '</span>' : '<span class="tag tag-gray">default</span>'}</div>
      </div>
      <div class="item">
        <div class="item-label">Rects</div>
        <div class="item-value">${p.client_rects_noise !== null && p.client_rects_noise !== undefined ? '<span class="tag tag-green">noise ' + p.client_rects_noise + '</span>' : '<span class="tag tag-gray">off</span>'}</div>
      </div>
      <div class="item item-full">
        <div class="item-label">User Agent</div>
        <div class="item-value mono" style="font-size:11px;color:var(--text-muted);">${p.user_agent || 'default'}</div>
      </div>
    </div>
    <div class="startup-url">
      <div class="startup-url-text">Startup URL: <strong>${p.startup_url || 'https://www.google.com'}</strong></div>
      <a class="btn" href="${p.startup_url || 'https://www.google.com'}" target="_blank" id="openBtn">Open &rarr;</a>
    </div>
    <div id="countdownWrap" style="margin-top:12px;text-align:center;font-size:13px;color:var(--text-muted);">
      Redirecting in <strong id="countdownNum" style="color:var(--accent);">3</strong>s &mdash;
      <a href="#" id="cancelRedirect" style="color:var(--text-secondary);text-decoration:underline;">cancel</a>
    </div>
  </div>
  <script>
    (function initTheme() {
      const saved = localStorage.getItem('veilbrowse-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = saved || (prefersDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
      updateIcon(theme);
    })();
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('veilbrowse-theme', next);
      updateIcon(next);
    }
    function updateIcon(theme) {
      const icon = document.getElementById('themeIcon');
      if (icon) icon.innerHTML = theme === 'dark' ? '&#127769;' : '&#9728;&#65039;';
    }
    (function() {
      const url = '${p.startup_url || 'https://www.google.com'}';
      let seconds = 3;
      const numEl = document.getElementById('countdownNum');
      const wrapEl = document.getElementById('countdownWrap');
      const cancelEl = document.getElementById('cancelRedirect');
      let timer = setInterval(function() {
        seconds--;
        if (numEl) numEl.textContent = seconds;
        if (seconds <= 0) {
          clearInterval(timer);
          if (wrapEl) wrapEl.style.display = 'none';
          window.location.href = url;
        }
      }, 1000);
      if (cancelEl) {
        cancelEl.addEventListener('click', function(e) {
          e.preventDefault();
          clearInterval(timer);
          if (wrapEl) wrapEl.style.display = 'none';
        });
      }
    })();
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  );
});

// Server-Sent Events: push session start/stop to all connected clients instantly
const sseClients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (e) { sseClients.delete(res); }
  }
}

events.on('session-change', (data) => {
  broadcast(data.type, { profileId: data.profileId, profileName: data.profileName });
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.add(res);

  // Send heartbeat every 30s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch (e) {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`VeilBrowse API running on http://localhost:${PORT}`);
  if (process.send) process.send('ready');
});
