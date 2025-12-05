const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

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
      const snapshot = await db.collection("videos").orderBy("createdAt", "desc").get();
      const videos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
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
      const doc = await db.collection("videos").doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
      }

      res.json({ id: doc.id, ...doc.data() });
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

      // 중복 체크
      const existing = await db.collection("videos").doc(id).get();
      if (existing.exists) {
        return res.status(400).json({ error: "이미 등록된 영상입니다" });
      }

      const now = new Date().toISOString();
      const videoData = {
        title,
        description,
        youtubeUrl,
        thumbnailUrl,
        type: type || "video",
        year,
        tags: tags || [],
        uploadedAt,
        durationSeconds,
        viewCount: viewCount || 0,
        likeCount: likeCount || 0,
        channelTitle,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection("videos").doc(id).set(videoData);

      res.status(201).json({ id, ...videoData });
    } catch (error) {
      console.error("비디오 등록 오류:", error);
      res.status(500).json({ error: "비디오 등록 실패" });
    }
  });
});

// 비디오 수정
exports.updateVideo = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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
      } = req.body;

      const doc = await db.collection("videos").doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
      }

      const updateData = {
        title,
        description,
        youtubeUrl,
        thumbnailUrl,
        type,
        year,
        tags: tags || [],
        uploadedAt,
        updatedAt: new Date().toISOString(),
      };

      await db.collection("videos").doc(id).update(updateData);

      res.json({ id, ...updateData });
    } catch (error) {
      console.error("비디오 수정 오류:", error);
      res.status(500).json({ error: "비디오 수정 실패" });
    }
  });
});

// 비디오 삭제
exports.deleteVideo = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const id = req.path.split("/").pop();

      const doc = await db.collection("videos").doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "비디오를 찾을 수 없습니다" });
      }

      await db.collection("videos").doc(id).delete();

      res.json({ message: "비디오가 삭제되었습니다", id });
    } catch (error) {
      console.error("비디오 삭제 오류:", error);
      res.status(500).json({ error: "비디오 삭제 실패" });
    }
  });
});
