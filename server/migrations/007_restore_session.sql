-- Add restore_session toggle for persistent context tab restoration
ALTER TABLE profiles ADD COLUMN restore_session INTEGER DEFAULT 0;

-- Migrate existing profiles that used the 'restore' startup_url hack
UPDATE profiles SET restore_session = 1 WHERE startup_url = 'restore';
UPDATE profiles SET startup_url = 'https://www.google.com' WHERE startup_url = 'restore';
