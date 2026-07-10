const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { randomUUID } = require("crypto");
const bcrypt = require("bcryptjs");
const cors = require("cors")({ origin: true });
const pgDb = require("./db");
const { mapMediaRowToVideo, mapUserRowToUser } = require("./responseMappers");

admin.initializeApp();
const db = admin.firestore();

const MEDIA_WITH_TAGS_SELECT = `
  SELECT
    m.*,
    COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
  FROM media m
  LEFT JOIN media_tags mt ON mt.media_id = m.id
  LEFT JOIN tags t ON t.id = mt.tag_id
`;

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
};

const toContentType = (type) => {
  if (type === "shorts") {
    return "shorts";
  }

  return "long";
};

const fetchMediaById = async (client, id) => {
  const result = await client.query(`
    ${MEDIA_WITH_TAGS_SELECT}
    WHERE m.id = $1
    GROUP BY m.id
  `, [id]);

  return result.rows[0] || null;
};

const replaceMediaTags = async (client, mediaId, tags) => {
  const normalizedTags = normalizeTags(tags);

  await client.query("DELETE FROM media_tags WHERE media_id = $1", [mediaId]);

  for (const tag of normalizedTags) {
    const tagResult = await client.query(`
      INSERT INTO tags (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [tag]);

    await client.query(`
      INSERT INTO media_tags (media_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT (media_id, tag_id) DO NOTHING
    `, [mediaId, tagResult.rows[0].id]);
  }
};

const USER_WITH_RELATIONS_SELECT = `
  SELECT
    u.*,
    COALESCE(array_agg(DISTINCT ulm.media_id) FILTER (WHERE ulm.media_id IS NOT NULL), '{}') AS liked_videos,
    COALESCE(array_agg(DISTINCT uwm.media_id) FILTER (WHERE uwm.media_id IS NOT NULL), '{}') AS watched_videos
  FROM users u
  LEFT JOIN user_liked_media ulm ON ulm.user_id = u.id
  LEFT JOIN user_watched_media uwm ON uwm.user_id = u.id
`;

const fetchUserById = async (id) => {
  const result = await pgDb.query(`
    ${USER_WITH_RELATIONS_SELECT}
    WHERE u.id = $1
    GROUP BY u.id
  `, [id]);

  return result.rows[0] || null;
};

const fetchUserByLoginId = async (userId) => {
  const result = await pgDb.query(`
    ${USER_WITH_RELATIONS_SELECT}
    WHERE u.user_id = $1
    GROUP BY u.id
  `, [userId]);

  return result.rows[0] || null;
};

// 유효한 호칭 목록
const VALID_TITLES = [
  "아빠", "엄마", "수호",
  "친할아버지", "친할머니", "외할아버지", "외할머니",
  "고모", "고모부", "이모", "이모부", "외삼촌", "기타"
];

// 유효한 카테고리 목록
const VALID_CATEGORIES = ["dad", "mom", "etc"];

// 관리자/부관리자 호칭
const ADMIN_TITLES = ["아빠", "엄마"];
const SUB_ADMIN_TITLES = ["수호"];

setGlobalOptions({ maxInstances: 10, region: "asia-northeast3" });

// 헬스 체크
exports.health = onRequest((req, res) => {
  cors(req, res, () => {
    res.json({ status: "ok", message: "Hotube API 서버 실행 중" });
  });
});

// 모든 비디오 조회
exports.getVideos = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const result = await pgDb.query(`
        ${MEDIA_WITH_TAGS_SELECT}
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `);
      const videos = result.rows.map(mapMediaRowToVideo);
      res.json(videos);
    } catch (error) {
      console.error("비디오 조회 오류:", error);
      res.status(500).json({ error: "비디오 조회 실패" });
    }
  });
});

// 단일 비디오 조회
exports.getVideo = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const id = req.path.split("/").pop();
      if (!id) {
        return res.status(400).json({ error: "비디오 id가 필요합니다" });
      }

      const result = await pgDb.query(`
        ${MEDIA_WITH_TAGS_SELECT}
        WHERE m.id = $1
        GROUP BY m.id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
      }

      res.json(mapMediaRowToVideo(result.rows[0]));
    } catch (error) {
      console.error("비디오 조회 오류:", error);
      res.status(500).json({ error: "비디오 조회 실패" });
    }
  });
});

