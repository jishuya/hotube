const fs = require('fs/promises');
const path = require('path');
const db = require('../db');
const { mediaDirectory } = require('../mediaStorage');
const { HttpError } = require('../httpErrors');

const sessionRoot = path.join(mediaDirectory, '.upload-sessions');
const sessionDirectory = (id) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, '올바른 업로드 세션이 아닙니다');
  return path.join(sessionRoot, id);
};

// The deployed PM2 backend runs one process. Queue mutations per session so
// retries from different tabs/devices and cleanup cannot touch the same files together.
// Waiting requests hold no DB connection (photo processing can take seconds).
const sessions = new Map();
async function withSessionLock(id, operation, tryOnly = false) {
  sessionDirectory(id);
  const previous = sessions.get(id);
  if (tryOnly && previous) return;
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  sessions.set(id, current);
  if (previous) await previous;
  try { return await operation(); }
  finally {
    release();
    if (sessions.get(id) === current) sessions.delete(id);
  }
}

async function cleanupExpiredUploads() {
  const { rows } = await db.query(`SELECT id FROM media_upload_sessions
    WHERE metadata->>'_tempCleaned' IS DISTINCT FROM 'true' AND (
       (status IN ('pending', 'expired') AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days')
       OR (status = 'completed' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 day'))
    ORDER BY updated_at LIMIT 100`);
  for (const { id } of rows) {
    await withSessionLock(id, async () => {
      // Recheck under the same lock used by init, chunk writes, and completion.
      const { rows: eligible } = await db.query(`SELECT status FROM media_upload_sessions WHERE id = $1 AND (
        (status IN ('pending', 'expired') AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days')
        OR (status = 'completed' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 day'))`, [id]);
      if (!eligible.length) return;
      if (eligible[0].status !== 'completed') {
        await db.query("UPDATE media_upload_sessions SET status = 'expired' WHERE id = $1", [id]);
      }
      await fs.rm(sessionDirectory(id), { recursive: true, force: true });
      await db.query(`UPDATE media_upload_sessions SET metadata = metadata || '{"_tempCleaned":true}'::jsonb WHERE id = $1`, [id]);
    }, true);
  }
}

function startUploadCleanup() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await cleanupExpiredUploads(); }
    catch (error) { console.error('업로드 임시 파일 정리 실패:', error.message); }
    finally { running = false; }
  };
  const timer = setInterval(() => void run(), 60 * 60 * 1000);
  timer.unref();
  void run();
  return timer;
}

module.exports = { sessionDirectory, withSessionLock, cleanupExpiredUploads, startUploadCleanup };
