const express = require('express');
const router = express.Router();
const db = require('../db');
const launcher = require('../launcher');
const path = require('path');
const fs = require('fs');

const profilesDir = path.join(db.dataDir, 'profiles');

function resolveProfileProxy(row) {
  const p = { ...row };
  if (p.proxy_id && p.proxy_resolved_host) {
    // Pool proxy takes precedence; clear inline fields so client sees clean pool source.
    p.proxy_host = p.proxy_resolved_host;
    p.proxy_port = p.proxy_resolved_port;
    p.proxy_username = p.proxy_resolved_username;
    p.proxy_password = p.proxy_resolved_password;
    p.proxy_source = 'pool';
  } else {
    p.proxy_source = 'inline';
  }
  return p;
}

// Backend API owns server-side validation and error message strings.
function validateProfile(body) {
  const errors = [];
  const {
    name, viewport_width, viewport_height,
    geolocation_lat, geolocation_lng, proxy_port,
  } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required');
  }
  const w = parseInt(viewport_width);
  const h = parseInt(viewport_height);
  if (Number.isNaN(w) || w < 1 || w > 7680) {
    errors.push('Viewport width must be between 1 and 7680');
  }
  if (Number.isNaN(h) || h < 1 || h > 7680) {
    errors.push('Viewport height must be between 1 and 7680');
  }
  const lat = parseFloat(geolocation_lat);
  const lng = parseFloat(geolocation_lng);
  if (geolocation_lat !== undefined && geolocation_lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
    errors.push('Latitude must be between -90 and 90');
  }
  if (geolocation_lng !== undefined && geolocation_lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
    errors.push('Longitude must be between -180 and 180');
  }
  const port = parseInt(proxy_port);
  if (proxy_port !== undefined && proxy_port !== null && (Number.isNaN(port) || port < 1 || port > 65535)) {
    errors.push('Proxy port must be between 1 and 65535');
  }
  if (body.proxy_id !== undefined && body.proxy_id !== null) {
    const pid = parseInt(body.proxy_id);
    if (Number.isNaN(pid) || pid < 1) {
      errors.push('Proxy ID must be a positive integer');
    }
  }
  const seed = parseInt(body.canvas_seed);
  if (body.canvas_seed !== undefined && body.canvas_seed !== null && Number.isNaN(seed)) {
    errors.push('Canvas seed must be an integer');
  }
  if (body.webrtc_policy !== undefined && body.webrtc_policy !== null &&
      !['block_local_ips', 'allow', 'strict_block'].includes(body.webrtc_policy)) {
    errors.push('WebRTC policy must be block_local_ips, allow, or strict_block');
  }
  const hw = parseInt(body.hardware_concurrency);
  if (body.hardware_concurrency !== undefined && body.hardware_concurrency !== null && (Number.isNaN(hw) || hw < 1 || hw > 128)) {
    errors.push('CPU cores must be between 1 and 128');
  }
  const mem = parseInt(body.device_memory);
  if (body.device_memory !== undefined && body.device_memory !== null && (Number.isNaN(mem) || mem < 1 || mem > 64)) {
    errors.push('RAM must be between 1 and 64');
  }
  const audioSeed = parseInt(body.audio_seed);
  if (body.audio_seed !== undefined && body.audio_seed !== null && Number.isNaN(audioSeed)) {
    errors.push('Audio seed must be an integer');
  }
  const rectNoise = parseFloat(body.client_rects_noise);
  if (body.client_rects_noise !== undefined && body.client_rects_noise !== null && (Number.isNaN(rectNoise) || rectNoise < 0 || rectNoise > 10)) {
    errors.push('Client rects noise must be between 0 and 10');
  }
  if (body.notes !== undefined && body.notes !== null && typeof body.notes === 'string' && body.notes.length > 2000) {
    errors.push('Notes must be 2000 characters or fewer');
  }

  return errors;
}

