const express = require("express");
const pgDb = require("../db");
const { mediaExists } = require("../services/mediaService");
const { userExists } = require("../services/userService");

const router = express.Router();

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

module.exports = router;
