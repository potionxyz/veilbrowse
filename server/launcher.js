const { chromium } = require('playwright');
const { buildAntiDetectScript } = require('./anti-detect');
const { findChrome } = require('../scripts/find-chrome');
const events = require('./events');

const activeSessions = new Map();

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return 'https://www.google.com';
  const trimmed = url.trim();
  if (!trimmed) return 'https://www.google.com';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return trimmed;
  if (trimmed.startsWith('about:') || trimmed.startsWith('chrome://')) return trimmed;
  return 'https://' + trimmed;
}

function emitSessionChange(type, profileId, profileName) {
  events.emit('session-change', { type, profileId, profileName });
}

async function launchProfile(profile) {
  if (activeSessions.has(profile.id)) {
    throw new Error('Profile already running');
  }

  const width = parseInt(profile.viewport_width || 1920);
  const height = parseInt(profile.viewport_height || 1080);

  const args = [
    '--no-sandbox',
    '--test-type', // suppresses "unsupported command-line flag" warning infobar
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    `--window-size=${width},${height}`,
  ];

  if (profile.user_agent) {
    args.push(`--user-agent=${profile.user_agent}`);
  }

  const launchOptions = {
    headless: false,
    executablePath: findChrome() || '/usr/bin/google-chrome',
    args,
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: { width, height },
    locale: profile.language || 'en-US',
    timezoneId: profile.timezone || 'America/New_York',
    geolocation: profile.geolocation_lat && profile.geolocation_lng
      ? { latitude: parseFloat(profile.geolocation_lat), longitude: parseFloat(profile.geolocation_lng), accuracy: 100 }
      : undefined,
    permissions: ['geolocation'],
    proxy: profile.proxy_host
      ? {
          server: profile.proxy_port ? `http://${profile.proxy_host}:${profile.proxy_port}` : `http://${profile.proxy_host}`,
          username: profile.proxy_username || undefined,
          password: profile.proxy_password || undefined,
          bypass: 'localhost,127.0.0.1',
        }
      : undefined,
  };

  const context = await chromium.launchPersistentContext(
    profile.user_data_dir,
    launchOptions
  );

  // Profile-specific anti-detect layer (WebRTC, Canvas, WebGL, Audio, Navigator, Fonts)
  const antiDetectScript = buildAntiDetectScript(profile);
  if (antiDetectScript) {
    await context.addInitScript(antiDetectScript);
  }

  // --- Tab 1: Profile Start Page ---
  const existingPages = context.pages();
  let infoPage = existingPages.length > 0 ? existingPages[0] : await context.newPage();
  const port = process.env.PORT || 8888;
  await infoPage.goto(`http://localhost:${port}/start/${profile.id}`, { waitUntil: 'domcontentloaded' });

  // --- Tab 2: Startup URL ---
  const startupPage = await context.newPage();
  const url = normalizeUrl(profile.startup_url);
  await startupPage.goto(url, { waitUntil: 'domcontentloaded' });

  // Track the startup page for screenshots (not the info page)
  const page = startupPage;

  if (profile.geolocation_lat && profile.geolocation_lng) {
    await context.setGeolocation({
      latitude: parseFloat(profile.geolocation_lat),
      longitude: parseFloat(profile.geolocation_lng),
      accuracy: 100,
    });
  }

  // Only listen to context close (entire browser quit).
  // Do NOT listen to page.on('close') — closing an individual tab
  // (even the initial one) must NOT mark the session as dead.
  context.on('close', () => {
    if (activeSessions.has(profile.id)) {
      activeSessions.delete(profile.id);
      emitSessionChange('session-stopped', profile.id, profile.name);
    }
  });

  activeSessions.set(profile.id, { context, page, profile, startTime: new Date() });
  emitSessionChange('session-started', profile.id, profile.name);

  return { status: 'running', profileId: profile.id };
}

async function stopProfile(profileId) {
  const id = parseInt(profileId);
  const session = activeSessions.get(id);
  if (!session) return { status: 'not_running' };
  activeSessions.delete(id);
  try { await session.context.close(); } catch (_) {}
  emitSessionChange('session-stopped', session.profile.id, session.profile.name);
  return { status: 'stopped' };
}

async function getScreenshot(profileId) {
  const id = parseInt(profileId);
  const session = activeSessions.get(id);
  if (!session) return null;

  // If the originally-tracked page was closed (user closed that tab),
  // find any other live page in the context to screenshot.
  let targetPage = session.page;
  if (targetPage.isClosed()) {
    const livePages = session.context.pages().filter(p => !p.isClosed());
    if (livePages.length === 0) {
      // All pages closed but context still alive — user closed every tab
      activeSessions.delete(id);
      emitSessionChange('session-stopped', session.profile.id, session.profile.name);
      return null;
    }
    targetPage = livePages[0];
    session.page = targetPage; // update reference for next time
  }

  try {
    return await targetPage.screenshot({ type: 'png' });
  } catch (e) {
    activeSessions.delete(id);
    try { await session.context.close(); } catch (_) {}
    emitSessionChange('session-stopped', session.profile.id, session.profile.name);
    return null;
  }
}

function listSessions() {
  const sessions = [];
  for (const [profileId, session] of activeSessions.entries()) {
    sessions.push({
      profileId,
      profileName: session.profile.name,
      status: 'running',
      startTime: session.startTime,
    });
  }
  return sessions;
}

async function cleanupStaleSessions() {
  for (const [id, session] of activeSessions.entries()) {
    let removed = false;
    try {
      // If the entire context is closed (browser quit), remove session
      const pages = session.context.pages();
      if (pages.length === 0 || pages.every(p => p.isClosed())) {
        removed = true;
      } else {
        // Try a lightweight ping on the first live page
        const livePage = pages.find(p => !p.isClosed());
        if (livePage) {
          await livePage.evaluate(() => true).catch(() => { removed = true; });
        } else {
          removed = true;
        }
      }
    } catch (e) {
      removed = true;
    }
    if (removed) {
      activeSessions.delete(id);
      emitSessionChange('session-stopped', session.profile.id, session.profile.name);
    }
  }
}
setInterval(() => { cleanupStaleSessions().catch(() => {}); }, 5000);

module.exports = { launchProfile, stopProfile, getScreenshot, listSessions, activeSessions };
