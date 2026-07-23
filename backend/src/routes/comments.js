const express = require("express");
const { randomUUID } = require("crypto");
const pgDb = require("../db");
const { mapCommentRowToComment } = require("../responseMappers");
const { fetchCommentById } = require("../services/commentService");
const { getMediaAccess, mediaExists } = require("../services/mediaService");
const { fetchCommentAuthorById } = require("../services/userService");

const router = express.Router();

router.post("/createComment", async (req, res) => {
  try {
    const { videoId, userId, content } = req.body;

    const normalizedContent = typeof content === "string" ? content.trim() : "";

    if (!videoId || !userId || !normalizedContent) {
      return res.status(400).json({ error: "모든 필드를 입력해주세요" });
    }

    const userData = await fetchCommentAuthorById(userId);
    if (!userData) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }

    if (!(await mediaExists(pgDb, videoId))) {
      return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
    }
    const access = await getMediaAccess(pgDb, videoId, userId);
    if (!access?.can_view) return res.status(403).json({ error: '이 미디어에 댓글을 작성할 권한이 없습니다' });

    const created = await pgDb.query(`
      INSERT INTO comments (id, media_id, user_id, user_name, user_title, user_category, content, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
      RETURNING *
    `, [
      randomUUID(),
      videoId,
      userId,
      userData.name,
      userData.title,
      userData.category,
      normalizedContent,
      new Date().toISOString(),
    ]);

    res.status(201).json(mapCommentRowToComment(created.rows[0]));
  } catch (error) {
    console.error("댓글 작성 오류:", error);
    res.status(500).json({ error: "댓글 작성 실패" });
  }
});

router.get("/getComments", async (req, res) => {
  try {
    const videoId = req.query.videoId;
    const userId = req.query.userId;

    if (!videoId) {
      return res.status(400).json({ error: "videoId가 필요합니다" });
    }

    const access = await getMediaAccess(pgDb, videoId, userId);
    if (!access?.can_view) return res.status(403).json({ error: '이 미디어의 댓글을 볼 권한이 없습니다' });
    let result;
    if (access.role === "admin" || access.role === "sub-admin") {
      result = await pgDb.query(
        "SELECT * FROM comments WHERE media_id = $1 ORDER BY created_at DESC",
        [videoId],
      );
    } else {
      result = await pgDb.query(
        "SELECT * FROM comments WHERE media_id = $1 AND user_category = $2 ORDER BY created_at DESC",
        [videoId, access.category],
      );
    }

    res.json(result.rows.map(mapCommentRowToComment));
  } catch (error) {
    console.error("댓글 조회 오류:", error);
    res.status(500).json({ error: "댓글 조회 실패" });
  }
});

router.put("/updateComment/:id", async (req, res) => {
  try {
    const { userId, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "댓글 내용을 입력해주세요" });
    }

    const commentData = await fetchCommentById(req.params.id);
    if (!commentData) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });
    }

    if (commentData.user_id !== userId) {
      return res.status(403).json({ error: "수정 권한이 없습니다" });
    }

    const updated = await pgDb.query(`
      UPDATE comments
      SET content = $2, updated_at = $3
      WHERE id = $1
      RETURNING *
    `, [req.params.id, content.trim(), new Date().toISOString()]);

    res.json(mapCommentRowToComment(updated.rows[0]));
  } catch (error) {
    console.error("댓글 수정 오류:", error);
    res.status(500).json({ error: "댓글 수정 실패" });
  }
});

router.delete("/deleteComment/:id", async (req, res) => {
  try {
    const userId = req.query.userId;
    const commentData = await fetchCommentById(req.params.id);
    if (!commentData) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });
    }

    if (commentData.user_id !== userId) {
      const userResult = await pgDb.query("SELECT role FROM users WHERE id = $1", [userId]);
      if (userResult.rows.length === 0 || userResult.rows[0].role !== "admin") {
        return res.status(403).json({ error: "삭제 권한이 없습니다" });
      }
    }

    await pgDb.query("DELETE FROM comments WHERE id = $1", [req.params.id]);
    res.json({ message: "댓글이 삭제되었습니다", id: req.params.id });
  } catch (error) {
    console.error("댓글 삭제 오류:", error);
    res.status(500).json({ error: "댓글 삭제 실패" });
  }
});

module.exports = router;
