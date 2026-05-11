const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  db.all(
    `SELECT g.*, COUNT(p.id) as profile_count
     FROM groups g
     LEFT JOIN profiles p ON p.group_id = g.id
     GROUP BY g.id
     ORDER BY g.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  const trimmed = name.trim();
  if (trimmed.length > 50) {
    return res.status(400).json({ error: 'Group name must be 50 characters or fewer' });
  }
  const finalColor = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#06b6d4';

  db.run(
    'INSERT INTO groups (name, color) VALUES (?, ?)',
    [trimmed, finalColor],
    function (err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Group name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT * FROM groups WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(row);
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { name, color } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  const trimmed = name.trim();
  if (trimmed.length > 50) {
    return res.status(400).json({ error: 'Group name must be 50 characters or fewer' });
  }
  const finalColor = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#06b6d4';

  db.run(
    'UPDATE groups SET name = ?, color = ? WHERE id = ?',
    [trimmed, finalColor, req.params.id],
    function (err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Group name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      db.get('SELECT * FROM groups WHERE id = ?', [req.params.id], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(row);
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const id = req.params.id;
  // Unassign profiles from this group first
  db.run('UPDATE profiles SET group_id = NULL WHERE group_id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM groups WHERE id = ?', [id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ deleted: this.changes });
    });
  });
});

module.exports = router;
