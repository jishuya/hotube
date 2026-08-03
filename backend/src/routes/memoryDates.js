const express = require('express');
const { addTagsToDateMedia, deleteMemoryDateNote, listMemoryDateNotes, saveMemoryDateNote } = require('../services/memoryDateService');

const router = express.Router();
const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const sendError = (res, fallback, error) => res.status(error.status || 500).json({ error: error.status ? error.message : fallback });

router.get('/memoryDateNotes', async (req, res) => {
  const { dateFrom, dateTo, userId } = req.query;
  if (!isDateKey(dateFrom) || !isDateKey(dateTo) || dateFrom >= dateTo) return res.status(400).json({ error: '올바른 날짜 범위가 필요합니다' });
  try {
    return res.json(await listMemoryDateNotes(dateFrom, dateTo, userId));
  } catch (error) {
    return sendError(res, '날짜 메모 조회 실패', error);
  }
});

router.put('/memoryDateNotes/:date', async (req, res) => {
  if (!isDateKey(req.params.date)) return res.status(400).json({ error: '올바른 날짜가 필요합니다' });
  try {
    return res.json(await saveMemoryDateNote(req.params.date, req.body.content, req.body.userId));
  } catch (error) {
    return sendError(res, '날짜 메모 저장 실패', error);
  }
});

router.delete('/memoryDateNotes/:date', async (req, res) => {
  if (!isDateKey(req.params.date)) return res.status(400).json({ error: '올바른 날짜가 필요합니다' });
  try {
    return res.json(await deleteMemoryDateNote(req.params.date, req.query.userId));
  } catch (error) {
    return sendError(res, '날짜 메모 삭제 실패', error);
  }
});

router.post('/memoryDates/:date/tags', async (req, res) => {
  if (!isDateKey(req.params.date)) return res.status(400).json({ error: '올바른 날짜가 필요합니다' });
  try {
    return res.json(await addTagsToDateMedia(req.params.date, req.body.tags, req.body.userId));
  } catch (error) {
    return sendError(res, '태그 일괄 추가 실패', error);
  }
});

module.exports = router;
