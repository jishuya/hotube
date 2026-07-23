BEGIN;

CREATE TABLE IF NOT EXISTS user_albums (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_albums_title CHECK (BTRIM(title) <> ''),
    CONSTRAINT fk_user_albums_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_album_media (
    album_id UUID NOT NULL,
    media_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (album_id, media_id),
    CONSTRAINT chk_user_album_media_position CHECK (position >= 0),
    CONSTRAINT fk_user_album_media_album
        FOREIGN KEY (album_id) REFERENCES user_albums (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_user_album_media_media
        FOREIGN KEY (media_id) REFERENCES media (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_albums_user_updated
    ON user_albums (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_album_media_album_position
    ON user_album_media (album_id, position, created_at);
CREATE INDEX IF NOT EXISTS idx_user_album_media_media_id
    ON user_album_media (media_id);

COMMIT;
