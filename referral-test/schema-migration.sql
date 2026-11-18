-- Execute ONCE in Cloudflare D1 > referral-test-api > Console BEFORE deploying worker.js.
-- Existing referrals are not rewarded automatically. A user's referral is
-- qualified only after they revisit the LIFF app and LINE confirms friendship.
ALTER TABLE users ADD COLUMN friend_confirmed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_referred_friend
  ON users (referred_by, friend_confirmed_at);
