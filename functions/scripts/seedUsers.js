const admin = require("firebase-admin");

// 서비스 계정 키 파일이 있으면 사용, 없으면 기본 인증 사용
try {
  const serviceAccount = require("../serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch {
  // Firebase CLI로 로그인된 상태에서 실행
  admin.initializeApp({
    projectId: "hotube-9e9dd",
  });
}

const db = admin.firestore();

// "12345!" 를 bcrypt로 해시한 값
const HASHED_PASSWORD = "$2b$10$GZXDrrRkPy2iAT2CwapROeh07rZeaEKALMEMIRq/qMQZdshGYQQuO";

// 사용자 데이터
const users = [
  // 관리자 (admin)
  { userId: "아빠", name: "아빠", title: "아빠", category: "dad", role: "admin" },
  { userId: "엄마", name: "엄마", title: "엄마", category: "mom", role: "admin" },

  // 부관리자 (sub-admin)
  { userId: "수호", name: "수호", title: "수호", category: "dad", role: "sub-admin" },

  // 아빠 가족 (dad)
  { userId: "친할아버지", name: "친할아버지", title: "친할아버지", category: "dad", role: "user" },
  { userId: "친할머니", name: "친할머니", title: "친할머니", category: "dad", role: "user" },
  { userId: "고모", name: "고모", title: "고모", category: "dad", role: "user" },
  { userId: "고모부", name: "고모부", title: "고모부", category: "dad", role: "user" },

  // 엄마 가족 (mom)
  { userId: "외할아버지", name: "외할아버지", title: "외할아버지", category: "mom", role: "user" },
  { userId: "외할머니", name: "외할머니", title: "외할머니", category: "mom", role: "user" },
  { userId: "이모", name: "이모", title: "이모", category: "mom", role: "user" },
  { userId: "이모부", name: "이모부", title: "이모부", category: "mom", role: "user" },
  { userId: "외삼촌", name: "외삼촌", title: "외삼촌", category: "mom", role: "user" },

  // 기타 (etc)
  { userId: "기타", name: "기타", title: "기타", category: "etc", role: "user" },
];

async function seedUsers() {
  const now = new Date().toISOString();

  console.log("사용자 생성 시작...\n");

  for (const user of users) {
    try {
      // 이미 존재하는지 확인
      const existing = await db.collection("users")
        .where("userId", "==", user.userId)
        .get();

      if (!existing.empty) {
        console.log(`⏭️  ${user.userId} - 이미 존재함 (건너뜀)`);
        continue;
      }

      const userData = {
        ...user,
        password: HASHED_PASSWORD,
        watchedVideos: [],
        likedVideos: [],
        createdAt: now,
      };

      await db.collection("users").add(userData);
      console.log(`✅ ${user.userId} (${user.role}) - 생성 완료`);
    } catch (error) {
      console.error(`❌ ${user.userId} - 생성 실패:`, error.message);
    }
  }

  console.log("\n모든 사용자 생성 완료!");
  console.log("임시 비밀번호: 12345!");
  process.exit(0);
}

seedUsers();
