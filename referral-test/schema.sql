-- Cloudflare D1 SQL console: paste and execute this entire script.
-- User identity is a server-side HMAC of the verified LINE user ID.
-- No raw LINE user ID or names are stored.
CREATE TABLE IF NOT EXISTS users (
  user_key TEXT PRIMARY KEY NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT REFERENCES users(user_key),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_referred_by
  ON users (referred_by);