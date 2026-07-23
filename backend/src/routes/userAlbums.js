const express = require('express');
const {
  addMediaToUserAlbum,
  createUserAlbum,
  deleteUserAlbum,
  getUserAlbum,
  listUserAlbumMedia,
  listUserAlbums,
  removeMediaFromUserAlbum,
  updateUserAlbum,
} = require('../services/userAlbumService');
const { mapMediaRowToVideo } = require('../responseMappers');

const router = express.Router();

const sendError = (res, fallback, error) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  return res.status(500).json({ error: fallback });
};

router.get('/getMyAlbums', async (req, res) => {
  try {
    return res.json(await listUserAlbums(req.query.userId));
  } catch (error) {
    console.error('개인 앨범 목록 조회 오류:', error);
    return sendError(res, '개인 앨범 목록 조회 실패', error);
  }
});

router.get('/getMyAlbum/:id', async (req, res) => {
  try {
    return res.json(await getUserAlbum(req.params.id, req.query.userId));
  } catch (error) {
    console.error('개인 앨범 조회 오류:', error);
    return sendError(res, '개인 앨범 조회 실패', error);
  }
});

router.get('/getMyAlbumMedia/:id', async (req, res) => {
  try {
    const media = await listUserAlbumMedia(req.params.id, req.query.userId);
    return res.json(media.map(mapMediaRowToVideo));
  } catch (error) {
    console.error('개인 앨범 미디어 조회 오류:', error);
    return sendError(res, '개인 앨범 미디어 조회 실패', error);
  }
});

router.post('/createMyAlbum', async (req, res) => {
  try {
    return res.status(201).json(await createUserAlbum(req.body));
  } catch (error) {
    console.error('개인 앨범 생성 오류:', error);
    return sendError(res, '개인 앨범 생성 실패', error);
  }
});

router.put('/updateMyAlbum/:id', async (req, res) => {
  try {
    return res.json(await updateUserAlbum(req.params.id, req.body));
  } catch (error) {
    console.error('개인 앨범 수정 오류:', error);
    return sendError(res, '개인 앨범 수정 실패', error);
  }
});

router.post('/addMediaToMyAlbum/:id', async (req, res) => {
  try {
    return res.json(await addMediaToUserAlbum(
      req.params.id,
      req.body.userId,
      req.body.mediaIds,
    ));
  } catch (error) {
    console.error('개인 앨범 미디어 추가 오류:', error);
    return sendError(res, '개인 앨범에 미디어 추가 실패', error);
  }
});

router.delete('/removeMediaFromMyAlbum/:id', async (req, res) => {
  try {
    return res.json(await removeMediaFromUserAlbum(
      req.params.id,
      req.body.userId,
      req.body.mediaIds,
    ));
  } catch (error) {
    console.error('개인 앨범 미디어 삭제 오류:', error);
    return sendError(res, '개인 앨범에서 미디어 삭제 실패', error);
  }
});

router.delete('/deleteMyAlbum/:id', async (req, res) => {
  try {
    return res.json(await deleteUserAlbum(req.params.id, req.query.userId));
  } catch (error) {
    console.error('개인 앨범 삭제 오류:', error);
    return sendError(res, '개인 앨범 삭제 실패', error);
  }
});

module.exports = router;
