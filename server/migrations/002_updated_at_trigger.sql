-- Backend API: auto-update updated_at on any row modification
-- Use BEFORE UPDATE to avoid recursive trigger firing (SQLite 3.38+ defaults recursive_triggers=ON).
CREATE TRIGGER IF NOT EXISTS profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