// 비디오 등록
exports.createVideo = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let client;

    try {
      const {
        videoId,
        title,
        description,
        youtubeUrl,
        thumbnailUrl,
        type,
        year,
        tags,
        uploadedAt,
        durationSeconds,
        viewCount,
        likeCount,
        channelTitle,
      } = req.body;

      const id = videoId;

      if (!id || !title || !youtubeUrl || !thumbnailUrl) {
        return res.status(400).json({ error: "필수 영상 정보가 누락되었습니다" });
      }

      client = await pgDb.getClient();
      await client.query("BEGIN");

      const existing = await client.query("SELECT id FROM media WHERE id = $1", [id]);
      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "이미 등록된 영상입니다" });
      }

      const now = new Date().toISOString();
      await client.query(`
        INSERT INTO media (
          id,
          title,
          description,
          content_type,
          media_type,
          youtube_url,
          file_path,
          thumbnail_url,
          thumbnail_path,
          year,
          uploaded_at,
          duration_seconds,
          view_count,
          like_count,
          channel_title,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, 'youtube', $5, NULL, $6, NULL,
          $7, $8, $9, $10, $11, $12, $13, $14
        )
      `, [
        id,
        title,
        description || "",
        toContentType(type),
        youtubeUrl,
        thumbnailUrl,
        year || null,
        uploadedAt || null,
        durationSeconds || null,
        viewCount || 0,
        likeCount || 0,
        channelTitle || null,
        now,
        now,
      ]);

      await replaceMediaTags(client, id, tags);

      const createdVideo = await fetchMediaById(client, id);
      await client.query("COMMIT");

      res.status(201).json(mapMediaRowToVideo(createdVideo));
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }
      console.error("비디오 등록 오류:", error);
      res.status(500).json({ error: "비디오 등록 실패" });
    } finally {
      if (client) {
        client.release();
      }
    }
  });
});

// 비디오 수정
exports.updateVideo = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let client;

    try {
      const id = req.path.split("/").pop();
      const {
        title,
        description,
        youtubeUrl,
        thumbnailUrl,
        type,
        year,
        tags,
        uploadedAt,
        durationSeconds,
        viewCount,
        likeCount,
        channelTitle,
      } = req.body;

      if (!id) {
        return res.status(400).json({ error: "비디오 id가 필요합니다" });
      }

      client = await pgDb.getClient();
      await client.query("BEGIN");

      const existing = await client.query("SELECT id FROM media WHERE id = $1 FOR UPDATE", [id]);
      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
      }

      await client.query(`
        UPDATE media
        SET
          title = COALESCE($2, title),
          description = COALESCE($3, description),
          content_type = COALESCE($4, content_type),
          youtube_url = COALESCE($5, youtube_url),
          thumbnail_url = COALESCE($6, thumbnail_url),
          year = COALESCE($7, year),
          uploaded_at = COALESCE($8, uploaded_at),
          duration_seconds = COALESCE($9, duration_seconds),
          view_count = COALESCE($10, view_count),
          like_count = COALESCE($11, like_count),
          channel_title = COALESCE($12, channel_title),
          updated_at = $13
        WHERE id = $1
      `, [
        id,
        title ?? null,
        description ?? null,
        type ? toContentType(type) : null,
        youtubeUrl ?? null,
        thumbnailUrl ?? null,
        year ?? null,
        uploadedAt ?? null,
        durationSeconds ?? null,
        viewCount ?? null,
        likeCount ?? null,
        channelTitle ?? null,
        new Date().toISOString(),
      ]);

      if (Array.isArray(tags)) {
        await replaceMediaTags(client, id, tags);
      }

      const updatedVideo = await fetchMediaById(client, id);
      await client.query("COMMIT");

      res.json(mapMediaRowToVideo(updatedVideo));
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }
      console.error("비디오 수정 오류:", error);
      res.status(500).json({ error: "비디오 수정 실패" });
    } finally {
      if (client) {
        client.release();
      }
    }
  });
});

// 비디오 삭제
exports.deleteVideo = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let client;

    try {
      const id = req.path.split("/").pop();

      if (!id) {
        return res.status(400).json({ error: "비디오 id가 필요합니다" });
      }

      client = await pgDb.getClient();
      await client.query("BEGIN");

      const deleted = await client.query("DELETE FROM media WHERE id = $1 RETURNING id", [id]);
      if (deleted.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
      }

      await client.query("COMMIT");

      res.json({ message: "비디오가 삭제되었습니다", id });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }
      console.error("비디오 삭제 오류:", error);
      res.status(500).json({ error: "비디오 삭제 실패" });
    } finally {
      if (client) {
        client.release();
      }
    }
  });
});

// ==================== 사용자 인증 API ====================

