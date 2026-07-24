const path = require('path');
const { randomUUID } = require('crypto');
const nodemailer = require('nodemailer');
const pgDb = require('../db');
const { HttpError } = require('../httpErrors');
const { fetchUserById } = require('./userService');
const { supportDirectory } = require('../supportStorage');

const SUPPORT_RECIPIENT = process.env.SUPPORT_EMAIL_TO || 'jishuya3015@gmail.com';

const normalizeMessage = (value) => {
  const message = String(value || '').trim();
  if (!message) throw new HttpError(400, '문의 내용을 입력해주세요');
  if (message.length > 5000) throw new HttpError(400, '문의 내용은 5000자 이하여야 합니다');
  return message;
};

const createSupportRequest = async ({ userId, requestType, message, files }) => {
  if (!['inquiry', 'bug'].includes(requestType)) throw new HttpError(400, '올바른 문의 유형이 필요합니다');
  const user = await fetchUserById(userId);
  if (!user) throw new HttpError(404, '사용자를 찾을 수 없습니다');
  const normalizedMessage = normalizeMessage(message);
  const requestId = randomUUID();
  let client;
  try {
    client = await pgDb.getClient();
    await client.query('BEGIN');
    const requestResult = await client.query(`
      INSERT INTO support_requests (id, user_id, request_type, message)
      VALUES ($1, $2, $3, $4)
      RETURNING id, request_type, message, status, email_sent, created_at
    `, [requestId, user.id, requestType, normalizedMessage]);
    for (const file of files) {
      await client.query(`
        INSERT INTO support_request_attachments (
          id, request_id, original_name, stored_path, mime_type, size_bytes
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [randomUUID(), requestId, file.originalname, file.filename, file.mimetype, file.size]);
    }
    await client.query('COMMIT');
    return { request: requestResult.rows[0], user, files };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client?.release();
  }
};

const sendSupportEmail = async ({ request, user, files }) => {
  const smtpUser = process.env.SUPPORT_SMTP_USER;
  const smtpPassword = process.env.SUPPORT_SMTP_APP_PASSWORD;
  if (!smtpUser || !smtpPassword) throw new Error('Gmail SMTP 환경변수가 설정되지 않았습니다');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPassword },
  });
  const typeLabel = request.request_type === 'bug' ? '오류 리포트' : '문의';
  await transporter.sendMail({
    from: `HoTube 고객센터 <${smtpUser}>`,
    to: SUPPORT_RECIPIENT,
    subject: `[HoTube ${typeLabel}] ${user.title || user.name || user.user_id}`,
    text: [
      `접수 번호: ${request.id}`,
      `유형: ${typeLabel}`,
      `작성자: ${user.name || '-'} (${user.title || '-'}, ${user.user_id})`,
      `접수 시간: ${new Date(request.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
      '',
      request.message,
    ].join('\n'),
    attachments: files.map((file) => ({
      filename: file.originalname,
      path: path.join(supportDirectory, file.filename),
      contentType: file.mimetype,
    })),
  });
};

const updateEmailResult = async (requestId, emailSent, error = null) => {
  await pgDb.query(`
    UPDATE support_requests
    SET email_sent = $2, email_error = $3
    WHERE id = $1
  `, [requestId, emailSent, error ? String(error.message || error).slice(0, 1000) : null]);
};

const requireAdmin = async (userId) => {
  const user = await fetchUserById(userId);
  if (!user || user.role !== 'admin') throw new HttpError(403, '관리자만 확인할 수 있습니다');
  return user;
};

const getSupportRequests = async (adminId) => {
  await requireAdmin(adminId);
  const result = await pgDb.query(`
    SELECT
      sr.id,
      sr.request_type,
      sr.message,
      sr.status,
      sr.email_sent,
      sr.created_at,
      u.name AS user_name,
      u.title AS user_title,
      u.user_id AS login_id,
      COUNT(sra.id)::INTEGER AS attachment_count
    FROM support_requests sr
    LEFT JOIN users u ON u.id = sr.user_id
    LEFT JOIN support_request_attachments sra ON sra.request_id = sr.id
    GROUP BY sr.id, u.id
    ORDER BY sr.created_at DESC
  `);
  return result.rows;
};

const markSupportRequestRead = async (requestId, adminId) => {
  await requireAdmin(adminId);
  const result = await pgDb.query(`
    UPDATE support_requests
    SET status = CASE WHEN status = 'received' THEN 'in_progress' ELSE status END
    WHERE id = $1
    RETURNING id, status
  `, [requestId]);
  if (!result.rows[0]) throw new HttpError(404, '접수 내용을 찾을 수 없습니다');
  return result.rows[0];
};

const updateSupportRequestStatus = async (requestId, status, adminId) => {
  await requireAdmin(adminId);
  if (!['received', 'in_progress', 'resolved'].includes(status)) {
    throw new HttpError(400, '올바른 처리 상태가 필요합니다');
  }
  const result = await pgDb.query(`
    UPDATE support_requests
    SET status = $2
    WHERE id = $1
    RETURNING id, status
  `, [requestId, status]);
  if (!result.rows[0]) throw new HttpError(404, '접수 내용을 찾을 수 없습니다');
  return result.rows[0];
};

const getSupportRequest = async (requestId, adminId) => {
  await requireAdmin(adminId);
  const requestResult = await pgDb.query(`
    SELECT
      sr.id,
      sr.request_type,
      sr.message,
      sr.status,
      sr.email_sent,
      sr.created_at,
      u.name AS user_name,
      u.title AS user_title,
      u.user_id AS login_id
    FROM support_requests sr
    LEFT JOIN users u ON u.id = sr.user_id
    WHERE sr.id = $1
  `, [requestId]);
  if (!requestResult.rows[0]) throw new HttpError(404, '접수 내용을 찾을 수 없습니다');
  const attachmentsResult = await pgDb.query(`
    SELECT id, original_name, mime_type, size_bytes
    FROM support_request_attachments
    WHERE request_id = $1
    ORDER BY created_at, id
  `, [requestId]);
  return { ...requestResult.rows[0], attachments: attachmentsResult.rows };
};

const getSupportAttachment = async (requestId, attachmentId, adminId) => {
  await requireAdmin(adminId);
  const result = await pgDb.query(`
    SELECT stored_path, original_name, mime_type
    FROM support_request_attachments
    WHERE id = $1 AND request_id = $2
  `, [attachmentId, requestId]);
  if (!result.rows[0]) throw new HttpError(404, '첨부 이미지를 찾을 수 없습니다');
  return result.rows[0];
};

module.exports = {
  createSupportRequest,
  getSupportAttachment,
  getSupportRequest,
  getSupportRequests,
  markSupportRequestRead,
  sendSupportEmail,
  updateSupportRequestStatus,
  updateEmailResult,
};
