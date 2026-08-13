const express = require("express");
const fs = require('fs/promises');
const path = require('path');
const pgDb = require('../db');
const { requireAuth } = require('../authToken');
const { mapMediaRowToVideo } = require("../responseMappers");
const { resolveMediaPath } = require('../mediaStorage');
const {
  createMedia,
  deleteMedia,
  deleteMediaByDate,
  getCalendarMedia,
  getMedia,
  getMediaAccess,
  getMediaDateRange,
  listMedia,
  updateMedia,
} = require("../services/mediaService");
const { fetchUserById } = require('../services/userService');
const { notifyNewMedia } = require('../services/pushNotificationService');

const router = express.Router();
const MAX_UPLOAD_FILES = 10;

const sendRouteError = (res, fallbackMessage, error) => {
  if (error.status) {
    return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }

  return res.status(500).json({ error: fallbackMessage });
};

router.post('/checkMediaDuplicates', async (req, res) => {
  try {
    const hashes = [...new Set((Array.isArray(req.body.hashes) ? req.body.hashes : [])
      .map((hash) => String(hash).toLowerCase())
      .filter((hash) => /^[a-f0-9]{64}$/.test(hash)))]
      .slice(0, MAX_UPLOAD_FILES);
    if (!hashes.length) return res.json({ duplicateHashes: [] });
    const result = await pgDb.query(
      'SELECT content_hash FROM media WHERE content_hash = ANY($1::text[])',
      [hashes],
    );
    return res.json({ duplicateHashes: result.rows.map((row) => row.content_hash) });
  } catch (error) {
    console.error('미디어 중복 확인 오류:', error);
    return sendRouteError(res, '중복 파일 확인 실패', error);
  }
});

router.get('/getMediaDateRange', async (req, res) => {
  try {
    const range = await getMediaDateRange();
    return res.json({ minDate: range.min_date, maxDate: range.max_date });
  } catch (error) {
    console.error('미디어 날짜 범위 조회 오류:', error);
    return sendRouteError(res, '미디어 날짜 범위 조회 실패', error);
  }
});

router.get('/getCalendarMedia', async (req, res) => {
  try {
    const viewer = req.query.viewerId ? await fetchUserById(req.query.viewerId) : null;
    if (!viewer) return res.status(401).json({ error: '로그인 정보가 필요합니다' });
    const calendar = await getCalendarMedia({
      viewerId: viewer.id,
      viewerCategory: viewer.category,
      viewerRole: viewer.role,
    });
    return res.json({
      dates: calendar.dates,
      unreadMedia: calendar.unreadMedia.map(mapMediaRowToVideo),
    });
  } catch (error) {
    console.error('캘린더 미디어 조회 오류:', error);
    return sendRouteError(res, '캘린더 미디어 조회 실패', error);
  }
});

router.get("/getVideos", async (req, res) => {
  try {
    const contentType = req.query.contentType || null;
    const search = req.query.search?.trim().replace(/^#/, '') || null;
    const tag = req.query.tag?.trim() || null;
    const uploadedAt = req.query.uploadedAt || null;
    const dateFrom = req.query.dateFrom || null;
    const dateTo = req.query.dateTo || null;
    const source = req.query.source || null;
    const mediaType = req.query.mediaType || null;
    const year = req.query.year ? Number(req.query.year) : null;
    const ids = req.query.ids
      ? [...new Set(String(req.query.ids).split(',').map((id) => id.trim()).filter(Boolean))]
      : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const viewerId = req.query.viewerId || null;
    const viewer = viewerId ? await fetchUserById(viewerId) : null;
    if (!viewer) return res.status(401).json({ error: '로그인 정보가 필요합니다' });
    if (contentType && !["long", "short"].includes(contentType)) {
      return res.status(400).json({ error: "contentType은 long 또는 short여야 합니다" });
    }
    if (uploadedAt && !/^\d{4}-\d{2}-\d{2}$/.test(uploadedAt)) {
      return res.status(400).json({ error: "uploadedAt은 YYYY-MM-DD 형식이어야 합니다" });
    }
    if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      return res.status(400).json({ error: "dateFrom은 YYYY-MM-DD 형식이어야 합니다" });
    }
    if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      return res.status(400).json({ error: "dateTo는 YYYY-MM-DD 형식이어야 합니다" });
    }
    if (dateFrom && dateTo && dateFrom >= dateTo) {
      return res.status(400).json({ error: "dateTo는 dateFrom보다 이후여야 합니다" });
    }
    if (source && !['youtube', 'file'].includes(source)) {
      return res.status(400).json({ error: "source는 youtube 또는 file이어야 합니다" });
    }
    if (mediaType && !['photo', 'video'].includes(mediaType)) {
      return res.status(400).json({ error: "mediaType은 photo 또는 video여야 합니다" });
    }
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
      return res.status(400).json({ error: "year는 1900부터 2100 사이의 정수여야 합니다" });
    }
    if (ids && (ids.length > 200 || ids.some((id) => id.length > 200))) {
      return res.status(400).json({ error: "ids는 최대 200개까지 조회할 수 있습니다" });
    }
    if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      return res.status(400).json({ error: "limit은 1부터 100 사이의 정수여야 합니다" });
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({ error: "offset은 0 이상의 정수여야 합니다" });
    }

    const videos = await listMedia({
      contentType, search, tag, uploadedAt, dateFrom, dateTo, source, mediaType, year, ids,
      viewerCategory: viewer.category,
      viewerRole: viewer.role,
      viewerId: viewer.id,
      limit,
      offset,
    });
    res.json(videos.map(mapMediaRowToVideo));
  } catch (error) {
    console.error("비디오 조회 오류:", error);
    sendRouteError(res, "비디오 조회 실패", error);
  }
});

