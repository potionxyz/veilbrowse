-- Backend API: proxy pool table for managed proxy assignment
CREATE TABLE IF NOT EXISTS proxies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT,
  status TEXT DEFAULT 'untested',
  latency_ms INTEGER,
  last_tested_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

