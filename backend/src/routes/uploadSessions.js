const { performance } = require('perf_hooks');
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const pgDb = require('../db');
const { HttpError } = require('../httpErrors');
const { mapMediaRowToVideo } = require('../responseMappers');
const { sessionDirectory, withSessionLock } = require('../services/uploadSessionLifecycle');
const { fetchUserById } = require('../services/userService');
const { enqueueVideoProcessing } = require('../services/mediaProcessingService');
const { finalizeMediaFile } = require('../services/mediaUploadService');
const { notifyNewMedia } = require('../services/pushNotificationService');

const router = express.Router();
const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 300 * 1024 * 1024;
const chunkPath = (sessionId, index) => path.join(sessionDirectory(sessionId), `chunk-${index}`);
const expectedChunkSize = (session, index) => Math.min(
  CHUNK_SIZE,
  Number(session.file_size) - (index * CHUNK_SIZE),
);

const sendError = (res, error, fallback) => res.status(error.status || 500).json({
  error: error.status ? error.message : fallback,
  ...(error.code ? { code: error.code } : {}),
});

router.post('/uploadMedia/init', async (req, res) => {
  try {
    const userId = String(req.body.userId || '');
    const contentHash = String(req.body.contentHash || '').toLowerCase();
    const originalName = String(req.body.originalName || '').slice(0, 500);
    const mimeType = String(req.body.mimeType || '');
    const fileSize = Number(req.body.fileSize);
    const metadata = req.body.metadata || {};
    if (typeof metadata !== 'object' || Array.isArray(metadata)
      || (metadata.title !== undefined && typeof metadata.title !== 'string')
      || (metadata.tags !== undefined && (!Array.isArray(metadata.tags) || metadata.tags.some((tag) => typeof tag !== 'string')))
      || (metadata.sharedWith !== undefined && (!Array.isArray(metadata.sharedWith) || metadata.sharedWith.some((family) => !['mom', 'dad'].includes(family))))) {
      throw new HttpError(400, '업로드 설정이 올바르지 않습니다');
    }
    if (typeof metadata.uploadedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.uploadedAt)
      || Number.isNaN(Date.parse(`${metadata.uploadedAt}T00:00:00Z`))
      || new Date(`${metadata.uploadedAt}T00:00:00Z`).toISOString().slice(0, 10) !== metadata.uploadedAt) {
      throw new HttpError(400, '올바른 미디어 날짜가 필요합니다');
    }
    if (!userId || !await fetchUserById(userId)) throw new HttpError(401, '로그인 정보가 필요합니다');
    if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new HttpError(400, '파일 확인 정보가 올바르지 않습니다');
    if (!originalName || !(mimeType.startsWith('image/') || mimeType.startsWith('video/'))) {
      throw new HttpError(400, '올바른 사진 또는 영상이 필요합니다');
    }
    const maxSize = mimeType.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > maxSize) {
      throw new HttpError(400, mimeType.startsWith('video/') ? '영상은 개당 300MB까지 업로드할 수 있습니다' : '사진은 개당 20MB까지 업로드할 수 있습니다');
    }
    const duplicate = await pgDb.query('SELECT 1 FROM media WHERE content_hash = $1', [contentHash]);
    if (duplicate.rows.length) throw new HttpError(409, `이미 업로드된 파일입니다: ${originalName}`, 'DUPLICATE_MEDIA');

    const existing = await pgDb.query(`
      SELECT * FROM media_upload_sessions
      WHERE user_id = $1 AND content_hash = $2 AND file_size = $3 AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1
    `, [userId, contentHash, fileSize]);
    let session = existing.rows[0];
    if (!session) {
      const id = randomUUID();
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      const result = await pgDb.query(`
        INSERT INTO media_upload_sessions (
          id, user_id, content_hash, original_name, mime_type, file_size, total_chunks, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING *
      `, [id, userId, contentHash, originalName, mimeType, fileSize, totalChunks, JSON.stringify({ _mediaId: randomUUID() })]);
      session = result.rows[0];
    }
    return await withSessionLock(session.id, async () => {
      const refreshed = await pgDb.query("SELECT * FROM media_upload_sessions WHERE id = $1 AND status = 'pending'", [session.id]);
      session = refreshed.rows[0];
      if (!session) throw new HttpError(503, '업로드 상태가 변경됐습니다. 다시 시도해주세요', 'UPLOAD_STATE_CHANGED');
      const updatedMetadata = {
        title: metadata.title, uploadedAt: metadata.uploadedAt, tags: metadata.tags,
        sharedWith: metadata.sharedWith, uploadBatchId: metadata.uploadBatchId,
        _mediaId: session.metadata?._mediaId || randomUUID(),
      };
      await pgDb.query(`UPDATE media_upload_sessions SET metadata = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [session.id, JSON.stringify(updatedMetadata)]);
      const directory = sessionDirectory(session.id);
      await fs.mkdir(directory, { recursive: true });
      const uploadedChunks = [];
      for (let index = 0; index < session.total_chunks; index += 1) {
        const stat = await fs.stat(chunkPath(session.id, index)).catch(() => null);
        if (stat?.size === expectedChunkSize(session, index)) uploadedChunks.push(index);
      }
      return res.json({ sessionId: session.id, chunkSize: CHUNK_SIZE, totalChunks: session.total_chunks, uploadedChunks });
    });
  } catch (error) {
    return sendError(res, error, '업로드를 시작하지 못했습니다');
  }
});

router.put('/uploadMedia/:sessionId/chunks/:index', express.raw({ type: 'application/octet-stream', limit: '6mb' }), async (req, res) => {
  try {
    return await withSessionLock(req.params.sessionId, async () => {
      const index = Number(req.params.index);
      const result = await pgDb.query('SELECT * FROM media_upload_sessions WHERE id = $1 AND status = $2', [req.params.sessionId, 'pending']);
      const session = result.rows[0];
      if (!session) throw new HttpError(404, '이어갈 업로드를 찾을 수 없습니다');
      if (!Number.isInteger(index) || index < 0 || index >= session.total_chunks) throw new HttpError(400, '올바른 파일 조각이 아닙니다');
      if (!Buffer.isBuffer(req.body) || req.body.length !== expectedChunkSize(session, index)) throw new HttpError(400, '파일 조각 크기가 올바르지 않습니다');
      await fs.mkdir(sessionDirectory(session.id), { recursive: true });
      const target = chunkPath(session.id, index);
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, req.body);
        await fs.rename(temporary, target);
      } finally {
        await fs.unlink(temporary).catch(() => {});
      }
      await pgDb.query('UPDATE media_upload_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [session.id]);
      return res.json({ uploaded: true, index });
    });
  } catch (error) {
    return sendError(res, error, '파일 조각을 올리지 못했습니다');
  }
});

router.post('/uploadMedia/:sessionId/complete', async (req, res) => {
  try {
    return await withSessionLock(req.params.sessionId, async () => {
      let assembledPath;
      try {
        const directory = sessionDirectory(req.params.sessionId);
        const result = await pgDb.query('SELECT * FROM media_upload_sessions WHERE id = $1', [req.params.sessionId]);
        const session = result.rows[0];
        if (!session || !['pending', 'completed'].includes(session.status)) throw new HttpError(404, '완료할 업로드를 찾을 수 없습니다');
        const metadata = session.metadata || {};
        // Persist the intended media ID before creating it, so a crash between registration
        // and marking the session complete can be recovered without inserting another media.
        const mediaId = session.media_id || metadata._mediaId || randomUUID();
        if (!session.media_id && !metadata._mediaId) {
          metadata._mediaId = mediaId;
          await pgDb.query('UPDATE media_upload_sessions SET metadata = $2::jsonb WHERE id = $1', [session.id, JSON.stringify(metadata)]);
        }
        const existing = await pgDb.query(`SELECT m.*, ARRAY(SELECT t.name FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.media_id = m.id) AS tags FROM media m WHERE m.id = $1 AND m.uploaded_by = $2`, [mediaId, session.user_id]);
        if (existing.rows.length) {
          const recovered = existing.rows[0];
          if (recovered.media_type === 'video' && recovered.processing_status === 'processing') {
            await enqueueVideoProcessing({ mediaId: recovered.id, inputPath: recovered.file_path });
          }
          await pgDb.query("UPDATE media_upload_sessions SET status = 'completed', media_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [session.id, mediaId]);
          await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
          return res.json(mapMediaRowToVideo(existing.rows[0]));
        }
        if (session.status === 'completed') throw new HttpError(410, '완료된 미디어가 삭제됐습니다', 'MEDIA_DELETED');
        const assemblyStarted = performance.now();
        assembledPath = path.join(directory, `assembled-${randomUUID()}`);
        const output = await fs.open(assembledPath, 'w');
        const hash = createHash('sha256');
        try {
          for (let index = 0; index < session.total_chunks; index++) {
            const chunk = await fs.readFile(chunkPath(session.id, index));
            if (chunk.length !== expectedChunkSize(session, index)) throw new HttpError(400, '업로드되지 않은 파일 조각이 있습니다');
            hash.update(chunk);
            // writeFile handles short writes; one bounded chunk is held at a time.
            await output.writeFile(chunk);
          }
        } finally { await output.close(); }
        if (hash.digest('hex') !== session.content_hash) throw new HttpError(400, '업로드한 파일을 확인하지 못했습니다. 다시 시도해주세요');
        res.locals.uploadTimings = { assemble: performance.now() - assemblyStarted };
        const finalizeStarted = performance.now();
        const uploader = await fetchUserById(session.user_id);
        const media = await finalizeMediaFile({
          mediaId, tempPath: assembledPath, originalName: session.original_name,
          mimeType: session.mime_type, title: metadata.title, uploadedAt: metadata.uploadedAt,
          tags: metadata.tags, uploadedBy: session.user_id, sharedWith: metadata.sharedWith,
          uploadBatchId: metadata.uploadBatchId, contentHash: session.content_hash,
        });
        res.locals.uploadTimings.finalize = performance.now() - finalizeStarted;
        await pgDb.query("UPDATE media_upload_sessions SET status = 'completed', media_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [session.id, media.id]);
        // Cleanup failure must not turn a successfully registered upload into a failure.
        await fs.rm(directory, { recursive: true, force: true }).catch((error) => console.warn('완료된 업로드 임시 파일 정리 실패:', error.message));
        void notifyNewMedia({ media, uploader, uploadBatchId: metadata.uploadBatchId || null }).catch((error) => console.error('새 미디어 푸시 알림 오류:', error));
        return res.status(201).json(mapMediaRowToVideo(media));
      } finally {
        if (assembledPath) await fs.unlink(assembledPath).catch(() => {});
      }
    });
  } catch (error) {
    return sendError(res, error, '업로드를 완료하지 못했습니다');
  }
});

module.exports = router;
