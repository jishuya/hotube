BEGIN;

CREATE INDEX IF NOT EXISTS idx_media_cursor_order
    ON media (COALESCE(created_at, 'epoch'::timestamptz) DESC, id DESC);

COMMIT;
