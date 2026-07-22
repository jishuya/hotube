const express = require('express');
const { addDateAlbumTag, deleteDateAlbumTag, listDateAlbumTags } = require('../services/dateAlbumTagService');

const router = express.Router();
const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const sendError = (res, fallback, error) => res.status(error.status || 500).json({ error: error.status ? error.message : fallback });

router.get('/getDateAlbumTags', async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  if (!isDateKey(dateFrom) || !isDateKey(dateTo) || dateFrom >= dateTo) return res.status(400).json({ error: '올바른 날짜 범위가 필요합니다' });
  try {
    return res.json(await listDateAlbumTags(dateFrom, dateTo));
  } catch (error) {
    console.error('날짜 태그 조회 오류:', error);
    return sendError(res, '날짜 태그 조회 실패', error);
  }
});

router.post('/addDateAlbumTag', async (req, res) => {
  if (!isDateKey(req.body.date)) return res.status(400).json({ error: '올바른 날짜가 필요합니다' });
  try {
    return res.status(201).json(await addDateAlbumTag(req.body.date, req.body.tag));
  } catch (error) {
    console.error('날짜 태그 추가 오류:', error);
    return sendError(res, '날짜 태그 추가 실패', error);
  }
});

router.delete('/deleteDateAlbumTag', async (req, res) => {
  if (!isDateKey(req.query.date) || !req.query.tag) return res.status(400).json({ error: '날짜와 태그가 필요합니다' });
  try {
    await deleteDateAlbumTag(req.query.date, req.query.tag);
    return res.json({ date: req.query.date, tag: req.query.tag });
  } catch (error) {
    console.error('날짜 태그 삭제 오류:', error);
    return sendError(res, '날짜 태그 삭제 실패', error);
  }
});

module.exports = router;
