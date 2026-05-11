#!/usr/bin/env node
/**
 * Runtime Chrome detection for PhantomGrid.
 * Tries common paths in priority order. Logs warnings if none found.
 */
const fs = require('fs');

const os = require('os');
const homedir = os.homedir();

const CANDIDATES = [
  // User override takes highest priority.
  process.env.PHANTOMGRID_CHROME_PATH,
  // Prefer non-snap binaries. Snap Chromium is sandboxed and cannot
  // write to arbitrary persistent profile directories (SingletonLock failure).
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/google-chrome',
  homedir + '/.local/bin/google-chrome-stable',
  homedir + '/.local/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/opt/google/chrome/chrome',
  // Snap binaries are LAST RESORT — they usually break persistent contexts.
  '/snap/bin/chromium',
].filter(Boolean);

function findChrome() {
  for (const p of CANDIDATES) {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      if (p.startsWith('/snap/')) {
        console.warn(`[PhantomGrid] WARNING: Detected Snap Chromium at ${p}.`);
        console.warn('  Snap browsers are sandboxed and often fail to create persistent profiles.');
        console.warn('  Install a non-Snap Chrome (.deb from google.com) for best results.');
        console.warn('  Or set PHANTOMGRID_CHROME_PATH to the correct binary path.');
      }
      return p;
    } catch (e) {
      // continue
    }
  }
  return null;
}

module.exports = { findChrome };
