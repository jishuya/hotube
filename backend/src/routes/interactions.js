const express = require("express");
const pgDb = require("../db");
const { mapMediaRowToVideo } = require('../responseMappers');
const { getMediaAccess, listFavoriteMedia, mediaExists } = require("../services/mediaService");
const { userExists } = require("../services/userService");

const router = express.Router();

router.get('/getFavoriteMedia', async (req, res) => {
  try {
    const media = await listFavoriteMedia(req.query.userId);
    return res.json(media.map(mapMediaRowToVideo));
  } catch (error) {
    console.error('즐겨찾기 목록 조회 오류:', error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : '즐겨찾기 목록 조회 실패',
    });
  }
});

router.post("/toggleLike", async (req, res) => {
  let client;

  try {
    const { userId, videoId } = req.body;

    if (!userId || !videoId) {
      return res.status(400).json({ error: "userId와 videoId가 필요합니다" });
    }

    client = await pgDb.getClient();
    await client.query("BEGIN");

    if (!(await userExists(client, userId))) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }

    if (!(await mediaExists(client, videoId))) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
    }
    const access = await getMediaAccess(client, videoId, userId);
    if (!access?.can_view) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: '이 미디어를 볼 권한이 없습니다' });
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [userId, videoId]);

    const existingLike = await client.query(
      "SELECT 1 FROM user_liked_media WHERE user_id = $1 AND media_id = $2",
      [userId, videoId],
    );
    const isLiked = existingLike.rows.length > 0;

    if (isLiked) {
      await client.query("DELETE FROM user_liked_media WHERE user_id = $1 AND media_id = $2", [userId, videoId]);
      await client.query("UPDATE media SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1", [videoId]);
    } else {
      await client.query(
        "INSERT INTO user_liked_media (user_id, media_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, videoId],
      );
      await client.query("UPDATE media SET like_count = like_count + 1 WHERE id = $1", [videoId]);
    }

    await client.query("COMMIT");
    res.json({ liked: !isLiked, videoId });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("좋아요 토글 오류:", error);
    res.status(500).json({ error: "좋아요 처리 실패" });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.post("/markVideoWatched", async (req, res) => {
  try {
    const { userId, videoId } = req.body;

    if (!userId || !videoId) {
      return res.status(400).json({ error: "userId와 videoId가 필요합니다" });
    }

    if (!(await userExists(pgDb, userId))) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }

    if (!(await mediaExists(pgDb, videoId))) {
      return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
    }
    const access = await getMediaAccess(pgDb, videoId, userId);
    if (!access?.can_view) return res.status(403).json({ error: '이 미디어를 볼 권한이 없습니다' });

    await pgDb.query(`
      INSERT INTO user_watched_media (user_id, media_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [userId, videoId]);

    res.json({ success: true, videoId });
  } catch (error) {
    console.error("시청 기록 추가 오류:", error);
    res.status(500).json({ error: "시청 기록 추가 실패" });
  }
});

router.get('/getMediaDetails/:id', async (req, res) => {
  try {
    const mediaId = req.params.id;
    const userId = req.query.userId || null;
    const access = await getMediaAccess(pgDb, mediaId, userId);
    if (!access?.can_view) return res.status(403).json({ error: '이 미디어를 볼 권한이 없습니다' });
    const [mediaResult, viewersResult, countsResult, favoriteResult] = await Promise.all([
      pgDb.query(`
        SELECT m.uploaded_by, m.shared_with, u.name AS uploader_name,
          u.title AS uploader_title, u.avatar AS uploader_avatar
        FROM media m LEFT JOIN users u ON u.id = m.uploaded_by WHERE m.id = $1
      `, [mediaId]),
      pgDb.query(`
        SELECT u.id, u.name, u.title, u.category, u.avatar
        FROM user_watched_media uwm JOIN users u ON u.id = uwm.user_id
        WHERE uwm.media_id = $1 ORDER BY u.name
      `, [mediaId]),
      pgDb.query(`SELECT
        (SELECT COUNT(*)::int FROM comments WHERE media_id = $1) AS comment_count,
        (SELECT COUNT(*)::int FROM user_liked_media WHERE media_id = $1) AS like_count
      `, [mediaId]),
      userId
        ? pgDb.query('SELECT 1 FROM user_favorite_media WHERE user_id = $1 AND media_id = $2', [userId, mediaId])
        : Promise.resolve({ rows: [] }),
    ]);
    if (!mediaResult.rows.length) return res.status(404).json({ error: '미디어를 찾을 수 없습니다' });
    const media = mediaResult.rows[0];
    return res.json({
      uploader: media.uploaded_by ? {
        id: media.uploaded_by,
        name: media.uploader_name,
        title: media.uploader_title,
        avatar: media.uploader_avatar,
      } : null,
      sharedWith: media.shared_with || ['dad', 'mom'],
      viewers: viewersResult.rows,
      commentCount: countsResult.rows[0].comment_count,
      likeCount: countsResult.rows[0].like_count,
      favorited: favoriteResult.rows.length > 0,
      canModify: access.can_modify,
    });
  } catch (error) {
    console.error('미디어 상세 정보 조회 오류:', error);
    return res.status(500).json({ error: '미디어 상세 정보 조회 실패' });
  }
});

router.post('/toggleFavorite', async (req, res) => {
  let client;
  try {
    const { userId, videoId } = req.body;
    if (!userId || !videoId) return res.status(400).json({ error: 'userId와 videoId가 필요합니다' });
    client = await pgDb.getClient();
    await client.query('BEGIN');
    const access = await getMediaAccess(client, videoId, userId);
    if (!access?.can_view) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: '이 미디어를 볼 권한이 없습니다' });
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [userId, videoId]);
    const existing = await client.query(
      'SELECT 1 FROM user_favorite_media WHERE user_id = $1 AND media_id = $2',
      [userId, videoId],
    );
    if (existing.rows.length) {
      await client.query('DELETE FROM user_favorite_media WHERE user_id = $1 AND media_id = $2', [userId, videoId]);
      await client.query('COMMIT');
      return res.json({ favorited: false, videoId });
    }
    await client.query('INSERT INTO user_favorite_media (user_id, media_id) VALUES ($1, $2)', [userId, videoId]);
    await client.query('COMMIT');
    return res.json({ favorited: true, videoId });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('즐겨찾기 토글 오류:', error);
    return res.status(500).json({ error: '즐겨찾기 처리 실패' });
  } finally {
    client?.release();
  }
});

module.exports = router;
