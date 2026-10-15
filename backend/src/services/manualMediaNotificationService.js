const { randomUUID } = require('crypto');
const pgDb = require('../db');
const { HttpError } = require('../httpErrors');
const { getDeveloperMode } = require('./developerModeService');
const push = require('./pushNotificationService');

const sendManualMediaNotification = async ({ actorId, groups, requestId }) => {
  const mode = await getDeveloperMode(actorId);
  if (!mode.enabled) throw new HttpError(403, '개발자 모드를 켠 상태에서만 알림을 보낼 수 있습니다');
  if (!Array.isArray(groups) || !groups.length || groups.length > 3
    || groups.some((group) => !['dad', 'mom', 'couple'].includes(group))) {
    throw new HttpError(400, '알림을 보낼 가족을 선택해주세요');
  }
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new HttpError(400, '올바른 알림 요청 번호가 필요합니다');
  }
  const selectedGroups = [...new Set(groups)].sort();
  // A network retry must not send the same announcement twice.
  const claimed = await pgDb.query(`
    INSERT INTO manual_media_notifications (id, actor_id, groups)
    VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING id
  `, [requestId, actorId, selectedGroups]);
  if (!claimed.rows.length) {
    const previous = await pgDb.query('SELECT actor_id, groups, result FROM manual_media_notifications WHERE id = $1', [requestId]);
    const row = previous.rows[0];
    if (!row || row.actor_id !== actorId || JSON.stringify(row.groups) !== JSON.stringify(selectedGroups)) {
      throw new HttpError(409, '다른 알림 요청에 사용된 번호입니다');
    }
    if (row.result) return { ...row.result, alreadySent: true };
    throw new HttpError(409, '이미 처리 중이거나 발송 결과를 확인할 수 없는 요청입니다. 중복 발송을 막기 위해 다시 보내지 않았습니다');
  }

  const audience = await pgDb.query(`
    SELECT id FROM users
    WHERE id <> $1 AND (
      (role IN ('admin', 'sub-admin') AND 'couple' = ANY($2::text[]))
      OR (role NOT IN ('admin', 'sub-admin') AND category = ANY($2::text[]))
    )
  `, [actorId, selectedGroups]);
  const userIds = audience.rows.map((row) => row.id);
  const notification = {
    type: 'media_announcement',
    title: '새로운 추억이 등록됐어요',
    body: '👶🏻호튜브에 새로운 사진 또는 영상이 올라왔어요',
    url: '/album',
    tag: `manual-media-${requestId}`,
  };
  // Save one announcement per recipient, without releasing suppressed upload alerts.
  if (userIds.length) {
    await pgDb.query(`
      INSERT INTO user_notifications (id, user_id, type, title, body, url)
      SELECT ids.id, ids.user_id, $3, $4, $5, $6
      FROM UNNEST($1::uuid[], $2::text[]) AS ids(id, user_id)
    `, [userIds.map(() => randomUUID()), userIds, notification.type, notification.title, notification.body, notification.url]);
  }
  const delivery = await push.sendToUserIds(userIds, notification, 'media');
  const result = { ...delivery, recipients: userIds.length };
  await pgDb.query('UPDATE manual_media_notifications SET result = $2::jsonb WHERE id = $1', [requestId, JSON.stringify(result)]);
  return result;
};

module.exports = { sendManualMediaNotification };
