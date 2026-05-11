-- Browser Engineer: anti-detect columns for deterministic fingerprint noise
ALTER TABLE profiles ADD COLUMN canvas_seed INTEGER;
ALTER TABLE profiles ADD COLUMN webrtc_policy TEXT DEFAULT 'block_local_ips';
