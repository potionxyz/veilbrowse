const express = require('express');
const router = express.Router();
const db = require('../db');
const { chromium } = require('playwright');

function validateProxy(body) {
  const errors = [];
  const { name, host, port } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required');
  }
  if (!host || typeof host !== 'string' || host.trim().length === 0) {
    errors.push('Host is required');
  }
  const p = parseInt(port);
  if (Number.isNaN(p) || p < 1 || p > 65535) {
    errors.push('Port must be between 1 and 65535');
  }
  return errors;
}

router.get('/', (req, res) => {
  db.all('SELECT * FROM proxies ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const validation = validateProxy(req.body);
  if (validation.length > 0) {
    return res.status(400).json({ error: validation.join('; ') });
  }
  const { name, host, port, username, password } = req.body;
  db.run(
    'INSERT INTO proxies (name, host, port, username, password) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), host.trim(), parseInt(port), username || null, password || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM proxies WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(row);
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const id = req.params.id;
  // Clear proxy_id references before deleting to avoid FK constraint violation
  db.run('UPDATE profiles SET proxy_id = NULL WHERE proxy_id = ?', [id], (err) => {
    if (err) console.error('Failed to clear profile proxy references:', err.message);
    db.run('DELETE FROM proxies WHERE id = ?', [id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ deleted: this.changes });
    });
  });
});

router.post('/:id/test', async (req, res) => {
  db.get('SELECT * FROM proxies WHERE id = ?', [req.params.id], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Proxy not found' });

    let browser;
    const start = Date.now();
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        proxy: {
          server: `http://${row.host}:${row.port}`,
          username: row.username || undefined,
          password: row.password || undefined,
        },
      });
      const context = await browser.newContext();
      const page = await context.newPage();
      const reqStart = Date.now();
      // Use a lightweight, reliable endpoint
      const resp = await page.goto('http://httpbin.org/ip', { timeout: 15000, waitUntil: 'domcontentloaded' });
      const ok = resp && resp.status() === 200;
      const latency = Date.now() - reqStart;

      const status = ok ? 'online' : 'failed';
      db.run(
        'UPDATE proxies SET status = ?, latency_ms = ?, last_tested_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, latency, row.id],
        (err2) => {
          if (err2) console.error('Failed to update proxy status:', err2.message);
        }
      );
      res.json({ id: row.id, status, latency_ms: latency, ok });
    } catch (e) {
      db.run(
        'UPDATE proxies SET status = ?, latency_ms = ?, last_tested_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['failed', null, row.id],
        (err2) => {
          if (err2) console.error('Failed to update proxy status:', err2.message);
        }
      );
      res.status(502).json({ id: row.id, status: 'failed', error: e.message });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  });
});

module.exports = router;
