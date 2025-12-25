const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkUsers() {
  const snapshot = await db.collection("users").get();

  console.log("현재 저장된 사용자 목록:\n");
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  userId: ${data.userId}`);
    console.log(`  title: ${data.title}`);
    console.log(`  password 존재: ${!!data.password}`);
    console.log("");
  });

  process.exit(0);
}

checkUsers();
