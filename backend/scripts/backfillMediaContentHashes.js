const { createHash } = require('crypto');
const { createReadStream } = require('fs');
const pgDb = require('../src/db');
const { resolveMediaPath } = require('../src/mediaStorage');

const hashFile = (filePath) => new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  stream.on('error', reject);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const run = async () => {
  await pgDb.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS content_hash TEXT');
  await pgDb.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_media_content_hash ON media (content_hash) WHERE content_hash IS NOT NULL');
  const result = await pgDb.query(`
    SELECT id, file_path
    FROM media
    WHERE media_type = 'photo' AND file_path IS NOT NULL AND content_hash IS NULL
    ORDER BY created_at, id
  `);

  let updated = 0;
  let duplicates = 0;
  let failed = 0;
  for (const row of result.rows) {
    try {
      const contentHash = await hashFile(resolveMediaPath(row.file_path));
      await pgDb.query('UPDATE media SET content_hash = $2 WHERE id = $1', [row.id, contentHash]);
      updated += 1;
    } catch (error) {
      if (error.code === '23505') {
        duplicates += 1;
      } else {
        failed += 1;
        console.error(`해시 생성 실패 (${row.id}):`, error.message);
      }
    }
  }

  console.log(`사진 해시 저장 완료: ${updated}개, 기존 중복 ${duplicates}개, 실패 ${failed}개`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pgDb.pool.end());
