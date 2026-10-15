-- Also applied idempotently by ensurePushSubscriptionSchema at API startup.
-- Existing accounts establish a baseline on their next authenticated visit.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_media_notifications (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, media_id)
);
