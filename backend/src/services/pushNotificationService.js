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
  if (Boolean(process.env.VAPID_PUBLIC_KEY) !== Boolean(process.env.VAPID_PRIVATE_KEY)) {
    throw new Error("VAPID_PUBLIC_KEY와 VAPID_PRIVATE_KEY를 함께 설정해야 합니다");
  }
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  if (fs.existsSync(VAPID_KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_KEYS_PATH, "utf8"));
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("운영 환경에는 고정된 VAPID_PUBLIC_KEY와 VAPID_PRIVATE_KEY가 필요합니다");
  }

  const keys = webPush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(VAPID_KEYS_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(VAPID_KEYS_PATH, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600 });
  return keys;
};

const ensurePushSubscriptionSchema = async () => {
  await pgDb.query(`ALTER TABLE media ADD COLUMN IF NOT EXISTS upload_batch_id TEXT`);
  await pgDb.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pgDb.query(`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions (user_id)
  `);
  await pgDb.query(`
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
      media_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      comments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pgDb.query(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pgDb.query(`CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications (user_id, created_at DESC) WHERE read_at IS NULL`);
  await pgDb.query(`
    CREATE TABLE IF NOT EXISTS media_notification_batches (
      upload_batch_id TEXT NOT NULL,
      uploader_id TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (upload_batch_id, uploader_id, user_id)
    )
  `);
};

const saveInternalNotifications = async (userIds, notification) => {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(uniqueIds.map((userId) => pgDb.query(`
    INSERT INTO user_notifications (id, user_id, type, title, body, url)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [randomUUID(), userId, notification.type, notification.title, notification.body, notification.url])));
};

const listInternalNotifications = async (userId) => {
  const result = await pgDb.query(`
    SELECT id, type, title, body, url, created_at AS "createdAt"
    FROM user_notifications
    WHERE user_id = $1 AND read_at IS NULL
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId]);
  return result.rows;
};

const markInternalNotificationRead = async (userId, notificationId) => {
  const result = await pgDb.query(`
    UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, [notificationId, userId]);
  if (!result.rows.length) throw new HttpError(404, "알림을 찾을 수 없습니다");
  return { id: notificationId, read: true };
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
      created_at = CURRENT_TIMESTAMP,
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
  const [subscriptionResult, preferencesResult] = await Promise.all([
    pgDb.query("SELECT COUNT(*)::INTEGER AS count FROM push_subscriptions WHERE user_id = $1", [userId]),
    pgDb.query("SELECT media_enabled, comments_enabled FROM user_notification_preferences WHERE user_id = $1", [userId]),
  ]);
  const preferences = preferencesResult.rows[0];
  return {
    subscribed: subscriptionResult.rows[0].count > 0,
    deviceCount: subscriptionResult.rows[0].count,
    preferences: {
      media: preferences?.media_enabled ?? true,
      comments: preferences?.comments_enabled ?? true,
    },
  };
};

