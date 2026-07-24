const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { ensureSupportDirectory, supportDirectory } = require('../supportStorage');
const {
  createSupportRequest,
  getSupportAttachment,
  getSupportRequest,
  getSupportRequests,
  markSupportRequestRead,
  sendSupportEmail,
  updateSupportRequestStatus,
  updateEmailResult,
} = require('../services/supportService');

const router = express.Router();
ensureSupportDirectory();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => callback(null, supportDirectory),
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { files: 5, fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith('image/')) return callback(null, true);
    return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'files'));
  },
});

const cleanupFiles = (files = []) => Promise.all(
  files.map((file) => fs.unlink(file.path).catch(() => {})),
);

router.post('/createSupportRequest', upload.array('files', 5), async (req, res) => {
  try {
    const result = await createSupportRequest({
      userId: req.body.userId,
      requestType: req.body.requestType,
      message: req.body.message,
      files: req.files || [],
    });
    let emailSent = false;
    try {
      await sendSupportEmail(result);
      emailSent = true;
      await updateEmailResult(result.request.id, true);
    } catch (emailError) {
      console.error('문의 메일 발송 오류:', emailError);
      await updateEmailResult(result.request.id, false, emailError).catch(() => {});
    }
    return res.status(201).json({
      id: result.request.id,
      status: result.request.status,
      emailSent,
      createdAt: result.request.created_at,
    });
  } catch (error) {
    await cleanupFiles(req.files);
    console.error('문의 접수 오류:', error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : '문의를 접수하지 못했습니다',
    });
  }
});

router.get('/supportRequests', async (req, res) => {
  try {
    const requests = await getSupportRequests(req.query.adminId);
    return res.json(requests);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : '알림을 불러오지 못했습니다',
    });
  }
});

router.get('/supportRequests/:id', async (req, res) => {
  try {
    const request = await getSupportRequest(req.params.id, req.query.adminId);
    return res.json(request);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : '접수 내용을 불러오지 못했습니다',
    });
  }
});

router.get('/supportRequests/:requestId/attachments/:attachmentId', async (req, res) => {
  try {
    const attachment = await getSupportAttachment(
      req.params.requestId,
      req.params.attachmentId,
      req.query.adminId,
    );
    res.type(attachment.mime_type);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`);
    return res.sendFile(path.join(supportDirectory, attachment.stored_path));
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : '첨부 이미지를 불러오지 못했습니다',
    });
  }
});

router.patch('/supportRequests/:id/read', async (req, res) => {
  try {
    const request = await markSupportRequestRead(req.params.id, req.body.adminId);
    return res.json(request);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : '알림 상태를 변경하지 못했습니다',
    });
  }
});

router.patch('/supportRequests/:id/status', async (req, res) => {
  try {
    const request = await updateSupportRequestStatus(req.params.id, req.body.status, req.body.adminId);
    return res.json(request);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : '처리 상태를 변경하지 못했습니다',
    });
  }
});

router.use((error, req, res, next) => {
  if (!(error instanceof multer.MulterError)) return next(error);
  cleanupFiles(req.files);
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? '첨부 이미지는 한 장당 5MB 이하여야 합니다'
    : error.code === 'LIMIT_FILE_COUNT'
      ? '이미지는 최대 5장까지 첨부할 수 있습니다'
      : '이미지 파일만 첨부할 수 있습니다';
  return res.status(400).json({ error: message });
});

module.exports = router;
