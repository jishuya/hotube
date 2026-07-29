const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const webPush = require("web-push");
const pgDb = require("../db");
const { HttpError } = require("../httpErrors");
const { fetchUserById } = require("./userService");

const DEFAULT_VAPID_PATH = path.join(os.homedir(), ".config", "hotube", "vapid-keys.json");
const VAPID_KEYS_PATH = process.env.VAPID_KEYS_PATH || DEFAULT_VAPID_PATH;

let configuredPublicKey = null;

const loadVapidKeys = () => {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  if (fs.existsSync(VAPID_KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_KEYS_PATH, "utf8"));
  }

  const keys = webPush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(VAPID_KEYS_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(VAPID_KEYS_PATH, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600 });
  return keys;
};

const configureWebPush = () => {
  if (configuredPublicKey) return configuredPublicKey;
  const keys = loadVapidKeys();
  const subject = process.env.VAPID_SUBJECT
    || `mailto:${process.env.SUPPORT_EMAIL_TO || "admin@hotube.net"}`;
  webPush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  configuredPublicKey = keys.publicKey;
  return configuredPublicKey;
};

const getPublicKey = () => configureWebPush();

const validateSubscription = (subscription) => {
  const endpoint = String(subscription?.endpoint || "").trim();
  const p256dh = String(subscription?.keys?.p256dh || "").trim();
  const auth = String(subscription?.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth || !endpoint.startsWith("https://")) {
    throw new HttpError(400, "올바른 푸시 구독 정보가 필요합니다");
  }
  return { endpoint, p256dh, auth };
};

const saveSubscription = async ({ userId, subscription, userAgent }) => {
  const user = await fetchUserById(userId);
  if (!user) throw new HttpError(404, "사용자를 찾을 수 없습니다");
  const normalized = validateSubscription(subscription);
  await pgDb.query(`
    INSERT INTO push_subscriptions (
      id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (endpoint) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      updated_at = CURRENT_TIMESTAMP
  `, [
    randomUUID(),
    user.id,
    normalized.endpoint,
    normalized.p256dh,
    normalized.auth,
    String(userAgent || "").slice(0, 500) || null,
  ]);
  return { subscribed: true };
};

const removeSubscription = async ({ userId, endpoint }) => {
  await pgDb.query(
    "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
    [userId, endpoint],
  );
  return { subscribed: false };
};

const getSubscriptionStatus = async (userId) => {
  const result = await pgDb.query(
    "SELECT COUNT(*)::INTEGER AS count FROM push_subscriptions WHERE user_id = $1",
    [userId],
  );
  return { subscribed: result.rows[0].count > 0, deviceCount: result.rows[0].count };
};

const deleteExpiredSubscription = async (endpoint) => {
  await pgDb.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
};

const sendToSubscriptions = async (subscriptions, payload) => {
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };
  configureWebPush();
  const message = JSON.stringify({
    title: payload.title || "HoTube",
    body: payload.body || "새로운 소식이 있습니다.",
    url: payload.url || "/",
    tag: payload.tag || "hotube",
    icon: payload.icon || "/logo.png",
    badge: payload.badge || "/logo.png",
  });
  const results = await Promise.allSettled(subscriptions.map(async (row) => {
    try {
      await webPush.sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }, message, { TTL: 60 * 60 });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await deleteExpiredSubscription(row.endpoint);
      }
      throw error;
    }
  }));
  return {
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
};

const sendToUserIds = async (userIds, payload) => {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return { sent: 0, failed: 0 };
  const result = await pgDb.query(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = ANY($1::text[])
  `, [uniqueIds]);
  return sendToSubscriptions(result.rows, payload);
};

const sendToRoles = async (roles, payload) => {
  const result = await pgDb.query(`
    SELECT ps.endpoint, ps.p256dh, ps.auth
    FROM push_subscriptions ps
    JOIN users u ON u.id = ps.user_id
    WHERE u.role = ANY($1::text[])
  `, [roles]);
  return sendToSubscriptions(result.rows, payload);
};

const notifyNewMedia = async ({ media, uploader }) => {
  const audience = await pgDb.query(`
    SELECT id
    FROM users
    WHERE id <> $1
      AND (
        role IN ('admin', 'sub-admin')
        OR category = ANY($2::text[])
      )
  `, [uploader.id, media.shared_with || ["dad", "mom"]]);
  return sendToUserIds(audience.rows.map((row) => row.id), {
    title: "새로운 추억이 등록됐어요",
    body: `${uploader.name || uploader.title || "가족"}님이 '${media.title}'을(를) 올렸어요.`,
    url: `/media/${encodeURIComponent(media.id)}`,
    tag: `media-${media.id}`,
  });
};

const notifyNewComment = async ({ mediaId, commenter, content }) => {
  const mediaResult = await pgDb.query(
    "SELECT id, title, uploaded_by FROM media WHERE id = $1",
    [mediaId],
  );
  const media = mediaResult.rows[0];
  if (!media?.uploaded_by || media.uploaded_by === commenter.id) return { sent: 0, failed: 0 };
  const preview = String(content).length > 70 ? `${String(content).slice(0, 67)}...` : String(content);
  return sendToUserIds([media.uploaded_by], {
    title: `${commenter.name || commenter.title || "가족"}님이 댓글을 남겼어요`,
    body: preview,
    url: `/media/${encodeURIComponent(media.id)}`,
    tag: `comment-${media.id}`,
  });
};

const notifySupportCreated = async ({ request, user }) => sendToRoles(["admin"], {
  title: "새 고객의 소리가 접수됐어요",
  body: `${user.name || user.title || user.user_id}: ${String(request.message).slice(0, 80)}`,
  url: "/support-management",
  tag: `support-${request.id}`,
});

const notifySupportStatus = async ({ requestId, status }) => {
  const result = await pgDb.query(
    "SELECT user_id FROM support_requests WHERE id = $1",
    [requestId],
  );
  const userId = result.rows[0]?.user_id;
  if (!userId) return { sent: 0, failed: 0 };
  const labels = { received: "접수", in_progress: "처리 중", resolved: "처리 완료" };
  return sendToUserIds([userId], {
    title: "문의 처리 상태가 변경됐어요",
    body: `문의 상태가 '${labels[status] || status}'(으)로 변경됐습니다.`,
    url: "/mypage",
    tag: `support-${requestId}`,
  });
};

module.exports = {
  getPublicKey,
  getSubscriptionStatus,
  notifyNewComment,
  notifyNewMedia,
  notifySupportCreated,
  notifySupportStatus,
  removeSubscription,
  saveSubscription,
  sendToUserIds,
};
