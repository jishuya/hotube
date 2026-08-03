BEGIN;

CREATE TABLE IF NOT EXISTS memory_date_notes (
    album_date DATE PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
    updated_by TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 기존 날짜 태그를 그 날짜에 현재 존재하는 모든 미디어의 개별 태그로 이관한다.
INSERT INTO media_tags (media_id, tag_id)
SELECT m.id, mdt.tag_id
FROM memory_date_tags mdt
JOIN media m ON m.uploaded_at = mdt.album_date
ON CONFLICT (media_id, tag_id) DO NOTHING;

DROP TABLE memory_date_tags;

-- 이관 대상 미디어가 없었던 날짜 태그만 tags에 고아 데이터로 남을 수 있다.
DELETE FROM tags t
WHERE NOT EXISTS (SELECT 1 FROM media_tags mt WHERE mt.tag_id = t.id);

COMMIT;
