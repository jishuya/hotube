BEGIN;

ALTER TABLE media
    ALTER COLUMN content_type DROP NOT NULL,
    ALTER COLUMN content_type DROP DEFAULT;

-- content_type은 YouTube 미디어에만 사용한다.
UPDATE media
SET content_type = NULL
WHERE media_type IN ('photo', 'video');

ALTER TABLE media
    DROP CONSTRAINT IF EXISTS chk_content_type;

ALTER TABLE media
    ADD CONSTRAINT chk_content_type
    CHECK (
        (media_type = 'youtube' AND content_type IN ('long', 'short'))
        OR
        (media_type IN ('photo', 'video') AND content_type IS NULL)
    );

COMMIT;