router.get('/', (req, res) => {
  db.all(
    `SELECT p.*, px.name as proxy_name, px.host as proxy_resolved_host, px.port as proxy_resolved_port, px.username as proxy_resolved_username, px.password as proxy_resolved_password, px.status as proxy_status, px.latency_ms as proxy_latency_ms
     FROM profiles p
     LEFT JOIN proxies px ON p.proxy_id = px.id
     ORDER BY p.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(resolveProfileProxy));
    }
  );
});

router.post('/', (req, res) => {
  const validation = validateProfile(req.body);
  if (validation.length > 0) {
    return res.status(400).json({ error: validation.join('; ') });
  }

  const {
    name, user_agent, viewport_width, viewport_height,
    timezone, geolocation_lat, geolocation_lng, language,
    proxy_host, proxy_port, proxy_username, proxy_password,
    canvas_seed, webrtc_policy, proxy_id, startup_url,
    hardware_concurrency, device_memory, webgl_vendor, webgl_renderer,
    audio_seed, client_rects_noise, notes,
  } = req.body;

  db.run(
    `INSERT INTO profiles (name, user_agent, viewport_width, viewport_height, timezone, geolocation_lat, geolocation_lng, language, proxy_host, proxy_port, proxy_username, proxy_password, canvas_seed, webrtc_policy, proxy_id, startup_url, user_data_dir, hardware_concurrency, device_memory, webgl_vendor, webgl_renderer, audio_seed, client_rects_noise, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, user_agent, viewport_width, viewport_height, timezone, geolocation_lat, geolocation_lng, language, proxy_host, proxy_port, proxy_username, proxy_password, (canvas_seed !== null && canvas_seed !== undefined) ? canvas_seed : null, webrtc_policy || 'block_local_ips', (proxy_id !== null && proxy_id !== undefined) ? proxy_id : null, startup_url || 'https://www.google.com', '',
     (hardware_concurrency !== null && hardware_concurrency !== undefined) ? hardware_concurrency : null,
     (device_memory !== null && device_memory !== undefined) ? device_memory : null,
     webgl_vendor || null, webgl_renderer || null,
     (audio_seed !== null && audio_seed !== undefined) ? audio_seed : null,
     (client_rects_noise !== null && client_rects_noise !== undefined) ? client_rects_noise : null,
     (notes !== null && notes !== undefined) ? notes : null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const id = this.lastID;
      const userDataDir = path.join(profilesDir, String(id));
      fs.mkdirSync(userDataDir, { recursive: true });

      db.run('UPDATE profiles SET user_data_dir = ? WHERE id = ?', [userDataDir, id], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        db.get('SELECT * FROM profiles WHERE id = ?', [id], (err3, row) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json(row);
        });
      });
    }
  );
});

