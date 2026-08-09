const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const pgDb = require('../src/db');
const {
  ensureMediaDateDirectory,
  resolveMediaPath,
  toStoredMediaPath,
} = require('../src/mediaStorage');
const { createImageThumbnail } = require('../src/videoThumbnail');

const backfill = async () => {
  const result = await pgDb.query(`
    SELECT id, file_path, TO_CHAR(uploaded_at, 'YYYY-MM-DD') AS uploaded_at
    FROM media
    WHERE media_type = 'photo'
      AND file_path IS NOT NULL
      AND thumbnail_path IS NULL
    ORDER BY created_at
  `);

  let completed = 0;
  for (const media of result.rows) {
    let thumbnailPath;
    try {
      const { absoluteDirectory, relativeDirectory } = ensureMediaDateDirectory(media.uploaded_at);
      const thumbnailFilename = `${randomUUID()}.webp`;
      thumbnailPath = toStoredMediaPath(relativeDirectory, thumbnailFilename);
      await createImageThumbnail(
        resolveMediaPath(media.file_path),
        path.join(absoluteDirectory, thumbnailFilename),
      );
      await pgDb.query(`
        UPDATE media
        SET thumbnail_path = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND thumbnail_path IS NULL
      `, [media.id, thumbnailPath]);
      completed += 1;
      console.log(`[${completed}/${result.rows.length}] ${media.id}`);
    } catch (error) {
      if (thumbnailPath) await fs.unlink(resolveMediaPath(thumbnailPath)).catch(() => {});
      console.error(`사진 썸네일 생성 실패 (${media.id}):`, error.message);
    }
  }

  console.log(`사진 썸네일 생성 완료: ${completed}/${result.rows.length}`);
};

backfill()
  .catch((error) => {
    console.error('사진 썸네일 보완 실패:', error);
    process.exitCode = 1;
  })
  .finally(() => pgDb.pool.end());
