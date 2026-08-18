const { randomUUID } = require('crypto');
const pgDb = require('../src/db');
const { resolveMediaPath } = require('../src/mediaStorage');
const { isPlaybackOptimizedVideo } = require('../src/videoThumbnail');

const enqueue = process.argv.includes('--enqueue');

const run = async () => {
  const result = await pgDb.query(`
    SELECT id, file_path
    FROM media
    WHERE media_type = 'video'
      AND file_path IS NOT NULL
      AND processing_status = 'ready'
    ORDER BY created_at
  `);

  let needsOptimization = 0;
  for (const [index, media] of result.rows.entries()) {
    try {
      const optimized = await isPlaybackOptimizedVideo(resolveMediaPath(media.file_path));
      if (!optimized) {
        needsOptimization += 1;
        if (enqueue) {
          await pgDb.query(`
            INSERT INTO media_processing_jobs (id, media_id, input_path, status, attempts, last_error, updated_at)
            VALUES ($1, $2, $3, 'pending', 0, NULL, CURRENT_TIMESTAMP)
            ON CONFLICT (media_id) DO UPDATE
            SET input_path = EXCLUDED.input_path,
                status = 'pending',
                attempts = 0,
                last_error = NULL,
                updated_at = CURRENT_TIMESTAMP
          `, [randomUUID(), media.id, media.file_path]);
          await pgDb.query(`
            UPDATE media
            SET processing_status = 'processing', processing_error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [media.id]);
        }
      }
      console.log(`[${index + 1}/${result.rows.length}] ${media.id}: ${optimized ? 'optimized' : enqueue ? 'queued' : 'needs optimization'}`);
    } catch (error) {
      console.error(`영상 검사 실패 (${media.id}):`, error.message);
    }
  }

  console.log(`검사 완료: ${result.rows.length}개 중 ${needsOptimization}개 최적화 필요${enqueue ? ' (작업 등록 완료, 백엔드 재시작 필요)' : ''}`);
};

run()
  .catch((error) => {
    console.error('영상 최적화 검사 실패:', error);
    process.exitCode = 1;
  })
  .finally(() => pgDb.pool.end());