router.get('/:id', (req, res) => {
  db.get(
    `SELECT p.*, px.name as proxy_name, px.host as proxy_resolved_host, px.port as proxy_resolved_port, px.username as proxy_resolved_username, px.password as proxy_resolved_password, px.status as proxy_status, px.latency_ms as proxy_latency_ms
     FROM profiles p
     LEFT JOIN proxies px ON p.proxy_id = px.id
     WHERE p.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(resolveProfileProxy(row));
    }
  );
});

router.put('/:id', (req, res) => {
  const validation = validateProfile(req.body);
  if (validation.length > 0) {
    return res.status(400).json({ error: validation.join('; ') });
  }

    const {
      name, user_agent, viewport_width, viewport_height,
      timezone, geolocation_lat, geolocation_lng, language,
      proxy_host, proxy_port, proxy_username, proxy_password,
      canvas_seed, webrtc_policy, proxy_id, startup_url,
      hardware_concurrency, device_memory, webgl_vendor, webgl_renderer,
      audio_seed, client_rects_noise, notes,
    } = req.body;

    // Preserve existing proxy_id if not explicitly provided in the request body
    db.get('SELECT proxy_id, notes FROM profiles WHERE id = ?', [req.params.id], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!existing) return res.status(404).json({ error: 'Not found' });

      // If proxy_id key is present in the body (even as null), use it; otherwise preserve existing.
      const finalProxyId = Object.prototype.hasOwnProperty.call(req.body, 'proxy_id') ? proxy_id : existing.proxy_id;
      const finalNotes = Object.prototype.hasOwnProperty.call(req.body, 'notes') ? notes : existing.notes;

      db.run(
        `UPDATE profiles SET name=?, user_agent=?, viewport_width=?, viewport_height=?, timezone=?, geolocation_lat=?, geolocation_lng=?, language=?, proxy_host=?, proxy_port=?, proxy_username=?, proxy_password=?, canvas_seed=?, webrtc_policy=?, proxy_id=?, startup_url=?, hardware_concurrency=?, device_memory=?, webgl_vendor=?, webgl_renderer=?, audio_seed=?, client_rects_noise=?, notes=? WHERE id=?`,
        [name, user_agent, viewport_width, viewport_height, timezone, geolocation_lat, geolocation_lng, language, proxy_host, proxy_port, proxy_username, proxy_password, (canvas_seed !== null && canvas_seed !== undefined) ? canvas_seed : null, webrtc_policy || 'block_local_ips', finalProxyId, startup_url || 'https://www.google.com',
         (hardware_concurrency !== null && hardware_concurrency !== undefined) ? hardware_concurrency : null,
         (device_memory !== null && device_memory !== undefined) ? device_memory : null,
         webgl_vendor || null, webgl_renderer || null,
         (audio_seed !== null && audio_seed !== undefined) ? audio_seed : null,
         (client_rects_noise !== null && client_rects_noise !== undefined) ? client_rects_noise : null,
         (finalNotes !== null && finalNotes !== undefined) ? finalNotes : null,
         req.params.id],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
        db.get(
          `SELECT p.*, px.name as proxy_name, px.host as proxy_resolved_host, px.port as proxy_resolved_port, px.username as proxy_resolved_username, px.password as proxy_resolved_password, px.status as proxy_status, px.latency_ms as proxy_latency_ms
           FROM profiles p
           LEFT JOIN proxies px ON p.proxy_id = px.id
           WHERE p.id = ?`,
          [req.params.id],
          (err3, row) => {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json(resolveProfileProxy(row));
          }
        );
      }
    );
  });
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  await launcher.stopProfile(id);
  db.get('SELECT user_data_dir FROM profiles WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const userDataDir = row ? row.user_data_dir : null;
    db.run('DELETE FROM profiles WHERE id = ?', [id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      if (userDataDir) {
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
      }
      res.json({ deleted: this.changes });
    });
  });
});

router.post('/:id/launch', (req, res) => {
  const id = parseInt(req.params.id);
  // Backend API owns the error message for duplicate launches.
  const sessions = launcher.listSessions();
  if (sessions.some(s => s.profileId === id)) {
    return res.status(409).json({ error: 'Profile already running' });
  }

  db.get(
    `SELECT p.*, px.host as proxy_resolved_host, px.port as proxy_resolved_port, px.username as proxy_resolved_username, px.password as proxy_resolved_password
     FROM profiles p
     LEFT JOIN proxies px ON p.proxy_id = px.id
     WHERE p.id = ?`,
    [id],
    async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Not found' });
      // If proxy_id is set and resolved fields exist, override inline proxy config
      if (row.proxy_id && row.proxy_resolved_host) {
        row.proxy_host = row.proxy_resolved_host;
        row.proxy_port = row.proxy_resolved_port;
        row.proxy_username = row.proxy_resolved_username;
        row.proxy_password = row.proxy_resolved_password;
      }
      try {
        const result = await launcher.launchProfile(row);
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );
});

router.post('/:id/stop', async (req, res) => {
  const result = await launcher.stopProfile(req.params.id);
  res.json(result);
});

router.get('/:id/screenshot', async (req, res) => {
  try {
    const screenshot = await launcher.getScreenshot(req.params.id);
    if (!screenshot) return res.status(404).json({ error: 'No active session' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(screenshot);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