// 회원가입
exports.registerUser = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { userId, name, title, category, password } = req.body;

      // 유효성 검사
      if (!userId || !name || !title || !category || !password) {
        return res.status(400).json({ error: "모든 필드를 입력해주세요" });
      }

      // 아이디 형식 검사 (영문, 숫자, 3-20자)
      if (!/^[a-zA-Z0-9]{3,20}$/.test(userId)) {
        return res.status(400).json({ error: "아이디는 영문, 숫자 3-20자로 입력해주세요" });
      }

      if (!VALID_TITLES.includes(title)) {
        return res.status(400).json({ error: "유효하지 않은 호칭입니다" });
      }

      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "유효하지 않은 카테고리입니다" });
      }

      // 비밀번호 검증: 5자 이상, 특수문자 1개 포함
      const passwordRegex = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{5,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: "비밀번호는 5자 이상, 특수문자를 1개 이상 포함해야 합니다" });
      }

      const existingUser = await pgDb.query(
        "SELECT id FROM users WHERE user_id = $1",
        [userId],
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: "이미 사용중인 아이디입니다" });
      }

      // 역할 결정: 아빠/엄마 = admin, 수호 = sub-admin, 나머지 = user
      let role = "user";
      if (ADMIN_TITLES.includes(title)) {
        role = "admin";
      } else if (SUB_ADMIN_TITLES.includes(title)) {
        role = "sub-admin";
      }

      // 비밀번호 해시
      const hashedPassword = await bcrypt.hash(password, 10);

      const id = randomUUID();
      const now = new Date().toISOString();
      await pgDb.query(`
        INSERT INTO users (id, user_id, name, title, category, role, password, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [id, userId, name, title, category, role, hashedPassword, now]);

      const createdUser = await fetchUserById(id);
      res.status(201).json(mapUserRowToUser(createdUser));
    } catch (error) {
      console.error("회원가입 오류:", error);
      res.status(500).json({ error: "회원가입 실패" });
    }
  });
});

// 로그인
exports.loginUser = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { userId, password } = req.body;

      if (!userId || !password) {
        return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요" });
      }

      const userData = await fetchUserByLoginId(userId);

      if (!userData) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 일치하지 않습니다" });
      }

      // 비밀번호 검증
      const isValidPassword = await bcrypt.compare(password, userData.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 일치하지 않습니다" });
      }

      res.json(mapUserRowToUser(userData));
    } catch (error) {
      console.error("로그인 오류:", error);
      res.status(500).json({ error: "로그인 실패" });
    }
  });
});

// 사용자 정보 조회
exports.getUser = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const id = req.path.split("/").pop();
      const userData = await fetchUserById(id);

      if (!userData) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      res.json(mapUserRowToUser(userData));
    } catch (error) {
      console.error("사용자 조회 오류:", error);
      res.status(500).json({ error: "사용자 조회 실패" });
    }
  });
});

// 사용자 정보 수정
exports.updateUser = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const id = req.path.split("/").pop();
      const { name, title, category } = req.body;

      // 유효성 검사
      if (!name || !title || !category) {
        return res.status(400).json({ error: "이름, 호칭, 카테고리를 입력해주세요" });
      }

      if (!VALID_TITLES.includes(title)) {
        return res.status(400).json({ error: "유효하지 않은 호칭입니다" });
      }

      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "유효하지 않은 카테고리입니다" });
      }

      const existingUser = await pgDb.query("SELECT id FROM users WHERE id = $1", [id]);
      if (existingUser.rows.length === 0) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      await pgDb.query(`
        UPDATE users
        SET name = $2, title = $3, category = $4
        WHERE id = $1
      `, [id, name, title, category]);

      const updatedUser = await fetchUserById(id);
      res.json(mapUserRowToUser(updatedUser));
    } catch (error) {
      console.error("사용자 정보 수정 오류:", error);
      res.status(500).json({ error: "사용자 정보 수정 실패" });
    }
  });
});

// 비밀번호 변경
exports.changePassword = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const id = req.path.split("/").pop();
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "현재 비밀번호와 새 비밀번호를 입력해주세요" });
      }

      // 비밀번호 검증: 5자 이상, 특수문자 1개 포함
      const passwordRegex = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{5,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ error: "비밀번호는 5자 이상, 특수문자를 1개 이상 포함해야 합니다" });
      }

      const userData = await fetchUserById(id);

      if (!userData) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      // 현재 비밀번호 확인
      const isValidPassword = await bcrypt.compare(currentPassword, userData.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "현재 비밀번호가 일치하지 않습니다" });
      }

      // 새 비밀번호 해시
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await pgDb.query(
        "UPDATE users SET password = $2 WHERE id = $1",
        [id, hashedPassword],
      );

      res.json({ message: "비밀번호가 변경되었습니다" });
    } catch (error) {
      console.error("비밀번호 변경 오류:", error);
      res.status(500).json({ error: "비밀번호 변경 실패" });
    }
  });
});

// 좋아요 토글
exports.toggleLike = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let client;

    try {
      const { userId, videoId } = req.body;

      if (!userId || !videoId) {
        return res.status(400).json({ error: "userId와 videoId가 필요합니다" });
      }

      client = await pgDb.getClient();
      await client.query("BEGIN");

      const userResult = await client.query("SELECT id FROM users WHERE id = $1", [userId]);
      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      const mediaResult = await client.query("SELECT id FROM media WHERE id = $1", [videoId]);
      if (mediaResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
      }

      const existingLike = await client.query(`
        SELECT 1
        FROM user_liked_media
        WHERE user_id = $1 AND media_id = $2
      `, [userId, videoId]);

      const isLiked = existingLike.rows.length > 0;

      if (isLiked) {
        await client.query(`
          DELETE FROM user_liked_media
          WHERE user_id = $1 AND media_id = $2
        `, [userId, videoId]);

        await client.query(`
          UPDATE media
          SET like_count = GREATEST(like_count - 1, 0)
          WHERE id = $1
        `, [videoId]);
      } else {
        await client.query(`
          INSERT INTO user_liked_media (user_id, media_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [userId, videoId]);

        await client.query(`
          UPDATE media
          SET like_count = like_count + 1
          WHERE id = $1
        `, [videoId]);
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
});

