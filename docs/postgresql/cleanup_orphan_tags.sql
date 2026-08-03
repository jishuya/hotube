DELETE FROM tags t
WHERE NOT EXISTS (
    SELECT 1 FROM media_tags mt WHERE mt.tag_id = t.id
);
