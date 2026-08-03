const crypto = require("crypto");
const { HttpError } = require("./httpErrors");

const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30);

const getSecret = () => {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET 환경변수가 필요합니다");
  }
  return secret;
};

const sign = (value) => crypto
  .createHmac("sha256", getSecret())
  .update(value)
  .digest("base64url");

const createAccessToken = (user) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const verifyAccessToken = (token) => {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) throw new HttpError(401, "로그인이 필요합니다");
  const expected = sign(payload);
  const valid = signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) throw new HttpError(401, "유효하지 않은 로그인 정보입니다");

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new HttpError(401, "유효하지 않은 로그인 정보입니다");
  }
  if (!decoded.sub || decoded.exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "로그인이 만료되었습니다");
  }
  return { userId: decoded.sub, role: decoded.role };
};

const requireAuth = (req, res, next) => {
  try {
    const header = req.get("authorization") || "";
    if (!header.startsWith("Bearer ")) throw new HttpError(401, "로그인이 필요합니다");
    req.auth = verifyAccessToken(header.slice(7));
    next();
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "인증에 실패했습니다" });
  }
};

module.exports = { createAccessToken, requireAuth, verifyAccessToken };