// 시청 기록 추가
exports.markVideoWatched = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { userId, videoId } = req.body;

      if (!userId || !videoId) {
        return res.status(400).json({ error: "userId와 videoId가 필요합니다" });
      }

      const userResult = await pgDb.query("SELECT id FROM users WHERE id = $1", [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      const mediaResult = await pgDb.query("SELECT id FROM media WHERE id = $1", [videoId]);
      if (mediaResult.rows.length === 0) {
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
});

// ==================== 댓글 API ====================

// 댓글 작성
exports.createComment = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { videoId, userId, content } = req.body;

      if (!videoId || !userId || !content) {
        return res.status(400).json({ error: "모든 필드를 입력해주세요" });
      }

      // 사용자 정보 가져오기
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      const userData = userDoc.data();
      const now = new Date().toISOString();

      const commentData = {
        videoId,
        userId,
        userName: userData.name,
        userTitle: userData.title,
        userCategory: userData.category,
        content,
        createdAt: now,
      };

      const docRef = await db.collection("comments").add(commentData);
      res.status(201).json({ id: docRef.id, ...commentData });
    } catch (error) {
      console.error("댓글 작성 오류:", error);
      res.status(500).json({ error: "댓글 작성 실패" });
    }
  });
});

// 댓글 조회 (같은 카테고리만, 관리자/부관리자는 모든 댓글 조회 가능)
exports.getComments = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const videoId = req.query.videoId;
      const userCategory = req.query.category;
      const userRole = req.query.role;

      if (!videoId) {
        return res.status(400).json({ error: "videoId가 필요합니다" });
      }

      let snapshot;

      // 관리자/부관리자는 모든 댓글 조회 가능
      if (userRole === "admin" || userRole === "sub-admin") {
        snapshot = await db.collection("comments")
          .where("videoId", "==", videoId)
          .orderBy("createdAt", "desc")
          .get();
      } else {
        // 일반 사용자는 같은 카테고리 댓글만 조회
        if (!userCategory) {
          return res.status(400).json({ error: "category가 필요합니다" });
        }
        snapshot = await db.collection("comments")
          .where("videoId", "==", videoId)
          .where("userCategory", "==", userCategory)
          .orderBy("createdAt", "desc")
          .get();
      }

      const comments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json(comments);
    } catch (error) {
      console.error("댓글 조회 오류:", error);
      res.status(500).json({ error: "댓글 조회 실패" });
    }
  });
});

// 댓글 수정
exports.updateComment = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const id = req.path.split("/").pop();
      const { userId, content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "댓글 내용을 입력해주세요" });
      }

      const doc = await db.collection("comments").doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });
      }

      const commentData = doc.data();

      // 본인 댓글인지 확인
      if (commentData.userId !== userId) {
        return res.status(403).json({ error: "수정 권한이 없습니다" });
      }

      const now = new Date().toISOString();
      await db.collection("comments").doc(id).update({
        content: content.trim(),
        updatedAt: now,
      });

      res.json({
        id,
        ...commentData,
        content: content.trim(),
        updatedAt: now,
      });
    } catch (error) {
      console.error("댓글 수정 오류:", error);
      res.status(500).json({ error: "댓글 수정 실패" });
    }
  });
});

// 댓글 삭제
exports.deleteComment = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const id = req.path.split("/").pop();
      const userId = req.query.userId;

      const doc = await db.collection("comments").doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });
      }

      const commentData = doc.data();

      // 본인 댓글인지 확인
      if (commentData.userId !== userId) {
        // 관리자인지 확인
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists || userDoc.data().role !== "admin") {
          return res.status(403).json({ error: "삭제 권한이 없습니다" });
        }
      }

      await db.collection("comments").doc(id).delete();
      res.json({ message: "댓글이 삭제되었습니다", id });
    } catch (error) {
      console.error("댓글 삭제 오류:", error);
      res.status(500).json({ error: "댓글 삭제 실패" });
    }
  });
});
