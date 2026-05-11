-- Backend API: add proxy_id foreign key to profiles for pool-managed proxies
ALTER TABLE profiles ADD COLUMN proxy_id INTEGER REFERENCES proxies(id);

