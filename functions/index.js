const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

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

      // 비밀번호 검증: 8자 이상, 영문+숫자+특수문자 포함
      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: "비밀번호는 8자 이상, 영문+숫자+특수문자를 포함해야 합니다" });
      }

      // 아이디 중복 체크
      const existingUser = await db.collection("users")
        .where("userId", "==", userId)
        .get();

      if (!existingUser.empty) {
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

      const now = new Date().toISOString();
      const userData = {
        userId,
        name,
        title,
        category,
        role,
        password: hashedPassword,
        watchedVideos: [],
        likedVideos: [],
        createdAt: now,
      };

      const docRef = await db.collection("users").add(userData);

      // 비밀번호 제외하고 반환
      const { password: _, ...userWithoutPassword } = userData;
      res.status(201).json({ id: docRef.id, ...userWithoutPassword });
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

      // 사용자 찾기
      const snapshot = await db.collection("users")
        .where("userId", "==", userId)
        .get();

      if (snapshot.empty) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 일치하지 않습니다" });
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      // 비밀번호 검증
      const isValidPassword = await bcrypt.compare(password, userData.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 일치하지 않습니다" });
      }

      // 비밀번호 제외하고 반환
      const { password: _, ...userWithoutPassword } = userData;
      res.json({ id: userDoc.id, ...userWithoutPassword });
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
      const doc = await db.collection("users").doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      const userData = doc.data();
      const { password: _, ...userWithoutPassword } = userData;
      res.json({ id: doc.id, ...userWithoutPassword });
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

      const userRef = db.collection("users").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      await userRef.update({
        name,
        title,
        category,
      });

      const updatedDoc = await userRef.get();
      const userData = updatedDoc.data();
      const { password: _, ...userWithoutPassword } = userData;
      res.json({ id: updatedDoc.id, ...userWithoutPassword });
    } catch (error) {
      console.error("사용자 정보 수정 오류:", error);
      res.status(500).json({ error: "사용자 정보 수정 실패" });
    }
  });
});

// 좋아요 토글
exports.toggleLike = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { userId, videoId } = req.body;

      if (!userId || !videoId) {
        return res.status(400).json({ error: "userId와 videoId가 필요합니다" });
      }

      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      const userData = userDoc.data();
      const likedVideos = userData.likedVideos || [];
      const isLiked = likedVideos.includes(videoId);

      if (isLiked) {
        // 좋아요 취소
        await userRef.update({
          likedVideos: admin.firestore.FieldValue.arrayRemove(videoId),
        });
      } else {
        // 좋아요 추가
        await userRef.update({
          likedVideos: admin.firestore.FieldValue.arrayUnion(videoId),
        });
      }

      res.json({ liked: !isLiked, videoId });
    } catch (error) {
      console.error("좋아요 토글 오류:", error);
      res.status(500).json({ error: "좋아요 처리 실패" });
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

      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      await userRef.update({
        watchedVideos: admin.firestore.FieldValue.arrayUnion(videoId),
      });

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
