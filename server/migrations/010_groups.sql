-- Backend API owns schema. Other agents request changes via new migration files.
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#06b6d4',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE profiles ADD COLUMN group_id INTEGER REFERENCES groups(id);
CREATE INDEX IF NOT EXISTS idx_profiles_group_id ON profiles(group_id);
