BEGIN;

ALTER TABLE date_album_tags
    RENAME TO memory_date_tags;

ALTER TABLE memory_date_tags
    RENAME CONSTRAINT date_album_tags_pkey TO memory_date_tags_pkey;

ALTER TABLE memory_date_tags
    RENAME CONSTRAINT fk_date_album_tags_tag TO fk_memory_date_tags_tag;

ALTER INDEX idx_date_album_tags_tag_date
    RENAME TO idx_memory_date_tags_tag_date;

COMMIT;
