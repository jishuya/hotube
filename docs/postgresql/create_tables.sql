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
    avatar TEXT,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS child_profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    birth_date DATE NOT NULL,
    photo_url TEXT,
    photo_path TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_child_profiles_name
        CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_child_profiles_nickname
        CHECK (BTRIM(nickname) <> ''),
    CONSTRAINT chk_child_profiles_gender
        CHECK (gender IN ('male', 'female')),
    CONSTRAINT fk_child_profiles_created_by
        FOREIGN KEY (created_by)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_child_profiles_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT,
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
    uploaded_by TEXT,
    shared_with TEXT[] NOT NULL DEFAULT ARRAY['dad', 'mom']::TEXT[],
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    CONSTRAINT chk_media_type
        CHECK (media_type IN ('youtube', 'video', 'photo')),
    CONSTRAINT chk_content_type
        CHECK (
            (media_type = 'youtube' AND content_type IN ('long', 'short'))
            OR
            (media_type IN ('photo', 'video') AND content_type IS NULL)
        ),
    CONSTRAINT chk_media_source
        CHECK (
            (media_type = 'youtube' AND youtube_url IS NOT NULL AND file_path IS NULL)
            OR
            (media_type IN ('video', 'photo') AND file_path IS NOT NULL AND youtube_url IS NULL)
    ),
    CONSTRAINT fk_media_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS memory_date_tags (
    album_date DATE NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (album_date, tag_id),
    CONSTRAINT fk_memory_date_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags (id)
        ON UPDATE CASCADE ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS user_favorite_media (
    user_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, media_id),
    CONSTRAINT fk_user_favorite_media_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_user_favorite_media_media
        FOREIGN KEY (media_id) REFERENCES media (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS support_requests (
    id UUID PRIMARY KEY,
    user_id TEXT,
    request_type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    email_sent BOOLEAN NOT NULL DEFAULT FALSE,
    email_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_requests_type CHECK (request_type IN ('inquiry', 'bug')),
    CONSTRAINT chk_support_requests_message CHECK (BTRIM(message) <> ''),
    CONSTRAINT chk_support_requests_status CHECK (status IN ('received', 'in_progress', 'resolved')),
    CONSTRAINT fk_support_requests_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS support_request_attachments (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_attachment_size CHECK (size_bytes > 0),
    CONSTRAINT fk_support_attachments_request
        FOREIGN KEY (request_id) REFERENCES support_requests (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_media_id ON comments (media_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_birth_date ON child_profiles (birth_date);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);
CREATE INDEX IF NOT EXISTS idx_media_title_trgm ON media USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_at ON media (uploaded_at);
CREATE INDEX IF NOT EXISTS idx_media_year ON media (year);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name);
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm ON tags USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag_media ON media_tags (tag_id, media_id);
CREATE INDEX IF NOT EXISTS idx_memory_date_tags_tag_date ON memory_date_tags (tag_id, album_date);
CREATE INDEX IF NOT EXISTS idx_user_watched_media_media_id ON user_watched_media (media_id);
CREATE INDEX IF NOT EXISTS idx_user_liked_media_media_id ON user_liked_media (media_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_media_media_id ON user_favorite_media (media_id);
CREATE INDEX IF NOT EXISTS idx_user_albums_user_updated ON user_albums (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_album_media_album_position ON user_album_media (album_id, position, created_at);
CREATE INDEX IF NOT EXISTS idx_user_album_media_media_id ON user_album_media (media_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_created ON support_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_user_created ON support_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_attachments_request ON support_request_attachments (request_id);

COMMIT;
