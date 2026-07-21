const express = require("express");
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { mapMediaRowToVideo } = require("../responseMappers");
const { ensureMediaDirectory, mediaDirectory } = require('../mediaStorage');
const {
  createFileMedia,
  createMedia,
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} = require("../services/mediaService");

const router = express.Router();

ensureMediaDirectory();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => callback(null, mediaDirectory),
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      callback(null, `${randomUUID()}${extension || ''}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) return callback(null, true);
    return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  },
});

const sendRouteError = (res, fallbackMessage, error) => {
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  return res.status(500).json({ error: fallbackMessage });
};

router.get("/getVideos", async (req, res) => {
  try {
    const contentType = req.query.contentType || null;
    const tag = req.query.tag?.trim() || null;
    const uploadedAt = req.query.uploadedAt || null;
    const source = req.query.source || null;
    const mediaType = req.query.mediaType || null;
    if (contentType && !["long", "short"].includes(contentType)) {
      return res.status(400).json({ error: "contentType은 long 또는 short여야 합니다" });
    }
    if (uploadedAt && !/^\d{4}-\d{2}-\d{2}$/.test(uploadedAt)) {
      return res.status(400).json({ error: "uploadedAt은 YYYY-MM-DD 형식이어야 합니다" });
    }
    if (source && !['youtube', 'file'].includes(source)) {
      return res.status(400).json({ error: "source는 youtube 또는 file이어야 합니다" });
    }
    if (mediaType && !['photo', 'video'].includes(mediaType)) {
      return res.status(400).json({ error: "mediaType은 photo 또는 video여야 합니다" });
    }

    const videos = await listMedia({ contentType, tag, uploadedAt, source, mediaType });
    res.json(videos.map(mapMediaRowToVideo));
  } catch (error) {
    console.error("비디오 조회 오류:", error);
    sendRouteError(res, "비디오 조회 실패", error);
  }
});

router.get("/getVideo/:id", async (req, res) => {
  try {
    const video = await getMedia(req.params.id);
    res.json(mapMediaRowToVideo(video));
  } catch (error) {
    console.error("비디오 조회 오류:", error);
    sendRouteError(res, "비디오 조회 실패", error);
  }
});

router.post("/createVideo", async (req, res) => {
  try {
    const createdVideo = await createMedia(req.body);
    res.status(201).json(mapMediaRowToVideo(createdVideo));
  } catch (error) {
    console.error("비디오 등록 오류:", error);
    sendRouteError(res, "비디오 등록 실패", error);
  }
});

router.post('/uploadMedia', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '업로드할 파일이 없습니다' });
  try {
    const tags = JSON.parse(req.body.tags || '[]');
    const createdMedia = await createFileMedia({
      id: randomUUID(),
      title: req.body.title?.trim() || req.file.originalname,
      filePath: req.file.filename,
      mediaType: req.file.mimetype.startsWith('video/') ? 'video' : 'photo',
      tags,
      uploadedAt: req.body.uploadedAt,
    });
    return res.status(201).json(mapMediaRowToVideo(createdMedia));
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    console.error('미디어 파일 업로드 오류:', error);
    return sendRouteError(res, '미디어 업로드 실패', error);
  }
});

router.get('/mediaFile/:id', async (req, res) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media.file_path) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
    const filename = path.basename(media.file_path);
    if (filename !== media.file_path) return res.status(400).json({ error: '잘못된 파일 경로입니다' });
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(filename, { root: mediaDirectory });
  } catch (error) {
    console.error('미디어 파일 조회 오류:', error);
    return sendRouteError(res, '미디어 파일 조회 실패', error);
  }
});

router.put("/updateVideo/:id", async (req, res) => {
  try {
    const updatedVideo = await updateMedia(req.params.id, req.body);
    res.json(mapMediaRowToVideo(updatedVideo));
  } catch (error) {
    console.error("비디오 수정 오류:", error);
    sendRouteError(res, "비디오 수정 실패", error);
  }
});

router.delete("/deleteVideo/:id", async (req, res) => {
  try {
    const deleted = await deleteMedia(req.params.id);
    for (const storedPath of [deleted.file_path, deleted.thumbnail_path].filter(Boolean)) {
      const filename = path.basename(storedPath);
      if (filename === storedPath) await fs.unlink(path.join(mediaDirectory, filename)).catch((error) => {
        if (error.code !== 'ENOENT') console.error('미디어 파일 삭제 오류:', error);
      });
    }
    res.json({ message: "비디오가 삭제되었습니다", id: req.params.id });
  } catch (error) {
    console.error("비디오 삭제 오류:", error);
    sendRouteError(res, "비디오 삭제 실패", error);
  }
});

router.use((error, req, res, next) => {
  if (!(error instanceof multer.MulterError)) return next(error);
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? '파일 크기는 1GB를 초과할 수 없습니다'
    : '사진 또는 영상 파일만 업로드할 수 있습니다';
  return res.status(400).json({ error: message });
});

module.exports = router;