router.get("/getVideo/:id", async (req, res) => {
  try {
    const access = await getMediaAccess(pgDb, req.params.id, req.query.viewerId);
    if (!access?.can_view) return res.status(403).json({ error: '이 미디어를 볼 권한이 없습니다' });
    const video = await getMedia(req.params.id);
    res.json(mapMediaRowToVideo(video));
  } catch (error) {
    console.error("비디오 조회 오류:", error);
    sendRouteError(res, "비디오 조회 실패", error);
  }
});

router.post("/createVideo", async (req, res) => {
  try {
    const uploader = req.body.uploadedBy ? await fetchUserById(req.body.uploadedBy) : null;
    if (!uploader) return res.status(401).json({ error: '업로드할 로그인 사용자 정보가 필요합니다' });
    const createdVideo = await createMedia(req.body);
    void notifyNewMedia({ media: createdVideo, uploader }).catch((error) => {
      console.error('새 미디어 푸시 알림 오류:', error);
    });
    res.status(201).json(mapMediaRowToVideo(createdVideo));
  } catch (error) {
    console.error("비디오 등록 오류:", error);
    sendRouteError(res, "비디오 등록 실패", error);
  }
});

router.get('/mediaFile/:id', async (req, res) => {
  try {
    const access = await getMediaAccess(pgDb, req.params.id, req.query.viewerId);
    if (!access?.can_view) return res.status(403).json({ error: '이 미디어를 볼 권한이 없습니다' });
    const media = await getMedia(req.params.id);
    if (!media.file_path) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
    const filename = path.basename(media.file_path);
    const absolutePath = resolveMediaPath(media.file_path);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    if (req.query.download === '1') {
      const safeTitle = String(media.title || filename).replace(/[\r\n"\\/]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}`);
    }
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('미디어 파일 조회 오류:', error);
    return sendRouteError(res, '미디어 파일 조회 실패', error);
  }
});

router.get('/mediaThumbnail/:id', async (req, res) => {
  try {
    const access = await getMediaAccess(pgDb, req.params.id, req.query.viewerId);
    if (!access?.can_view) return res.status(403).json({ error: '이 미디어를 볼 권한이 없습니다' });
    const media = await getMedia(req.params.id);
    if (!media.thumbnail_path) return res.status(404).json({ error: '썸네일을 찾을 수 없습니다' });
    const absolutePath = resolveMediaPath(media.thumbnail_path);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('미디어 썸네일 조회 오류:', error);
    return sendRouteError(res, '미디어 썸네일 조회 실패', error);
  }
});

router.put("/updateVideo/:id", async (req, res) => {
  try {
    const access = await getMediaAccess(pgDb, req.params.id, req.body.requesterId);
    if (!access?.can_modify) return res.status(403).json({ error: '미디어 수정 권한이 없습니다' });
    const updatedVideo = await updateMedia(req.params.id, req.body);
    res.json(mapMediaRowToVideo(updatedVideo));
  } catch (error) {
    console.error("비디오 수정 오류:", error);
    sendRouteError(res, "비디오 수정 실패", error);
  }
});

router.delete("/deleteVideo/:id", async (req, res) => {
  try {
    const access = await getMediaAccess(pgDb, req.params.id, req.query.requesterId);
    if (!access?.can_modify) return res.status(403).json({ error: '미디어 삭제 권한이 없습니다' });
    const deleted = await deleteMedia(req.params.id);
    for (const storedPath of [deleted.file_path, deleted.thumbnail_path].filter(Boolean)) {
      await fs.unlink(resolveMediaPath(storedPath)).catch((error) => {
        if (error.code !== 'ENOENT') console.error('미디어 파일 삭제 오류:', error);
      });
    }
    res.json({ message: "비디오가 삭제되었습니다", id: req.params.id });
  } catch (error) {
    console.error("비디오 삭제 오류:", error);
    sendRouteError(res, "비디오 삭제 실패", error);
  }
});

router.delete("/deleteMediaByDate/:date", requireAuth, async (req, res) => {
  try {
    const requester = await fetchUserById(req.auth.userId);
    if (requester?.role !== 'admin') {
      return res.status(403).json({ error: '관리자만 날짜별 미디어를 삭제할 수 있습니다' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) {
      return res.status(400).json({ error: '올바른 날짜가 필요합니다' });
    }
    const deleted = await deleteMediaByDate(req.params.date);
    for (const row of deleted) {
      for (const storedPath of [row.file_path, row.thumbnail_path].filter(Boolean)) {
        await fs.unlink(resolveMediaPath(storedPath)).catch((error) => {
          if (error.code !== 'ENOENT') console.error('미디어 파일 삭제 오류:', error);
        });
      }
    }
    return res.json({
      message: `${deleted.length}개의 미디어가 삭제되었습니다`,
      count: deleted.length,
      ids: deleted.map((row) => row.id),
    });
  } catch (error) {
    console.error("날짜별 미디어 삭제 오류:", error);
    return sendRouteError(res, "날짜별 미디어 삭제 실패", error);
  }
});

module.exports = router;
