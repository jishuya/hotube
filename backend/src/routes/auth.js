const express = require("express");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const pgDb = require("../db");
const { mapUserRowToUser } = require("../responseMappers");
const { fetchUserById, fetchUserByLoginId } = require("../services/userService");
const {
  VALID_TITLES,
  VALID_CATEGORIES,
  ADMIN_TITLES,
  PASSWORD_REGEX,
  SUB_ADMIN_TITLES,
  USER_ID_REGEX,
} = require("../constants");

const router = express.Router();

router.post("/registerUser", async (req, res) => {
  try {
    const { userId, name, title, category, password } = req.body;

    if (!userId || !name || !title || !category || !password) {
      return res.status(400).json({ error: "모든 필드를 입력해주세요" });
    }

    if (!USER_ID_REGEX.test(userId)) {
      return res.status(400).json({ error: "아이디는 영문, 숫자 3-20자로 입력해주세요" });
    }

    if (!VALID_TITLES.includes(title)) {
      return res.status(400).json({ error: "유효하지 않은 호칭입니다" });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "유효하지 않은 카테고리입니다" });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({ error: "비밀번호는 5자 이상, 특수문자를 1개 이상 포함해야 합니다" });
    }

    const existingUser = await pgDb.query("SELECT id FROM users WHERE user_id = $1", [userId]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "이미 사용중인 아이디입니다" });
    }

    let role = "user";
    if (ADMIN_TITLES.includes(title)) {
      role = "admin";
    } else if (SUB_ADMIN_TITLES.includes(title)) {
      role = "sub-admin";
    }

    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);
    await pgDb.query(`
      INSERT INTO users (id, user_id, name, title, category, role, password, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, userId, name, title, category, role, hashedPassword, new Date().toISOString()]);

    res.status(201).json(mapUserRowToUser(await fetchUserById(id)));
  } catch (error) {
    console.error("회원가입 오류:", error);
    res.status(500).json({ error: "회원가입 실패" });
  }
});

router.post("/loginUser", async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요" });
    }

    const userData = await fetchUserByLoginId(userId);
    if (!userData) {
      return res.status(401).json({ error: "아이디 또는 비밀번호가 일치하지 않습니다" });
    }

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

router.get("/getUser/:id", async (req, res) => {
  try {
    const userData = await fetchUserById(req.params.id);
    if (!userData) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }

    res.json(mapUserRowToUser(userData));
  } catch (error) {
    console.error("사용자 조회 오류:", error);
    res.status(500).json({ error: "사용자 조회 실패" });
  }
});

router.put("/updateUser/:id", async (req, res) => {
  try {
    const { name, title, category, avatar } = req.body;

    if (!name || !title || !category) {
      return res.status(400).json({ error: "이름, 호칭, 카테고리를 입력해주세요" });
    }

    if (!VALID_TITLES.includes(title)) {
      return res.status(400).json({ error: "유효하지 않은 호칭입니다" });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "유효하지 않은 카테고리입니다" });
    }

    const existingUser = await pgDb.query("SELECT id FROM users WHERE id = $1", [req.params.id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }

    await pgDb.query(`
      UPDATE users
      SET name = $2, title = $3, category = $4, avatar = COALESCE($5, avatar)
      WHERE id = $1
    `, [req.params.id, name, title, category, avatar || null]);

    res.json(mapUserRowToUser(await fetchUserById(req.params.id)));
  } catch (error) {
    console.error("사용자 정보 수정 오류:", error);
    res.status(500).json({ error: "사용자 정보 수정 실패" });
  }
});

router.put("/changePassword/:id", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "현재 비밀번호와 새 비밀번호를 입력해주세요" });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({ error: "비밀번호는 5자 이상, 특수문자를 1개 이상 포함해야 합니다" });
    }

    const userData = await fetchUserById(req.params.id);
    if (!userData) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, userData.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "현재 비밀번호가 일치하지 않습니다" });
    }

    await pgDb.query(
      "UPDATE users SET password = $2 WHERE id = $1",
      [req.params.id, await bcrypt.hash(newPassword, 10)],
    );

    res.json({ message: "비밀번호가 변경되었습니다" });
  } catch (error) {
    console.error("비밀번호 변경 오류:", error);
    res.status(500).json({ error: "비밀번호 변경 실패" });
  }
});

module.exports = router;
