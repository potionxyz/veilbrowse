const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

function getDataDir() {
  if (process.env.VEILBROWSE_DATA_DIR) return process.env.VEILBROWSE_DATA_DIR;

  // electron-main.js sets VEILBROWSE_USER_DATA env to app.getPath('userData').
  if (process.env.VEILBROWSE_USER_DATA) {
    return path.join(process.env.VEILBROWSE_USER_DATA, 'data');
  }
  return path.join(__dirname, '..', 'data');
}

const dataDir = getDataDir();
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'veilbrowse.db');
const db = new sqlite3.Database(dbPath);

let migrationsReady = false;
const readyCallbacks = [];

function onReady(cb) {
  if (migrationsReady) return cb();
  readyCallbacks.push(cb);
}

function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    db.run(`CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.all('SELECT filename FROM migrations', [], (err, rows) => {
      if (err) {
        console.error('Failed to read migrations table:', err.message);
        return;
      }
      const applied = new Set((rows || []).map(r => r.filename));

      function applyNext(index) {
        if (index >= files.length) {
          migrationsReady = true;
          readyCallbacks.forEach(cb => cb());
          readyCallbacks.length = 0;
          return;
        }
        const file = files[index];
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

        if (applied.has(file)) {
          applyNext(index + 1);
          return;
        }

        db.exec(sql, (execErr) => {
          if (execErr) {
            console.error(`Migration SQL error in ${file}:`, execErr.message);
            applyNext(index + 1);
            return;
          }
          db.run(
            'INSERT INTO migrations (filename) VALUES (?)',
            [file],
            (insertErr) => {
              if (insertErr) {
                console.error(`Migration tracking error for ${file}:`, insertErr.message);
              } else {
                console.log(`Applied migration: ${file}`);
              }
              applyNext(index + 1);
            }
          );
        });
      }

      applyNext(0);
    });
  });
}

runMigrations();

module.exports = db;
module.exports.dataDir = dataDir;
module.exports.onReady = onReady;
