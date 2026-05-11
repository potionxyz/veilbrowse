-- Add startup URL to profiles for launch behavior
ALTER TABLE profiles ADD COLUMN startup_url TEXT DEFAULT 'https://www.google.com';