const saveNotificationPreferences = async (userId, preferences) => {
  const media = typeof preferences?.media === "boolean" ? preferences.media : true;
  const comments = typeof preferences?.comments === "boolean" ? preferences.comments : true;
  const result = await pgDb.query(`
    INSERT INTO user_notification_preferences (user_id, media_enabled, comments_enabled, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE
    SET media_enabled = EXCLUDED.media_enabled,
        comments_enabled = EXCLUDED.comments_enabled,
        updated_at = CURRENT_TIMESTAMP
    RETURNING media_enabled, comments_enabled
  `, [userId, media, comments]);
  return { preferences: { media: result.rows[0].media_enabled, comments: result.rows[0].comments_enabled } };
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
    ...(Number.isInteger(payload.badgeCount) ? { badgeCount: payload.badgeCount } : {}),
    ...(Number.isFinite(payload.badgeVersion) ? { badgeVersion: payload.badgeVersion } : {}),
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

const sendToUserIds = async (userIds, payload, preferenceType = null) => {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return { sent: 0, failed: 0 };
  const preferenceColumn = { media: "media_enabled", comments: "comments_enabled" }[preferenceType];
  const result = await pgDb.query(`
    SELECT ps.endpoint, ps.p256dh, ps.auth
    FROM push_subscriptions ps
    LEFT JOIN user_notification_preferences unp ON unp.user_id = ps.user_id
    WHERE ps.user_id = ANY($1::text[])
      ${preferenceColumn ? `AND COALESCE(unp.${preferenceColumn}, TRUE)` : ""}
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

const getUnreadNotificationCount = async (userId, mediaSince = null) => {
  const result = await pgDb.query(`
    SELECT (
      SELECT COUNT(DISTINCT COALESCE(m.upload_batch_id, m.id))::integer
      FROM media m
      WHERE (
        u.role IN ('admin', 'sub-admin')
        OR u.category = ANY(m.shared_with)
        OR m.uploaded_by = u.id
      )
        AND ($2::timestamptz IS NULL OR m.created_at > $2)
        AND NOT EXISTS (
          SELECT 1
          FROM user_watched_media uwm
          JOIN media watched_media ON watched_media.id = uwm.media_id
          WHERE uwm.user_id = u.id
            AND COALESCE(watched_media.upload_batch_id, watched_media.id)
              = COALESCE(m.upload_batch_id, m.id)
        )
    ) AS unread_count
    FROM users u
    WHERE u.id = $1
  `, [userId, mediaSince]);
  return result.rows[0]?.unread_count || 0;
};

const claimBatchRecipients = async ({ uploadBatchId, uploaderId, userIds }) => {
  if (!uploadBatchId) return userIds;
  const result = await pgDb.query(`
    INSERT INTO media_notification_batches (upload_batch_id, uploader_id, user_id)
    SELECT $1, $2, UNNEST($3::text[])
    ON CONFLICT DO NOTHING
    RETURNING user_id
  `, [String(uploadBatchId).slice(0, 100), uploaderId, userIds]);
  return result.rows.map(({ user_id: userId }) => userId);
};

const notifyNewMedia = async ({ media, uploader, uploadBatchId = null }) => {
  const audience = await pgDb.query(`
    SELECT id
    FROM users
    WHERE id <> $1
      AND (
        role IN ('admin', 'sub-admin')
        OR category = ANY($2::text[])
      )
  `, [uploader.id, media.shared_with || ["dad", "mom"]]);
  const audienceIds = await claimBatchRecipients({
    uploadBatchId,
    uploaderId: uploader.id,
    userIds: audience.rows.map(({ id }) => id),
  });
  if (audienceIds.length === 0) return { sent: 0, failed: 0 };
  const subscriptions = await pgDb.query(`
    SELECT ps.endpoint, ps.p256dh, ps.auth, ps.user_id, ps.created_at
    FROM push_subscriptions ps
    LEFT JOIN user_notification_preferences unp ON unp.user_id = ps.user_id
    WHERE ps.user_id = ANY($1::text[])
      AND COALESCE(unp.media_enabled, TRUE)
  `, [audienceIds]);
  const results = await Promise.all(subscriptions.rows.map(async (subscription) => {
    const badgeCount = await getUnreadNotificationCount(
      subscription.user_id,
      subscription.created_at,
    );
    return sendToSubscriptions([subscription], {
      title: "새로운 추억이 등록됐어요",
      body: "👶🏻호튜브에 새로운 사진 또는 영상이 올라왔어요",
      url: `/media/${encodeURIComponent(media.id)}`,
      tag: `media-${media.id}`,
      badgeCount,
      badgeVersion: new Date(media.created_at).getTime(),
    });
  }));
  return results.reduce((total, result) => ({
    sent: total.sent + result.sent,
    failed: total.failed + result.failed,
  }), { sent: 0, failed: 0 });
};

const notifyNewComment = async ({ mediaId, commenter, content }) => {
  const result = await pgDb.query(`
    SELECT DISTINCT u.id, m.title
    FROM media m
    JOIN users u ON (
      u.id = m.uploaded_by
      OR EXISTS (
        SELECT 1
        FROM comments c
        WHERE c.media_id = m.id AND c.user_id = u.id
      )
    )
    WHERE m.id = $1
      AND u.id <> $2
      AND (
        u.role IN ('admin', 'sub-admin')
        OR u.category = ANY(m.shared_with)
        OR m.uploaded_by = u.id
      )
  `, [mediaId, commenter.id]);
  const recipientIds = result.rows.map(({ id }) => id);
  if (recipientIds.length === 0) return { sent: 0, failed: 0 };
  const mediaTitle = result.rows[0]?.title;
  const preview = String(content).length > 70 ? `${String(content).slice(0, 67)}...` : String(content);
  const notification = {
    type: "comment",
    title: `${commenter.name || commenter.title || "가족"}님이 댓글을 남겼어요`,
    body: mediaTitle ? `${mediaTitle} · ${preview}` : preview,
    url: `/media/${encodeURIComponent(mediaId)}?focus=comments`,
  };
  await saveInternalNotifications(recipientIds, notification).catch((error) => {
    console.error("댓글 앱 내부 알림 저장 오류:", error);
  });
  const subscriptions = await pgDb.query(`
    SELECT ps.endpoint, ps.p256dh, ps.auth, ps.user_id, ps.created_at
    FROM push_subscriptions ps
    LEFT JOIN user_notification_preferences unp ON unp.user_id = ps.user_id
    WHERE ps.user_id = ANY($1::text[])
      AND COALESCE(unp.comments_enabled, TRUE)
  `, [recipientIds]);
  const results = await Promise.all(subscriptions.rows.map(async (subscription) => {
    const badgeCount = await getUnreadNotificationCount(subscription.user_id, subscription.created_at);
    return sendToSubscriptions([subscription], {
      ...notification,
      tag: `comment-${mediaId}`,
      badgeCount,
      badgeVersion: Date.now(),
    });
  }));
  return results.reduce((total, pushResult) => ({
    sent: total.sent + pushResult.sent,
    failed: total.failed + pushResult.failed,
  }), { sent: 0, failed: 0 });
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
  const notification = {
    type: "support_status",
    title: "문의 처리 상태가 변경됐어요",
    body: `문의 상태가 '${labels[status] || status}'(으)로 변경됐습니다.`,
    url: "/mypage",
  };
  await saveInternalNotifications([userId], notification);
  return sendToUserIds([userId], {
    ...notification,
    tag: `support-${requestId}`,
  });
};

module.exports = {
  ensurePushSubscriptionSchema,
  getPublicKey,
  getSubscriptionStatus,
  listInternalNotifications,
  markInternalNotificationRead,
  notifyNewComment,
  notifyNewMedia,
  notifySupportCreated,
  notifySupportStatus,
  removeSubscription,
  saveSubscription,
  saveNotificationPreferences,
  sendToUserIds,
};
