-- Required for GIN trigram indexes that use gin_trgm_ops.
-- Run this once per database before creating idx_media_title_trgm and idx_tags_name_trgm.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    title TEXT,
    category TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL,
    media_type TEXT NOT NULL,
    youtube_url TEXT,
    file_path TEXT,
    thumbnail_url TEXT,
    thumbnail_path TEXT,
    year INTEGER,
    uploaded_at DATE,
    duration_seconds INTEGER,
    view_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    channel_title TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    CONSTRAINT chk_media_type
        CHECK (media_type IN ('youtube', 'video', 'photo')),
    CONSTRAINT chk_content_type
        CHECK (content_type IN ('long', 'shorts')),
    CONSTRAINT chk_media_source
        CHECK (
            (media_type = 'youtube' AND youtube_url IS NOT NULL AND file_path IS NULL)
            OR
            (media_type IN ('video', 'photo') AND file_path IS NOT NULL AND youtube_url IS NULL)
        )
);

CREATE TABLE IF NOT EXISTS tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS media_tags (
    media_id TEXT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (media_id, tag_id),
    CONSTRAINT fk_media_tags_media
        FOREIGN KEY (media_id)
        REFERENCES media (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_media_tags_tag
        FOREIGN KEY (tag_id)
        REFERENCES tags (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    media_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_title TEXT,
    user_category TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    CONSTRAINT fk_comments_media
        FOREIGN KEY (media_id)
        REFERENCES media (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_comments_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS user_liked_media (
    user_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    PRIMARY KEY (user_id, media_id),
    CONSTRAINT fk_user_liked_media_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_user_liked_media_media
        FOREIGN KEY (media_id)
        REFERENCES media (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_watched_media (
    user_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    PRIMARY KEY (user_id, media_id),
    CONSTRAINT fk_user_watched_media_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_user_watched_media_media
        FOREIGN KEY (media_id)
        REFERENCES media (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_media_id ON comments (media_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);
CREATE INDEX IF NOT EXISTS idx_media_title_trgm ON media USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_at ON media (uploaded_at);
CREATE INDEX IF NOT EXISTS idx_media_year ON media (year);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name);
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm ON tags USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag_media ON media_tags (tag_id, media_id);
CREATE INDEX IF NOT EXISTS idx_user_watched_media_media_id ON user_watched_media (media_id);
CREATE INDEX IF NOT EXISTS idx_user_liked_media_media_id ON user_liked_media (media_id);

COMMIT;
