BEGIN;

CREATE TABLE IF NOT EXISTS memory_date_tags (
    album_date DATE NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (album_date, tag_id),
    CONSTRAINT fk_memory_date_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_date_tags_tag_date
    ON memory_date_tags (tag_id, album_date);

COMMIT;
