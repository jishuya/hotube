const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const pgDb = require('../db');
const { resolveMediaPath, toStoredMediaPath } = require('../mediaStorage');
const {
  createBrowserCompatibleVideo,
  createVideoThumbnail,
  isBrowserCompatibleVideo,
} = require('../videoThumbnail');

let workerRunning = false;

const enqueueVideoProcessing = async ({ mediaId, inputPath }) => {
  await pgDb.query(`
    INSERT INTO media_processing_jobs (id, media_id, input_path)
    VALUES ($1, $2, $3)
    ON CONFLICT (media_id) DO NOTHING
  `, [randomUUID(), mediaId, inputPath]);
  kickMediaProcessingWorker();
};

const claimNextJob = async () => {
  const client = await pgDb.getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      SELECT id, media_id, input_path, attempts
      FROM media_processing_jobs
      WHERE status = 'pending'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    if (!result.rows.length) {
      await client.query('COMMIT');
      return null;
    }
    const job = result.rows[0];
    await client.query(`
      UPDATE media_processing_jobs
      SET status = 'processing', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [job.id]);
    await client.query('COMMIT');
    return { ...job, attempts: job.attempts + 1 };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const processVideoJob = async (job) => {
  const inputAbsolutePath = resolveMediaPath(job.input_path);
  const relativeDirectory = path.posix.dirname(job.input_path);
  const absoluteDirectory = path.dirname(inputAbsolutePath);
  const thumbnailPath = toStoredMediaPath(relativeDirectory, `${randomUUID()}.jpg`);
  const thumbnailAbsolutePath = resolveMediaPath(thumbnailPath);
  let outputPath = job.input_path;
  let outputAbsolutePath = inputAbsolutePath;

  try {
    await createVideoThumbnail(inputAbsolutePath, thumbnailAbsolutePath);
    const compatible = await isBrowserCompatibleVideo(inputAbsolutePath);
    if (!compatible) {
      outputPath = toStoredMediaPath(relativeDirectory, `${randomUUID()}.mp4`);
      outputAbsolutePath = path.join(absoluteDirectory, path.basename(outputPath));
      await createBrowserCompatibleVideo(inputAbsolutePath, outputAbsolutePath);
    }

    const client = await pgDb.getClient();
    let result;
    try {
      await client.query('BEGIN');
      result = await client.query(`
        UPDATE media
        SET file_path = $2,
            thumbnail_path = $3,
            processing_status = 'ready',
            processing_error = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `, [job.media_id, outputPath, thumbnailPath]);
      await client.query(`
        UPDATE media_processing_jobs
        SET status = 'completed', last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [job.id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    if (!result.rows.length) {
      await fs.unlink(thumbnailAbsolutePath).catch(() => {});
      if (outputPath !== job.input_path) await fs.unlink(outputAbsolutePath).catch(() => {});
    } else if (outputPath !== job.input_path) {
      await fs.unlink(inputAbsolutePath).catch(() => {});
    }
  } catch (error) {
    await fs.unlink(thumbnailAbsolutePath).catch(() => {});
    if (outputPath !== job.input_path) await fs.unlink(outputAbsolutePath).catch(() => {});
    const failed = job.attempts >= 3;
    await pgDb.query(`
      UPDATE media_processing_jobs
      SET status = $2, last_error = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [job.id, failed ? 'failed' : 'pending', String(error.message || error).slice(0, 2000)]);
    if (failed) {
      await pgDb.query(`
        UPDATE media
        SET processing_status = 'failed', processing_error = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [job.media_id, String(error.message || error).slice(0, 2000)]);
    }
    console.error(`영상 백그라운드 처리 실패 (${job.media_id}, ${job.attempts}/3):`, error.message);
  }
};

const runWorker = async () => {
  if (workerRunning) return;
  workerRunning = true;
  try {
    while (true) {
      const job = await claimNextJob();
      if (!job) break;
      await processVideoJob(job);
    }
  } catch (error) {
    console.error('영상 처리 작업자 오류:', error);
  } finally {
    workerRunning = false;
  }
};

function kickMediaProcessingWorker() {
  setImmediate(() => void runWorker());
}

const resumeMediaProcessing = async () => {
  await pgDb.query(`
    UPDATE media_processing_jobs
    SET status = 'pending', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'processing'
  `);
  kickMediaProcessingWorker();
};

module.exports = {
  enqueueVideoProcessing,
  resumeMediaProcessing,
};
