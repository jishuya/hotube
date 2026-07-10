BEGIN;

ALTER TABLE media DROP CONSTRAINT IF EXISTS chk_content_type;

UPDATE media
SET content_type = 'short'
WHERE content_type = 'shorts';

ALTER TABLE media
    ADD CONSTRAINT chk_content_type
    CHECK (content_type IN ('long', 'short'));

COMMIT;
