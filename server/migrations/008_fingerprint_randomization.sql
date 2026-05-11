-- Backend API owns schema. Other agents request changes via new migration files.
ALTER TABLE profiles ADD COLUMN hardware_concurrency INTEGER;
ALTER TABLE profiles ADD COLUMN device_memory INTEGER;
ALTER TABLE profiles ADD COLUMN webgl_vendor TEXT;
ALTER TABLE profiles ADD COLUMN webgl_renderer TEXT;
ALTER TABLE profiles ADD COLUMN audio_seed INTEGER;
ALTER TABLE profiles ADD COLUMN client_rects_noise REAL;
