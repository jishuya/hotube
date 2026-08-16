const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const pgDb = require('../db');
const { HttpError } = require('../httpErrors');
const { mapMediaRowToVideo } = require('../responseMappers');
const { mediaDirectory } = require('../mediaStorage');
const { fetchUserById } = require('../services/userService');
const { finalizeMediaFile } = require('../services/mediaUploadService');
const { notifyNewMedia } = require('../services/pushNotificationService');

const router = express.Router();
const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 150 * 1024 * 1024;
const SESSION_ROOT = path.join(mediaDirectory, '.upload-sessions');

const sessionDirectory = (sessionId) => {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new HttpError(400, '올바른 업로드 세션이 아닙니다');
  return path.join(SESSION_ROOT, sessionId);
};
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
    if (!userId || !await fetchUserById(userId)) throw new HttpError(401, '로그인 정보가 필요합니다');
    if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new HttpError(400, '파일 확인 정보가 올바르지 않습니다');
    if (!originalName || !(mimeType.startsWith('image/') || mimeType.startsWith('video/'))) {
      throw new HttpError(400, '올바른 사진 또는 영상이 필요합니다');
    }
    const maxSize = mimeType.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > maxSize) {
      throw new HttpError(400, mimeType.startsWith('video/') ? '영상은 개당 150MB까지 업로드할 수 있습니다' : '사진은 개당 20MB까지 업로드할 수 있습니다');
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
      `, [id, userId, contentHash, originalName, mimeType, fileSize, totalChunks, JSON.stringify(req.body.metadata || {})]);
      session = result.rows[0];
    }
    const directory = sessionDirectory(session.id);
    await fs.mkdir(directory, { recursive: true });
    const uploadedChunks = [];
    for (let index = 0; index < session.total_chunks; index += 1) {
      const stat = await fs.stat(chunkPath(session.id, index)).catch(() => null);
      if (stat?.size === expectedChunkSize(session, index)) uploadedChunks.push(index);
    }
    return res.json({ sessionId: session.id, chunkSize: CHUNK_SIZE, totalChunks: session.total_chunks, uploadedChunks });
  } catch (error) {
    return sendError(res, error, '업로드를 시작하지 못했습니다');
  }
});

router.put('/uploadMedia/:sessionId/chunks/:index', express.raw({ type: 'application/octet-stream', limit: '6mb' }), async (req, res) => {
  try {
    const index = Number(req.params.index);
    const result = await pgDb.query('SELECT * FROM media_upload_sessions WHERE id = $1 AND status = $2', [req.params.sessionId, 'pending']);
    const session = result.rows[0];
    if (!session) throw new HttpError(404, '이어갈 업로드를 찾을 수 없습니다');
    if (!Number.isInteger(index) || index < 0 || index >= session.total_chunks) throw new HttpError(400, '올바른 파일 조각이 아닙니다');
    if (!Buffer.isBuffer(req.body) || req.body.length !== expectedChunkSize(session, index)) throw new HttpError(400, '파일 조각 크기가 올바르지 않습니다');
    await fs.mkdir(sessionDirectory(session.id), { recursive: true });
    const target = chunkPath(session.id, index);
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, req.body);
    await fs.rename(temporary, target);
    await pgDb.query('UPDATE media_upload_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [session.id]);
    return res.json({ uploaded: true, index });
  } catch (error) {
    return sendError(res, error, '파일 조각을 올리지 못했습니다');
  }
});

router.post('/uploadMedia/:sessionId/complete', async (req, res) => {
  let assembledPath = null;
  try {
    const directory = sessionDirectory(req.params.sessionId);
    assembledPath = path.join(directory, 'assembled');
    const result = await pgDb.query('SELECT * FROM media_upload_sessions WHERE id = $1', [req.params.sessionId]);
    const session = result.rows[0];
    if (!session || session.status !== 'pending') throw new HttpError(404, '완료할 업로드를 찾을 수 없습니다');
    const output = await fs.open(assembledPath, 'w');
    const hash = createHash('sha256');
    try {
      for (let index = 0; index < session.total_chunks; index += 1) {
        const chunk = await fs.readFile(chunkPath(session.id, index));
        if (chunk.length !== expectedChunkSize(session, index)) throw new HttpError(400, '업로드되지 않은 파일 조각이 있습니다');
        hash.update(chunk);
        await output.write(chunk);
      }
    } finally {
      await output.close();
    }
    if (hash.digest('hex') !== session.content_hash) throw new HttpError(400, '업로드한 파일을 확인하지 못했습니다. 다시 시도해주세요');
    const metadata = session.metadata || {};
    const uploader = await fetchUserById(session.user_id);
    const media = await finalizeMediaFile({
      tempPath: assembledPath,
      originalName: session.original_name,
      mimeType: session.mime_type,
      title: metadata.title,
      uploadedAt: metadata.uploadedAt,
      tags: metadata.tags,
      uploadedBy: session.user_id,
      sharedWith: metadata.sharedWith,
      uploadBatchId: metadata.uploadBatchId,
      contentHash: session.content_hash,
    });
    await pgDb.query(`
      UPDATE media_upload_sessions
      SET status = 'completed', media_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [session.id, media.id]);
    await fs.rm(directory, { recursive: true, force: true });
    void notifyNewMedia({ media, uploader, uploadBatchId: metadata.uploadBatchId || null }).catch((error) => {
      console.error('새 미디어 푸시 알림 오류:', error);
    });
    return res.status(201).json(mapMediaRowToVideo(media));
  } catch (error) {
    if (assembledPath) await fs.unlink(assembledPath).catch(() => {});
    return sendError(res, error, '업로드를 완료하지 못했습니다');
  }
});

module.exports = router;
