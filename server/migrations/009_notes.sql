-- Backend API owns schema. Other agents request changes via new migration files.
ALTER TABLE profiles ADD COLUMN notes TEXT;
