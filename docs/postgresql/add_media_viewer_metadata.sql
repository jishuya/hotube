BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS shared_with TEXT[] NOT NULL DEFAULT ARRAY['dad', 'mom']::TEXT[];

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_media_uploaded_by') THEN
        ALTER TABLE media ADD CONSTRAINT fk_media_uploaded_by
            FOREIGN KEY (uploaded_by) REFERENCES users (id)
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_favorite_media (
    user_id TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    media_id TEXT NOT NULL REFERENCES media (id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_media_media_id ON user_favorite_media (media_id);

COMMIT;
