-- 날짜 메모 부분 검색 성능을 위한 인덱스.
-- create_tables.sql에서 pg_trgm 확장이 먼저 활성화되어 있어야 한다.
CREATE INDEX IF NOT EXISTS idx_memory_date_notes_content_trgm
    ON memory_date_notes USING GIN (content gin_trgm_ops);
