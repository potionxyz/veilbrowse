#!/usr/bin/env node
/**
 * Post-install validation script.
 * Checks for system Chrome and warns if missing.
 */
const { findChrome } = require('./find-chrome');

const chrome = findChrome();
if (!chrome) {
  console.warn('\n[PhantomGrid] WARNING: No system Chrome found.');
  console.warn('PhantomGrid requires Google Chrome or Chromium to be installed.');
  console.warn('Install one of: google-chrome-stable, google-chrome, chromium-browser, chromium');
  console.warn('Or set PHANTOMGRID_CHROME_PATH environment variable.\n');
  process.exit(0); // non-fatal
} else {
  console.log(`[PhantomGrid] Found Chrome: ${chrome}`);
}
