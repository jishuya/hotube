const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const pgDb = require('../db');
const { HttpError } = require('../httpErrors');
const {
  ensureMediaDateDirectory,
  resolveMediaPath,
  toStoredMediaPath,
} = require('../mediaStorage');
const { createImageThumbnail } = require('../videoThumbnail');
const { createFileMedia, deleteMedia } = require('./mediaService');
const { enqueueVideoProcessing } = require('./mediaProcessingService');

const finalizeMediaFile = async ({
  tempPath,
  originalName,
  mimeType,
  title,
  uploadedAt,
  tags,
  uploadedBy,
  sharedWith,
  uploadBatchId,
  contentHash,
}) => {
  const isVideo = mimeType.startsWith('video/');
  const mediaType = isVideo ? 'video' : 'photo';
  let storedFilePath = null;
  let thumbnailPath = null;
  let createdMedia = null;
  try {
    const duplicate = await pgDb.query('SELECT id FROM media WHERE content_hash = $1 LIMIT 1', [contentHash]);
    if (duplicate.rows.length) {
      throw new HttpError(409, `이미 업로드된 파일입니다: ${originalName}`, 'DUPLICATE_MEDIA');
    }
    const { absoluteDirectory, relativeDirectory } = ensureMediaDateDirectory(uploadedAt);
    if (isVideo) {
      const extension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
      const inputFilename = `${randomUUID()}${extension || '.video'}`;
      storedFilePath = toStoredMediaPath(relativeDirectory, inputFilename);
      await fs.rename(tempPath, path.join(absoluteDirectory, inputFilename));
    } else {
      const originalExtension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
      const originalFilename = `${randomUUID()}${originalExtension || '.image'}`;
      const thumbnailFilename = `${randomUUID()}.webp`;
      storedFilePath = toStoredMediaPath(relativeDirectory, originalFilename);
      thumbnailPath = toStoredMediaPath(relativeDirectory, thumbnailFilename);
      await createImageThumbnail(tempPath, path.join(absoluteDirectory, thumbnailFilename));
      await fs.rename(tempPath, path.join(absoluteDirectory, originalFilename));
    }
    createdMedia = await createFileMedia({
      id: randomUUID(),
      title: String(title || '').trim() || originalName,
      filePath: storedFilePath,
      thumbnailPath,
      mediaType,
      tags,
      uploadedAt,
      uploadedBy,
      sharedWith,
      uploadBatchId,
      contentHash,
      processingStatus: isVideo ? 'processing' : 'ready',
    });
    if (isVideo) await enqueueVideoProcessing({ mediaId: createdMedia.id, inputPath: storedFilePath });
    return createdMedia;
  } catch (error) {
    if (createdMedia?.id) await deleteMedia(createdMedia.id).catch(() => {});
    await fs.unlink(tempPath).catch(() => {});
    if (thumbnailPath) await fs.unlink(resolveMediaPath(thumbnailPath)).catch(() => {});
    if (storedFilePath) await fs.unlink(resolveMediaPath(storedFilePath)).catch(() => {});
    throw error;
  }
};

module.exports = { finalizeMediaFile };
